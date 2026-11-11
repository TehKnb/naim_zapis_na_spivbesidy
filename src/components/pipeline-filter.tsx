'use client';

import { ChevronDown, Funnel } from 'lucide-react';
import { usePipelines } from '@/hooks/use-sessions';
import { pipelineColor } from '@/lib/pipeline-colors';
import type { Session } from '@/lib/types';
import { cx } from './ui';

/** Значення фільтра: 'all' або ID воронки рядком. */
export type PipelineFilterValue = 'all' | string;

export function matchesPipeline(s: Session, value: PipelineFilterValue): boolean {
  return value === 'all' || String(s.pipelineId ?? '') === value;
}

/** Кольорова крапка воронки. */
export function PipelineDot({ id, className }: { id: number | null | undefined; className?: string }) {
  return <span className={cx('inline-block h-2.5 w-2.5 flex-none rounded-full', className)} style={{ background: pipelineColor(id) }} aria-hidden />;
}

/** Фільтр співбесід за воронкою («Усі співбесіди»: список і календар). */
export function PipelineFilter({ value, onChange, className }: { value: PipelineFilterValue; onChange: (v: PipelineFilterValue) => void; className?: string }) {
  const { data: pipelines, isError } = usePipelines();
  const active = value !== 'all';
  return (
    <label className={cx('relative block', className)}>
      <span className="sr-only">Фільтр за воронкою</span>
      {active ? (
        <PipelineDot id={Number(value)} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
      ) : (
        <Funnel className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={isError ? 'Не вдалося завантажити список воронок' : undefined}
        className={cx(
          'h-10 w-full min-w-0 appearance-none truncate rounded-lg border bg-surface pl-9 pr-8 text-sm font-medium outline-none focus:border-primary focus:ring-4 focus:ring-primary/15',
          active ? 'border-ink/40 text-ink' : 'border-line-strong text-ink',
        )}
      >
        <option value="all">Усі воронки</option>
        {(pipelines || []).map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
    </label>
  );
}

/** Назва воронки (з кольоровою крапкою за потреби). */
export function PipelineName({ session, className, fallback = 'Воронку не вказано', dot }: { session: Session; className?: string; fallback?: string; dot?: boolean }) {
  if (!session.pipelineName) return <span className={cx('text-ink-soft', className)}>{fallback}</span>;
  if (!dot) return <span className={className} title={session.pipelineName}>{session.pipelineName}</span>;
  return (
    <span className={cx('inline-flex min-w-0 items-center gap-2', className)} title={session.pipelineName}>
      <PipelineDot id={session.pipelineId} /> <span className="truncate">{session.pipelineName}</span>
    </span>
  );
}
