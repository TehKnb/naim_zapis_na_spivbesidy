/**
 * Відповідь голосового агента і перерозподіл місць (лише сервер).
 *
 * Бронювання (n8n) створює запис Reserved — це бронь, кандидат час ще не підтвердив.
 * Агент дзвонить і надсилає результат на /api/webhooks/voice-agent:
 *   confirmed = true  → Reserved стає Confirmed (у KeyCRM нічого не змінюємо — статус переводить агент);
 *   confirmed = false → бронь знімається (Cancelled), поле співбесіди в картці очищається,
 *                       а звільнене місце отримують ліди з пізнішою бронню (rebalancePipeline).
 */
import { ApiFailure } from './api-failure';
import { REBALANCE_MAX_CARD_CHECKS, REBALANCE_MAX_MOVES, REBALANCE_MIN_LEAD_MINUTES, SELECTED_STATUS_ID } from './config';
import { query, transaction } from './db';
import { clearInterviewTime, fetchCard, writeInterviewTime } from './keycrm';

export type AgentResultCode = 'confirmed' | 'already_confirmed' | 'cancelled' | 'already_cancelled' | 'no_booking';

export interface AgentInput {
  cardId: string;
  confirmed: boolean;
  statusId: number | null;
  payload: unknown;
}

export interface AgentResult {
  ok: true;
  result: AgentResultCode;
  card_id: string;
  message: string;
  session?: { id: string; name: string; start_date: string };
  keycrm?: 'Synced' | 'Failed';
  warning?: string;
}

interface Row {
  id: number;
  keycrm_id: string;
  session_id: string;
  registration_status: string;
  keycrm_sync: string;
  cancel_reason: string;
  session_name: string;
  start_date: Date;
  pipeline_name: string;
}

const errText = (e: unknown) => `${new Date().toISOString()} KeyCRM: ${e instanceof Error ? e.message : String(e)}`.slice(0, 1600);
const sessionView = (r: Row) => ({ id: r.session_id, name: r.session_name, start_date: new Date(r.start_date).toISOString() });

/** Обробляє відповідь агента. Повторний запит з тими самими даними безпечний. */
export async function handleAgentResponse(input: AgentInput): Promise<{ result: AgentResult; freedPipelines: string[] }> {
  const { cardId, confirmed } = input;
  const decided = await transaction(async (tx) => {
    const rows = (
      await tx.query<Row>(
        `SELECT p.id, p.keycrm_id, p.session_id, p.registration_status, p.keycrm_sync, p.cancel_reason, s.session_name, s.start_date, s.pipeline_name
           FROM interview_participants p JOIN interview_sessions s USING (session_id)
          WHERE p.keycrm_id = $1
          ORDER BY p.id
          FOR UPDATE OF p`,
        [cardId],
      )
    ).rows;
    const active = rows.filter((r) => r.registration_status !== 'Cancelled');
    const last = rows[rows.length - 1];

    if (confirmed) {
      if (!active.length) return { code: 'no_booking' as const, rows };
      const toConfirm = active.filter((r) => r.registration_status === 'Reserved');
      if (toConfirm.length) {
        await tx.query("UPDATE interview_participants SET registration_status = 'Confirmed', confirmed_at = now() WHERE id = ANY($1::int[])", [toConfirm.map((r) => r.id)]);
      }
      return { code: toConfirm.length ? ('confirmed' as const) : ('already_confirmed' as const), rows: active };
    }

    if (!active.length) {
      // Повтор відмови: бронь уже знято; якщо минулого разу KeyCRM не очистився — повторимо очищення
      if (last && last.cancel_reason === 'agent_declined') return { code: 'already_cancelled' as const, rows: [last], retryClear: last.keycrm_sync !== 'Synced' };
      return { code: 'no_booking' as const, rows };
    }
    const sessionIds = [...new Set(active.map((r) => r.session_id))];
    await tx.query('SELECT 1 FROM interview_sessions WHERE session_id = ANY($1::text[]) ORDER BY id FOR UPDATE', [sessionIds]);
    await tx.query(
      `UPDATE interview_participants
          SET registration_status = 'Cancelled', cancel_reason = 'agent_declined', keycrm_sync = 'Pending', sync_error = ''
        WHERE id = ANY($1::int[])`,
      [active.map((r) => r.id)],
    );
    // Звільнене місце: заповнена сесія знову відкрита (закриту вручну не чіпаємо)
    await tx.query("UPDATE interview_sessions SET status = 'Open' WHERE session_id = ANY($1::text[]) AND status = 'Full'", [sessionIds]);
    return { code: 'cancelled' as const, rows: active, retryClear: true };
  });

  const main = decided.rows[decided.rows.length - 1];
  const base = { ok: true as const, card_id: cardId, ...(main && decided.code !== 'no_booking' ? { session: sessionView(main) } : {}) };

  if (decided.code === 'no_booking') {
    return { result: { ...base, result: 'no_booking', message: 'Для цієї картки немає активного бронювання — нічого не змінено.' }, freedPipelines: [] };
  }
  if (decided.code === 'confirmed' || decided.code === 'already_confirmed') {
    const message = decided.code === 'confirmed' ? 'Співбесіду підтверджено.' : 'Співбесіду вже було підтверджено раніше.';
    return { result: { ...base, result: decided.code, message }, freedPipelines: [] };
  }

  // Відмова: очищаємо поле співбесіди в KeyCRM
  let keycrm: 'Synced' | 'Failed' | undefined;
  let warning: string | undefined;
  if (decided.retryClear) {
    const ids = decided.rows.map((r) => r.id);
    try {
      await clearInterviewTime(cardId);
      keycrm = 'Synced';
      await query("UPDATE interview_participants SET keycrm_sync = 'Synced', sync_error = '' WHERE id = ANY($1::int[])", [ids]);
    } catch (e) {
      if (e instanceof ApiFailure) throw e;
      keycrm = 'Failed';
      warning = `Бронь знято, але поле співбесіди в KeyCRM не очищено. ${errText(e)}`;
      await query("UPDATE interview_participants SET keycrm_sync = 'Failed', sync_error = $2 WHERE id = ANY($1::int[])", [ids, errText(e)]);
    }
  } else {
    keycrm = 'Synced';
  }
  const message = decided.code === 'cancelled' ? 'Бронь знято, місце звільнено.' : 'Бронь уже було знято раніше.';
  return {
    result: { ...base, result: decided.code, message, keycrm, ...(warning ? { warning } : {}) },
    freedPipelines: decided.code === 'cancelled' ? [...new Set(decided.rows.map((r) => r.pipeline_name).filter(Boolean))] : [],
  };
}

