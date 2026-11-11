import { NextResponse } from 'next/server';
import { callSessionApi } from '@/lib/n8n';
import { errorResponse } from '@/lib/server-route';
import type { Responsible } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Співробітники, яких можна призначити відповідальними (n8n таблиця Interview Responsibles). */
export async function GET() {
  try {
    const { body } = await callSessionApi<{ responsibles: Responsible[] }>('responsibles');
    return NextResponse.json({ responsibles: body.responsibles ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}
