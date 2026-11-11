'use client';

import { ChevronLeft, ChevronRight, Clock, Users } from 'lucide-react';
import type { DateTime } from 'luxon';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { displayState, STATE_META } from '@/lib/session-utils';
import { dayKey, dayKeyOf, formatTime, kyiv, nowKyiv } from '@/lib/time';
import type { Session } from '@/lib/types';
import { Button, cx, IconButton } from './ui';

type View = 'month' | 'week';
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function range(start: DateTime, end: DateTime): DateTime[] {
  const out: DateTime[] = [];
  for (let d = start; d <= end; d = d.plus({ days: 1 })) out.push(d);
  return out;
}

export function CalendarLegend({ className }: { className?: string }) {
  const items: [string, string][] = [['bg-primary', 'Відкрита'], ['bg-warning', 'Заповнена'], ['bg-ink-soft', 'Закрита або минула']];
  return (
    <div className={cx('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted', className)}>
      {items.map(([c, l]) => (
        <span key={l} className="inline-flex items-center gap-1.5"><span className={cx('h-2 w-2 rounded-full', c)} />{l}</span>
      ))}
    </div>
  );
}

function EventChip({ s, onOpen, full }: { s: Session; onOpen: (s: Session) => void; full?: boolean }) {
  const m = STATE_META[displayState(s)];
  return (
    <button
      type="button"
      onClick={() => onOpen(s)}
      title={`${s.pipelineName || 'Воронку не вказано'} · ${formatTime(s.startDate)} · ${s.currentCount}/${s.maxParticipants} · ${m.label}`}
      className={cx(
        'flex w-full items-center gap-1.5 rounded-md border px-1.5 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        full ? 'flex-col items-start gap-0.5 py-2 px-2.5' : 'h-6',
        m.event,
      )}
    >
      {full ? (
        <>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(s.startDate)}</span>
          {s.pipelineName && <span className="line-clamp-2 w-full break-words text-center font-normal">{s.pipelineName}</span>}
          <span className="flex items-center gap-1 font-normal opacity-90"><Users className="h-3 w-3" />{s.currentCount}/{s.maxParticipants}</span>
          <span className="font-normal opacity-80">{m.label}</span>
        </>
      ) : (
        <>
          <span className={cx('h-1.5 w-1.5 flex-none rounded-full', m.dot)} />
          <span className="truncate">{formatTime(s.startDate)} · {s.currentCount}/{s.maxParticipants}</span>
        </>
      )}
    </button>
  );
}