/** Запис у журнал запитів агента. Помилка журналу не ламає обробку. */
export async function logAgentEvent(e: { cardId: string; confirmed: boolean | null; statusId: number | null; payload: unknown; result: string; details?: unknown }) {
  try {
    await query(
      'INSERT INTO interview_agent_events (keycrm_id, confirmed, status_id, payload, result, details) VALUES ($1, $2, $3, $4, $5, $6)',
      [e.cardId, e.confirmed, e.statusId, JSON.stringify(e.payload ?? {}), e.result, JSON.stringify(e.details ?? {})],
    );
  } catch (err) {
    console.error('[agent] не вдалося записати журнал:', err instanceof Error ? err.message : err);
  }
}

// ---------- Перерозподіл ----------

export interface Move {
  participantId: number;
  cardId: string;
  from: { sessionId: string; start: string };
  to: { sessionId: string; start: string };
  keycrm: 'Synced' | 'Failed';
  error?: string;
}

interface TargetRow {
  session_id: string;
  start_date: Date;
  max_participants: number;
  n: number;
}

interface CandRow {
  id: number;
  keycrm_id: string;
  session_id: string;
  start_date: Date;
}

/**
 * Заповнює вільні місця у ближчих сесіях воронки лідами з пізнішою бронню.
 * Переносяться лише брони (Reserved) лідів, які зараз у статусі «Відібрано» (агент їм ще не дзвонив).
 * Черга — за порядком бронювання (менший ID запису — раніше). Ланцюжком: місце, звільнене перенесеним лідом,
 * так само отримує наступний лід з ще пізнішої сесії. Кожне перенесення перевіряється в окремій транзакції.
 */
export async function rebalancePipeline(pipelineName: string): Promise<Move[]> {
  const moves: Move[] = [];
  const ineligible = new Set<number>(); // не в «Відібрано» або картки немає — у цьому запуску не пропонуємо
  const unfillable = new Set<string>(); // сесії, для яких немає кого переносити
  let checks = 0;

  while (moves.length < REBALANCE_MAX_MOVES) {
    const targets = await query<TargetRow>(
      `SELECT s.session_id, s.start_date, s.max_participants, COALESCE(c.n, 0)::int AS n
         FROM interview_sessions s
         LEFT JOIN (SELECT session_id, count(*) AS n FROM interview_participants WHERE registration_status <> 'Cancelled' GROUP BY session_id) c USING (session_id)
        WHERE s.pipeline_name = $1 AND s.status IN ('Open', 'Full')
          AND s.start_date > now() + make_interval(mins => $2)
          AND COALESCE(c.n, 0) < s.max_participants
        ORDER BY s.start_date, s.id`,
      [pipelineName, REBALANCE_MIN_LEAD_MINUTES],
    );
    const target = targets.find((t) => !unfillable.has(t.session_id));
    if (!target) break;

    const cands = await query<CandRow>(
      `SELECT p.id, p.keycrm_id, p.session_id, s.start_date
         FROM interview_participants p JOIN interview_sessions s USING (session_id)
        WHERE s.pipeline_name = $1 AND p.registration_status = 'Reserved'
          AND s.start_date > $2 AND NOT (p.id = ANY($3::int[]))
        ORDER BY p.id`,
      [pipelineName, target.start_date, [...ineligible]],
    );

    let moved: Move | null = null;
    for (const c of cands) {
      if (checks >= REBALANCE_MAX_CARD_CHECKS) break;
      checks++;
      let card: Awaited<ReturnType<typeof fetchCard>>;
      try {
        card = await fetchCard(c.keycrm_id);
      } catch (e) {
        console.error(`[rebalance] картка ${c.keycrm_id}: ${e instanceof Error ? e.message : e}`);
        ineligible.add(c.id);
        continue;
      }
      if (!card || Number(card.status_id) !== SELECTED_STATUS_ID) {
        ineligible.add(c.id);
        continue;
      }
      moved = await moveParticipant(c.id, c.session_id, target.session_id);
      if (moved) break;
    }
    if (!moved) {
      if (checks >= REBALANCE_MAX_CARD_CHECKS) break;
      unfillable.add(target.session_id);
      continue;
    }
    moves.push(await syncMovedCard(moved));
  }
  return moves;
}

