import { NextResponse } from 'next/server';
import { callSessionApi } from '@/lib/n8n';
import { errorResponse } from '@/lib/server-route';
import type { Session } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Закриття співбесіди (статус Closed). Реєстрації кандидатів не змінюються. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { body } = await callSessionApi<{ session: Session }>('close', { sessionId: id });
    return NextResponse.json(body);
  } catch (e) {
    return errorResponse(e);
  }
}
