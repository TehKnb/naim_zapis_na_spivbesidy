/**
 * Налаштування бізнес-логіки (раніше — вузол «Конфіг» у n8n workflow «Адмінпанель: API…»).
 * Довідник воронок тепер у таблиці interview_pipelines.
 */
export const KEYCRM_API = (process.env.KEYCRM_API_URL?.trim() || 'https://openapi.keycrm.app/v1').replace(/\/+$/, '');
/** Статус «Запросили на 1 тур»: з нього беруться ліди для ручного запису. */
export const CANDIDATE_STATUS_ID = 29;
/** Кастомне поле картки KeyCRM з датою й часом співбесіди. */
export const INTERVIEW_FIELD_UUID = 'LD_1027';
/** Тип поля: datetime | date | text (так само, як у workflow бронювання). */
export const INTERVIEW_FIELD_TYPE: 'datetime' | 'date' | 'text' = 'datetime';
/** Скільки сторінок лідів (по 50) максимум читати з KeyCRM. */
export const CANDIDATES_MAX_PAGES = 10;
export const KEYCRM_TIMEOUT_MS = 20_000;
