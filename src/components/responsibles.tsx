'use client';

import { Check, ChevronDown, Search, UserRound } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { pipelineColor, tint } from '@/lib/pipeline-colors';
import type { Responsible, Session, SessionResponsible } from '@/lib/types';
import { cx } from './ui';

export function sessionResponsibles(s: Session): SessionResponsible[] {
  return s.responsibles ?? [];
}

function initials(name: string) {
  const parts = name.replace(/[ʼ'’]/g, '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** «Юлія Максименко» → «Юлія М.» */
export function shortName(name: string) {
  const [first, last] = name.split(/\s+/).filter(Boolean);
  return last ? `${first} ${last[0]}.` : first ?? name;
}

/** Кружечок з ініціалами в кольорі співробітника. */
export function ResponsibleAvatar({ person, className }: { person: Pick<Responsible, 'id' | 'name'>; className?: string }) {
  const c = pipelineColor(person.id);
  return (
    <span
      className={cx('inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-[11px] font-bold ring-2 ring-surface', className)}
      style={{ background: tint(c, 0.16), color: c }}
      title={person.name}
      aria-hidden
    >
      {initials(person.name)}
    </span>
  );
}

/** Аватарки внахлест + «+N». */
export function ResponsibleStack({ people, max = 3, className }: { people: SessionResponsible[]; max?: number; className?: string }) {
  if (!people.length) return null;
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className={cx('inline-flex flex-none items-center -space-x-1.5', className)} title={people.map((p) => p.name).join(', ')}>
      {shown.map((p) => <ResponsibleAvatar key={p.id} person={p} />)}
      {rest > 0 && <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-bold text-ink-muted ring-2 ring-surface">+{rest}</span>}
    </span>
  );
}

/** Рядок «відповідальні» для карток: аватарки + скорочені імена. */
export function ResponsibleSummary({ session, className, full }: { session: Session; className?: string; full?: boolean }) {
  const people = sessionResponsibles(session);
  if (!people.length) {
    return (
      <span className={cx('inline-flex items-center gap-1.5 text-ink-soft', className)}>
        <UserRound className="h-4 w-4 flex-none" /> Відповідальних не призначено
      </span>
    );
  }
  const names = people.map((p) => (full || people.length === 1 ? p.name : shortName(p.name)));
  const label = names.length > 2 && !full ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
  return (
    <span className={cx('inline-flex min-w-0 items-center gap-2', className)} title={people.map((p) => p.name).join(', ')}>
      <ResponsibleStack people={people} max={full ? 4 : 2} />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Вибір кількох відповідальних випадаючим списком (форма створення / редагування). */
export function ResponsibleSelect({
  options,
  value,
  onToggle,
  onClear,
  disabled,
  loading,
  invalid,
}: {
  options: SessionResponsible[];
  value: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
  disabled?: boolean;
  loading?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = value.map((id) => options.find((o) => o.id === id)).filter(Boolean) as SessionResponsible[];
  const needle = q.trim().toLowerCase();
  const visible = needle ? options.filter((o) => o.name.toLowerCase().includes(needle)) : options;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    const t = setTimeout(() => {
      search.current?.focus({ preventScroll: true });
      // Список усередині прокручуваної форми — докручуємо, щоб його було видно повністю
      panel.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 0);
    return () => { document.removeEventListener('mousedown', onDown); clearTimeout(t); };
  }, [open]);

  const close = () => { setOpen(false); setQ(''); trigger.current?.focus(); };
  const optionButtons = () => [...(root.current?.querySelectorAll<HTMLButtonElement>('[role=option]') ?? [])];
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; } // Escape закриває список, а не всю форму
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = optionButtons();
      if (!items.length) return;
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % items.length : i <= 0 ? items.length - 1 : i - 1;
      items[next].focus();
    }
  };

  return (
    <div ref={root} className="relative" onKeyDown={open ? onKeyDown : undefined}>
      <button
        ref={trigger}
        type="button"
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          'flex min-h-10 w-full items-center gap-2 rounded-lg border bg-surface py-1.5 pl-2 pr-9 text-left text-sm outline-none transition focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 disabled:bg-neutral-50',
          open ? 'border-primary ring-4 ring-primary/15' : invalid ? 'border-danger' : 'border-line-strong',
        )}
      >
        {selected.length ? (
          <span className="flex min-w-0 flex-wrap gap-1.5">
            {selected.map((p) => (
              <span key={p.id} className={cx('inline-flex h-7 items-center gap-1.5 rounded-full bg-primary-50 py-0.5 pl-0.5 pr-2.5 text-[13px] font-medium text-primary', p.missing && 'line-through')}>
                <ResponsibleAvatar person={p} className="h-6 w-6 text-[10px] ring-0" />
                {p.name}
              </span>
            ))}
          </span>
        ) : (
          <span className="px-1 text-ink-soft">{loading ? 'Завантаження співробітників…' : 'Оберіть відповідальних'}</span>
        )}
        <ChevronDown className={cx('pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div ref={panel} className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
          <div className="relative border-b border-line p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <input
              ref={search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (visible.length === 1) onToggle(visible[0].id); } }}
              placeholder="Пошук за ім'ям"
              aria-label="Пошук співробітника"
              className="h-9 w-full rounded-lg bg-neutral-50 pl-8 pr-3 text-sm text-ink outline-none placeholder:text-ink-soft focus:bg-surface focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div id={listId} role="listbox" aria-multiselectable="true" aria-label="Відповідальні" className="max-h-56 overflow-y-auto p-1">
            {visible.length === 0 && <p className="px-3 py-4 text-center text-sm text-ink-soft">Нікого не знайдено</p>}
            {visible.map((p) => {
              const on = value.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => onToggle(p.id)}
                  className={cx('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors hover:bg-neutral-50 focus-visible:bg-primary-50', on && 'bg-primary-50/60')}
                >
                  <span className={cx('flex h-[18px] w-[18px] flex-none items-center justify-center rounded border', on ? 'border-primary bg-primary text-white' : 'border-line-strong bg-surface')}>
                    {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                  <ResponsibleAvatar person={p} className="ring-0" />
                  <span className={cx('min-w-0 flex-1 truncate font-medium', on ? 'text-primary' : 'text-ink', p.missing && 'line-through')}>{p.name}</span>
                  {p.missing ? (
                    <span className="text-[11px] text-ink-soft">немає в довіднику</span>
                  ) : !p.discordLinked && (
                    <span className="rounded bg-neutral-100 px-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">без Discord</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs">
            <span className="text-ink-muted">Обрано: {value.length}</span>
            <span className="flex gap-3">
              {value.length > 0 && <button type="button" onClick={onClear} className="font-semibold text-ink-muted hover:text-ink">Очистити</button>}
              <button type="button" onClick={close} className="font-semibold text-primary hover:underline">Готово</button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
