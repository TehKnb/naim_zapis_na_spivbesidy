'use client';

import { ArrowUpDown, CalendarDays, CalendarX, ChevronDown, Clock, List, Search, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarView, isDayKey, type CalendarState } from '@/components/calendar-view';
import { matchesPipeline, PipelineFilter, type PipelineFilterValue } from '@/components/pipeline-filter';
import { ResponsibleStack, sessionResponsibles, shortName } from '@/components/responsibles';
import { DateTile, PipelineStripe, SessionActions, SessionCard } from '@/components/session-card';
import { pipelineColor } from '@/lib/pipeline-colors';
import { Card, EmptyState, ErrorState, PageHeader, ProgressBar, Skeleton, StatusBadge, cx } from '@/components/ui';
import { useSessions } from '@/hooks/use-sessions';
import { displayState, LAST_SESSIONS_URL_KEY, pluralSeats, sortByDate, sortUpcomingFirst } from '@/lib/session-utils';
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

/** Стан сторінки живе в URL (?view=calendar&month=…): «Назад» з картки співбесіди повертає саме його. */
interface ListState {
  filter: Filter;
  sort: Sort;
  view: 'list' | 'calendar';
  pipeline: PipelineFilterValue;
  q: string;
  cal: CalendarState;
}

function parseState(sp: URLSearchParams): ListState {
  const pick = <T extends string>(v: string | null, allowed: readonly T[], def: T): T => (allowed.includes(v as T) ? (v as T) : def);
  const pipeline = sp.get('pipeline') ?? '';
  const date = sp.get('date') ?? '', day = sp.get('day') ?? '';
  return {
    filter: pick(sp.get('status'), FILTERS.map((f) => f.key), 'all'),
    sort: pick(sp.get('sort'), SORTS.map((s) => s.key), 'upcoming'),
    view: pick(sp.get('view'), ['list', 'calendar'] as const, 'list'),
    pipeline: /^\d+$/.test(pipeline) ? pipeline : 'all',
    q: (sp.get('q') ?? '').slice(0, 200),
    cal: {
      view: pick(sp.get('cal'), ['month', 'week'] as const, 'month'),
      date: isDayKey(date) ? date : '',
      day: isDayKey(day) ? day : '',
    },
  };
}

function serializeState(st: ListState): string {
  const p = new URLSearchParams();
  if (st.view !== 'list') p.set('view', st.view);
  if (st.filter !== 'all') p.set('status', st.filter);
  if (st.pipeline !== 'all') p.set('pipeline', st.pipeline);
  if (st.q) p.set('q', st.q);
  if (st.sort !== 'upcoming') p.set('sort', st.sort);
  if (st.view === 'calendar') {
    if (st.cal.view !== 'month') p.set('cal', st.cal.view);
    if (st.cal.date) p.set('date', st.cal.date);
    if (st.cal.day) p.set('day', st.cal.day);
  }
  return p.toString();
}

function useListState() {
  const sp = useSearchParams();
  const spString = sp.toString();
  const [st, setSt] = useState<ListState>(() => parseState(new URLSearchParams(spString)));
  // Перехід на /sessions без параметрів (навбар) чи «Вперед/Назад» браузера — беремо стан з URL
  useEffect(() => {
    setSt((cur) => (serializeState(cur) === serializeState(parseState(new URLSearchParams(spString))) ? cur : parseState(new URLSearchParams(spString))));
  }, [spString]);
  // Стан → URL (replaceState: без нового запису в історії і без запиту до сервера)
  useEffect(() => {
    const qs = serializeState(st);
    const url = qs ? `/sessions?${qs}` : '/sessions';
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(window.history.state, '', url);
    try { sessionStorage.setItem(LAST_SESSIONS_URL_KEY, url); } catch { /* приватний режим */ }
  }, [st]);
  const set = useCallback(<K extends keyof ListState>(k: K, v: ListState[K]) => setSt((cur) => ({ ...cur, [k]: v })), []);
  const setCal = useCallback((patch: Partial<CalendarState>) => setSt((cur) => ({ ...cur, cal: { ...cur.cal, ...patch } })), []);
  return { st, set, setCal };
}

