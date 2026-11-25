#!/usr/bin/env node
/**
 * Застосовує SQL-міграції з db/migrations (по порядку назв файлів), кожну — в окремій транзакції.
 * Застосовані міграції записуються в таблицю schema_migrations, тож повторний запуск безпечний.
 *
 *   npm run db:migrate            — локально (бере змінні з .env.local)
 *   node scripts/db-migrate.mjs   — на сервері (змінні середовища вже задані)
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { databaseConfig, loadLocalEnv } from './db-url.mjs';

loadLocalEnv();

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');
const client = new pg.Client(databaseConfig());

try {
  await client.connect();
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  // Захист від одночасного запуску двох міграцій
  await client.query('SELECT pg_advisory_lock(727274001)');
  const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  let applied = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(path.join(dir, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`✓ ${file}`);
      applied++;
    } catch (e) {
      await client.query('ROLLBACK');
      throw new Error(`${file}: ${e.message}`);
    }
  }
  console.log(applied ? `Застосовано міграцій: ${applied}` : 'Схема вже актуальна');
} catch (e) {
  console.error('Помилка міграції:', e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
