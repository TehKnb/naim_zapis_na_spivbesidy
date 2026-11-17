import { NextResponse } from 'next/server';
import { callSessionApi } from '@/lib/n8n';
import { errorResponse } from '@/lib/server-route';
import type { Candidate } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Ліди KeyCRM у статусі «Запросили на 1 тур» для ручного запису на цю співбесіду. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { body } = await callSessionApi<{ candidates: Candidate[]; truncated?: boolean }>('candidates', { sessionId: id });
    return NextResponse.json({ candidates: body.candidates ?? [], truncated: !!body.truncated });
  } catch (e) {
    return errorResponse(e);
  }
}