function DayList({ day, items, onOpen }: { day: DateTime; items: Session[]; onOpen: (s: Session) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink">{cap(day.toFormat('cccc, d MMMM'))}</p>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-ink-muted">Немає співбесід</p>
      ) : (
        <div className="space-y-2">
          {items.map((s) => {
            const m = STATE_META[displayState(s)];
            return (
              <button key={s.id} type="button" onClick={() => onOpen(s)}
                className={cx('flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors', m.event)}>
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  <span className={cx('h-2 w-2 flex-none rounded-full', m.dot)} />{formatTime(s.startDate)}
                  {s.pipelineName && <span className="truncate font-normal">{s.pipelineName}</span>}
                </span>
                <span className="flex flex-none items-center gap-3 text-xs"><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{s.currentCount}/{s.maxParticipants}</span>{m.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CalendarView({ sessions }: { sessions: Session[] }) {
  const router = useRouter();
  const today = nowKyiv().startOf('day');
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<DateTime>(today);
  const [selected, setSelected] = useState<string>(dayKey(today));

  const byDay = useMemo(() => {
    const m = new Map<string, Session[]>();
    for (const s of [...sessions].sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))) {
      const k = dayKeyOf(s.startDate);
      m.set(k, [...(m.get(k) || []), s]);
    }
    return m;
  }, [sessions]);

  const open = (s: Session) => router.push(`/sessions/${s.id}`);
  const days = view === 'month'
    ? range(cursor.startOf('month').startOf('week'), cursor.endOf('month').endOf('week').startOf('day'))
    : range(cursor.startOf('week'), cursor.startOf('week').plus({ days: 6 }));
  const title = view === 'month'
    ? cap(cursor.toFormat('LLLL yyyy'))
    : (() => {
        const a = cursor.startOf('week'), b = a.plus({ days: 6 });
        return a.month === b.month ? `${a.toFormat('d')}–${b.toFormat('d MMMM yyyy')}` : `${a.toFormat('d MMMM')} – ${b.toFormat('d MMMM yyyy')}`;
      })();
  const shift = (dir: 1 | -1) => setCursor((c) => (view === 'month' ? c.plus({ months: dir }).startOf('month') : c.plus({ weeks: dir })));
  const selectedDay = kyiv(`${selected}T12:00:00Z`).startOf('day');

  return (
    <div>
      {/* Панель керування */}
      <div className="flex flex-col gap-3 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setCursor(today); setSelected(dayKey(today)); }}>Сьогодні</Button>
          <div className="flex items-center">
            <IconButton label="Попередній період" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></IconButton>
            <IconButton label="Наступний період" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></IconButton>
          </div>
          <h2 className="text-base font-semibold text-ink" aria-live="polite">{title}</h2>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <CalendarLegend className="hidden lg:flex" />
          <div className="inline-flex rounded-lg border border-line bg-neutral-50 p-0.5" role="tablist" aria-label="Режим календаря">
            {(['month', 'week'] as View[]).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={cx('h-7 rounded-md px-3 text-[13px] font-medium transition-colors', view === v ? 'bg-surface text-ink shadow-xs ring-1 ring-line' : 'text-ink-muted hover:text-ink')}>
                {v === 'month' ? 'Місяць' : 'Тиждень'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'month' ? (
        <>
          {/* Місяць: desktop / tablet */}
          <div className="hidden md:block">
            <div className="grid grid-cols-7 border-b border-line bg-neutral-50">
              {WEEKDAYS.map((w) => <div key={w} className="px-2 py-2 text-xs font-medium text-ink-muted">{w}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d, i) => {
                const items = byDay.get(dayKey(d)) || [];
                const inMonth = d.month === cursor.month;
                const isToday = d.hasSame(today, 'day');
                return (
                  <div key={dayKey(d)} className={cx('min-h-[112px] border-line p-1.5', i % 7 !== 6 && 'border-r', i < days.length - 7 && 'border-b', !inMonth && 'bg-neutral-50/70')}>
                    <div className="mb-1 flex justify-end">
                      <span className={cx('flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs', isToday ? 'bg-primary font-semibold text-white' : inMonth ? 'text-ink' : 'text-ink-soft')}>{d.day}</span>
                    </div>
                    <div className="space-y-1">
                      {items.slice(0, 3).map((s) => <EventChip key={s.id} s={s} onOpen={open} />)}
                      {items.length > 3 && (
                        <button type="button" onClick={() => { setCursor(d); setView('week'); }} className="w-full rounded px-1.5 text-left text-xs font-medium text-primary hover:underline">
                          +{items.length - 3} ще
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Місяць: mobile — компактна сітка + події вибраного дня */}
          <div className="md:hidden">
            <div className="grid grid-cols-7 px-2 pt-2">
              {WEEKDAYS.map((w) => <div key={w} className="py-1 text-center text-[11px] font-medium text-ink-muted">{w}</div>)}
              {days.map((d) => {
                const k = dayKey(d);
                const items = byDay.get(k) || [];
                const inMonth = d.month === cursor.month;
                const isSel = k === selected;
                const isToday = d.hasSame(today, 'day');
                return (
                  <button key={k} type="button" onClick={() => setSelected(k)} aria-pressed={isSel} aria-label={`${d.toFormat('d MMMM')}: ${items.length} співбесід`}
                    className="flex h-12 flex-col items-center justify-start gap-1 pt-1">
                    <span className={cx('flex h-7 w-7 items-center justify-center rounded-full text-[13px]',
                      isSel ? 'bg-primary font-semibold text-white' : isToday ? 'font-semibold text-primary ring-1 ring-primary/40' : inMonth ? 'text-ink' : 'text-ink-soft')}>{d.day}</span>
                    <span className="flex h-1.5 gap-0.5">
                      {items.slice(0, 3).map((s) => <span key={s.id} className={cx('h-1.5 w-1.5 rounded-full', STATE_META[displayState(s)].dot)} />)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-line p-3">
              <DayList day={selectedDay} items={byDay.get(selected) || []} onOpen={open} />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Тиждень: desktop / tablet */}
          <div className="hidden grid-cols-7 md:grid">
            {days.map((d, i) => {
              const items = byDay.get(dayKey(d)) || [];
              const isToday = d.hasSame(today, 'day');
              return (
                <div key={dayKey(d)} className={cx('min-h-[320px] border-line', i !== 6 && 'border-r')}>
                  <div className={cx('border-b border-line px-2 py-2 text-center', isToday && 'bg-primary-50')}>
                    <p className="text-xs font-medium text-ink-muted">{WEEKDAYS[i]}</p>
                    <p className={cx('text-lg font-semibold', isToday ? 'text-primary' : 'text-ink')}>{d.day}</p>
                  </div>
                  <div className="space-y-1.5 p-1.5">
                    {items.map((s) => <EventChip key={s.id} s={s} onOpen={open} full />)}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Тиждень: mobile — список днів */}
          <div className="space-y-4 p-3 md:hidden">
            {days.map((d) => <DayList key={dayKey(d)} day={d} items={byDay.get(dayKey(d)) || []} onOpen={open} />)}
          </div>
        </>
      )}
      <CalendarLegend className="border-t border-line px-4 py-3 lg:hidden" />
    </div>
  );
}
