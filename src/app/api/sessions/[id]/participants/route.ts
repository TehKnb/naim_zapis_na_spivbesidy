import { NextResponse } from 'next/server';
import { ApiFailure, callSessionApi } from '@/lib/n8n';
import { errorResponse, readJson } from '@/lib/server-route';
import type { AddParticipantResult, Participant } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Кандидати, зареєстровані на співбесіду (лише читання). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { body } = await callSessionApi<{ sessionId: string; participants: Participant[] }>('participants', { sessionId: id });
    return NextResponse.json(body);
  } catch (e) {
    return errorResponse(e);
  }
}

/** Ручний запис кандидата (лід KeyCRM у статусі «Запросили на 1 тур»): { cardId }. Перезаписує поле співбесіди в KeyCRM. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await readJson(req);
    const cardId = typeof body.cardId === 'string' || typeof body.cardId === 'number' ? String(body.cardId).trim() : '';
    if (!/^\d{1,12}$/.test(cardId)) throw new ApiFailure(400, 'INVALID_CARD', 'Оберіть кандидата зі списку.');
    const { body: result } = await callSessionApi<AddParticipantResult>('addParticipant', { sessionId: id, cardId });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
