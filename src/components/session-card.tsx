'use client';

import { Clock, Eye, Pencil, Users } from 'lucide-react';
import Link from 'next/link';
import { displayState, pluralSeats } from '@/lib/session-utils';
import { formatDate, formatTime, formatWeekday, kyiv } from '@/lib/time';
import type { Session } from '@/lib/types';
import { useSessionForm } from './session-form';
import { IconButton, ProgressBar, StatusBadge, cx } from './ui';

const MONTHS_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];

/** Блок дати в стилі календарного листка. */
export function DateTile({ iso, muted }: { iso: string; muted?: boolean }) {
  const d = kyiv(iso);
  return (
    <div className={cx('flex w-14 flex-none flex-col items-center rounded-lg border py-1.5', muted ? 'border-line bg-neutral-50' : 'border-primary/15 bg-primary-50')}>
      <span className={cx('text-[11px] font-medium uppercase tracking-wide', muted ? 'text-ink-muted' : 'text-primary')}>{MONTHS_SHORT[d.month - 1]}</span>
      <span className={cx('text-xl font-semibold leading-6', muted ? 'text-ink-muted' : 'text-ink')}>{d.toFormat('d')}</span>
    </div>
  );
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

/** Картка співбесіди для «Огляду» та мобільного списку. */
export function SessionCard({ session, showName }: { session: Session; showName?: boolean }) {
  const muted = ['past', 'closed'].includes(displayState(session));
  return (
    <article className="group flex flex-col rounded-card border border-line bg-surface p-4 transition-colors hover:border-line-strong">
      <div className="flex items-start gap-3">
        <DateTile iso={session.startDate} muted={muted} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap-reverse items-start justify-between gap-x-2 gap-y-1.5">
            <Link href={`/sessions/${session.id}`} className="block min-w-0 rounded focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
              {showName && <p className="mb-0.5 text-sm font-semibold text-ink">{session.name}</p>}
              <p className={showName ? 'text-sm text-ink-muted' : 'text-sm font-semibold text-ink'}>{formatWeekday(session.startDate)}, {formatDate(session.startDate)}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted"><Clock className="h-3.5 w-3.5" /> {formatTime(session.startDate)}</p>
            </Link>
            <StatusBadge session={session} />
          </div>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 font-medium text-ink"><Users className="h-4 w-4 text-ink-muted" /> {session.currentCount}/{session.maxParticipants}</span>
          <span className="text-ink-muted">{pluralSeats(session.availableSeats)}</span>
        </div>
        <ProgressBar session={session} />
      </div>
      <div className="mt-3 flex items-center justify-end border-t border-line pt-2">
        <SessionActions session={session} />
      </div>
    </article>
  );
}
