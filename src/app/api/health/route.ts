import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Перевірка стану для Railway (не звертається до n8n). */
export function GET() {
  return NextResponse.json({ ok: true, time: new Date().toISOString() });
}
