/**
 * Серверна перевірка сесії для route handlers (другий рубіж після middleware).
 * Імпортується лише на сервері.
 */
import { cookies } from 'next/headers';
import { authConfig, SESSION_COOKIE, verifySessionToken } from './auth';

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value, authConfig());
}
