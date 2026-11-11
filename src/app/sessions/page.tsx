'use client';

import { ArrowUpDown, CalendarDays, CalendarX, Clock, List, Search, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarView } from '@/components/calendar-view';
import { matchesPipeline, PipelineFilter, type PipelineFilterValue } from '@/components/pipeline-filter';
import { DateTile, SessionActions, SessionCard } from '@/components/session-card';
import { Card, EmptyState, ErrorState, PageHeader, ProgressBar, Skeleton, StatusBadge, cx } from '@/components/ui';
import { useSessions } from '@/hooks/use-sessions';
import { displayState, pluralSeats, sortByDate, sortUpcomingFirst } from '@/lib/session-utils';
import { formatDate, formatTime, formatWeekday } from '@/lib/time';
import type { Session } from '@/lib/types';

type Filter = 'all' | 'open' | 'full' | 'closed' | 'past';
type Sort = 'upcoming' | 'asc' | 'desc';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Усі' },
  { key: 'open', label: 'Відкриті' },
  { key: 'full', label: 'Заповнені' },
  { key: 'closed', label: 'Закриті' },
  { key: 'past', label: 'Минулі' },
];
const SORTS: { key: Sort; label: string }[] = [
  { key: 'upcoming', label: 'Спочатку найближчі' },
  { key: 'asc', label: 'Дата: від ранніх' },
  { key: 'desc', label: 'Дата: від пізніх' },
];

function matches(s: Session, f: Filter) {
  const st = displayState(s);
  if (f === 'all') return true;
  if (f === 'closed') return s.status === 'Closed';
  if (f === 'past') return st === 'past';
  return st === f; // open / full — лише майбутні
}

function SessionRow({ s }: { s: Session }) {
  const muted = ['past', 'closed'].includes(displayState(s));
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_72px_minmax(180px,240px)_112px_72px] items-center gap-4 px-4 py-3 transition-colors hover:bg-neutral-50 lg:gap-6">
      <Link href={`/sessions/${s.id}`} className="flex min-w-0 items-center gap-3 rounded focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
        <DateTile iso={s.startDate} muted={muted} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink" title={s.name}>{s.pipelineName || s.name}</p>
          <p className="mt-0.5 truncate text-sm text-ink-muted">{formatWeekday(s.startDate)}, {formatDate(s.startDate)}</p>
        </div>
      </Link>
      <span className="flex items-center gap-1.5 text-sm text-ink"><Clock className="h-4 w-4 text-ink-muted" />{formatTime(s.startDate)}</span>
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1 font-medium text-ink"><Users className="h-3.5 w-3.5 text-ink-muted" />{s.currentCount}/{s.maxParticipants}</span>
          <span className="truncate text-ink-muted">{pluralSeats(s.availableSeats)}</span>
        </div>
        <ProgressBar session={s} />
      </div>
      <StatusBadge session={s} className="justify-self-start" />
      <SessionActions session={s} compact />
    </div>
  );
}

export default function AllSessionsPage() {
  const { data, isLoading, error, refetch } = useSessions();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('upcoming');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [pipeline, setPipeline] = useState<PipelineFilterValue>('all');

  const inPipeline = useMemo(() => (data || []).filter((s) => matchesPipeline(s, pipeline)), [data, pipeline]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, inPipeline.filter((s) => matches(s, f.key)).length])), [inPipeline]);
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = inPipeline.filter((s) => matches(s, filter)).filter((s) => {
      if (!needle) return true;
      const hay = `${s.name} ${s.pipelineName} ${formatWeekday(s.startDate)} ${formatDate(s.startDate)} ${formatTime(s.startDate)}`.toLowerCase();
      return hay.includes(needle);
    });
    return sort === 'upcoming' ? sortUpcomingFirst(list) : sortByDate(list, sort);
  }, [inPipeline, q, filter, sort]);

  return (
    <>
      <PageHeader title="Усі співбесіди" description="Пошук, фільтри та керування всіма створеними співбесідами." />

      <Card className="overflow-hidden">
        {/* Панель інструментів */}
        <div className="flex flex-col gap-3 border-b border-line p-3 md:p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Фільтр за статусом">
              {FILTERS.map((f) => (
                <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
                  className={cx('inline-flex h-8 flex-none items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors',
                    filter === f.key ? 'bg-primary-50 text-primary' : 'text-ink-muted hover:bg-neutral-100 hover:text-ink')}>
                  {f.label}
                  <span className={cx('rounded-full px-1.5 text-[11px]', filter === f.key ? 'bg-primary/10' : 'bg-neutral-100')}>{data ? counts[f.key] : '·'}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <PipelineFilter value={pipeline} onChange={setPipeline} className="md:w-60 md:flex-none" />
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук за назвою, воронкою чи датою" aria-label="Пошук"
                  className="h-9 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-8 text-sm text-ink outline-none placeholder:text-ink-soft focus:border-primary focus:ring-4 focus:ring-primary/15" />
                {q && <button onClick={() => setQ('')} aria-label="Очистити пошук" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-soft hover:text-ink"><X className="h-4 w-4" /></button>}
              </div>
              <div className="flex gap-2">
                <label className="relative flex-1 xs:flex-none">
                  <span className="sr-only">Сортування</span>
                  <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                  <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} disabled={view === 'calendar'}
                    className="h-9 w-full appearance-none rounded-lg border border-line-strong bg-surface pl-9 pr-3 text-sm text-ink outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-50">
                    {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </label>
                <div className="inline-flex flex-none rounded-lg border border-line bg-neutral-50 p-0.5" role="tablist" aria-label="Режим відображення">
                  {([['list', List, 'Список'], ['calendar', CalendarDays, 'Календар']] as const).map(([k, Icon, label]) => (
                    <button key={k} role="tab" aria-selected={view === k} aria-label={label} title={label} onClick={() => setView(k)}
                      className={cx('inline-flex h-8 w-9 items-center justify-center rounded-md transition-colors', view === k ? 'bg-surface text-ink shadow-xs ring-1 ring-line' : 'text-ink-muted hover:text-ink')}>
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex items-center gap-3 p-4"><Skeleton className="h-14 w-14" /><div className="flex-1"><Skeleton className="h-4 w-56" /><Skeleton className="mt-2 h-3 w-32" /></div></div>)}
          </div>
        ) : view === 'calendar' ? (
          <CalendarView sessions={visible} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<CalendarX className="h-5 w-5" />}
            title={data && data.length ? 'Нічого не знайдено' : 'Ще немає жодної співбесіди'}
            description={data && data.length ? 'Змініть фільтр, воронку або пошуковий запит.' : 'Створіть першу співбесіду кнопкою «Створити співбесіду» вгорі.'}
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <div className="grid grid-cols-[minmax(0,1fr)_72px_minmax(180px,240px)_112px_72px] gap-4 border-b border-line bg-neutral-50 px-4 py-2 text-xs font-medium text-ink-muted lg:gap-6">
                <span>Воронка і дата</span><span>Час</span><span>Заповненість</span><span>Статус</span><span />
              </div>
              <div className="divide-y divide-line">{visible.map((s) => <SessionRow key={s.id} s={s} />)}</div>
            </div>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 md:p-4 lg:hidden">{visible.map((s) => <SessionCard key={s.id} session={s} showName />)}</div>
          </>
        )}
      </Card>
    </>
  );
}
