import { NextResponse } from 'next/server';
import { guarded, parseSessionInput, readJson } from '@/lib/server-route';
import { createSession, listSessions } from '@/lib/sessions-service';

export const dynamic = 'force-dynamic';

/** Список усіх співбесід. */
export function GET() {
  return guarded(async () => NextResponse.json(await listSessions()));
}

/** Створення співбесіди: { date: 'YYYY-MM-DD', time: 'HH:mm' (Europe/Kyiv), maxParticipants, pipelineId, responsibleIds? }. */
export function POST(req: Request) {
  return guarded(async () => {
    const input = parseSessionInput(await readJson(req), { requireFuture: true });
    return NextResponse.json({ session: await createSession(input) }, { status: 201 });
  });
}
