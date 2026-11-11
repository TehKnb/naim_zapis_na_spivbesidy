'use client';

import { Check, UserRound } from 'lucide-react';
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

/** Вибір кількох відповідальних (форма створення / редагування). */
export function ResponsiblePicker({
  options,
  value,
  onToggle,
  disabled,
}: {
  options: SessionResponsible[];
  value: number[];
  onToggle: (id: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Відповідальні">
      {options.map((p) => {
        const on = value.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(p.id)}
            title={p.missing ? 'Співробітника немає в довіднику' : !p.discordLinked ? 'Немає Discord ID: у повідомленні буде лише імʼя' : undefined}
            className={cx(
              'inline-flex h-9 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-60',
              on ? 'border-primary bg-primary-50 text-primary' : 'border-line-strong bg-surface text-ink hover:border-ink/40',
            )}
          >
            {on ? (
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white"><Check className="h-4 w-4" /></span>
            ) : (
              <ResponsibleAvatar person={p} className="ring-0" />
            )}
            <span className={cx(p.missing && 'line-through decoration-ink-soft')}>{p.name}</span>
            {!p.discordLinked && !p.missing && <span className="rounded bg-neutral-100 px-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">без Discord</span>}
          </button>
        );
      })}
    </div>
  );
}
