'use client';

import { AlertTriangle, ArrowLeft, CalendarDays, Clock, Funnel, Lock, Pencil, Users } from 'lucide-react';
import Link from 'next/link';
import { use, useState } from 'react';
import { toast } from 'sonner';
import { PipelineName } from '@/components/pipeline-filter';
import { useSessionForm } from '@/components/session-form';
import { Button, Card, EmptyState, ErrorState, Modal, Pill, ProgressBar, Skeleton, StatusBadge } from '@/components/ui';
import { useCloseSession, useSession } from '@/hooks/use-sessions';
import { ClientApiError } from '@/lib/api-client';
import { fillPercent, pluralCandidates } from '@/lib/session-utils';
import { formatFull, formatTime, formatWeekday, formatDate } from '@/lib/time';
import type { Participant, Session } from '@/lib/types';

const REG: Record<string, { label: string; tone: 'blue' | 'green' | 'gray' }> = {
  Reserved: { label: 'Reserved', tone: 'blue' },
  Confirmed: { label: 'Confirmed', tone: 'green' },
  Cancelled: { label: 'Cancelled', tone: 'gray' },
};
const SYNC: Record<string, { label: string; tone: 'green' | 'orange' | 'red' }> = {
  Synced: { label: 'Synced', tone: 'green' },
  Pending: { label: 'Pending', tone: 'orange' },
  Failed: { label: 'Failed', tone: 'red' },
};

function Metric({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function CloseDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const close = useCloseSession(session.id);
  const [err, setErr] = useState<string | null>(null);
  async function confirm() {
    if (close.isPending) return;
    setErr(null);
    try {
      await close.mutateAsync();
      toast.success('Співбесіду закрито', { description: 'Нові кандидати на неї більше не записуватимуться.' });
      onClose();
    } catch (e) {
      setErr(e instanceof ClientApiError ? e.message : 'Не вдалося закрити співбесіду.');
    }
  }
  return (
    <Modal open size="sm" onClose={onClose} closeDisabled={close.isPending} title="Закрити співбесіду?" description={session.name}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={close.isPending}>Скасувати</Button>
        <Button variant="danger" onClick={confirm} loading={close.isPending} data-autofocus>Закрити співбесіду</Button>
      </>}>
      <div className="space-y-3 text-sm text-ink-muted">
        <p>Після закриття співбесіда отримає статус «Закрита», і автоматизація більше не записуватиме на неї нових кандидатів.</p>
        {session.currentCount > 0 && (
          <div className="flex gap-2.5 rounded-lg border border-warning/30 bg-warning-50 px-3 py-2.5 text-warning-700" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <p>На цю співбесіду вже зареєстровано <b>{pluralCandidates(session.currentCount)}</b>. Їхні реєстрації залишаться без змін — за потреби повідомте їх окремо.</p>
          </div>
        )}
        {err && <p className="rounded-lg bg-danger-50 px-3 py-2 text-danger-700" role="alert">{err}</p>}
      </div>
    </Modal>
  );
}

