# Адмінпанель групових співбесід

Вебзастосунок для адміністраторів: огляд і список групових співбесід (з режимом календаря), створення, редагування та закриття співбесід (кожна прив'язана до воронки KeyCRM), призначення відповідальних, фільтр за воронкою, перегляд зареєстрованих кандидатів.
Дані зберігаються в **n8n Data Tables**. Браузер звертається лише до бекенду цього застосунку, а бекенд — до захищеного webhook у n8n. Секрет n8n у браузер не потрапляє.

```
Браузер ──► Next.js (src/app/api/*) ──X-Webhook-Token──► n8n webhook /session-management ──► Data Tables
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
    api/sessions/...          Бекенд: проксі до n8n з валідацією
    api/pipelines/route.ts    Довідник воронок (з n8n)
    api/responsibles/route.ts Співробітники для призначення відповідальними (з n8n)
    api/auth/...              Вхід і вихід (cookie сесії)
    api/health/route.ts       Healthcheck для Railway (без входу)
  components/                 Navbar, спільна форма, календар, картки, UI
  hooks/use-sessions.ts       Спільний кеш даних для всіх вкладок
  lib/time.ts                 Усі перетворення часу (UTC ⇄ Europe/Kyiv)
  lib/n8n.ts                  Серверний клієнт n8n (секрет лише тут)
n8n/                          JSON-файли workflow для імпорту в n8n + UPGRADE-pipelines.md, UPGRADE-responsibles.md
```

## Змінні середовища

Скопіюйте `.env.example` у `.env.local` (локально) або задайте у Railway → Variables.

| Змінна | Обов'язкова | Призначення |
|---|---|---|
| `N8N_BASE_URL` | так* | Адреса n8n, напр. `https://n8n.example.com` |
| `N8N_SESSION_MANAGEMENT_WEBHOOK_URL` | ні* | Повна production-адреса webhook API. Якщо не задана — `${N8N_BASE_URL}/webhook/session-management` |
| `N8N_WEBHOOK_SECRET` | так | Секрет із credential «Admin API secret (X-Webhook-Token)» у n8n |
| `N8N_REQUEST_TIMEOUT_MS` | ні | Тайм-аут запиту до n8n, типово `15000` |
| `ADMIN_LOGIN` | так | Спільний логін для входу |
| `ADMIN_PASSWORD` | так | Спільний пароль для входу |
| `ADMIN_SESSION_SECRET` | так | Ключ підпису cookie сесії, ≥ 32 символи (`openssl rand -base64 48`) |

\* Потрібна хоча б одна з двох адрес.

Усі змінні — серверні (без префікса `NEXT_PUBLIC_`), тож вони не потрапляють у JavaScript браузера.

## Локальний запуск

Потрібен Node.js 20.9+ (рекомендовано 22).

```bash
npm install
cp .env.example .env.local   # і заповніть значення
npm run dev                  # http://localhost:3000
```

Production-збірка локально: `npm run build && npm start`.

## Розгортання на Railway

1. Завантажте проєкт у GitHub-репозиторій (`.env*` і `node_modules` у `.gitignore`).
2. Railway → New Project → Deploy from GitHub repo → оберіть репозиторій.
3. Variables: додайте змінні з таблиці вище.
4. Settings → Networking → Generate Domain.

`railway.json` уже задає збірку (`npm run build`), запуск (`npm run start`, порт Railway підхоплюється автоматично) і healthcheck `/api/health`.

## Важливо

- **Вхід.** Один спільний логін і пароль (`ADMIN_LOGIN`, `ADMIN_PASSWORD`). Після входу браузер отримує HTTP-only cookie `ia_session` на 30 днів (Secure у production, SameSite=Lax), підписаний HMAC-SHA256 ключем `ADMIN_SESSION_SECRET`. Бази даних немає: сесія зберігається лише в cookie.
  - `src/middleware.ts` перевіряє сесію до виконання будь-якої сторінки чи API. Без сесії сторінки переадресовуються на `/login`, а API відповідає `401`. Без входу доступні лише `/login`, `/api/auth/*` і `/api/health`.
  - Другий рубіж: `lib/n8n.ts` ще раз перевіряє cookie, тож без сесії запит до n8n не виконується.
  - Змінили пароль, логін чи ключ — усі сесії завершуються, і всім треба увійти знову.
  - 10 невдалих спроб входу з однієї IP-адреси за 15 хвилин тимчасово блокують вхід.
  - Якщо змінні не задані, вхід неможливий: доступ закритий для всіх.
- **Часовий пояс.** Дата й час вводяться і показуються за Києвом незалежно від часового поясу комп'ютера. Зберігаються в UTC. Час, якого не існує через перехід на літній час (напр. 03:30 в останню неділю березня), форма не приймає.
- Поле часу показує 24- чи 12-годинний формат залежно від мови браузера / ОС.
- Реєстрації кандидатів адмінпанель лише показує; змінює їх тільки workflow бронювання.
- **Воронки.** Список воронок для форми й фільтрів береться з n8n: workflow API → вузол «Конфіг» → поле `PIPELINES` (JSON `[{ "id": 1, "name": "…" }]`). Назва має точно збігатися з назвою воронки в KeyCRM: за нею workflow бронювання шукає сесії. Воронку сесії можна змінити, лише поки на неї ніхто не записаний.
- **Відповідальні.** Список співробітників береться з n8n Data Table **Interview Responsibles** (`employee_id`, `name`, `discord_id`). На співбесіду можна призначити кількох; вони зберігаються в колонці `responsible_ids`. Workflow 05 щодня о 9:00 надсилає в Discord сьогоднішні співбесіди й тегає відповідальних. Налаштування: `n8n/UPGRADE-responsibles.md`.
