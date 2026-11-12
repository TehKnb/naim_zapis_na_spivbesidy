import { NextResponse } from 'next/server';
import { authConfig, authConfigProblem, checkCredentials, createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Обмеження спроб входу (у пам'яті процесу): 10 невдалих спроб за 15 хвилин з однієї IP-адреси
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;
const fails = new Map<string, { count: number; first: number }>();

// Останнє значення X-Forwarded-For додає проксі хостингу (Railway); перші клієнт може підробити
function clientIp(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || req.headers.get('x-real-ip') || 'local';
}

function error(status: number, code: string, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

/** Вхід: { login, password } → HTTP-only cookie сесії на 30 днів. */
export async function POST(req: Request) {
  const cfg = authConfig();
  if (!cfg) {
    console.error('[auth] ' + authConfigProblem());
    return error(503, 'AUTH_NOT_CONFIGURED', 'Вхід не налаштовано на сервері. ' + (authConfigProblem() ?? ''));
  }

  const ip = clientIp(req);
  const now = Date.now();
  const rec = fails.get(ip);
  if (rec && now - rec.first > WINDOW_MS) fails.delete(ip);
  const cur = fails.get(ip);
  if (cur && cur.count >= MAX_FAILS) {
    const retry = Math.ceil((cur.first + WINDOW_MS - now) / 1000);
    return error(429, 'TOO_MANY_ATTEMPTS', `Забагато невдалих спроб. Спробуйте через ${Math.ceil(retry / 60)} хв.`, { 'Retry-After': String(retry) });
  }

  let body: Record<string, unknown> = {};
  try {
    const b = await req.json();
    if (b && typeof b === 'object') body = b as Record<string, unknown>;
  } catch {
    return error(400, 'INVALID_JSON', 'Некоректне тіло запиту.');
  }
  const login = typeof body.login === 'string' ? body.login : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!login.trim() || !password) return error(400, 'VALIDATION_ERROR', 'Вкажіть логін і пароль.');
  if (login.length > 200 || password.length > 200) return error(400, 'VALIDATION_ERROR', 'Занадто довге значення.');

  if (!(await checkCredentials(cfg, login, password))) {
    const r = fails.get(ip) ?? { count: 0, first: now };
    r.count += 1;
    fails.set(ip, r);
    if (fails.size > 10_000) fails.clear(); // захист пам'яті
    await new Promise((res) => setTimeout(res, 400)); // уповільнення перебору
    return error(401, 'INVALID_CREDENTIALS', 'Невірний логін або пароль.');
  }

  fails.delete(ip);
  const { token, expires } = await createSessionToken(cfg);
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expires));
  return res;
}
