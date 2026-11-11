'use client';

import { CalendarDays, Clock, Info, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useCreateSession, useUpdateSession } from '@/hooks/use-sessions';
import { ClientApiError } from '@/lib/api-client';
import { pluralCandidates } from '@/lib/session-utils';
import { localPartsToUtc, nowKyiv, previewSessionName, toLocalParts } from '@/lib/time';
import type { Session, SessionInput } from '@/lib/types';
import { Button, cx, Modal } from './ui';

type FormState = { mode: 'create' } | { mode: 'edit'; session: Session };
const Ctx = createContext<{ openCreate: () => void; openEdit: (s: Session) => void } | null>(null);

export function useSessionForm() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSessionForm must be used inside SessionFormProvider');
  return c;
}

/** Одна спільна форма створення / редагування для всього застосунку. */
export function SessionFormProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FormState | null>(null);
  const [nonce, setNonce] = useState(0);
  const openCreate = useCallback(() => { setState({ mode: 'create' }); setNonce((n) => n + 1); }, []);
  const openEdit = useCallback((session: Session) => { setState({ mode: 'edit', session }); setNonce((n) => n + 1); }, []);
  const value = useMemo(() => ({ openCreate, openEdit }), [openCreate, openEdit]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {state && <SessionFormDialog key={nonce} state={state} onClose={() => setState(null)} />}
    </Ctx.Provider>
  );
}

function initialValues(state: FormState) {
  if (state.mode === 'edit') {
    const { date, time } = toLocalParts(state.session.startDate);
    return { date, time, max: String(state.session.maxParticipants) };
  }
  const t = nowKyiv().plus({ days: 1 });
  return { date: t.toFormat('yyyy-LL-dd'), time: '10:00', max: '10' };
}

type Errors = Partial<Record<'date' | 'time' | 'maxParticipants', string>>;

function SessionFormDialog({ state, onClose }: { state: FormState; onClose: () => void }) {
  const router = useRouter();
  const init = useMemo(() => initialValues(state), [state]);
  const [date, setDate] = useState(init.date);
  const [time, setTime] = useState(init.time);
  const [max, setMax] = useState(init.max);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const isEdit = state.mode === 'edit';
  const session = isEdit ? state.session : null;
  const create = useCreateSession();
  const update = useUpdateSession(session?.id ?? '');
  const mutation = isEdit ? update : create;
  const pending = mutation.isPending;
  const preview = previewSessionName(date, time);
  const minDate = nowKyiv().toFormat('yyyy-LL-dd');

  function validate(): Errors {
    const e: Errors = {};
    if (!date) e.date = 'Вкажіть дату';
    if (!time) e.time = 'Вкажіть час';
    if (date && time) {
      const r = localPartsToUtc(date, time);
      const changed = !isEdit || date !== init.date || time !== init.time;
      if (!r.ok) e[r.code === 'NONEXISTENT_TIME' ? 'time' : 'date'] = r.message;
      else if (changed && new Date(r.iso).getTime() <= Date.now()) e.date = isEdit ? 'Не можна перенести співбесіду в минуле' : 'Не можна створити співбесіду в минулому';
    }
    const n = Number(max);
    if (!max.trim()) e.maxParticipants = 'Вкажіть кількість';
    else if (!Number.isInteger(n) || n <= 0) e.maxParticipants = 'Має бути додатне ціле число';
    else if (n > 1000) e.maxParticipants = 'Занадто велике значення';
    else if (session && n < session.currentCount) e.maxParticipants = `Не менше ${session.currentCount} — стільки кандидатів уже зареєстровано`;
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (pending) return; // захист від повторного натискання
    setFormError(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    const input: SessionInput = { date, time, maxParticipants: Number(max) };
    try {
      const { session: saved } = await mutation.mutateAsync(input);
      toast.success(isEdit ? 'Зміни збережено' : 'Співбесіду створено', {
        description: saved.name,
        action: !isEdit ? { label: 'Відкрити', onClick: () => router.push(`/sessions/${saved.id}`) } : undefined,
      });
      onClose();
    } catch (err) {
      // Введені дані лишаються у формі
      if (err instanceof ClientApiError) {
        const f = err.fields as Errors;
        if (err.code === 'CAPACITY_BELOW_REGISTERED') setErrors({ maxParticipants: err.message });
        else if (err.code === 'START_IN_PAST') setErrors({ date: err.message });
        else if (Object.keys(f).length) setErrors(f);
        else setFormError(err.message);
      } else setFormError('Не вдалося зберегти. Спробуйте ще раз.');
    }
  }

  const field = 'h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:bg-neutral-50';
  const err = (k: keyof Errors) => errors[k] && <p className="mt-1.5 text-xs text-danger" role="alert">{errors[k]}</p>;

  return (
    <Modal
      open
      onClose={onClose}
      closeDisabled={pending}
      title={isEdit ? 'Редагувати співбесіду' : 'Нова співбесіда'}
      description={isEdit ? session!.name : 'Назва сформується автоматично з дати й часу'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending} type="button">Скасувати</Button>
          <Button type="submit" form="session-form" loading={pending}>{isEdit ? 'Зберегти зміни' : 'Створити співбесіду'}</Button>
        </>
      }
    >
      <form id="session-form" onSubmit={submit} noValidate className="space-y-5">
        {formError && (
          <div className="flex gap-2 rounded-lg border border-danger/20 bg-danger-50 px-3 py-2.5 text-sm text-danger-700" role="alert">
            <Info className="mt-0.5 h-4 w-4 flex-none" /> {formError}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 xs:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink"><CalendarDays className="h-4 w-4 text-ink-muted" /> Дата</span>
            <input type="date" value={date} min={isEdit ? undefined : minDate} onChange={(e) => setDate(e.target.value)} disabled={pending}
              aria-invalid={!!errors.date} className={cx(field, errors.date ? 'border-danger' : 'border-line-strong')} />
            {err('date')}
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink"><Clock className="h-4 w-4 text-ink-muted" /> Час</span>
            <input type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} disabled={pending}
              aria-invalid={!!errors.time} className={cx(field, errors.time ? 'border-danger' : 'border-line-strong')} />
            {err('time')}
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink"><Users className="h-4 w-4 text-ink-muted" /> Максимальна кількість учасників</span>
          <input type="number" inputMode="numeric" min={session?.currentCount || 1} step={1} value={max} onChange={(e) => setMax(e.target.value)} disabled={pending}
            aria-invalid={!!errors.maxParticipants} className={cx(field, errors.maxParticipants ? 'border-danger' : 'border-line-strong')} />
          {err('maxParticipants')}
          {session && session.currentCount > 0 && !errors.maxParticipants && (
            <p className="mt-1.5 text-xs text-ink-muted">Уже зареєстровано {pluralCandidates(session.currentCount)} — менше вказати не можна.</p>
          )}
        </label>
        <div className="rounded-lg border border-line bg-canvas px-3 py-2.5">
          <p className="text-xs text-ink-muted">Назва</p>
          <p className="mt-0.5 text-sm font-medium text-ink">{preview ?? '—'}</p>
          <p className="mt-1 text-xs text-ink-muted">Час за Києвом (Europe/Kyiv). {isEdit ? 'Статус оновиться відповідно до заповненості.' : 'Нова співбесіда отримає статус «Відкрита».'}</p>
        </div>
      </form>
    </Modal>
  );
}
