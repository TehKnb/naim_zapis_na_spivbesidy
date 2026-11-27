/**
 * Бізнес-логіка співбесід поверх PostgreSQL (перенесено з n8n workflow «Адмінпанель: API керування співбесідами»).
 * Правила й коди помилок ті самі, що були в n8n, тож фронтенд не змінювався.
 * Лише сервер: викликається з route handlers після перевірки авторизації.
 */
import { DateTime } from 'luxon';
import { ApiFailure } from './api-failure';
import { CANDIDATE_STATUS_ID, INTERVIEW_FIELD_UUID } from './config';
import { query, transaction, type Tx } from './db';
import { cardField, cardName, cardPhone, cardPipelineId, fetchCandidateCards, fetchCard, interviewIso, KeycrmError, writeInterviewTime } from './keycrm';
import { TZ } from './time';
import type { AddParticipantResult, Candidate, Participant, Pipeline, Responsible, Session, SessionResponsible, SessionStatus } from './types';

// ---------- Рядки таблиць ----------

interface SessionRow {
  session_id: string;
  session_name: string;
  start_date: Date;
  max_participants: number;
  status: SessionStatus;
  pipeline_id: number | null;
  pipeline_name: string;
  responsible_ids: number[];
  created_at: Date;
  updated_at: Date;
}

interface ParticipantRow {
  id: number;
  keycrm_id: string;
  name: string;
  phone: string;
  session_id: string;
  registration_status: string;
  keycrm_sync: string;
  sync_error: string;
  confirmed_at: Date | null;
  cancel_reason: string;
  created_at: Date;
}

interface ResponsibleRow {
  employee_id: number;
  name: string;
  discord_id: string;
}

const ACTIVE = "registration_status <> 'Cancelled'";
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

// ---------- Довідники ----------

async function loadResponsibles(db: Pick<Tx, 'query'> | null = null): Promise<Map<number, ResponsibleRow>> {
  const sql = 'SELECT employee_id, name, discord_id FROM interview_responsibles';
  const rows = db ? (await db.query<ResponsibleRow>(sql)).rows : await query<ResponsibleRow>(sql);
  return new Map(rows.map((r) => [r.employee_id, r]));
}

function responsibleView(id: number, dir: Map<number, ResponsibleRow>): SessionResponsible {
  const r = dir.get(id);
  return r ? { id, name: r.name, discordLinked: !!r.discord_id.trim() } : { id, name: `Співробітник #${id}`, discordLinked: false, missing: true };
}

export async function listPipelines(): Promise<Pipeline[]> {
  return query<Pipeline>('SELECT id, name FROM interview_pipelines ORDER BY position, id');
}