function ParticipantsTable({ participants }: { participants: Participant[] }) {
  if (participants.length === 0) {
    return <EmptyState icon={<Users className="h-5 w-5" />} title="Ще немає кандидатів" description="Кандидати з'являться тут, щойно автоматизація запише їх на цю співбесіду." />;
  }
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-neutral-50 text-xs font-medium text-ink-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Ім&apos;я</th>
              <th className="px-4 py-2.5 font-medium">Телефон</th>
              <th className="px-4 py-2.5 font-medium">KeyCRM ID</th>
              <th className="px-4 py-2.5 font-medium">Статус реєстрації</th>
              <th className="px-4 py-2.5 font-medium">Синхронізація KeyCRM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {participants.map((p) => {
              const r = REG[p.registrationStatus] ?? { label: p.registrationStatus || '—', tone: 'gray' as const };
              const s = SYNC[p.keycrmSync] ?? { label: p.keycrmSync || '—', tone: 'orange' as const };
              return (
                <tr key={p.id} className={p.registrationStatus === 'Cancelled' ? 'text-ink-muted' : 'text-ink'}>
                  <td className="px-4 py-3 font-medium">{p.name || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{p.phone || '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{p.keycrmId || '—'}</td>
                  <td className="px-4 py-3"><Pill tone={r.tone}>{r.label}</Pill></td>
                  <td className="px-4 py-3"><Pill tone={s.tone}>{s.label}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line md:hidden">
        {participants.map((p) => {
          const r = REG[p.registrationStatus] ?? { label: p.registrationStatus || '—', tone: 'gray' as const };
          const s = SYNC[p.keycrmSync] ?? { label: p.keycrmSync || '—', tone: 'orange' as const };
          return (
            <li key={p.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{p.name || '—'}</p>
                  <p className="mt-0.5 text-sm tabular-nums text-ink-muted">{p.phone || '—'}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">KeyCRM ID: <span className="tabular-nums">{p.keycrmId || '—'}</span></p>
                </div>
                <div className="flex flex-col items-end gap-1"><Pill tone={r.tone}>{r.label}</Pill><Pill tone={s.tone}>{s.label}</Pill></div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function SessionDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error, refetch } = useSession(id);
  const { openEdit } = useSessionForm();
  const [closing, setClosing] = useState(false);
  const notFound = error instanceof ClientApiError && error.status === 404;

  return (
    <>
      <Link href="/sessions" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Усі співбесіди
      </Link>

      {notFound ? (
        <Card><EmptyState title="Співбесіду не знайдено" description="Можливо, посилання застаріле." /></Card>
      ) : error ? (
        <Card><ErrorState error={error} onRetry={() => refetch()} /></Card>
      ) : isLoading || !data ? (
        <Card className="p-6"><Skeleton className="h-7 w-80 max-w-full" /><Skeleton className="mt-3 h-4 w-48" /><Skeleton className="mt-8 h-16 w-full" /></Card>
      ) : (
        <>
          <Card className="p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight text-ink md:text-2xl">{data.session.name}</h1>
                  <StatusBadge session={data.session} />
                </div>
                <p className="mt-1.5 text-sm text-ink-muted">{formatFull(data.session.startDate)} · Europe/Kyiv</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                  <Funnel className="h-4 w-4 flex-none" /> Воронка: <PipelineName session={data.session} className="font-medium text-ink" fallback="не вказано" />
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => openEdit(data.session)} className="flex-1 md:flex-none"><Pencil className="h-4 w-4" /> Редагувати</Button>
                <Button variant="secondary" onClick={() => setClosing(true)} disabled={data.session.status === 'Closed'} className="flex-1 md:flex-none">
                  <Lock className="h-4 w-4" /> {data.session.status === 'Closed' ? 'Закрита' : 'Закрити'}
                </Button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-5 md:grid-cols-5">
              <Metric icon={CalendarDays} label="Дата" value={<span className="text-base">{formatWeekday(data.session.startDate)}, {formatDate(data.session.startDate)}</span>} />
              <Metric icon={Clock} label="Час" value={formatTime(data.session.startDate)} />
              <Metric label="Максимум учасників" value={data.session.maxParticipants} />
              <Metric label="Зареєстровано" value={data.session.currentCount} />
              <Metric label="Вільні місця" value={data.session.availableSeats} />
            </div>
            <div className="mt-5">
              <div className="mb-1.5 flex justify-between text-xs text-ink-muted">
                <span>Заповненість</span><span className="font-medium text-ink">{fillPercent(data.session)}%</span>
              </div>
              <ProgressBar session={data.session} className="h-2" />
            </div>
          </Card>

          <Card className="mt-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-base font-semibold text-ink">Кандидати</h2>
              <span className="text-sm text-ink-muted">{data.participants.length}</span>
            </div>
            <ParticipantsTable participants={data.participants} />
          </Card>

          {closing && <CloseDialog session={data.session} onClose={() => setClosing(false)} />}
        </>
      )}
    </>
  );
}
