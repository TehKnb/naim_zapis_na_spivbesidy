import { NextResponse } from 'next/server';
import { ApiFailure } from './api-failure';
import { isAuthenticated } from './auth-server';
import { asDbFailure } from './db';
import { localPartsToUtc } from './time';

export function errorResponse(e: unknown) {
  const err = asDbFailure(e);
  if (err instanceof ApiFailure) {
    if (err.status >= 500) console.error('[api]', err.code, err.message);
    return NextResponse.json(err.toBody(), { status: err.status, headers: { 'Cache-Control': 'no-store' } });
  }
  console.error('[api] unexpected error', err);
  return NextResponse.json({ error: { code: 'INTERNAL', message: 'Внутрішня помилка сервера.' } }, { status: 500 });
}

/**
 * Обгортка route handler: спершу перевірка сесії (другий рубіж після middleware — без входу база й KeyCRM не чіпаються),
 * потім обробник; будь-яка помилка → JSON { error }.
 */
export async function guarded(fn: () => Promise<Response>): Promise<Response> {
  try {
    if (!(await isAuthenticated())) throw new ApiFailure(401, 'AUTH_REQUIRED', 'Сесія завершилась. Увійдіть ще раз.');
    return await fn();
  } catch (e) {
    return errorResponse(e);
  }
}

const SESSION_ID_RE = /^[A-Za-z0-9-]{1,64}$/;
/** ID співбесіди з адреси: некоректний → 404 (без звернення до бази). */
export function sessionIdParam(id: string): string {
  if (!SESSION_ID_RE.test(id)) throw new ApiFailure(404, 'SESSION_NOT_FOUND', 'Співбесіду не знайдено');
  return id;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
  } catch {
    throw new ApiFailure(400, 'INVALID_JSON', 'Некоректне тіло запиту.');
  }
}

/** Валідація полів форми на бекенді + переведення київського часу в UTC. */
export function parseSessionInput(body: Record<string, unknown>, { requireFuture }: { requireFuture: boolean }) {
  const date = typeof body.date === 'string' ? body.date.trim() : '';
  const time = typeof body.time === 'string' ? body.time.trim() : '';
  const max = Number(body.maxParticipants);
  const pipelineId = Number(body.pipelineId);
  const fields: Record<string, string> = {};
  const conv = localPartsToUtc(date, time);
  if (!date) fields.date = 'Вкажіть дату';
  if (!time) fields.time = 'Вкажіть час';
  if (date && time && !conv.ok) fields[conv.code === 'NONEXISTENT_TIME' ? 'time' : 'date'] = conv.message;
  if (conv.ok && requireFuture && new Date(conv.iso).getTime() <= Date.now()) fields.date = 'Не можна створити співбесіду в минулому';
  if (!Number.isInteger(max) || max <= 0) fields.maxParticipants = 'Має бути додатне ціле число';
  else if (max > 1000) fields.maxParticipants = 'Занадто велике значення';
  // Наявність воронки в довіднику перевіряє sessions-service
  if (body.pipelineId === null || body.pipelineId === undefined || body.pipelineId === '' || !Number.isInteger(pipelineId) || pipelineId <= 0) {
    fields.pipelineId = 'Оберіть воронку';
  }
  // Відповідальні: масив ID співробітників (необов'язково). Наявність у довіднику перевіряє sessions-service
  let responsibleIds: number[] | undefined;
  if (body.responsibleIds !== undefined && body.responsibleIds !== null) {
    const raw = body.responsibleIds;
    const ids = Array.isArray(raw) ? [...new Set(raw.map(Number))] : [];
    if (!Array.isArray(raw) || ids.some((n) => !Number.isInteger(n) || n <= 0)) fields.responsibleIds = 'Некоректний список відповідальних';
    else if (ids.length > 50) fields.responsibleIds = 'Занадто багато відповідальних';
    else responsibleIds = ids;
  }
  if (Object.keys(fields).length > 0 || !conv.ok) {
    throw new ApiFailure(400, 'VALIDATION_ERROR', Object.values(fields)[0] ?? 'Перевірте дані форми', { fields });
  }
  return { startDate: conv.iso, maxParticipants: max, pipelineId, ...(responsibleIds ? { responsibleIds } : {}) };
}
