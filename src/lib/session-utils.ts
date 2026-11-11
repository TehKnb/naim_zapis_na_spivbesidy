import type { Session } from './types';
import { isPastIso } from './time';

export type DisplayState = 'open' | 'full' | 'closed' | 'past';

export function displayState(s: Session): DisplayState {
  if (isPastIso(s.startDate)) return 'past';
  if (s.status === 'Closed') return 'closed';
  if (s.status === 'Full') return 'full';
  return 'open';
}

export const STATE_META: Record<DisplayState, { label: string; badge: string; dot: string; event: string }> = {
  open: {
    label: 'Відкрита',
    badge: 'bg-success-50 text-success-700 ring-success/25',
    dot: 'bg-success',
    event: 'bg-primary-50 text-primary border-primary/25 hover:bg-primary-100',
  },
  full: {
    label: 'Заповнена',
    badge: 'bg-warning-50 text-warning-700 ring-warning/20',
    dot: 'bg-warning',
    event: 'bg-warning-50 text-warning-700 border-warning/30 hover:bg-[#FEF0C7]',
  },
  closed: {
    label: 'Закрита',
    badge: 'bg-neutral-100 text-neutral-700 ring-neutral-500/15',
    dot: 'bg-ink-soft',
    event: 'bg-neutral-100 text-neutral-700 border-line-strong hover:bg-neutral-200',
  },
  past: {
    label: 'Минула',
    badge: 'bg-neutral-100 text-ink-muted ring-neutral-500/10',
    dot: 'bg-ink-soft',
    event: 'bg-neutral-50 text-ink-muted border-line hover:bg-neutral-100',
  },
};

export function fillPercent(s: Session): number {
  if (!s.maxParticipants) return 0;
  return Math.min(100, Math.round((s.currentCount / s.maxParticipants) * 100));
}

const t = (s: Session) => new Date(s.startDate).getTime();

/** Майбутні — від найближчої; потім минулі — від найсвіжішої. */
export function sortUpcomingFirst(list: Session[]): Session[] {
  const now = Date.now();
  const future = list.filter((s) => t(s) > now).sort((a, b) => t(a) - t(b));
  const past = list.filter((s) => t(s) <= now).sort((a, b) => t(b) - t(a));
  return [...future, ...past];
}

export function sortByDate(list: Session[], dir: 'asc' | 'desc'): Session[] {
  return [...list].sort((a, b) => (dir === 'asc' ? t(a) - t(b) : t(b) - t(a)));
}

export function isUpcoming(s: Session): boolean {
  return t(s) > Date.now();
}

export function pluralCandidates(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} кандидат`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} кандидати`;
  return `${n} кандидатів`;
}

export function pluralSeats(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} вільне місце`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} вільні місця`;
  return `${n} вільних місць`;
}