function matches(s: Session, f: Filter) {
  const st = displayState(s);
  if (f === 'all') return true;
  if (f === 'closed') return s.status === 'Closed';
  if (f === 'past') return st === 'past';
  return st === f; // open / full — лише майбутні
}

const GRID = 'grid-cols-[minmax(0,1fr)_64px_minmax(150px,210px)_minmax(150px,210px)_112px_72px]';

function Responsibles({ s }: { s: Session }) {
  const people = sessionResponsibles(s);
  if (!people.length) return <span className="text-sm text-ink-soft">Не призначено</span>;
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm text-ink" title={people.map((p) => p.name).join(', ')}>
      <ResponsibleStack people={people} max={2} />
      <span className="truncate">{people.length === 1 ? people[0].name : people.map((p) => shortName(p.name)).join(', ')}</span>
    </span>
  );
}

function SessionRow({ s }: { s: Session }) {
  const muted = ['past', 'closed'].includes(displayState(s));
  return (
    <div className={cx('relative grid items-center gap-4 py-3 pl-6 pr-4 transition-colors hover:bg-neutral-50 lg:gap-6', GRID)}>
      <PipelineStripe session={s} className="inset-y-2 rounded-r-full" />
      <Link href={`/sessions/${s.id}`} className="flex min-w-0 items-center gap-3 rounded focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
        <DateTile iso={s.startDate} muted={muted} color={pipelineColor(s.pipelineId)} />
        <div className="min-w-0">
          <p className={cx('truncate text-[15px] font-bold', muted ? 'text-ink-muted' : 'text-ink')} title={s.name}>{s.pipelineName || s.name}</p>
          <p className="mt-0.5 truncate text-sm text-ink-muted">{formatWeekday(s.startDate)}, {formatDate(s.startDate)}</p>
        </div>
      </Link>
      <span className="flex items-center gap-1.5 text-sm text-ink"><Clock className="h-4 w-4 text-ink-muted" />{formatTime(s.startDate)}</span>
      <Responsibles s={s} />
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1 font-semibold text-ink"><Users className="h-3.5 w-3.5 text-ink-muted" />{s.currentCount}/{s.maxParticipants}</span>
          <span className="truncate text-ink-muted">{pluralSeats(s.availableSeats)}</span>
        </div>
        <ProgressBar session={s} className="h-2" />
      </div>
      <StatusBadge session={s} className="justify-self-start" />
      <SessionActions session={s} compact />
    </div>
  );
}

export default function AllSessionsPage() {
  // useSearchParams потребує Suspense для статичної збірки
  return (
    <Suspense fallback={<PageHeader title="Усі співбесіди" description="Пошук, фільтри та керування всіма співбесідами за воронками." />}>
      <AllSessions />
    </Suspense>
  );
}

