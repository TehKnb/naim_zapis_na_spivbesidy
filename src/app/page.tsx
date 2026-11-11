'use client';

import { Armchair, ArrowRight, CalendarCheck2, CalendarClock, CalendarDays, CircleCheck, Clock, Pencil, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { PipelineDot } from '@/components/pipeline-filter';
import { SessionCard } from '@/components/session-card';
import { ResponsibleSummary } from '@/components/responsibles';
import { useSessionForm } from '@/components/session-form';
import { Button, Card, EmptyState, ErrorState, PageHeader, ProgressBar, SectionLabel, Skeleton, StatusBadge, cx } from '@/components/ui';
import { useSessions } from '@/hooks/use-sessions';
import { isUpcoming, pluralSeats } from '@/lib/session-utils';
import { formatDate, formatTime, formatWeekday } from '@/lib/time';
import type { Session } from '@/lib/types';

const UPCOMING_LIMIT = 6;

function stats(list: Session[]) {
  const future = list.filter(isUpcoming);
  return {
    future: future.length,
    open: future.filter((s) => s.status === 'Open').length,
    full: future.filter((s) => s.status === 'Full').length,
    seats: future.filter((s) => s.status === 'Open').reduce((n, s) => n + s.availableSeats, 0),
  };
}

function StatCard({ label, value, hint, icon: Icon, color }: { label: string; value: number | string; hint: string; icon: React.ElementType; color: string }) {
  return (
    <Card className="relative overflow-hidden p-4 md:p-5">
      <div className="flex items-center gap-3">
        <span className={cx('flex h-9 w-9 flex-none items-center justify-center rounded-xl text-white shadow-xs', color)}><Icon className="h-[18px] w-[18px]" /></span>
        <p className="text-sm font-medium text-ink-muted">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>
    </Card>
  );
}

/** Найближча співбесіда — головна картка з градієнтною смугою. */
function NextSession({ session }: { session: Session }) {
  const { openEdit } = useSessionForm();
  return (
    <Card className="relative overflow-hidden">
      <span className="absolute inset-y-0 left-0 w-1.5 bg-brand" aria-hidden />
      <div className="flex flex-col gap-5 py-5 pl-7 pr-5 md:flex-row md:items-center md:justify-between md:py-6 md:pl-8 md:pr-6">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-violet">
            <CalendarClock className="h-4 w-4" /> Наступна співбесіда
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <PipelineDot id={session.pipelineId} className="h-3 w-3" />
            <h2 className="text-xl font-bold tracking-tight text-ink md:text-2xl">{session.pipelineName || 'Воронку не вказано'}</h2>
            <StatusBadge session={session} />
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-ink-muted">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{formatWeekday(session.startDate)}, {formatDate(session.startDate)}</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" />{formatTime(session.startDate)}</span>
            <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{session.currentCount} / {session.maxParticipants} · {pluralSeats(session.availableSeats)}</span>
          </p>
          <ResponsibleSummary session={session} full className="mt-3 text-[15px] text-ink" />
          <ProgressBar session={session} className="mt-4 h-2 max-w-md" />
        </div>
        <div className="flex flex-none gap-2">
          <Button variant="secondary" onClick={() => openEdit(session)} className="flex-1 md:flex-none"><Pencil className="h-4 w-4" /> Редагувати</Button>
          <Link href={`/sessions/${session.id}`} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-navy px-4 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-navy-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 md:flex-none">
            Відкрити <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </Card>
  );
}

export default function OverviewPage() {
  const { data, isLoading, error, refetch } = useSessions();
  const { openCreate } = useSessionForm();
  const s = data ? stats(data) : null;
  const sorted = (data || []).filter(isUpcoming).sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate));
  const next = sorted[0];
  const upcoming = sorted.slice(1, UPCOMING_LIMIT + 1);

  return (
    <>
      <PageHeader title="Огляд" description="Заповненість, вільні місця та найближчі групові співбесіди." />

      {next && <div className="mb-6"><NextSession session={next} /></div>}

      <section aria-label="Статистика" className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {isLoading || !s ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-9 w-32" /><Skeleton className="mt-3 h-8 w-16" /><Skeleton className="mt-2 h-3 w-24" /></Card>
          ))
        ) : (
          <>
            <StatCard label="Усі майбутні" value={s.future} hint="співбесід заплановано" icon={CalendarDays} color="bg-primary" />
            <StatCard label="Відкриті" value={s.open} hint="приймають кандидатів" icon={CalendarCheck2} color="bg-success" />
            <StatCard label="Заповнені" value={s.full} hint="вільних місць немає" icon={CircleCheck} color="bg-warning" />
            <StatCard label="Вільні місця" value={s.seats} hint="у відкритих співбесідах" icon={Armchair} color="bg-violet" />
          </>
        )}
      </section>

      <section className="mt-10" aria-labelledby="upcoming-title">
        <div className="mb-4 flex items-center justify-between gap-4">
          <SectionLabel><span id="upcoming-title">Далі за розкладом</span></SectionLabel>
          <Link href="/sessions" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Усі співбесіди <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {error ? (
          <Card><ErrorState error={error} onRetry={() => refetch()} /></Card>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4"><Skeleton className="h-5 w-48" /><Skeleton className="mt-3 h-4 w-32" /><Skeleton className="mt-6 h-2 w-full" /></Card>
            ))}
          </div>
        ) : !next ? (
          <Card>
            <EmptyState icon={<CalendarClock className="h-5 w-5" />} title="Немає запланованих співбесід" description="Створіть співбесіду — кандидати почнуть автоматично записуватися на найближчу відкриту у своїй воронці.">
              <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4" /> Створити співбесіду</Button>
            </EmptyState>
          </Card>
        ) : upcoming.length === 0 ? (
          <p className="rounded-card border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-muted">Інших майбутніх співбесід поки немає.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((session) => <SessionCard key={session.id} session={session} />)}
          </div>
        )}
      </section>
    </>
  );
}
