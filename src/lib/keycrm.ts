/**
 * Клієнт KeyCRM Open API (лише сервер). Ключ — KEYCRM_API_KEY, у браузер не потрапляє.
 * KeyCRM обмежує кількість запитів на хвилину, тому сторінки лідів читаються послідовно з паузою 1 с (як у n8n).
 */
import { DateTime } from 'luxon';
import { ApiFailure } from './api-failure';
import { CANDIDATE_STATUS_ID, CANDIDATES_MAX_PAGES, INTERVIEW_FIELD_TYPE, INTERVIEW_FIELD_UUID, KEYCRM_API, KEYCRM_TIMEOUT_MS } from './config';
import { TZ } from './time';

export interface KeycrmCard {
  id: number | string;
  title?: string | null;
  status_id?: number | string | null;
  status?: { pipeline_id?: number | string | null } | null;
  contact?: { full_name?: string | null; phone?: string | null; client?: { phone?: string | null } | null } | null;
  custom_fields?: { uuid?: string; value?: unknown }[] | null;
}

interface CardsPage {
  data?: KeycrmCard[];
  total?: number;
  per_page?: number;
}

/** Помилка запиту до KeyCRM: текст для sync_error і повідомлень адміністратору. */
export class KeycrmError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

function apiKey(): string {
  const key = process.env.KEYCRM_API_KEY?.trim();
  if (!key) throw new ApiFailure(500, 'KEYCRM_NOT_CONFIGURED', 'Не налаштовано KEYCRM_API_KEY — без нього немає доступу до лідів KeyCRM.');
  return key;
}

function errorText(body: unknown, status: number): string {
  const b = body as { message?: unknown; error?: unknown; errors?: unknown; description?: unknown } | null;
  const parts = [b?.message, typeof b?.error === 'string' ? b.error : (b?.error as { message?: unknown } | undefined)?.message, b?.description]
    .filter((v) => typeof v === 'string' && v.trim()) as string[];
  if (b?.errors && typeof b.errors === 'object') parts.push(JSON.stringify(b.errors));
  return `HTTP ${status}${parts.length ? ': ' + parts.join(' | ') : ''}`.slice(0, 1500);
}

