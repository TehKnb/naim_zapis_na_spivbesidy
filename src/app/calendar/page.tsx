'use client';

import { CalendarView } from '@/components/calendar-view';
import { Card, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { useSessions } from '@/hooks/use-sessions';

export default function CalendarPage() {
  const { data, isLoading, error, refetch } = useSessions();
  return (
    <>
      <PageHeader title="Календар" description="Співбесіди за місяць або тиждень. Натисніть на подію, щоб відкрити деталі." />
      <Card className="overflow-hidden">
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="p-4"><Skeleton className="h-8 w-64" /><Skeleton className="mt-4 h-[420px] w-full" /></div>
        ) : (
          <CalendarView sessions={data || []} />
        )}
      </Card>
    </>
  );
}
