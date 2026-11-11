import { NextResponse } from 'next/server';
import { ApiFailure } from './n8n';
import { localPartsToUtc } from './time';

export function errorResponse(e: unknown) {
  if (e instanceof ApiFailure) return NextResponse.json(e.toBody(), { status: e.status });
  console.error('[api] unexpected error', e);
  return NextResponse.json({ error: { code: 'INTERNAL', message: 'Внутрішня помилка сервера.' } }, { status: 500 });
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
  const fields: Record<string, string> = {};
  const conv = localPartsToUtc(date, time);
  if (!date) fields.date = 'Вкажіть дату';
  if (!time) fields.time = 'Вкажіть час';
  if (date && time && !conv.ok) fields[conv.code === 'NONEXISTENT_TIME' ? 'time' : 'date'] = conv.message;
  if (conv.ok && requireFuture && new Date(conv.iso).getTime() <= Date.now()) fields.date = 'Не можна створити співбесіду в минулому';
  if (!Number.isInteger(max) || max <= 0) fields.maxParticipants = 'Має бути додатне ціле число';
  else if (max > 1000) fields.maxParticipants = 'Занадто велике значення';
  if (Object.keys(fields).length > 0 || !conv.ok) {
    throw new ApiFailure(400, 'VALIDATION_ERROR', Object.values(fields)[0] ?? 'Перевірте дані форми', { fields });
  }
  return { startDate: conv.iso, maxParticipants: max };
}
