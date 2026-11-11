export type SessionStatus = 'Open' | 'Full' | 'Closed';

/** Співбесіда, як її повертає API (n8n workflow «Адмінпанель: API керування співбесідами»). */
export interface Session {
  id: string;
  name: string;
  /** ISO 8601 у UTC. Показувати завжди через helpers з lib/time.ts (Europe/Kyiv). */
  startDate: string;
  status: SessionStatus;
  maxParticipants: number;
  /** Активні реєстрації (без Cancelled). */
  currentCount: number;
  availableSeats: number;
  isPast: boolean;
  /** Воронка KeyCRM, для якої ця співбесіда. null — ще не прив'язано (стара сесія). */
  pipelineId: number | null;
  pipelineName: string;
  /** ID відповідальних співробітників (таблиця Interview Responsibles у n8n). */
  responsibleIds?: number[];
  /** Ті самі відповідальні з іменами. missing — співробітника вже немає в довіднику. */
  responsibles?: SessionResponsible[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export type RegistrationStatus = 'Reserved' | 'Confirmed' | 'Cancelled';
export type KeycrmSync = 'Pending' | 'Synced' | 'Failed';

export interface Participant {
  id: number;
  name: string;
  phone: string;
  keycrmId: string;
  registrationStatus: RegistrationStatus | string;
  keycrmSync: KeycrmSync | string;
  createdAt?: string | null;
}

export interface SessionDetails {
  session: Session;
  participants: Participant[];
}

/** Воронка з довідника (n8n «Конфіг» → PIPELINES). */
export interface Pipeline {
  id: number;
  name: string;
}

/** Співробітник, якого можна призначити відповідальним (n8n таблиця Interview Responsibles). */
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

export interface ApiErrorBody {
  error: { code: string; message: string; [key: string]: unknown };
}
