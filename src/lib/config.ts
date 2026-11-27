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
/** Статус «Відібрано»: з нього приходить webhook бронювання. Переносити на ближчу дату можна лише лідів, які ще в ньому (агент їм ще не дзвонив). */
export const SELECTED_STATUS_ID = 30;
/** Не переносити лідів у сесію, що починається раніше ніж за стільки хвилин (як MIN_LEAD_MINUTES у workflow бронювання). */
export const REBALANCE_MIN_LEAD_MINUTES = 0;
/** Обмеження одного перерозподілу: перенесень і перевірок карток KeyCRM (ліміт запитів KeyCRM). */
export const REBALANCE_MAX_MOVES = 30;
export const REBALANCE_MAX_CARD_CHECKS = 40;
