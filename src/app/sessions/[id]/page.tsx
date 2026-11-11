'use client';

import { AlertTriangle, ArrowLeft, CalendarDays, Clock, Funnel, Lock, Pencil, UserRound, Users } from 'lucide-react';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PipelineName } from '@/components/pipeline-filter';
import { ResponsibleAvatar, sessionResponsibles } from '@/components/responsibles';
import { PipelineStripe } from '@/components/session-card';
import { useSessionForm } from '@/components/session-form';
import { Button, Card, EmptyState, ErrorState, Modal, Pill, ProgressBar, Skeleton, StatusBadge } from '@/components/ui';
import { useCloseSession, useSession } from '@/hooks/use-sessions';
import { ClientApiError } from '@/lib/api-client';
import { fillPercent, LAST_SESSIONS_URL_KEY, pluralCandidates } from '@/lib/session-utils';
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

function Metric({ label, value, icon: Icon, tone = 'bg-neutral-50' }: { label: string; value: React.ReactNode; icon?: React.ElementType; tone?: string }) {
  return (
    <div className={`min-w-0 rounded-xl px-4 py-3 ${tone}`}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</p>
      <p className="mt-1 text-lg font-bold text-ink">{value}</p>
    </div>
  );
}

function ResponsiblesBlock({ session, onEdit }: { session: Session; onEdit: () => void }) {
  const people = sessionResponsibles(session);
  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted"><UserRound className="h-3.5 w-3.5" /> Відповідальні</p>
      {people.length ? (
        <ul className="flex flex-wrap gap-2">
          {people.map((p) => (
            <li key={p.id} className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm font-medium text-ink"
              title={p.missing ? 'Співробітника немає в довіднику' : !p.discordLinked ? 'Немає Discord ID: у щоденному повідомленні буде лише ім\u02bcя' : undefined}>
              <ResponsibleAvatar person={p} className="ring-0" />
              <span className={p.missing ? 'text-ink-muted line-through' : undefined}>{p.name}</span>
              {!p.discordLinked && !p.missing && <span className="rounded bg-neutral-100 px-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">без Discord</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">
          Не призначено.{' '}
          <button type="button" onClick={onEdit} className="font-semibold text-primary hover:underline">Призначити</button>
        </p>
      )}
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
  // «Назад» веде до «Усіх співбесід» у тому стані (календар, місяць, фільтри), з якого відкрили співбесіду
  const [backHref, setBackHref] = useState('/sessions');
  useEffect(() => {
    try {
      const last = sessionStorage.getItem(LAST_SESSIONS_URL_KEY);
      if (last && /^\/sessions(\?|$)/.test(last)) setBackHref(last);
    } catch { /* приватний режим */ }
  }, []);

  return (
    <>
      <Link href={backHref} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
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
          <Card className="relative overflow-hidden py-5 pl-7 pr-5 md:py-6 md:pl-8 md:pr-6">
            <PipelineStripe session={data.session} className="w-1.5" />
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-ink md:text-2xl">{data.session.name}</h1>
                  <StatusBadge session={data.session} />
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
                  <Funnel className="h-4 w-4 flex-none" /> <PipelineName session={data.session} dot className="font-semibold text-ink" fallback="Воронку не вказано" />
                </p>
                <p className="mt-1 text-sm text-ink-muted">{formatFull(data.session.startDate)} · Europe/Kyiv</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => openEdit(data.session)} className="flex-1 md:flex-none"><Pencil className="h-4 w-4" /> Редагувати</Button>
                <Button variant="secondary" onClick={() => setClosing(true)} disabled={data.session.status === 'Closed'} className="flex-1 md:flex-none">
                  <Lock className="h-4 w-4" /> {data.session.status === 'Closed' ? 'Закрита' : 'Закрити'}
                </Button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
              <Metric icon={CalendarDays} label="Дата" tone="bg-primary-50" value={<span className="text-base">{formatWeekday(data.session.startDate)}, {formatDate(data.session.startDate)}</span>} />
              <Metric icon={Clock} label="Час" tone="bg-primary-50" value={formatTime(data.session.startDate)} />
              <Metric label="Максимум учасників" tone="bg-violet-50" value={data.session.maxParticipants} />
              <Metric label="Зареєстровано" tone="bg-success-50" value={data.session.currentCount} />
              <Metric label="Вільні місця" tone="bg-warning-50" value={data.session.availableSeats} />
            </div>
            <div className="mt-5">
              <div className="mb-1.5 flex justify-between text-xs text-ink-muted">
                <span>Заповненість</span><span className="font-medium text-ink">{fillPercent(data.session)}%</span>
              </div>
              <ProgressBar session={data.session} className="h-2.5" />
            </div>
            <ResponsiblesBlock session={data.session} onEdit={() => openEdit(data.session)} />
          </Card>

          <Card className="mt-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-base font-bold text-ink">Кандидати</h2>
              <span className="rounded-full bg-primary px-2 py-px text-xs font-semibold text-white">{data.participants.length}</span>
            </div>
            <ParticipantsTable participants={data.participants} />
          </Card>

          {closing && <CloseDialog session={data.session} onClose={() => setClosing(false)} />}
        </>
      )}
    </>
  );
}