export async function listResponsibles(): Promise<Responsible[]> {
  const rows = await query<ResponsibleRow>('SELECT employee_id, name, discord_id FROM interview_responsibles');
  // discord_id назовні не віддаємо — лише ознаку, що тег у Discord можливий
  return rows
    .map((r) => ({ id: r.employee_id, name: r.name.trim(), discordLinked: !!r.discord_id.trim() }))
    .filter((r) => r.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
}

// ---------- Форма відповіді ----------

/** count — активні записи (бронь + підтверджені); confirmed — з них підтверджені. */
function shapeSession(s: SessionRow, count: number, dir: Map<number, ResponsibleRow>, confirmed = 0): Session {
  const max = s.max_participants;
  const ids = [...new Set(s.responsible_ids ?? [])];
  const start = iso(s.start_date)!;
  return {
    id: s.session_id,
    name: s.session_name || '',
    startDate: start,
    status: s.status || 'Open',
    pipelineId: s.pipeline_id ?? null,
    pipelineName: s.pipeline_name || '',
    responsibleIds: ids,
    responsibles: ids.map((id) => responsibleView(id, dir)),
    maxParticipants: max,
    currentCount: count,
    confirmedCount: confirmed,
    reservedCount: Math.max(0, count - confirmed),
    availableSeats: Math.max(0, max - count),
    isPast: new Date(start).getTime() <= Date.now(),
    createdAt: iso(s.created_at),
    updatedAt: iso(s.updated_at),
  };
}

function shapeParticipant(p: ParticipantRow): Participant {
  return {
    id: p.id,
    name: p.name || '',
    phone: p.phone || '',
    keycrmId: p.keycrm_id || '',
    registrationStatus: p.registration_status || '',
    keycrmSync: p.keycrm_sync || '',
    cancelReason: p.cancel_reason || '',
    confirmedAt: iso(p.confirmed_at),
    createdAt: iso(p.created_at),
  };
}

/** «Групова співбесіда — Менеджер з продажу 1 етап — 12 листопада, 14:00» (Europe/Kyiv). */
function sessionName(startIso: string, pipelineName: string) {
  return `Групова співбесіда — ${pipelineName ? pipelineName + ' — ' : ''}${DateTime.fromISO(startIso, { zone: 'utc' }).setZone(TZ).setLocale('uk').toFormat('d MMMM, HH:mm')}`;
}

function checkResponsibles(ids: number[] | undefined, dir: Map<number, ResponsibleRow>, allowed: number[] = []) {
  if (ids === undefined) return;
  const unknown = ids.filter((id) => !dir.has(id) && !allowed.includes(id));
  if (unknown.length) throw new ApiFailure(400, 'UNKNOWN_RESPONSIBLE', `Співробітника не знайдено в довіднику відповідальних: ${unknown.join(', ')}`, { unknown });
}

async function pipelineById(db: Tx, id: number): Promise<Pipeline | undefined> {
  return (await db.query<Pipeline>('SELECT id, name FROM interview_pipelines WHERE id = $1', [id])).rows[0];
}

const notFound = () => new ApiFailure(404, 'SESSION_NOT_FOUND', 'Співбесіду не знайдено');

async function lockSession(tx: Tx, sessionId: string): Promise<SessionRow> {
  const s = (await tx.query<SessionRow>('SELECT * FROM interview_sessions WHERE session_id = $1 FOR UPDATE', [sessionId])).rows[0];
  if (!s) throw notFound();
  return s;
}

async function confirmedCount(db: Pick<Tx, 'query'>, sessionId: string): Promise<number> {
  return (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM interview_participants WHERE session_id = $1 AND registration_status = 'Confirmed'", [sessionId])).rows[0].n;
}

async function activeCount(db: Tx, sessionId: string): Promise<number> {
  return (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM interview_participants WHERE session_id = $1 AND ${ACTIVE}`, [sessionId])).rows[0].n;
}

// ---------- Співбесіди ----------

export async function listSessions(): Promise<{ sessions: Session[]; serverTime: string }> {
  const [rows, dir] = await Promise.all([
    query<SessionRow & { active_count: number; confirmed_count: number }>(
      `SELECT s.*, COALESCE(c.n, 0)::int AS active_count, COALESCE(c.confirmed, 0)::int AS confirmed_count
         FROM interview_sessions s
         LEFT JOIN (SELECT session_id, count(*) AS n, count(*) FILTER (WHERE registration_status = 'Confirmed') AS confirmed
                      FROM interview_participants WHERE ${ACTIVE} GROUP BY session_id) c USING (session_id)
        ORDER BY s.start_date, s.id`,
    ),
    loadResponsibles(),
  ]);
  return { sessions: rows.map((s) => shapeSession(s, s.active_count, dir, s.confirmed_count)), serverTime: new Date().toISOString() };
}

export async function getSession(sessionId: string): Promise<{ session: Session; participants: Participant[] }> {
  const [s] = await query<SessionRow>('SELECT * FROM interview_sessions WHERE session_id = $1', [sessionId]);
  if (!s) throw notFound();
  const [parts, dir] = await Promise.all([
    query<ParticipantRow>('SELECT * FROM interview_participants WHERE session_id = $1 ORDER BY id', [sessionId]),
    loadResponsibles(),
  ]);
  return { session: shapeSession(s, parts.filter((p) => p.registration_status !== 'Cancelled').length, dir, parts.filter((p) => p.registration_status === 'Confirmed').length), participants: parts.map(shapeParticipant) };
}

export interface SessionWrite {
  startDate: string; // ISO UTC
  maxParticipants: number;
  pipelineId: number;
  responsibleIds?: number[];
}

export async function createSession(input: SessionWrite): Promise<Session> {
  if (new Date(input.startDate).getTime() <= Date.now()) throw new ApiFailure(400, 'START_IN_PAST', 'Не можна створити співбесіду в минулому');
  return transaction(async (tx) => {
    const pipeline = await pipelineById(tx, input.pipelineId);
    if (!pipeline) throw new ApiFailure(400, 'UNKNOWN_PIPELINE', 'Воронку не знайдено в довіднику');
    const dir = await loadResponsibles(tx);
    checkResponsibles(input.responsibleIds, dir);
    const startIso = new Date(input.startDate).toISOString();
    const row = (
      await tx.query<SessionRow>(
        `INSERT INTO interview_sessions (session_name, start_date, max_participants, status, pipeline_id, pipeline_name, responsible_ids)
         VALUES ($1, $2, $3, 'Open', $4, $5, $6) RETURNING *`,
        [sessionName(startIso, pipeline.name), startIso, input.maxParticipants, pipeline.id, pipeline.name, input.responsibleIds ?? []],
      )
    ).rows[0];
    return shapeSession(row, 0, dir);
  });
}

export async function updateSession(sessionId: string, input: SessionWrite): Promise<Session> {
  return transaction(async (tx) => {
    const s = await lockSession(tx, sessionId);
    const count = await activeCount(tx, sessionId);
    const startIso = new Date(input.startDate).toISOString();
    const max = input.maxParticipants;
    const startChanged = new Date(startIso).getTime() !== new Date(s.start_date).getTime();
    if (startChanged && new Date(startIso).getTime() <= Date.now()) throw new ApiFailure(400, 'START_IN_PAST', 'Не можна перенести співбесіду в минуле');
    if (max < count) {
      throw new ApiFailure(409, 'CAPACITY_BELOW_REGISTERED', `Не можна зменшити місткість нижче поточної кількості зареєстрованих кандидатів (${count})`, { currentCount: count });
    }
    const pid = input.pipelineId;
    const pipeline = await pipelineById(tx, pid);
    const pipelineChanged = pid !== s.pipeline_id;
    if (pipelineChanged && !pipeline) throw new ApiFailure(400, 'UNKNOWN_PIPELINE', 'Воронку не знайдено в довіднику');
    // Прив'язати воронку до сесії без воронки можна завжди; змінити наявну — лише поки ніхто не записаний
    if (pipelineChanged && count > 0 && s.pipeline_id !== null) {
      throw new ApiFailure(409, 'PIPELINE_LOCKED', `Не можна змінити воронку: на співбесіду вже зареєстровано кандидатів (${count})`, { currentCount: count });
    }
    const pipelineName = pipeline ? pipeline.name : s.pipeline_name || '';
    // Відповідальних можна змінювати завжди; не передано — лишаються як були
    const dir = await loadResponsibles(tx);
    checkResponsibles(input.responsibleIds, dir, s.responsible_ids ?? []);
    const responsibleIds = input.responsibleIds ?? s.responsible_ids ?? [];
    // Closed лишається Closed (закрито вручну); інакше статус відповідає заповненості
    const status: SessionStatus = s.status === 'Closed' ? 'Closed' : count >= max ? 'Full' : 'Open';
    const row = (
      await tx.query<SessionRow>(
        `UPDATE interview_sessions
            SET session_name = $2, start_date = $3, max_participants = $4, status = $5, pipeline_id = $6, pipeline_name = $7, responsible_ids = $8
          WHERE session_id = $1 RETURNING *`,
        [sessionId, sessionName(startIso, pipelineName), startIso, max, status, pid, pipelineName, responsibleIds],
      )
    ).rows[0];
    return shapeSession(row, count, dir, await confirmedCount(tx, sessionId));
  });
}

/** Закриття (статус Closed). Реєстрації кандидатів не змінюються. */
export async function closeSession(sessionId: string): Promise<Session> {
  return transaction(async (tx) => {
    await lockSession(tx, sessionId);
    const count = await activeCount(tx, sessionId);
    const row = (await tx.query<SessionRow>("UPDATE interview_sessions SET status = 'Closed' WHERE session_id = $1 RETURNING *", [sessionId])).rows[0];
    return shapeSession(row, count, await loadResponsibles(tx), await confirmedCount(tx, sessionId));
  });
}

// ---------- Ручний запис кандидатів із KeyCRM ----------

const keycrmFailure = (prefix: string, e: unknown) =>
  e instanceof KeycrmError ? new ApiFailure(502, 'KEYCRM_ERROR', `${prefix} ${e.message}`) : e;

export async function listCandidates(sessionId: string): Promise<{ candidates: Candidate[]; statusId: number; truncated: boolean }> {
  const [here] = await query<SessionRow>('SELECT * FROM interview_sessions WHERE session_id = $1', [sessionId]);
  if (!here) throw notFound();
  let fetched: Awaited<ReturnType<typeof fetchCandidateCards>>;
  try {
    fetched = await fetchCandidateCards();
  } catch (e) {
    throw keycrmFailure('Не вдалося отримати лідів з KeyCRM.', e);
  }
  const [sessions, active, pipelines] = await Promise.all([
    query<SessionRow>('SELECT * FROM interview_sessions'),
    query<ParticipantRow>(`SELECT * FROM interview_participants WHERE ${ACTIVE}`),
    listPipelines(),
  ]);
  const byId = new Map(sessions.map((s) => [s.session_id, s]));
  const regsByCard = new Map<string, ParticipantRow[]>();
  for (const p of active) regsByCard.set(p.keycrm_id, [...(regsByCard.get(p.keycrm_id) ?? []), p]);
  const pipelineName = (id: number | null) => (id === null ? '' : pipelines.find((p) => p.id === id)?.name ?? '');
  const herePipeline = here.pipeline_id;

  const candidates: Candidate[] = fetched.cards
    .map((c) => {
      const pid = cardPipelineId(c);
      const regs = regsByCard.get(String(c.id)) ?? [];
      const raw = cardField(c, INTERVIEW_FIELD_UUID);
      return {
        cardId: String(c.id),
        name: cardName(c),
        phone: cardPhone(c),
        pipelineId: pid,
        pipelineName: pipelineName(pid),
        interviewAt: interviewIso(raw),
        interviewRaw: raw === undefined || raw === null ? '' : String(raw),
        inThisSession: regs.some((r) => r.session_id === sessionId && r.keycrm_sync !== 'Failed'),
        retryHere: regs.some((r) => r.session_id === sessionId && r.keycrm_sync === 'Failed'),
        currentSessions: regs
          .filter((r) => r.session_id !== sessionId)
          .filter((r) => { const s = byId.get(r.session_id); return !s || new Date(s.start_date).getTime() > Date.now(); })
          .map((r) => {
            const s = byId.get(r.session_id);
            return { sessionId: r.session_id, name: s?.session_name ?? '', startDate: s ? iso(s.start_date) : null };
          }),
      };
    })
    .sort(
      (a, b) =>
        Number(a.inThisSession) - Number(b.inThisSession) ||
        Number(b.pipelineId === herePipeline) - Number(a.pipelineId === herePipeline) ||
        a.name.localeCompare(b.name, 'uk', { numeric: true }),
    );
  return { candidates, statusId: CANDIDATE_STATUS_ID, truncated: fetched.truncated };
}

/**
 * Записує ліда на співбесіду: попередні активні записи на інші співбесіди скасовуються,
 * потім у картку KeyCRM пишеться новий час (статус картки не змінюється).
 * Якщо KeyCRM не оновився — запис лишається з keycrm_sync = Failed, його можна повторити.
 */
export async function addParticipant(sessionId: string, cardId: string): Promise<AddParticipantResult> {
  if (!/^\d+$/.test(cardId)) throw new ApiFailure(400, 'INVALID_CARD', 'Некоректний ID картки KeyCRM');
  const [pre] = await query<SessionRow>('SELECT * FROM interview_sessions WHERE session_id = $1', [sessionId]);
  if (!pre) throw notFound();
  const pastError = () => new ApiFailure(409, 'SESSION_PAST', 'Співбесіда вже минула — записати кандидата не можна');
  if (new Date(pre.start_date).getTime() <= Date.now()) throw pastError();

  let card: Awaited<ReturnType<typeof fetchCard>>;
  try {
    card = await fetchCard(cardId);
  } catch (e) {
    throw keycrmFailure('Не вдалося отримати картку з KeyCRM.', e);
  }
  if (!card) throw new ApiFailure(404, 'CARD_NOT_FOUND', 'Картку KeyCRM не знайдено');
  if (Number(card.status_id) !== CANDIDATE_STATUS_ID) throw new ApiFailure(409, 'WRONG_STATUS', 'Лід уже не в статусі «Запросили на 1 тур». Оновіть список.');

  const booked = await transaction(async (tx) => {
    const s = await lockSession(tx, sessionId);
    if (new Date(s.start_date).getTime() <= Date.now()) throw pastError();
    // Активні записи кандидата на майбутні співбесіди (і на цю); записи на минулі — історія, їх не чіпаємо
    const records = (
      await tx.query<ParticipantRow>(
        `SELECT p.* FROM interview_participants p JOIN interview_sessions s USING (session_id)
          WHERE p.keycrm_id = $1 AND p.registration_status <> 'Cancelled' AND (s.start_date > now() OR p.session_id = $2)
          FOR UPDATE OF p`,
        [cardId, sessionId],
      )
    ).rows;
    const here = records.filter((r) => r.session_id === sessionId);
    if (here.some((r) => r.keycrm_sync !== 'Failed')) throw new ApiFailure(409, 'ALREADY_IN_SESSION', 'Кандидат уже записаний на цю співбесіду');
    // Повтор: попередній запис сюди не оновив KeyCRM (Failed) — його буде скасовано і створено новий
    const count = (await activeCount(tx, sessionId)) - here.length;
    const max = s.max_participants;
    if (count >= max) {
      throw new ApiFailure(409, 'SESSION_FULL', `Вільних місць немає (${count} з ${max}). Збільште максимальну кількість учасників.`, { currentCount: count });
    }
    const previous = records.filter((r) => r.session_id !== sessionId);
    const oldSessionIds = [...new Set(previous.map((r) => r.session_id))];

    // Скасувати всі активні записи кандидата (на інші співбесіди і невдалий запис сюди)
    if (records.length) {
      await tx.query("UPDATE interview_participants SET registration_status = 'Cancelled', cancel_reason = 'rebooked_manually' WHERE id = ANY($1::int[])", [records.map((r) => r.id)]);
    }
    // Співбесіди, з яких кандидата забрали, знову мають вільне місце
    if (oldSessionIds.length) {
      await tx.query("UPDATE interview_sessions SET status = 'Open' WHERE session_id = ANY($1::text[]) AND status = 'Full'", [oldSessionIds]);
    }
    const participant = (
      await tx.query<ParticipantRow>(
        `INSERT INTO interview_participants (keycrm_id, name, phone, session_id, registration_status, keycrm_sync, sync_error)
         VALUES ($1, $2, $3, $4, 'Confirmed', 'Pending', '') RETURNING *`, // ручний запис менеджером — одразу підтверджено
        [cardId, cardName(card!), cardPhone(card!), sessionId],
      )
    ).rows[0];
    const newCount = count + 1;
    const newStatus: SessionStatus = s.status === 'Closed' ? 'Closed' : newCount >= max ? 'Full' : 'Open';
    const updated = (await tx.query<SessionRow>('UPDATE interview_sessions SET status = $2 WHERE session_id = $1 RETURNING *', [sessionId, newStatus])).rows[0];
    return { participant, session: updated, newCount, previousCount: previous.length };
  });

  const dir = await loadResponsibles();
  const session = shapeSession(booked.session, booked.newCount, dir, (await query<{ n: number }>("SELECT count(*)::int AS n FROM interview_participants WHERE session_id = $1 AND registration_status = 'Confirmed'", [sessionId]))[0].n);
  try {
    await writeInterviewTime(cardId, iso(booked.session.start_date)!);
  } catch (e) {
    const text = `${new Date().toISOString()} KeyCRM PUT: ${e instanceof Error ? e.message : String(e)}`.slice(0, 1600);
    await query("UPDATE interview_participants SET keycrm_sync = 'Failed', sync_error = $2 WHERE id = $1", [booked.participant.id, text]);
    return {
      participant: shapeParticipant({ ...booked.participant, keycrm_sync: 'Failed' }),
      session,
      keycrmSync: 'Failed',
      previousCancelled: booked.previousCount,
      warning: `Кандидата записано, але поле співбесіди в KeyCRM не оновлено. Деталі — у sync_error (interview_participants). ${text}`,
    };
  }
  await query("UPDATE interview_participants SET keycrm_sync = 'Synced', sync_error = '' WHERE id = $1", [booked.participant.id]);
  return {
    participant: shapeParticipant({ ...booked.participant, keycrm_sync: 'Synced' }),
    session,
    keycrmSync: 'Synced',
    previousCancelled: booked.previousCount,
  };
}
