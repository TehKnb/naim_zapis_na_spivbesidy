/**
 * Авторизація адмінпанелі: один спільний логін і пароль, сесія в підписаному HTTP-only cookie.
 * Без бази даних: токен містить лише термін дії й підпис HMAC-SHA256 (ключ — ADMIN_SESSION_SECRET).
 * Підпис також залежить від логіна й пароля, тож зміна будь-якого з них або секрету робить усі сесії недійсними.
 *
 * Працює і в middleware (Edge), і в route handlers (Node): лише Web Crypto, без залежностей.
 */

export const SESSION_COOKIE = 'ia_session';
export const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 днів
const TOKEN_VERSION = 'v1';
const MIN_SECRET_LENGTH = 32;

export interface AuthConfig {
  login: string;
  password: string;
  secret: string;
}

/** Конфігурація з env. null — авторизацію не налаштовано (тоді вхід неможливий: доступ закритий для всіх). */
export function authConfig(): AuthConfig | null {
  const login = process.env.ADMIN_LOGIN?.trim() ?? '';
  const password = process.env.ADMIN_PASSWORD ?? '';
  const secret = process.env.ADMIN_SESSION_SECRET?.trim() ?? '';
  if (!login || !password || secret.length < MIN_SECRET_LENGTH) return null;
  return { login, password, secret };
}

export function authConfigProblem(): string | null {
  const missing = ['ADMIN_LOGIN', 'ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET'].filter((k) => !process.env[k]?.trim());
  if (missing.length) return `Не задано змінні середовища: ${missing.join(', ')}`;
  if ((process.env.ADMIN_SESSION_SECRET?.trim().length ?? 0) < MIN_SECRET_LENGTH) return `ADMIN_SESSION_SECRET має містити щонайменше ${MIN_SECRET_LENGTH} символи`;
  return null;
}

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** Дані, що підписуються: версія, час видачі, термін дії та відбиток облікових даних. */
function signedPayload(cfg: AuthConfig, iat: number, exp: number) {
  return enc.encode(`${TOKEN_VERSION}.${iat}.${exp}.${cfg.login}\u0000${cfg.password}`);
}

export async function createSessionToken(cfg: AuthConfig, now = Date.now()): Promise<{ token: string; expires: Date }> {
  const iat = Math.floor(now / 1000);
  const exp = iat + SESSION_MAX_AGE_SEC;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(cfg.secret), signedPayload(cfg, iat, exp));
  return { token: `${TOKEN_VERSION}.${iat}.${exp}.${b64url(sig)}`, expires: new Date(exp * 1000) };
}

/** Перевірка токена: формат, підпис (порівняння сталого часу через subtle.verify) і термін дії. */
export async function verifySessionToken(token: string | undefined | null, cfg: AuthConfig | null = authConfig(), now = Date.now()): Promise<boolean> {
  if (!cfg || !token || token.length > 256) return false;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) return false;
  const iat = Number(parts[1]);
  const exp = Number(parts[2]);
  if (!Number.isSafeInteger(iat) || !Number.isSafeInteger(exp) || exp - iat !== SESSION_MAX_AGE_SEC) return false;
  const nowSec = Math.floor(now / 1000);
  if (exp <= nowSec || iat > nowSec + 300) return false;
  const sig = fromB64url(parts[3]);
  if (!sig || sig.length !== 32) return false;
  try {
    return await crypto.subtle.verify('HMAC', await hmacKey(cfg.secret), sig, signedPayload(cfg, iat, exp));
  } catch {
    return false;
  }
}

/** Порівняння логіна й пароля без витоку часу: порівнюються HMAC-дайджести однакової довжини. */
export async function checkCredentials(cfg: AuthConfig, login: string, password: string): Promise<boolean> {
  const key = await hmacKey(cfg.secret);
  const digest = async (v: string) => new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(v)));
  const [a1, b1, a2, b2] = await Promise.all([digest(login.trim()), digest(cfg.login), digest(password), digest(cfg.password)]);
  let diff = 0;
  for (let i = 0; i < a1.length; i++) diff |= (a1[i] ^ b1[i]) | (a2[i] ^ b2[i]);
  return diff === 0;
}

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires,
    maxAge: SESSION_MAX_AGE_SEC,
  };
}

/** Безпечна адреса повернення після входу: лише відносний шлях цього сайту. */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\') || raw.startsWith('/login') || raw.startsWith('/api/')) return '/';
  return raw.slice(0, 1000);
}
