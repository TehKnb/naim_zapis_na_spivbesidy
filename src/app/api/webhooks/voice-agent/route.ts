import { timingSafeEqual } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import { ApiFailure } from '@/lib/api-failure';
import { handleAgentResponse, logAgentEvent, rebalancePipeline } from '@/lib/agent-service';
import { errorResponse } from '@/lib/server-route';

export const dynamic = 'force-dynamic';

/**
 * Відповідь голосового агента після дзвінка кандидату.
 *   POST /api/webhooks/voice-agent
 *   { "card_id": 12345, "confirmed": true, "status_id": 31 }
 * card_id — ID картки KeyCRM; confirmed — чи підходить кандидату час співбесіди; status_id — необов'язково (у журнал).
 * Без авторизації адмінпанелі. Якщо задано VOICE_AGENT_WEBHOOK_TOKEN — потрібен ?token=… в адресі.
 */
const YES = new Set(['true', '1', 'yes', 'так', 'y', 'confirmed']);
const NO = new Set(['false', '0', 'no', 'ні', 'n', 'declined']);

function parseBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1 ? true : v === 0 ? false : null;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return YES.has(s) ? true : NO.has(s) ? false : null;
  }
  return null;
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get('content-type') ?? '';
  const text = await req.text();
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text));
  try {
    const b = text ? JSON.parse(text) : {};
    return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
  } catch {
    await logAgentEvent({ cardId: '', confirmed: null, statusId: null, payload: { raw: text.slice(0, 2000) }, result: 'invalid', details: { error: 'INVALID_JSON' } });
    throw new ApiFailure(400, 'INVALID_JSON', 'Тіло запиту має бути JSON: {"card_id": 123, "confirmed": true}');
  }
}

function checkToken(req: Request) {
  const expected = process.env.VOICE_AGENT_WEBHOOK_TOKEN?.trim();
  if (!expected) return;
  const got = new URL(req.url).searchParams.get('token') ?? '';
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiFailure(401, 'INVALID_TOKEN', 'Невірний token у адресі webhook.');
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    checkToken(req);
    body = await readBody(req);
    const rawCard = body.card_id ?? body.cardId;
    const cardId = typeof rawCard === 'string' || typeof rawCard === 'number' ? String(rawCard).trim() : '';
    const confirmed = parseBool(body.confirmed);
    const statusNum = Number(body.status_id ?? body.statusId);
    const statusId = Number.isInteger(statusNum) && statusNum > 0 ? statusNum : null;

    const fields: Record<string, string> = {};
    if (!/^\d{1,12}$/.test(cardId)) fields.card_id = 'Потрібен ID картки KeyCRM (число)';
    if (confirmed === null) fields.confirmed = 'Потрібне значення true або false';
    if (Object.keys(fields).length) {
      await logAgentEvent({ cardId, confirmed, statusId, payload: body, result: 'invalid', details: fields });
      throw new ApiFailure(400, 'VALIDATION_ERROR', Object.values(fields).join('; '), { fields });
    }

    const { result, freedPipelines } = await handleAgentResponse({ cardId, confirmed: confirmed!, statusId, payload: body });
    await logAgentEvent({ cardId, confirmed, statusId, payload: body, result: result.result, details: result });

    // Перерозподіл звільнених місць — після відповіді агенту (може тривати кілька секунд через запити до KeyCRM)
    if (freedPipelines.length) {
      after(async () => {
        for (const pipeline of freedPipelines) {
          try {
            const moves = await rebalancePipeline(pipeline);
            if (moves.length) {
              console.log(`[rebalance] «${pipeline}»: перенесено ${moves.length}`);
              await logAgentEvent({ cardId, confirmed, statusId, payload: {}, result: 'rebalance', details: { pipeline, moves } });
            }
          } catch (e) {
            console.error(`[rebalance] «${pipeline}»:`, e instanceof Error ? e.message : e);
            await logAgentEvent({ cardId, confirmed, statusId, payload: {}, result: 'rebalance_error', details: { pipeline, error: e instanceof Error ? e.message : String(e) } });
          }
        }
      });
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
