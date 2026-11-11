/**
 * Серверний клієнт API співбесід у n8n.
 * Імпортується ЛИШЕ з route handlers (src/app/api/**): секрет ніколи не потрапляє у браузер.
 */
import type { ApiErrorBody } from './types';

export type SessionApiAction = 'list' | 'get' | 'participants' | 'create' | 'update' | 'close' | 'pipelines';

export class ApiFailure extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message, ...this.extra } };
  }
}

function endpoint(): string {
  const explicit = process.env.N8N_SESSION_MANAGEMENT_WEBHOOK_URL?.trim();
  if (explicit) return explicit;
  const base = process.env.N8N_BASE_URL?.trim().replace(/\/+$/, '');
  if (!base) {
    throw new ApiFailure(500, 'N8N_NOT_CONFIGURED', 'Не налаштовано адресу n8n (N8N_SESSION_MANAGEMENT_WEBHOOK_URL або N8N_BASE_URL).');
  }
  return `${base}/webhook/session-management`;
}

export async function callSessionApi<T>(action: SessionApiAction, payload: Record<string, unknown> = {}): Promise<{ status: number; body: T }> {
  const url = endpoint();
  const secret = process.env.N8N_WEBHOOK_SECRET?.trim();
  if (!secret) throw new ApiFailure(500, 'N8N_NOT_CONFIGURED', 'Не налаштовано N8N_WEBHOOK_SECRET.');
  const timeout = Number(process.env.N8N_REQUEST_TIMEOUT_MS) || 15000;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Webhook-Token': secret },
      body: JSON.stringify({ action, ...payload }),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeout),
    });
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw new ApiFailure(
      503,
      timedOut ? 'N8N_TIMEOUT' : 'N8N_UNAVAILABLE',
      timedOut ? 'n8n не відповів вчасно. Спробуйте ще раз за хвилину.' : 'Сервіс n8n недоступний. Перевірте, що n8n запущено, і спробуйте ще раз.',
    );
  }

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (res.ok) {
    if (body === null) throw new ApiFailure(502, 'N8N_BAD_RESPONSE', 'n8n повернув неочікувану відповідь.');
    return { status: res.status, body: body as T };
  }

  // Бізнес-помилки workflow (валідація, не знайдено, конфлікт місткості) передаємо як є
  const err = (body as ApiErrorBody | null)?.error;
  if (err?.code && err?.message && res.status >= 400 && res.status < 500) {
    const { code, message, ...extra } = err;
    throw new ApiFailure(res.status, code, message, extra);
  }
  if (res.status === 401 || res.status === 403) {
    throw new ApiFailure(502, 'N8N_AUTH', 'n8n відхилив запит. Перевірте, що N8N_WEBHOOK_SECRET збігається із секретом у n8n.');
  }
  if (res.status === 404) {
    throw new ApiFailure(502, 'N8N_WEBHOOK_NOT_FOUND', 'Webhook n8n не знайдено. Перевірте адресу і що workflow API опубліковано (активний).');
  }
  throw new ApiFailure(502, 'N8N_ERROR', 'Під час обробки запиту в n8n сталася помилка. Деталі — у Executions цього workflow.');
}
