import { DateTime } from 'luxon';

/**
 * Єдине джерело правди для часу в застосунку.
 * - Зберігання та передача: ISO 8601 у UTC (n8n Data Tables, API).
 * - Показ і введення: завжди Europe/Kyiv, незалежно від часового поясу браузера чи сервера.
 * Luxon коректно враховує перехід на літній / зимовий час.
 */
export const TZ = 'Europe/Kyiv';
export const LOCALE = 'uk';

export function kyiv(iso: string): DateTime {
  return DateTime.fromISO(iso, { zone: 'utc' }).setZone(TZ).setLocale(LOCALE);
}

export function nowKyiv(): DateTime {
  return DateTime.now().setZone(TZ).setLocale(LOCALE);
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** «12 листопада» (рік додається, якщо не поточний). */
export function formatDate(iso: string): string {
  const d = kyiv(iso);
  return d.year === nowKyiv().year ? d.toFormat('d MMMM') : d.toFormat('d MMMM yyyy');
}

/** «Четвер» */
export function formatWeekday(iso: string): string {
  return cap(kyiv(iso).toFormat('cccc'));
}

/** «Чт» */
export function formatWeekdayShort(iso: string): string {
  return cap(kyiv(iso).toFormat('ccc'));
}

/** «14:00» */
export function formatTime(iso: string): string {
  return kyiv(iso).toFormat('HH:mm');
}

/** «Четвер, 12 листопада 2026, 14:00» */
export function formatFull(iso: string): string {
  const d = kyiv(iso);
  return `${cap(d.toFormat('cccc'))}, ${d.toFormat('d MMMM yyyy')}, ${d.toFormat('HH:mm')}`;
}

export function isPastIso(iso: string): boolean {
  return DateTime.fromISO(iso).toMillis() <= Date.now();
}

/** UTC ISO → поля форми у київському часі. */
export function toLocalParts(iso: string): { date: string; time: string } {
  const d = kyiv(iso);
  return { date: d.toFormat('yyyy-LL-dd'), time: d.toFormat('HH:mm') };
}

export type LocalToUtcResult = { ok: true; iso: string } | { ok: false; code: 'INVALID' | 'NONEXISTENT_TIME'; message: string };

/**
 * Поля форми (київський час) → UTC ISO.
 * Відхиляє час, якого не існує через перехід на літній час (наприклад, 03:30 в останню неділю березня).
 * Неоднозначний час під час переходу на зимовий (03:00–03:59 в останню неділю жовтня) Luxon трактує однозначно,
 * а адмін бачить результат одразу після збереження.
 */
export function localPartsToUtc(date: string, time: string): LocalToUtcResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return { ok: false, code: 'INVALID', message: 'Некоректна дата або час' };
  }
  const d = DateTime.fromISO(`${date}T${time}`, { zone: TZ });
  if (!d.isValid) return { ok: false, code: 'INVALID', message: 'Некоректна дата або час' };
  if (d.toFormat('yyyy-LL-dd') !== date || d.toFormat('HH:mm') !== time) {
    return {
      ok: false,
      code: 'NONEXISTENT_TIME',
      message: 'Цього часу не існує через перехід на літній час. Оберіть інший час.',
    };
  }
  return { ok: true, iso: d.toUTC().toISO()! };
}

/** Прев'ю автоматичної назви (остаточну назву формує n8n за тим самим правилом). */
export function previewSessionName(date: string, time: string): string | null {
  const r = localPartsToUtc(date, time);
  if (!r.ok) return null;
  return `Групова співбесіда — ${kyiv(r.iso).toFormat('d MMMM, HH:mm')}`;
}

/** Початок тижня (понеділок) у Києві. */
export function startOfWeekKyiv(d: DateTime): DateTime {
  return d.setZone(TZ).startOf('week');
}

export function dayKey(d: DateTime): string {
  return d.toFormat('yyyy-LL-dd');
}

export function dayKeyOf(iso: string): string {
  return kyiv(iso).toFormat('yyyy-LL-dd');
}
