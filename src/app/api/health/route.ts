import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Перевірка стану для Railway (без бази й KeyCRM). */
export function GET() {
  return NextResponse.json({ ok: true, time: new Date().toISOString() });
}
