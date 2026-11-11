import { NextResponse } from 'next/server';
import { callSessionApi } from '@/lib/n8n';
import { errorResponse } from '@/lib/server-route';
import type { Pipeline } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Довідник воронок (n8n «Конфіг» → PIPELINES): для форми і фільтрів. */
export async function GET() {
  try {
    const { body } = await callSessionApi<{ pipelines: Pipeline[] }>('pipelines');
    return NextResponse.json({ pipelines: body.pipelines ?? [] });
  } catch (e) {
    return errorResponse(e);
  }
}
