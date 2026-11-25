import { NextResponse } from 'next/server';
import { ApiFailure } from '@/lib/api-failure';
import { guarded, readJson, sessionIdParam } from '@/lib/server-route';
import { addParticipant, getSession } from '@/lib/sessions-service';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** Кандидати, зареєстровані на співбесіду (лише читання). */
export function GET(_req: Request, { params }: Ctx) {
  return guarded(async () => {
    const { session, participants } = await getSession(sessionIdParam((await params).id));
    return NextResponse.json({ sessionId: session.id, participants });
  });
}

/** Ручний запис кандидата (лід KeyCRM у статусі «Запросили на 1 тур»): { cardId }. Перезаписує поле співбесіди в KeyCRM. */
export function POST(req: Request, { params }: Ctx) {
  return guarded(async () => {
    const id = sessionIdParam((await params).id);
    const body = await readJson(req);
    const cardId = typeof body.cardId === 'string' || typeof body.cardId === 'number' ? String(body.cardId).trim() : '';
    if (!/^\d{1,12}$/.test(cardId)) throw new ApiFailure(400, 'INVALID_CARD', 'Оберіть кандидата зі списку.');
    return NextResponse.json(await addParticipant(id, cardId), { status: 201 });
  });
}