async function keycrm<T>(method: 'GET' | 'PUT', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(KEYCRM_API + path, {
      method,
      headers: { Authorization: `Bearer ${apiKey()}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(KEYCRM_TIMEOUT_MS),
    });
  } catch (e) {
    if (e instanceof ApiFailure) throw e;
    const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw new KeycrmError(timedOut ? 'KeyCRM не відповів вчасно' : "Немає з'єднання з KeyCRM");
  }
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) {
    if (res.status === 401) throw new KeycrmError('KeyCRM відхилив ключ API (перевірте KEYCRM_API_KEY)', 401);
    if (res.status === 429) throw new KeycrmError('Перевищено ліміт запитів до KeyCRM, спробуйте за хвилину', 429);
    throw new KeycrmError(errorText(json, res.status), res.status);
  }
  return json as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ліди у статусі «Запросили на 1 тур» (до CANDIDATES_MAX_PAGES сторінок по 50). */
export async function fetchCandidateCards(): Promise<{ cards: KeycrmCard[]; truncated: boolean }> {
  const page = (n: number) =>
    keycrm<CardsPage>('GET', `/pipelines/cards?${new URLSearchParams({
      'filter[status_id]': String(CANDIDATE_STATUS_ID),
      include: 'contact.client,status,custom_fields',
      limit: '50',
      page: String(n),
    })}`);
  const first = await page(1);
  if (!Array.isArray(first?.data)) throw new KeycrmError('Неочікувана відповідь KeyCRM');
  const per = Number(first.per_page) || 50;
  const totalPages = Math.ceil((Number(first.total) || 0) / per);
  const last = Math.min(totalPages, CANDIDATES_MAX_PAGES);
  const all = [...first.data];
  for (let n = 2; n <= last; n++) {
    await sleep(1000);
    const p = await page(n);
    if (Array.isArray(p?.data)) all.push(...p.data);
  }
  const seen = new Set<string>();
  const cards = all.filter((c) => c && c.id !== undefined && Number(c.status_id) === CANDIDATE_STATUS_ID && !seen.has(String(c.id)) && !!seen.add(String(c.id)));
  return { cards, truncated: totalPages > CANDIDATES_MAX_PAGES };
}

export async function fetchCard(cardId: string): Promise<KeycrmCard | null> {
  try {
    const k = await keycrm<KeycrmCard | CardsPage>('GET', `/pipelines/cards/${encodeURIComponent(cardId)}?include=contact.client,status,custom_fields`);
    const card = Array.isArray((k as CardsPage)?.data) ? (k as CardsPage).data!.find((c) => String(c.id) === cardId) : (k as KeycrmCard);
    return card && String(card.id) === cardId ? card : null;
  } catch (e) {
    if (e instanceof KeycrmError && e.status === 404) return null;
    throw e;
  }
}

/** Записує час співбесіди в поле картки. Статус картки не змінюється. */
export async function writeInterviewTime(cardId: string, startIso: string): Promise<void> {
  await keycrm('PUT', `/pipelines/cards/${encodeURIComponent(cardId)}`, { custom_fields: [{ uuid: INTERVIEW_FIELD_UUID, value: interviewFieldValue(startIso) }] });
}

/**
 * Очищає поле співбесіди. Документація KeyCRM не описує очищення, тому після запису картку перечитуємо:
 * спершу value: null, якщо поле лишилось — порожній рядок; якщо й тоді заповнене — помилка.
 */
export async function clearInterviewTime(cardId: string): Promise<void> {
  const path = `/pipelines/cards/${encodeURIComponent(cardId)}`;
  for (const value of [null, '']) {
    await keycrm('PUT', path, { custom_fields: [{ uuid: INTERVIEW_FIELD_UUID, value }] });
    const card = await fetchCard(cardId);
    if (!card) throw new KeycrmError('Картку KeyCRM не знайдено', 404);
    const left = cardField(card, INTERVIEW_FIELD_UUID);
    if (left === null || left === undefined || String(left).trim() === '') return;
  }
  throw new KeycrmError('KeyCRM не очистив поле співбесіди');
}

/** Значення поля співбесіди — той самий формат, що й у workflow бронювання. */
export function interviewFieldValue(startIso: string): string {
  const start = DateTime.fromISO(startIso, { zone: 'utc' });
  const local = start.setZone(TZ);
  if (INTERVIEW_FIELD_TYPE === 'datetime') return start.toUTC().toFormat("yyyy-LL-dd'T'HH:mm:ss.SSS'000Z'");
  if (INTERVIEW_FIELD_TYPE === 'date') return local.toFormat('yyyy-LL-dd');
  return local.toFormat('dd.LL.yyyy HH:mm');
}

export const cardField = (card: KeycrmCard, uuid: string) => (Array.isArray(card.custom_fields) ? card.custom_fields : []).find((f) => f && f.uuid === uuid)?.value;
export const cardName = (c: KeycrmCard) => String(c.contact?.full_name || c.title || `Картка #${c.id}`).trim();
export const cardPhone = (c: KeycrmCard) => String(c.contact?.phone || c.contact?.client?.phone || '').trim();
export const cardPipelineId = (c: KeycrmCard): number | null => {
  const v = c.status?.pipeline_id;
  return v === null || v === undefined || v === '' || !Number.isInteger(Number(v)) ? null : Number(v);
};

/** Значення поля співбесіди з KeyCRM → ISO UTC (KeyCRM віддає час в UTC: ISO або «YYYY-MM-DD HH:mm:ss»). */
export function interviewIso(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  let d = DateTime.fromISO(s, { zone: 'utc' });
  if (!d.isValid) d = DateTime.fromSQL(s, { zone: 'utc' });
  return d.isValid ? d.toUTC().toISO() : null;
}
