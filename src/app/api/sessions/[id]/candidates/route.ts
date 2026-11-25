import { NextResponse } from 'next/server';
import { guarded, sessionIdParam } from '@/lib/server-route';
import { listCandidates } from '@/lib/sessions-service';

export const dynamic = 'force-dynamic';

/** Ліди KeyCRM у статусі «Запросили на 1 тур» для ручного запису на цю співбесіду. */
export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    const { candidates, truncated } = await listCandidates(sessionIdParam((await params).id));
    return NextResponse.json({ candidates, truncated });
  });
}
