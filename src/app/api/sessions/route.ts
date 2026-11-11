import { NextResponse } from 'next/server';
import { callSessionApi } from '@/lib/n8n';
import { errorResponse, parseSessionInput, readJson } from '@/lib/server-route';
import type { Session } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Список усіх співбесід. */
export async function GET() {
  try {
    const { body } = await callSessionApi<{ sessions: Session[] }>('list');
    return NextResponse.json({ sessions: body.sessions ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Створення співбесіди: { date: 'YYYY-MM-DD', time: 'HH:mm' (Europe/Kyiv), maxParticipants, pipelineId }. */
export async function POST(req: Request) {
  try {
    const input = parseSessionInput(await readJson(req), { requireFuture: true });
    const { body } = await callSessionApi<{ session: Session }>('create', input);
    return NextResponse.json(body, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
