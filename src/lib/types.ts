export type SessionStatus = 'Open' | 'Full' | 'Closed';

/** Співбесіда, як її повертає API (маршрути /api/sessions, дані — PostgreSQL). */
export interface Session {
  id: string;
  name: string;
  /** ISO 8601 у UTC. Показувати завжди через helpers з lib/time.ts (Europe/Kyiv). */
  startDate: string;
  status: SessionStatus;
  maxParticipants: number;
  /** Активні реєстрації (без Cancelled): бронь + підтверджені. */
  currentCount: number;
  /** Підтверджені (кандидат підтвердив час агенту або записаний вручну). */
  confirmedCount?: number;
  /** Броні, які ще чекають підтвердження. */
  reservedCount?: number;
  availableSeats: number;
  isPast: boolean;
  /** Воронка KeyCRM, для якої ця співбесіда. null — ще не прив'язано (стара сесія). */
  pipelineId: number | null;
  pipelineName: string;
  /** ID відповідальних співробітників (таблиця interview_responsibles). */
  responsibleIds?: number[];
  /** Ті самі відповідальні з іменами. missing — співробітника вже немає в довіднику. */
  responsibles?: SessionResponsible[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** Reserved — бронь (кандидат ще не підтвердив час), Confirmed — підтверджено, Cancelled — знято. */
export type RegistrationStatus = 'Reserved' | 'Confirmed' | 'Cancelled';
export type KeycrmSync = 'Pending' | 'Synced' | 'Failed';

export interface Participant {
  id: number;
  name: string;
  phone: string;
  keycrmId: string;
  registrationStatus: RegistrationStatus | string;
  keycrmSync: KeycrmSync | string;
  /** Причина скасування: agent_declined — відмова агенту, rebooked_manually — перезаписано вручну. */
  cancelReason?: string;
  confirmedAt?: string | null;
  createdAt?: string | null;
}

export interface SessionDetails {
  session: Session;
  participants: Participant[];
}

/** Воронка з довідника (таблиця interview_pipelines). */
export interface Pipeline {
  id: number;
  name: string;
}

/** Співробітник, якого можна призначити відповідальним (таблиця interview_responsibles). */
export interface Responsible {
  id: number;
  name: string;
  /** Чи заданий Discord ID (для тегу в щоденному повідомленні). */
  discordLinked: boolean;
}

export interface SessionResponsible extends Responsible {
  missing?: boolean;
}

/** Дані форми: дата й час — локальні, Europe/Kyiv. */
export interface SessionInput {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  maxParticipants: number;
  pipelineId: number;
  responsibleIds: number[];
}

/** Лід KeyCRM у статусі «Запросили на 1 тур» — кандидат для ручного запису на співбесіду. */
export interface Candidate {
  cardId: string;
  name: string;
  phone: string;
  pipelineId: number | null;
  pipelineName: string;
  /** Поточний час співбесіди з поля KeyCRM (ISO UTC); null — не заповнено або не розпізнано. */
  interviewAt: string | null;
  interviewRaw: string;
  /** Уже записаний на цю співбесіду. */
  inThisSession: boolean;
  /** Записаний сюди, але поле в KeyCRM не оновилось (Failed) — можна повторити. */
  retryHere?: boolean;
  /** Активні записи на інші співбесіди (будуть скасовані при перенесенні). */
  currentSessions: { sessionId: string; name: string; startDate: string | null }[];
}

export interface AddParticipantResult {
  participant: Participant;
  session: Session;
  keycrmSync: 'Synced' | 'Failed';
  previousCancelled: number;
  warning?: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; [key: string]: unknown };
}