function AllSessions() {
  const { data, isLoading, error, refetch } = useSessions();
  const { st, set, setCal } = useListState();
  const { q, filter, sort, view, pipeline } = st;
  const setQ = (v: string) => set('q', v);
  const setFilter = (v: Filter) => set('filter', v);
  const setSort = (v: Sort) => set('sort', v);
  const setView = (v: 'list' | 'calendar') => set('view', v);
  const setPipeline = (v: PipelineFilterValue) => set('pipeline', v);

  const inPipeline = useMemo(() => (data || []).filter((s) => matchesPipeline(s, pipeline)), [data, pipeline]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, inPipeline.filter((s) => matches(s, f.key)).length])), [inPipeline]);
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = inPipeline.filter((s) => matches(s, filter)).filter((s) => {
      if (!needle) return true;
      const people = sessionResponsibles(s).map((p) => p.name).join(' ');
      const hay = `${s.name} ${s.pipelineName} ${people} ${formatWeekday(s.startDate)} ${formatDate(s.startDate)} ${formatTime(s.startDate)}`.toLowerCase();
      return hay.includes(needle);
    });
    return sort === 'upcoming' ? sortUpcomingFirst(list) : sortByDate(list, sort);
  }, [inPipeline, q, filter, sort]);

  return (
    <>
      <PageHeader title="Усі співбесіди" description="Пошук, фільтри та керування всіма співбесідами за воронками." />

      {/* Вкладки статусів з підкресленням, як у Calendly */}
      <div className="-mx-4 mb-5 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
        <div className="flex gap-6" role="tablist" aria-label="Фільтр за статусом">
          {FILTERS.map((f) => (
            <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
              className={cx('relative inline-flex h-11 flex-none items-center gap-2 text-[15px] font-medium transition-colors',
                filter === f.key ? 'text-ink' : 'text-ink-muted hover:text-ink')}>
              {f.label}
              <span className={cx('rounded-full px-2 py-px text-xs font-semibold', filter === f.key ? 'bg-primary text-white' : 'bg-neutral-100 text-ink-muted')}>{data ? counts[f.key] : '·'}</span>
              {filter === f.key && <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-t-full bg-primary" aria-hidden />}
            </button>
          ))}
        </div>
      </div>

      {/* Панель інструментів */}
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
        <PipelineFilter value={pipeline} onChange={setPipeline} className="md:w-64 md:flex-none" />
        <div className="relative flex-1 md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук: воронка, дата, відповідальний" aria-label="Пошук"
            className="h-10 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-8 text-sm text-ink outline-none placeholder:text-ink-soft focus:border-primary focus:ring-4 focus:ring-primary/15" />
          {q && <button onClick={() => setQ('')} aria-label="Очистити пошук" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-soft hover:text-ink"><X className="h-4 w-4" /></button>}
        </div>
        <div className="flex gap-2 md:ml-auto">
          <label className="relative flex-1 xs:flex-none">
            <span className="sr-only">Сортування</span>
            <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} disabled={view === 'calendar'}
              className="h-10 w-full appearance-none rounded-lg border border-line-strong bg-surface pl-9 pr-8 text-sm font-medium text-ink outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-50">
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          </label>
          <div className="inline-flex flex-none rounded-lg border border-line-strong bg-surface p-0.5" role="tablist" aria-label="Режим відображення">
            {([['list', List, 'Список'], ['calendar', CalendarDays, 'Календар']] as const).map(([k, Icon, label]) => (
              <button key={k} role="tab" aria-selected={view === k} aria-label={label} title={label} onClick={() => setView(k)}
                className={cx('inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors', view === k ? 'bg-primary-50 text-primary' : 'text-ink-muted hover:text-ink')}>
                <Icon className="h-4 w-4" /><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex items-center gap-3 p-4"><Skeleton className="h-14 w-14" /><div className="flex-1"><Skeleton className="h-4 w-56" /><Skeleton className="mt-2 h-3 w-32" /></div></div>)}
          </div>
        ) : view === 'calendar' ? (
          <CalendarView sessions={visible} state={st.cal} onChange={setCal} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<CalendarX className="h-5 w-5" />}
            title={data && data.length ? 'Нічого не знайдено' : 'Ще немає жодної співбесіди'}
            description={data && data.length ? 'Змініть фільтр, воронку або пошуковий запит.' : 'Створіть першу співбесіду кнопкою «Створити співбесіду» вгорі.'}
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <div className={cx('grid gap-4 border-b border-line bg-neutral-50 py-2.5 pl-6 pr-4 text-xs font-semibold uppercase tracking-wide text-ink-muted lg:gap-6', GRID)}>
                <span>Воронка і дата</span><span>Час</span><span>Відповідальні</span><span>Заповненість</span><span>Статус</span><span />
              </div>
              <div className="divide-y divide-line">{visible.map((s) => <SessionRow key={s.id} s={s} />)}</div>
            </div>
            <div className="grid grid-cols-1 gap-3 bg-canvas p-3 sm:grid-cols-2 md:p-4 lg:hidden">{visible.map((s) => <SessionCard key={s.id} session={s} />)}</div>
          </>
        )}
      </Card>
    </>
  );
}
