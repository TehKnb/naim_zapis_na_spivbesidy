'use client';

import type { ApiErrorBody, Pipeline, Session, SessionDetails, SessionInput } from './types';

export class ClientApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
  get isN8nDown() {
    return ['N8N_UNAVAILABLE', 'N8N_TIMEOUT', 'NETWORK'].includes(this.code);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      cache: 'no-store',
    });
  } catch {
    throw new ClientApiError(0, 'NETWORK', "Немає зв'язку із сервером. Перевірте інтернет-з'єднання.");
  }
  const body = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) {
    const e = body?.error;
    const { code, message, fields, ...extra } = (e || {}) as { code?: string; message?: string; fields?: Record<string, string> };
    throw new ClientApiError(res.status, code || 'HTTP_' + res.status, message || 'Не вдалося виконати запит.', fields || {}, extra);
  }
  return body as T;
}

export const api = {
  list: () => request<{ sessions: Session[] }>('/api/sessions'),
  pipelines: () => request<{ pipelines: Pipeline[] }>('/api/pipelines'),
  get: (id: string) => request<SessionDetails>(`/api/sessions/${encodeURIComponent(id)}`),
  create: (input: SessionInput) => request<{ session: Session }>('/api/sessions', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: SessionInput) =>
    request<{ session: Session }>(`/api/sessions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  close: (id: string) => request<{ session: Session }>(`/api/sessions/${encodeURIComponent(id)}/close`, { method: 'POST' }),
};
