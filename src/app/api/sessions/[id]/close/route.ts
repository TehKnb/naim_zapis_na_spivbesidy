import { NextResponse } from 'next/server';
import { guarded, sessionIdParam } from '@/lib/server-route';
import { closeSession } from '@/lib/sessions-service';

export const dynamic = 'force-dynamic';

/** Закриття співбесіди (статус Closed). Реєстрації кандидатів не змінюються. */
export function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => NextResponse.json({ session: await closeSession(sessionIdParam((await params).id)) }));
}
