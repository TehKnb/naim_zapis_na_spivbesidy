import { NextResponse } from 'next/server';
import { guarded } from '@/lib/server-route';
import { listResponsibles } from '@/lib/sessions-service';

export const dynamic = 'force-dynamic';

/** Співробітники, яких можна призначити відповідальними (таблиця interview_responsibles). */
export function GET() {
  return guarded(async () => NextResponse.json({ responsibles: await listResponsibles() }));
}
