import { NextResponse } from 'next/server';
import { callSessionApi } from '@/lib/n8n';
import { errorResponse, parseSessionInput, readJson } from '@/lib/server-route';
import type { Session, SessionDetails } from '@/lib/types';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

/** Деталі співбесіди + кандидати. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { body } = await callSessionApi<SessionDetails>('get', { sessionId: id });
    return NextResponse.json(body);
  } catch (e) {
    return errorResponse(e);
  }
}

/** Редагування дати, часу, максимальної кількості учасників і воронки. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    // Минуле перевіряє n8n: дату минулої співбесіди можна не змінювати, але не можна перенести в минуле
    const input = parseSessionInput(await readJson(req), { requireFuture: false });
    const { body } = await callSessionApi<{ session: Session }>('update', { sessionId: id, ...input });
    return NextResponse.json(body);
  } catch (e) {
    return errorResponse(e);
  }
}
