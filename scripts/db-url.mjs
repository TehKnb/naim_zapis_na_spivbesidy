/**
 * Вибір рядка підключення для скриптів (та сама логіка, що й у src/lib/db.ts):
 * внутрішня адреса Railway (*.railway.internal) доступна лише всередині Railway,
 * тому поза ним використовується DATABASE_PUBLIC_URL.
 */
/** Локально підхоплює .env.local (змінні, вже задані в середовищі, мають пріоритет). */
export function loadLocalEnv() {
  for (const f of ['.env.local', '.env']) {
    try { process.loadEnvFile(f); } catch { /* файлу немає — ок */ }
  }
}

export function databaseUrl(env = process.env) {
  const internal = env.DATABASE_URL?.trim() ?? '';
  const pub = env.DATABASE_PUBLIC_URL?.trim() ?? '';
  const onRailway = !!(env.RAILWAY_ENVIRONMENT_ID || env.RAILWAY_PROJECT_ID);
  const isInternal = (u) => { try { return new URL(u).hostname.endsWith('.railway.internal'); } catch { return false; } };
  const url = internal && (onRailway || !isInternal(internal)) ? internal : pub || internal;
  if (!url) throw new Error('Не задано DATABASE_URL (або DATABASE_PUBLIC_URL)');
  return url;
}

export function databaseConfig(env = process.env) {
  const connectionString = databaseUrl(env);
  const host = new URL(connectionString).hostname;
  const local = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.railway.internal');
  // Публічний проксі Railway має самопідписаний сертифікат: шифруємо, але не перевіряємо ланцюжок
  return { connectionString, ssl: local || env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false } };
}
