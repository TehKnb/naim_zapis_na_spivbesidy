'use client';

import { AlertTriangle, CalendarClock, Phone, RefreshCw, Search, UserPlus } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAddParticipant, useCandidates } from '@/hooks/use-sessions';
import { ClientApiError } from '@/lib/api-client';
import { formatDate, formatTime, formatWeekdayShort } from '@/lib/time';
import type { Candidate, Session } from '@/lib/types';
import { PipelineDot } from './pipeline-filter';
import { Button, cx, Modal, Skeleton } from './ui';

const when = (iso: string) => `${formatWeekdayShort(iso)}, ${formatDate(iso)}, ${formatTime(iso)}`;
const currentInterview = (c: Candidate) => (c.interviewAt ? when(c.interviewAt) : c.interviewRaw || null);

/** Кнопка «Додати кандидата» + випадаючий список лідів KeyCRM у статусі «Запросили на 1 тур». */
export function AddCandidate({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Candidate | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const listId = useId();
  const query = useCandidates(session.id, open || !!picked);

  const blocked = session.isPast ? 'Співбесіда вже минула' : session.availableSeats <= 0 ? 'Немає вільних місць — збільште максимальну кількість учасників' : null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    const t = setTimeout(() => search.current?.focus(), 0);
    return () => { document.removeEventListener('mousedown', onDown); clearTimeout(t); };
  }, [open]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = query.data?.candidates ?? [];
    if (!needle) return all;
    const digits = needle.replace(/\D/g, '');
    return all.filter((c) => c.name.toLowerCase().includes(needle) || c.pipelineName.toLowerCase().includes(needle) || (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits)));
  }, [query.data, q]);

  const close = () => { setOpen(false); setQ(''); root.current?.querySelector<HTMLButtonElement>('button[aria-haspopup]')?.focus(); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = [...(root.current?.querySelectorAll<HTMLButtonElement>('[role=option]:not([disabled])') ?? [])];
      if (!items.length) return;
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      items[e.key === 'ArrowDown' ? (i + 1) % items.length : i <= 0 ? items.length - 1 : i - 1].focus();
    }
  };

  return (
    <div ref={root} className="relative" onKeyDown={open ? onKeyDown : undefined}>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setOpen((v) => !v)}
        disabled={!!blocked}
        title={blocked ?? 'Записати ліда зі статусу «Запросили на 1 тур»'}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
      >
        <UserPlus className="h-4 w-4" /> Додати кандидата
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(440px,calc(100vw-3rem))] overflow-hidden rounded-xl border border-line bg-surface text-left shadow-pop">
          <div className="border-b border-line p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Ліди у статусі «Запросили на 1 тур»</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input ref={search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ім'я, телефон або воронка" aria-label="Пошук ліда"
                className="h-9 w-full rounded-lg bg-neutral-50 pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink-soft focus:bg-surface focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          <div id={listId} role="listbox" aria-label="Ліди KeyCRM" className="max-h-80 overflow-y-auto p-1">
            {query.isLoading ? (
              <div className="space-y-2 p-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : query.isError ? (
              <div className="px-3 py-5 text-center text-sm">
                <p className="text-danger-700">{query.error instanceof ClientApiError ? query.error.message : 'Не вдалося завантажити лідів.'}</p>
                <button type="button" onClick={() => query.refetch()} className="mt-2 font-semibold text-primary hover:underline">Спробувати ще раз</button>
              </div>
            ) : list.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-soft">
                {query.data?.candidates.length ? 'Нікого не знайдено' : 'У статусі «Запросили на 1 тур» зараз немає лідів'}
              </p>
            ) : (
              list.map((c) => {
                const now = currentInterview(c);
                const samePipeline = c.pipelineId !== null && c.pipelineId === session.pipelineId;
                return (
                  <button
                    key={c.cardId}
                    type="button"
                    role="option"
                    aria-selected={false}
                    disabled={c.inThisSession}
                    onClick={() => { setPicked(c); setOpen(false); setQ(''); }}
                    className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left outline-none transition-colors hover:bg-neutral-50 focus-visible:bg-primary-50 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{c.name}</span>
                      {c.inThisSession ? (
                        <span className="flex-none rounded bg-success-50 px-1.5 py-px text-[11px] font-semibold text-success-700">Уже записаний</span>
                      ) : c.retryHere ? (
                        <span className="flex-none rounded bg-danger-50 px-1.5 py-px text-[11px] font-semibold text-danger-700">Повторити KeyCRM</span>
                      ) : c.currentSessions.length > 0 ? (
                        <span className="flex-none rounded bg-warning-50 px-1.5 py-px text-[11px] font-semibold text-warning-700">Буде перенесено</span>
                      ) : null}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted">
                      {c.phone && <span className="inline-flex items-center gap-1 tabular-nums"><Phone className="h-3 w-3" />{c.phone}</span>}
                      {c.pipelineName && (
                        <span className={cx('inline-flex min-w-0 items-center gap-1.5', samePipeline && 'font-medium text-ink')}>
                          <PipelineDot id={c.pipelineId} className="h-2 w-2" /><span className="truncate">{c.pipelineName}</span>
                        </span>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                      <CalendarClock className="h-3 w-3" /> {now ? <>Зараз: {now}</> : 'Час співбесіди не заповнено'}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2 text-xs text-ink-muted">
            <span>
              {query.data ? `Лідів: ${query.data.candidates.length}` : 'KeyCRM'}
              {query.data?.truncated && ' (показано не всіх)'}
            </span>
            <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline disabled:opacity-50">
              <RefreshCw className={cx('h-3.5 w-3.5', query.isFetching && 'animate-spin')} /> Оновити
            </button>
          </div>
        </div>
      )}

      {picked && <ConfirmAdd session={session} candidate={picked} onClose={() => setPicked(null)} />}
    </div>
  );
}

function ConfirmAdd({ session, candidate, onClose }: { session: Session; candidate: Candidate; onClose: () => void }) {
  const add = useAddParticipant(session.id);
  const [err, setErr] = useState<string | null>(null);
  const now = currentInterview(candidate);

  async function confirm() {
    if (add.isPending) return;
    setErr(null);
    try {
      const r = await add.mutateAsync(candidate.cardId);
      if (r.keycrmSync === 'Failed') {
        toast.warning('Кандидата записано, але KeyCRM не оновлено', { description: r.warning, duration: 12000 });
      } else {
        toast.success('Кандидата записано', { description: `${candidate.name} · ${when(session.startDate)}` });
      }
      onClose();
    } catch (e) {
      setErr(e instanceof ClientApiError ? e.message : 'Не вдалося записати кандидата.');
    }
  }

  return (
    <Modal open size="sm" onClose={onClose} closeDisabled={add.isPending} title="Записати кандидата?" description={session.name}
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={add.isPending}>Скасувати</Button>
        <Button onClick={confirm} loading={add.isPending} data-autofocus>Записати</Button>
      </>}>
      <div className="space-y-3 text-sm">
        <div className="rounded-lg border border-line px-3 py-2.5">
          <p className="font-semibold text-ink">{candidate.name}</p>
          <p className="mt-0.5 text-ink-muted">
            {[candidate.phone, candidate.pipelineName].filter(Boolean).join(' · ') || `Картка KeyCRM #${candidate.cardId}`}
          </p>
        </div>
        <div className="rounded-lg bg-primary-50 px-3 py-2.5 text-ink">
          <p className="text-xs font-medium text-ink-muted">Час співбесіди в KeyCRM буде перезаписано</p>
          <p className="mt-1">
            {now ? <span className="text-ink-muted line-through">{now}</span> : <span className="text-ink-muted">не заповнено</span>}
            {' → '}<b>{when(session.startDate)}</b>
          </p>
        </div>
        {candidate.retryHere && (
          <div className="flex gap-2.5 rounded-lg border border-danger/20 bg-danger-50 px-3 py-2.5 text-danger-700" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <p>Кандидат уже записаний сюди, але поле в KeyCRM тоді не оновилось. Запис буде створено заново і KeyCRM оновлено ще раз.</p>
          </div>
        )}
        {candidate.currentSessions.length > 0 && (
          <div className="flex gap-2.5 rounded-lg border border-warning/30 bg-warning-50 px-3 py-2.5 text-warning-700" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <p>
              Запис на {candidate.currentSessions.length > 1 ? 'інші співбесіди' : 'іншу співбесіду'} буде скасовано:{' '}
              <b>{candidate.currentSessions.map((s) => (s.startDate ? when(s.startDate) : s.name || 'співбесіда')).join('; ')}</b>.
            </p>
          </div>
        )}
        <p className="text-xs text-ink-muted">Статус картки в KeyCRM не зміниться.</p>
        {err && <p className="rounded-lg bg-danger-50 px-3 py-2 text-danger-700" role="alert">{err}</p>}
      </div>
    </Modal>
  );
}
