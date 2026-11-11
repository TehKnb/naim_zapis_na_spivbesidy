'use client';

import { AlertTriangle, Inbox, LoaderCircle, RefreshCw, WifiOff, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { ClientApiError } from '@/lib/api-client';
import { displayState, fillPercent, STATE_META } from '@/lib/session-utils';
import type { Session } from '@/lib/types';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover focus-visible:ring-primary/30 disabled:bg-primary/60',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-neutral-50 focus-visible:ring-primary/20 disabled:text-ink-soft',
  ghost: 'text-ink-muted hover:text-ink hover:bg-neutral-100 focus-visible:ring-primary/20',
  danger: 'bg-danger text-white hover:bg-danger-700 focus-visible:ring-danger/30 disabled:bg-danger/60',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        BTN[variant],
        className,
      )}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-neutral-100 hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx('rounded-card border border-line bg-surface', className)}>{children}</div>;
}

export function StatusBadge({ session, className }: { session: Session; className?: string }) {
  const m = STATE_META[displayState(session)];
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', m.badge, className)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', m.dot)} aria-hidden />
      {m.label}
    </span>
  );
}

export function Pill({ tone, children }: { tone: 'blue' | 'green' | 'orange' | 'red' | 'gray'; children: React.ReactNode }) {
  const tones = {
    blue: 'bg-primary-50 text-primary ring-primary/15',
    green: 'bg-success-50 text-success-700 ring-success/20',
    orange: 'bg-warning-50 text-warning-700 ring-warning/20',
    red: 'bg-danger-50 text-danger-700 ring-danger/20',
    gray: 'bg-neutral-100 text-neutral-700 ring-neutral-500/15',
  };
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone])}>{children}</span>;
}

export function ProgressBar({ session, className }: { session: Session; className?: string }) {
  const pct = fillPercent(session);
  const state = displayState(session);
  const color = state === 'past' || state === 'closed' ? 'bg-ink-soft' : pct >= 100 ? 'bg-warning' : 'bg-primary';
  return (
    <div
      className={cx('h-1.5 w-full overflow-hidden rounded-full bg-neutral-100', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={`Заповненість ${pct}%`}
    >
      <div className={cx('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-md bg-neutral-100', className)} aria-hidden />;
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ title, description, icon, children }: { title: string; description?: string; icon?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-ink-muted">{icon ?? <Inbox className="h-5 w-5" />}</div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const down = error instanceof ClientApiError && error.isN8nDown;
  const message = error instanceof Error ? error.message : 'Не вдалося завантажити дані.';
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center" role="alert">
      <div className={cx('mb-4 flex h-12 w-12 items-center justify-center rounded-full', down ? 'bg-warning-50 text-warning-700' : 'bg-danger-50 text-danger')}>
        {down ? <WifiOff className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
      </div>
      <p className="text-sm font-semibold text-ink">{down ? 'n8n зараз недоступний' : 'Не вдалося завантажити дані'}</p>
      <p className="mt-1 max-w-md text-sm text-ink-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Спробувати ще раз
        </Button>
      )}
    </div>
  );
}

/** Модальне вікно; на мобільних — повноекранна панель. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeDisabled,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeDisabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !closeDisabled) onClose();
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>('input, button[data-autofocus]')?.focus(), 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose, closeDisabled]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink/40 animate-[fade_150ms_ease-out]" onClick={() => !closeDisabled && onClose()} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cx(
          'relative flex h-full w-full flex-col bg-surface shadow-pop animate-[rise_180ms_ease-out] sm:h-auto sm:max-h-[90vh] sm:rounded-card sm:border sm:border-line',
          size === 'sm' ? 'sm:max-w-md' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 id="modal-title" className="text-base font-semibold text-ink">{title}</h2>
            {description && <div className="mt-0.5 text-sm text-ink-muted">{description}</div>}
          </div>
          <IconButton label="Закрити" onClick={onClose} disabled={closeDisabled} className="-mr-2 -mt-1">
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end sm:px-6">{footer}</div>}
      </div>
    </div>
  );
}