/** Переносить бронь в іншу сесію, якщо все ще можна (перевірка під блокуванням обох сесій). */
async function moveParticipant(participantId: number, fromId: string, toId: string): Promise<Move | null> {
  return transaction(async (tx) => {
    const sessions = (
      await tx.query<{ session_id: string; start_date: Date; max_participants: number; status: string; pipeline_name: string }>(
        'SELECT session_id, start_date, max_participants, status, pipeline_name FROM interview_sessions WHERE session_id = ANY($1::text[]) ORDER BY id FOR UPDATE',
        [[fromId, toId]],
      )
    ).rows;
    const from = sessions.find((s) => s.session_id === fromId);
    const to = sessions.find((s) => s.session_id === toId);
    if (!from || !to) return null;
    const p = (
      await tx.query<{ id: number; keycrm_id: string; session_id: string; registration_status: string }>(
        'SELECT id, keycrm_id, session_id, registration_status FROM interview_participants WHERE id = $1 FOR UPDATE',
        [participantId],
      )
    ).rows[0];
    const cutoff = Date.now() + REBALANCE_MIN_LEAD_MINUTES * 60_000;
    const toStart = new Date(to.start_date).getTime();
    if (!p || p.session_id !== fromId || p.registration_status !== 'Reserved') return null;
    if (to.status === 'Closed' || to.pipeline_name !== from.pipeline_name || toStart <= cutoff || toStart >= new Date(from.start_date).getTime()) return null;
    const n = (await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM interview_participants WHERE session_id = $1 AND registration_status <> 'Cancelled'", [toId])).rows[0].n;
    if (n >= to.max_participants) return null;

    await tx.query("UPDATE interview_participants SET session_id = $2, keycrm_sync = 'Pending', sync_error = '' WHERE id = $1", [participantId, toId]);
    await tx.query("UPDATE interview_sessions SET status = 'Full' WHERE session_id = $1 AND status = 'Open' AND $2 >= max_participants", [toId, n + 1]);
    await tx.query("UPDATE interview_sessions SET status = 'Open' WHERE session_id = $1 AND status = 'Full'", [fromId]);
    return {
      participantId,
      cardId: p.keycrm_id,
      from: { sessionId: fromId, start: new Date(from.start_date).toISOString() },
      to: { sessionId: toId, start: new Date(to.start_date).toISOString() },
      keycrm: 'Synced' as const,
    };
  });
}

/** Пише новий час у картку. Якщо за цей час запис перенесли ще раз — пише актуальний. */
async function syncMovedCard(m: Move): Promise<Move> {
  let start = m.to.start;
  for (let i = 0; i < 3; i++) {
    try {
      await writeInterviewTime(m.cardId, start);
    } catch (e) {
      if (e instanceof ApiFailure) throw e;
      await query("UPDATE interview_participants SET keycrm_sync = 'Failed', sync_error = $2 WHERE id = $1", [m.participantId, errText(e)]);
      return { ...m, keycrm: 'Failed', error: errText(e) };
    }
    const [now] = await query<{ start_date: Date; registration_status: string }>(
      'SELECT s.start_date, p.registration_status FROM interview_participants p JOIN interview_sessions s USING (session_id) WHERE p.id = $1',
      [m.participantId],
    );
    if (!now || now.registration_status === 'Cancelled' || new Date(now.start_date).toISOString() === start) break;
    start = new Date(now.start_date).toISOString();
  }
  await query("UPDATE interview_participants SET keycrm_sync = 'Synced', sync_error = '' WHERE id = $1 AND registration_status <> 'Cancelled'", [m.participantId]);
  return { ...m, to: { ...m.to, start } };
}
