#!/usr/bin/env node
/**
 * Одноразове перенесення даних з n8n Data Tables у PostgreSQL.
 *
 *   npm run db:import -- export.json [--dry-run | --replace]
 *
 * export.json — вихід вузла «Експорт» тимчасового workflow «TMP: експорт Data Tables у PostgreSQL»:
 *   { sessions: [...], participants: [...], responsibles: [...] }
 *
 * Співбесіди й учасники переносяться в ПОРОЖНІ таблиці зі збереженням ID (порядок записів важливий для бронювання).
 * --replace спершу очищає interview_sessions і interview_participants — лише для повторного перенесення
 *           ДО запуску нової системи (після запуску там будуть нові записи, які це видалить).
 * Відповідальні оновлюються за employee_id.
 */
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { databaseConfig, loadLocalEnv } from './db-url.mjs';

loadLocalEnv();

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error('Вкажіть файл експорту: node scripts/import-datatables.mjs export.json [--dry-run]');
  process.exit(1);
}
const dryRun = flag === '--dry-run';
const replace = flag === '--replace';
const data = JSON.parse(await readFile(file, 'utf8'));
const list = (v) => (Array.isArray(v) ? v : []);

const ids = (v) => [...new Set(String(v ?? '').split(/[^0-9]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
const ts = (v) => (v ? new Date(v).toISOString() : null);
const STATUSES = ['Open', 'Full', 'Closed'];
const REG = ['Reserved', 'Confirmed', 'Cancelled'];
const SYNC = ['Pending', 'Synced', 'Failed'];

const responsibles = list(data.responsibles)
  .map((r) => ({ employee_id: Number(r.employee_id), name: String(r.name ?? '').trim(), discord_id: String(r.discord_id ?? '').trim(), created_at: ts(r.createdAt) }))
  .filter((r) => Number.isInteger(r.employee_id) && r.employee_id > 0 && r.name);

const sessions = list(data.sessions).map((s) => ({
  id: Number(s.id),
  session_id: String(s.session_id ?? '').trim(),
  session_name: String(s.session_name ?? ''),
  start_date: ts(s.start_date),
  max_participants: Number(s.max_participants) > 0 ? Number(s.max_participants) : 10,
  status: STATUSES.includes(s.status) ? s.status : 'Open',
  pipeline_id: Number.isInteger(Number(s.pipeline_id)) && s.pipeline_id !== null && s.pipeline_id !== '' ? Number(s.pipeline_id) : null,
  pipeline_name: String(s.pipeline_name ?? ''),
  responsible_ids: ids(s.responsible_ids),
  created_at: ts(s.createdAt),
}));
const badSessions = sessions.filter((s) => !s.session_id || !s.start_date);

const sessionIds = new Set(sessions.map((s) => s.session_id));
const participants = list(data.participants).map((p) => ({
  id: Number(p.id),
  keycrm_id: String(p.keycrm_id ?? '').trim(),
  name: String(p.name ?? ''),
  phone: String(p.phone ?? ''),
  session_id: String(p.session_id ?? '').trim(),
  registration_status: REG.includes(p.registration_status) ? p.registration_status : 'Reserved',
  keycrm_sync: SYNC.includes(p.keycrm_sync) ? p.keycrm_sync : 'Pending',
  sync_error: String(p.sync_error ?? ''),
  created_at: ts(p.createdAt),
}));
const orphans = participants.filter((p) => !sessionIds.has(p.session_id) || !p.keycrm_id);

console.log(`Відповідальні: ${responsibles.length}, співбесіди: ${sessions.length}, учасники: ${participants.length}`);
if (badSessions.length) console.log(`⚠ Пропущено співбесід без session_id/дати: ${badSessions.length}`);
if (orphans.length) console.log(`⚠ Пропущено учасників без співбесіди або keycrm_id: ${orphans.map((p) => p.id).join(', ')}`);
if (dryRun) {
  console.log('Перевірка без запису (--dry-run): нічого не змінено.');
  process.exit(0);
}

const client = new pg.Client(databaseConfig());
await client.connect();
try {
  await client.query('BEGIN');
  const existing = (await client.query('SELECT (SELECT count(*) FROM interview_sessions)::int s, (SELECT count(*) FROM interview_participants)::int p')).rows[0];
  if (existing.s + existing.p > 0) {
    if (!replace) throw new Error(`у базі вже є співбесіди (${existing.s}) або учасники (${existing.p}). Для повторного перенесення до запуску додайте --replace`);
    await client.query('TRUNCATE interview_participants, interview_sessions RESTART IDENTITY');
    console.log(`Очищено перед перенесенням: співбесід ${existing.s}, учасників ${existing.p}`);
  }
  for (const r of responsibles) {
    await client.query(
      `INSERT INTO interview_responsibles (employee_id, name, discord_id, created_at) VALUES ($1, $2, $3, COALESCE($4, now()))
       ON CONFLICT (employee_id) DO UPDATE SET name = EXCLUDED.name, discord_id = EXCLUDED.discord_id`,
      [r.employee_id, r.name, r.discord_id, r.created_at],
    );
  }
  for (const s of sessions.filter((x) => !badSessions.includes(x))) {
    await client.query(
      `INSERT INTO interview_sessions (id, session_id, session_name, start_date, max_participants, status, pipeline_id, pipeline_name, responsible_ids, created_at)
       OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, now()))`,
      [s.id, s.session_id, s.session_name, s.start_date, s.max_participants, s.status, s.pipeline_id, s.pipeline_name, s.responsible_ids, s.created_at],
    );
  }
  for (const p of participants.filter((x) => !orphans.includes(x))) {
    await client.query(
      `INSERT INTO interview_participants (id, keycrm_id, name, phone, session_id, registration_status, keycrm_sync, sync_error, created_at)
       OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, now()))`,
      [p.id, p.keycrm_id, p.name, p.phone, p.session_id, p.registration_status, p.keycrm_sync, p.sync_error, p.created_at],
    );
  }
  // Нові записи отримають ID після перенесених
  for (const t of ['interview_sessions', 'interview_participants']) {
    await client.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), GREATEST((SELECT COALESCE(max(id), 0) FROM ${t}), 1), (SELECT count(*) > 0 FROM ${t}))`);
  }
  await client.query('COMMIT');
  const counts = await client.query(`SELECT (SELECT count(*) FROM interview_responsibles)::int r, (SELECT count(*) FROM interview_sessions)::int s, (SELECT count(*) FROM interview_participants)::int p`);
  console.log(`✓ Перенесено. У базі: відповідальних ${counts.rows[0].r}, співбесід ${counts.rows[0].s}, учасників ${counts.rows[0].p}`);
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Помилка, зміни скасовано:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
