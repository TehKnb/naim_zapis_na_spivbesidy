'use client';

import { Armchair, ArrowRight, CalendarCheck2, CalendarClock, CalendarDays, CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { SessionCard } from '@/components/session-card';
import { useSessionForm } from '@/components/session-form';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, cx } from '@/components/ui';
import { useSessions } from '@/hooks/use-sessions';
import { isUpcoming } from '@/lib/session-utils';
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

function StatCard({ label, value, hint, icon: Icon, tone }: { label: string; value: number | string; hint: string; icon: React.ElementType; tone: string }) {
  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        <span className={cx('flex h-8 w-8 items-center justify-center rounded-lg', tone)}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{hint}</p>
    </Card>
  );
}

export default function OverviewPage() {
  const { data, isLoading, error, refetch } = useSessions();
  const { openCreate } = useSessionForm();
  const s = data ? stats(data) : null;
  const upcoming = (data || []).filter(isUpcoming).sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate)).slice(0, UPCOMING_LIMIT);

  return (
    <>
      <PageHeader title="Огляд" description="Поточний стан групових співбесід: заповненість, вільні місця та найближчі події." />

      <section aria-label="Статистика" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || !s ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-4 w-32" /><Skeleton className="mt-4 h-8 w-16" /><Skeleton className="mt-2 h-3 w-24" /></Card>
          ))
        ) : (
          <>
            <StatCard label="Усі майбутні" value={s.future} hint="співбесід заплановано" icon={CalendarDays} tone="bg-primary-50 text-primary" />
            <StatCard label="Відкриті" value={s.open} hint="приймають кандидатів" icon={CalendarCheck2} tone="bg-success-50 text-success-700" />
            <StatCard label="Заповнені" value={s.full} hint="вільних місць немає" icon={CircleCheck} tone="bg-warning-50 text-warning-700" />
            <StatCard label="Вільні місця" value={s.seats} hint="у відкритих співбесідах" icon={Armchair} tone="bg-neutral-100 text-neutral-700" />
          </>
        )}
      </section>

      <section className="mt-8" aria-labelledby="upcoming-title">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="upcoming-title" className="text-lg font-semibold text-ink">Найближчі співбесіди</h2>
          <Link href="/sessions" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Усі співбесіди <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {error ? (
          <Card><ErrorState error={error} onRetry={() => refetch()} /></Card>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4"><div className="flex gap-3"><Skeleton className="h-14 w-14" /><div className="flex-1"><Skeleton className="h-4 w-40" /><Skeleton className="mt-2 h-3 w-16" /></div></div><Skeleton className="mt-5 h-1.5 w-full" /></Card>
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <Card>
            <EmptyState icon={<CalendarClock className="h-5 w-5" />} title="Немає запланованих співбесід" description="Створіть співбесіду — кандидати почнуть автоматично записуватися на найближчу відкриту.">
              <button onClick={openCreate} className="text-sm font-medium text-primary hover:underline">Створити співбесіду</button>
            </EmptyState>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {upcoming.map((session) => <SessionCard key={session.id} session={session} />)}
          </div>
        )}
      </section>
    </>
  );
}
