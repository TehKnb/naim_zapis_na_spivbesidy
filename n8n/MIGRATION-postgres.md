# Перехід з n8n Data Tables на PostgreSQL

Що змінюється:

| Було | Стало |
|---|---|
| Data Tables: Interview Sessions / Participants / Responsibles | Таблиці PostgreSQL `interview_sessions`, `interview_participants`, `interview_responsibles` |
| Довідник воронок у вузлі «Конфіг» workflow 02 | Таблиця `interview_pipelines` |
| Workflow «Адмінпанель: API керування співбесідами (Data Tables)» | Логіка в самій адмінпанелі (`src/lib/sessions-service.ts`), workflow вимикається |
| Вузли «DT: …» у workflow бронювання і Discord-нагадуванні | Вузли «БД: …» (Postgres) з тими самими полями; решта логіки без змін |

Файли: `01-booking-keycrm-postgres.json` (бронювання), `05-discord-daily-interviews.json` (нагадування). Credential у них — заглушка `REPLACE_POSTGRES_CRED`.

## 1. Підготовка (один раз)

1. **Схема бази**: `npm run db:migrate`. Створює таблиці й заповнює воронки; повторний запуск безпечний.
2. **Credential у n8n**: Credentials → New → **Postgres**:
   - Host `roundhouse.proxy.rlwy.net`, Port `49362`, Database `railway`, User `postgres`, Password — з `DATABASE_PUBLIC_URL`;
   - SSL: `Require`, увімкнути **Ignore SSL Issues** (у публічного проксі Railway самопідписаний сертифікат).
   n8n працює на іншому хостингу, тому потрібна саме публічна адреса.
3. **Змінні адмінпанелі** на хостингу: `DATABASE_URL`, `KEYCRM_API_KEY` (див. `.env.example`). Змінні `N8N_*` більше не потрібні.

## 2. Перемикання (одним заходом, коли ніхто не працює в адмінпанелі)

1. **Свіжі дані з Data Tables.** Запустіть тимчасовий workflow «TMP: експорт Data Tables у PostgreSQL», збережіть вихід вузла «Експорт» у файл і виконайте:
   ```bash
   npm run db:import -- export.json --replace
   ```
   `--replace` очищає співбесіди й учасників у базі перед перенесенням. Використовуйте лише ДО запуску нової системи.
2. **Workflow бронювання.** Замініть вузли «DT: …» на «БД: …» (імпорт `01-booking-keycrm-postgres.json` або оновлення наявного workflow), у кожному вузлі «БД: …» оберіть Postgres credential і опублікуйте.
3. **Адмінпанель.** Розгорніть нову версію (push у `main`).
4. **Старий API.** Вимкніть (Unpublish) workflow «Адмінпанель: API керування співбесідами (Data Tables)». Workflow «TMP: експорт…» можна видалити.
5. **Discord-нагадування.** Імпортуйте `05-discord-daily-interviews.json` замість старого, оберіть Postgres credential у трьох вузлах «БД: …», вставте адресу Discord webhook і опублікуйте.

Між кроками 2 і 3 стара адмінпанель ще читає Data Tables. Тому робіть ці кроки один за одним і нічого не змінюйте в адмінпанелі в цей час.

Data Tables після перемикання лишаються як резервна копія. Видалити їх можна, коли все перевірено.

## Повернення назад

Попередні версії workflow є в історії версій n8n (Workflow → History). Стара адмінпанель — попередній коміт у git. Дані, записані вже в PostgreSQL, у Data Tables не потрапляють.
