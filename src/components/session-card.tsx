'use client';

import { ArrowRight, CalendarDays, Clock, Eye, Pencil, Users } from 'lucide-react';
import Link from 'next/link';
import { pipelineColor, tint } from '@/lib/pipeline-colors';
import { displayState, pluralSeats } from '@/lib/session-utils';
import { formatDate, formatTime, formatWeekdayShort, kyiv } from '@/lib/time';
import type { Session } from '@/lib/types';
import { useSessionForm } from './session-form';
import { IconButton, ProgressBar, StatusBadge, cx } from './ui';

const MONTHS_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];

/** Блок дати в кольорі воронки. */
export function DateTile({ iso, muted, color }: { iso: string; muted?: boolean; color?: string }) {
  const d = kyiv(iso);
  const c = muted ? undefined : color || '#006BFF';
  return (
    <div
      className={cx('flex w-14 flex-none flex-col items-center rounded-lg py-1.5', muted && 'bg-neutral-100')}
      style={c ? { background: tint(c, 0.1) } : undefined}
    >
      <span className={cx('text-[11px] font-semibold uppercase tracking-wide', muted && 'text-ink-soft')} style={c ? { color: c } : undefined}>{MONTHS_SHORT[d.month - 1]}</span>
      <span className={cx('text-xl font-bold leading-6', muted ? 'text-ink-muted' : 'text-ink')}>{d.toFormat('d')}</span>
    </div>
  );
}

/** Кольорова смужка воронки зліва (як у типів подій Calendly). */
export function PipelineStripe({ session, className }: { session: Session; className?: string }) {
  const muted = ['past', 'closed'].includes(displayState(session));
  return <span className={cx('absolute inset-y-0 left-0 w-[5px]', muted && 'opacity-40', className)} style={{ background: pipelineColor(session.pipelineId) }} aria-hidden />;
}

export function SessionActions({ session, compact }: { session: Session; compact?: boolean }) {
  const { openEdit } = useSessionForm();
  return (
    <div className={cx('flex items-center', compact ? 'gap-0.5' : 'gap-1')}>
      <Link
        href={`/sessions/${session.id}`}
        aria-label={`Переглянути: ${session.name}`}
        title="Переглянути"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-neutral-100 hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
      >
        <Eye className="h-4 w-4" />
      </Link>
      <IconButton label={`Редагувати: ${session.name}`} onClick={() => openEdit(session)}>
        <Pencil className="h-4 w-4" />
      </IconButton>
    </div>
  );
}

/** Картка співбесіди для «Огляду» та мобільного списку. Клікабельна повністю. */
export function SessionCard({ session }: { session: Session; showName?: boolean }) {
  const { openEdit } = useSessionForm();
  const muted = ['past', 'closed'].includes(displayState(session));
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-card border border-line bg-surface py-4 pl-5 pr-4 shadow-card transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift has-[a:focus-visible]:ring-4 has-[a:focus-visible]:ring-primary/20">
      <PipelineStripe session={session} />
      <div className="flex items-start justify-between gap-3">
        {/* Посилання розтягнуте на всю картку (after:inset-0); кнопка редагування лежить поверх */}
        <Link href={`/sessions/${session.id}`} className="min-w-0 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
          <p className={cx('line-clamp-2 text-[17px] font-bold leading-snug', muted ? 'text-ink-muted' : 'text-ink')} title={session.name}>
            {session.pipelineName || <span className="text-ink-soft">Воронку не вказано</span>}
          </p>
        </Link>
        <StatusBadge session={session} className="mt-0.5 flex-none" />
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
        <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{formatWeekdayShort(session.startDate)}, {formatDate(session.startDate)}</span>
        <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" />{formatTime(session.startDate)}</span>
      </p>
      <div className="mt-auto pt-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-ink"><Users className="h-4 w-4 text-ink-muted" /> {session.currentCount} / {session.maxParticipants}</span>
          <span className="text-ink-muted">{pluralSeats(session.availableSeats)}</span>
        </div>
        <ProgressBar session={session} className="h-2" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          Відкрити <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
        <IconButton label={`Редагувати: ${session.name}`} onClick={() => openEdit(session)} className="relative z-10">
          <Pencil className="h-4 w-4" />
        </IconButton>
      </div>
    </article>
  );
}
