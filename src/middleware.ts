import { NextResponse, type NextRequest } from 'next/server';
import { authConfig, safeNextPath, SESSION_COOKIE, verifySessionToken } from '@/lib/auth';

/**
 * Перевірка авторизації для всіх сторінок і API ДО виконання маршруту.
 * Без дійсної сесії: сторінки → редірект на /login, API → 401 (запит до n8n не виконується).
 */

// Доступні без входу
const PUBLIC_API = new Set(['/api/auth/login', '/api/auth/logout', '/api/health']);

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isApi = pathname === '/api' || pathname.startsWith('/api/');
  if (isApi && PUBLIC_API.has(pathname)) return NextResponse.next();

  const authed = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, authConfig());

  if (pathname === '/login') {
    // Уже увійшли — одразу на потрібну сторінку
    if (authed) return NextResponse.redirect(new URL(safeNextPath(req.nextUrl.searchParams.get('next')), req.url));
    return NextResponse.next();
  }

  if (authed) return NextResponse.next();

  if (isApi) {
    return NextResponse.json(
      { error: { code: 'AUTH_REQUIRED', message: 'Сесія завершилась. Увійдіть ще раз.' } },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const login = new URL('/login', req.url);
  const next = safeNextPath(pathname + search);
  if (next !== '/') login.searchParams.set('next', next);
  const res = NextResponse.redirect(login);
  // Недійсний або прострочений cookie прибираємо
  if (req.cookies.has(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE);
  return res;
}

export const config = {
  // Усе, крім статичних файлів збірки та іконки
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)'],
};
