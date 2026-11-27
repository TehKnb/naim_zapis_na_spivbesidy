/**
 * Підключення до PostgreSQL. Імпортується ЛИШЕ на сервері (route handlers).
 * Внутрішня адреса Railway (*.railway.internal) працює лише всередині Railway,
 * тому поза ним (локальна розробка) використовується DATABASE_PUBLIC_URL.
 */
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { ApiFailure } from './api-failure';

function connectionString(): string {
  const internal = process.env.DATABASE_URL?.trim() ?? '';
  const pub = process.env.DATABASE_PUBLIC_URL?.trim() ?? '';
  const onRailway = !!(process.env.RAILWAY_ENVIRONMENT_ID || process.env.RAILWAY_PROJECT_ID);
  const isInternal = (u: string) => {
    try { return new URL(u).hostname.endsWith('.railway.internal'); } catch { return false; }
  };
  const url = internal && (onRailway || !isInternal(internal)) ? internal : pub || internal;
  if (!url) throw new ApiFailure(500, 'DB_NOT_CONFIGURED', 'Не налаштовано підключення до бази даних (DATABASE_URL).');
  return url;
}

let dbHost = '';

function createPool(): Pool {
  const url = connectionString();
  const host = new URL(url).hostname;
  dbHost = `${host}:${new URL(url).port || 5432}`;
  const plain = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.railway.internal') || process.env.DATABASE_SSL === 'disable';
  const pool = new Pool({
    connectionString: url,
    // Публічний проксі Railway має самопідписаний сертифікат: з'єднання шифрується, ланцюжок не перевіряється
    ssl: plain ? false : { rejectUnauthorized: false },
    max: Number(process.env.DATABASE_POOL_MAX) || 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
  });
  pool.on('error', (e) => console.error('[db] idle client error', e.message));
  return pool;
}

// Один пул на процес (у dev Next перезавантажує модулі — тримаємо пул у globalThis)
const g = globalThis as unknown as { __interviewPool?: Pool };
function pool(): Pool {
  return (g.__interviewPool ??= createPool());
}

const CONNECTION_CODES = /^(ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|EHOSTUNREACH|08\w{3}|57P0\d|53300)$/;

/** Збої з'єднання з базою → 503 з людським повідомленням; решта лишається як є. */
export function asDbFailure(e: unknown): unknown {
  if (e instanceof ApiFailure) return e;
  const err = e as { code?: string; message?: string };
  const msg = String(err?.message ?? '');
  if ((err?.code && CONNECTION_CODES.test(err.code)) || /timeout exceeded when trying to connect|Connection terminated/i.test(msg)) {
    // Причина — у логах сервера (без пароля): напр. ENOTFOUND для *.railway.internal з іншого проєкту Railway
    console.error(`[db] connection failed: ${err?.code ?? '-'} host=${dbHost || '?'} ${msg.replace(/postgres(ql)?:\/\/\S+/g, '[url]').slice(0, 200)}`);
    return new ApiFailure(503, 'DB_UNAVAILABLE', 'База даних тимчасово недоступна. Спробуйте ще раз за хвилину.');
  }
  return e;
}

export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    return (await pool().query<T>(sql, params)).rows;
  } catch (e) {
    throw asDbFailure(e);
  }
}

export type Tx = Pick<PoolClient, 'query'>;

/** Виконує fn у транзакції; при помилці — ROLLBACK. */
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let client: PoolClient;
  try {
    client = await pool().connect();
  } catch (e) {
    throw asDbFailure(e);
  }
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw asDbFailure(e);
  } finally {
    client.release();
  }
}
