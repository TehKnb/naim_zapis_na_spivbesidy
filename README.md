# Адмінпанель групових співбесід

Вебзастосунок для адміністраторів: огляд і список групових співбесід (з режимом календаря), створення, редагування та закриття співбесід (кожна прив'язана до воронки KeyCRM), призначення відповідальних, фільтр за воронкою, перегляд зареєстрованих кандидатів.
Дані зберігаються в **PostgreSQL** (Railway). Браузер звертається лише до бекенду цього застосунку; бекенд працює з базою і KeyCRM напряму. Рядок підключення й ключ KeyCRM у браузер не потрапляють.

```
Браузер ──► Next.js (src/app/api/*) ──► PostgreSQL ◄── n8n: бронювання з KeyCRM, нагадування в Discord
                                   └──► KeyCRM Open API (ручний запис кандидатів)
```

Стек: Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · TanStack Query · Luxon (Europe/Kyiv) · Lucide · шрифт Geist.

## Структура

```
src/
  middleware.ts               Перевірка входу для всіх сторінок і API
  app/
    page.tsx                  Огляд
    sessions/page.tsx         Усі співбесіди (список / календар, пошук, фільтри, сортування)
    sessions/[id]/page.tsx    Деталі + кандидати + закриття
    login/page.tsx            Сторінка входу
    api/sessions/...          Бекенд: співбесіди, кандидати, ручний запис
    api/pipelines/route.ts    Довідник воронок (таблиця interview_pipelines)
    api/responsibles/route.ts Співробітники для призначення відповідальними (interview_responsibles)
    api/auth/...              Вхід і вихід (cookie сесії)
    api/health/route.ts       Healthcheck для Railway (без входу)
  components/                 Navbar, спільна форма, календар, картки, UI
  hooks/use-sessions.ts       Спільний кеш даних для всіх вкладок
  lib/time.ts                 Усі перетворення часу (UTC ⇄ Europe/Kyiv)
  lib/sessions-service.ts     Бізнес-правила співбесід (створення, редагування, закриття, запис)
  lib/db.ts                   Пул підключень до PostgreSQL
  lib/keycrm.ts               Клієнт KeyCRM Open API
  lib/config.ts               Статус «Запросили на 1 тур», поле LD_1027 тощо
db/migrations/                SQL-схема бази (застосовується `npm run db:migrate`)
scripts/                      Міграції схеми та одноразове перенесення з n8n Data Tables
n8n/                          Workflow бронювання і Discord-нагадування (Postgres) + MIGRATION-postgres.md
```

## Змінні середовища

Скопіюйте `.env.example` у `.env.local` (локально) або задайте у Railway → Variables.

| Змінна | Обов'язкова | Призначення |
|---|---|---|
| `DATABASE_URL` | так | Рядок підключення PostgreSQL. На Railway в одному проєкті з базою — внутрішня адреса (`*.railway.internal`), інакше — публічна |
| `DATABASE_PUBLIC_URL` | локально | Публічна адреса бази. Поза Railway використовується автоматично замість внутрішньої |
| `KEYCRM_API_KEY` | так | Ключ KeyCRM Open API (ліди «Запросили на 1 тур», запис поля LD_1027) |
| `ADMIN_LOGIN` | так | Спільний логін для входу |
| `ADMIN_PASSWORD` | так | Спільний пароль для входу |
| `ADMIN_SESSION_SECRET` | так | Ключ підпису cookie сесії, ≥ 32 символи (`openssl rand -base64 48`) |

Усі змінні — серверні (без префікса `NEXT_PUBLIC_`), тож вони не потрапляють у JavaScript браузера.

## Локальний запуск

Потрібен Node.js 20.9+ (рекомендовано 22).

```bash
npm install
cp .env.example .env.local   # і заповніть значення
npm run db:migrate           # створює / оновлює таблиці (повторний запуск безпечний)
npm run dev                  # http://localhost:3000
```

Production-збірка локально: `npm run build && npm start`.

## Розгортання на Railway

1. Завантажте проєкт у GitHub-репозиторій (`.env*` і `node_modules` у `.gitignore`).
2. Railway → New Project → Deploy from GitHub repo → оберіть репозиторій.
3. Variables: додайте змінні з таблиці вище (`DATABASE_URL`, `KEYCRM_API_KEY`, `ADMIN_*`).
4. Settings → Networking → Generate Domain.

Схему бази оновлюйте командою `npm run db:migrate` (локально з `.env.local`) після змін у `db/migrations/`.

`railway.json` уже задає збірку (`npm run build`), запуск (`npm run start`, порт Railway підхоплюється автоматично) і healthcheck `/api/health`.

## Важливо

- **Вхід.** Один спільний логін і пароль (`ADMIN_LOGIN`, `ADMIN_PASSWORD`). Після входу браузер отримує HTTP-only cookie `ia_session` на 30 днів (Secure у production, SameSite=Lax), підписаний HMAC-SHA256 ключем `ADMIN_SESSION_SECRET`. Сесія входу зберігається лише в cookie (не в базі).
  - `src/middleware.ts` перевіряє сесію до виконання будь-якої сторінки чи API. Без сесії сторінки переадресовуються на `/login`, а API відповідає `401`. Без входу доступні лише `/login`, `/api/auth/*` і `/api/health`.
  - Другий рубіж: кожен API-маршрут (`guarded` у `lib/server-route.ts`) ще раз перевіряє cookie, тож без сесії база і KeyCRM не чіпаються.
  - Змінили пароль, логін чи ключ — усі сесії завершуються, і всім треба увійти знову.
  - 10 невдалих спроб входу з однієї IP-адреси за 15 хвилин тимчасово блокують вхід.
  - Якщо змінні не задані, вхід неможливий: доступ закритий для всіх.
- **Часовий пояс.** Дата й час вводяться і показуються за Києвом незалежно від часового поясу комп'ютера. Зберігаються в UTC. Час, якого не існує через перехід на літній час (напр. 03:30 в останню неділю березня), форма не приймає.
- Поле часу показує 24- чи 12-годинний формат залежно від мови браузера / ОС.
- **База даних.** Таблиці: `interview_sessions`, `interview_participants`, `interview_responsibles`, `interview_pipelines` (схема — `db/migrations/`). Автоматичні записи кандидатів робить workflow бронювання в n8n (вузли Postgres), ручні — адмінпанель. Зміни в одній транзакції з блокуванням рядка співбесіди, тож два адміністратори не переповнять одну співбесіду.
- **Воронки.** Список воронок — таблиця `interview_pipelines` (`id` воронки KeyCRM, `name`, `position` для порядку). Додати чи перейменувати воронку можна прямо в таблиці (Railway → база → Data). Назва має точно збігатися з назвою воронки в KeyCRM: за нею workflow бронювання шукає сесії. Воронку сесії можна змінити, лише поки на неї ніхто не записаний.
- **Ручний запис кандидатів.** На сторінці співбесіди кнопка «Додати кандидата» показує лідів KeyCRM у статусі «Запросили на 1 тур» (ID 29, `lib/config.ts`). Запис переносить кандидата з іншої співбесіди, перезаписує поле LD_1027 і не змінює статус картки. Якщо KeyCRM не оновився, запис лишається з `keycrm_sync = Failed` і його можна повторити.
- **Відповідальні.** Список співробітників — таблиця `interview_responsibles` (`employee_id`, `name`, `discord_id`). На співбесіду можна призначити кількох (`responsible_ids` — масив). Workflow 05 щодня о 9:00 надсилає в Discord сьогоднішні співбесіди й тегає відповідальних.
- **Перехід з n8n Data Tables** — покроково в `n8n/MIGRATION-postgres.md`.
