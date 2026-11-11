import { NextResponse } from 'next/server';
import { callSessionApi } from '@/lib/n8n';
import { errorResponse } from '@/lib/server-route';
import type { Participant } from '@/lib/types';

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
