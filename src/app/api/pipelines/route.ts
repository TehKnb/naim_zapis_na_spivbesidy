import { NextResponse } from 'next/server';
import { guarded } from '@/lib/server-route';
import { listPipelines } from '@/lib/sessions-service';

export const dynamic = 'force-dynamic';

/** Довідник воронок (таблиця interview_pipelines): для форми і фільтрів. */
export function GET() {
  return guarded(async () => NextResponse.json({ pipelines: await listPipelines() }));
}
