'use client';

import { useState } from 'react';
import { CalendarView } from '@/components/calendar-view';
import { matchesPipeline, PipelineFilter, type PipelineFilterValue } from '@/components/pipeline-filter';
import { Card, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { useSessions } from '@/hooks/use-sessions';

export default function CalendarPage() {
  const { data, isLoading, error, refetch } = useSessions();
  const [pipeline, setPipeline] = useState<PipelineFilterValue>('all');
  return (
    <>
      <PageHeader title="Календар" description="Співбесіди за місяць або тиждень. Натисніть на подію, щоб відкрити деталі." />
      <Card className="overflow-hidden">
        <div className="border-b border-line p-3 sm:px-4">
          <PipelineFilter value={pipeline} onChange={setPipeline} className="sm:w-72" />
        </div>
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="p-4"><Skeleton className="h-8 w-64" /><Skeleton className="mt-4 h-[420px] w-full" /></div>
        ) : (
          <CalendarView sessions={(data || []).filter((s) => matchesPipeline(s, pipeline))} />
        )}
      </Card>
    </>
  );
}
