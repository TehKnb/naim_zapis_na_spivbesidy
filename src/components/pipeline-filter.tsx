'use client';

import { Funnel } from 'lucide-react';
import { usePipelines } from '@/hooks/use-sessions';
import type { Session } from '@/lib/types';
import { cx } from './ui';

/** Значення фільтра: 'all' або ID воронки рядком. */
export type PipelineFilterValue = 'all' | string;

export function matchesPipeline(s: Session, value: PipelineFilterValue): boolean {
  return value === 'all' || String(s.pipelineId ?? '') === value;
}

/** Фільтр співбесід за воронкою («Усі співбесіди», «Календар»). */
export function PipelineFilter({ value, onChange, className }: { value: PipelineFilterValue; onChange: (v: PipelineFilterValue) => void; className?: string }) {
  const { data: pipelines, isError } = usePipelines();
  return (
    <label className={cx('relative block', className)}>
      <span className="sr-only">Фільтр за воронкою</span>
      <Funnel className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={isError ? 'Не вдалося завантажити список воронок' : undefined}
        className={cx(
          'h-9 w-full min-w-0 appearance-none truncate rounded-lg border bg-surface pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15',
          value === 'all' ? 'border-line-strong text-ink' : 'border-primary/40 text-primary',
        )}
      >
        <option value="all">Усі воронки</option>
        {(pipelines || []).map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
      </select>
    </label>
  );
}

/** Назва воронки під назвою / датою співбесіди. */
export function PipelineName({ session, className, fallback = 'Воронку не вказано' }: { session: Session; className?: string; fallback?: string }) {
  if (!session.pipelineName) return <span className={cx('text-ink-soft', className)}>{fallback}</span>;
  return <span className={className} title={session.pipelineName}>{session.pipelineName}</span>;
}
