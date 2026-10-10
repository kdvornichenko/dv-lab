# Phase 20: Schedule - Research

> **Поправка оркестратора 2026-10-10:** D-15 и D-16 в 20-CONTEXT.md главнее этого файла. Приложение ничего не удаляет из базы: Pattern 2 шаги 5-6, строки Restore и End series в Pattern 3, допущение A3 и Open Question 2 читать как «строки остаются, меняются статус или `ends_on`, история скрывается правилом видимости в `core`». Зона серии не хранится (Open Question 1 решён: константа). Видимость вхождения принадлежит только `core/schedule.ts` (20-ARCH-REVIEW.md).

**Researched:** 2026-10-10
**Domain:** Recurring-lesson data model (series + exceptions) on Postgres 18 / Drizzle rc.4, time-zone arithmetic without a date library, Hono API, Next 16 week grid
**Confidence:** HIGH for the code map and the environment, MEDIUM for the recommended series-cut semantics (they fill gaps D-01..D-04 leave open and need owner confirmation where tagged)

## Summary

The codebase already has every building block except the schedule itself. `packages/db` adds tables by one generated migration under `dvlab_migrator`; `dvlab_app` gets CRUD on new tables automatically through default privileges, so the migration carries no GRANT. `apps/api` routes follow one pattern (Hono router, `noStore, requireSession(db), requireRole('teacher')`, zod `readJson`, `errorBody(code, message)` with a closed `ErrorCode` list). `packages/core` is dependency-free TypeScript run straight from source by Node type stripping, which is where occurrence expansion, next-lesson and overlap detection go. The scroll fade (D-14) is already ported into `apps/web/app/globals.css`; only the tokens and the deletion of one unlayered rule remain (UI-SPEC E1, E2).

There is no date library and no `Temporal` (Node 24.17: `typeof Temporal` is `undefined`), and the UI-SPEC forbids new packages. Core therefore needs a small `Intl.DateTimeFormat#formatToParts` helper pair: zoned wall time to instant and instant to zoned parts. Vietnam has no DST, but the helper must not assume a constant offset, because the second zone (Moscow by default, any IANA zone by choice) is rendered with the same helpers. Node's ICU canonicalises `Asia/Ho_Chi_Minh` to `Asia/Saigon`, so zone ids must never be compared as strings after `resolvedOptions()`.

The decisions leave four mechanics open that change the migration or the transactions: where the series' zone lives, what happens to moved and cancelled exceptions on a cut, what happens when a cut or an end leaves a series with no occurrences, and how a move that crosses week boundaries is found by the week query. This document recommends one answer for each (Architecture Patterns, Pattern 2 and 3) and lists the ones that need the owner in Open Questions.

**Primary recommendation:** Three tables exactly as D-01 names them, series rule columns immutable after insert (only `ends_on` changes), every series change done as one locked transaction in `apps/api`, every occurrence computed by one `packages/core` module (`schedule.ts`) on the server, and the web receiving a flat, already expanded week of blocks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Модель уроков и серий
- **D-01:** Серия хранится одним правилом в `lesson_series` (`student_id`, `weekday` 1-7, `start_time` местное время зоны серии, `duration_minutes`, `starts_on`, `ends_on` пусто = идёт). Одиночные уроки в `lessons` (`student_id`, `starts_at timestamptz`, `duration_minutes`, `status` scheduled | cancelled, по умолчанию scheduled; отменённый одиночный урок остаётся виден зачёркнутым с кнопкой Restore, решение владельца 2026-10-10). Исключение из серии в `lesson_exceptions` (`series_id`, `original_on`, `kind` cancelled | moved, для moved `starts_at` и `duration_minutes`; ключ `series_id + original_on`). Вхождения серии считаются при показе, строк на каждое вхождение нет, генератора нет. Ключ вхождения = серия + исходная дата: на нём фаза 21 строит отметки, фазы 24-25 строят id событий Google. — **Reversibility:** one-way — ключ вхождения и схема лягут в миграцию и в id событий Google.
- **D-02:** Серия открытая: учитель заканчивает её кнопкой (`ends_on` = последняя дата), числа уроков при создании нет. Прошлые уроки закончившейся серии не меняются.

#### Перенос и отмена
- **D-03:** Перенос всей серии на другой день и время режет её: старая серия получает `ends_on` накануне, новая начинается с выбранной даты. По умолчанию дата = ближайшее вхождение, её можно изменить. Прошлые вхождения остаются в старой серии без правки.
- **D-04:** При переносе серии уже перенесённые будущие вхождения остаются отдельными уроками на том времени, куда их поставил учитель; отменённые вхождения сбрасываются (старая дата в новом правиле уже не существует).
- **D-05:** Прошедшие вхождения в этой фазе только смотреть: перенос и отмена недоступны. Отметки проведён и неявка добавляет фаза 21.
- **D-06:** Перерывы из `Teaching breaks.md` в расписание не импортируются и не рисуются; учитель отменяет вхождения сам. Массовые переносы придут с чатом в фазе 23.

#### Часовые пояса
- **D-07:** Сетка показывает время Вьетнама (`Asia/Ho_Chi_Minh`). Вторая зона одна на всю сетку, выбирается в шапке, по умолчанию Москва, выбор помнит браузер; в базу ничего не пишется. Поле `students.time_zone` в этой фазе не используется.

#### Сетка и создание урока
- **D-08:** Урок создаётся кликом по пустой клетке (диалог с подставленными днём, временем с шагом 15 минут и длиной из `students.default_lesson_minutes`) и кнопкой «New lesson». В диалоге выбор «Repeats»: одиночный или каждую неделю.
- **D-09:** Пересекающиеся уроки разрешены: показываются рядом с предупреждением, сохранение не блокируется.
- **D-10:** Сетка показывает сутки целиком и при открытии прокручена к 08:00 по Вьетнаму. Дни Mon-Sun, навигация по неделям, кнопка Today, красная линия «сейчас», столбец сегодня подсвечен (стиль Google Calendar).
- **D-11:** Статусы блоков из варианта A поверх нейтрального цвета: отменённый зачёркнут и приглушён, перенесённый с пунктирной рамкой и стрелкой на новую дату. Цветов Google и модели цветов в этой фазе нет.

#### Список учеников
- **D-12:** Вкладки статуса Active и Archived; поиск по имени на клиенте среди загруженных карточек (карточек 25, серверный поиск не нужен).
- **D-13:** В строке: остаток уроков из `packages/core` по правилу D-09 фазы 19 (до ввода открывающего остатка «Set opening balance»; вычитание за уроки добавит фаза 21) и следующий урок из расписания в формате «Tue 14 Oct, 18:00» по времени Вьетнама; нет урока = «none».

#### Фэйд на скроллерах (правило владельца 2026-10-10, через «Design dude»)
- **D-14:** Все скроллящиеся контейнеры сайта получают фэйд: класс `scroll-fade` (вертикаль) или `scroll-fade-x` (горизонталь) на элементе с overflow; компонент ScrollFade design system v21, токены `--scroll-fade-size` 48px и `--scroll-fade-size-compact` 24px уже в `tokens.css`. Фэйд только у края, куда ещё есть что листать, появляется за первые 48px скролла; контейнер ниже 96px без фэйда; 24px для контейнеров ниже ~200px и горизонтальных лент (`[--scroll-fade-size:var(--scroll-fade-size-compact)]`). Исключение только input и textarea. В этой фазе: тело страницы, WeekGrid (вертикаль), таблица списка учеников, диалоги и выпадающие списки новых экранов.
- Ловушки: фэйд — маска самого скроллера, поэтому рамку, кольцо, фон и тень переносить на обёртку, скроллер класть внутрь; sticky-шапку и колонку времени WeekGrid держать выше скроллера (день недели и подпись зон не внутри); с ScrollArea класс ставить на viewport (`viewportClassName="scroll-fade"`); маска не мешает кликам и drag-and-drop; без scroll-driven animations фэйда нет, статичный фэйд не делать; `useReducedMotion` не нужен. Не копировать утилиту `scroll-fade` из shadcn/tailwind.css (96px, ease-in-out, статичный fallback): нужна версия из лаборатории (`src/app/globals.css`: `@property --sf-start/--sf-end`, keyframes `sf-reveal-*`, `animation-timeline: scroll(self)`); правило `.scroll-fade, .scroll-fade-x { --scroll-fade-size: 48px }` из лаборатории при переносе удалить (без слоя, перебивает переопределение на элементе). — **Reversibility:** reversible — классы на элементах.

### Claude's Discretion
- Решения D-01..D-13 подтверждены владельцем явно, пунктов «по умолчанию, не просмотрено» нет.
- Детали маршрутов API, формы диалогов, тексты и компоненты сетки выбирают исследование и планировщик в рамках решений выше; недостающий элемент дизайна запрашивается у «Design dude».

### Deferred Ideas (OUT OF SCOPE)
- Цвета событий Google и модель цветов — фазы 24-25 после спайка `colors.get`.
- Каталог всех методов Google Calendar API v3 (events, calendars, calendarList, colors, acl, settings, freebusy, channels и др.) с кратким «зачем нужен» — в фазе 24, когда проектируем работу с Google и получаем цвета: не останавливаться на цветах, держать список рядом (решение владельца 2026-10-10).
- Отметки проведён / неявка, вычитание из остатка, вкладка «pays soon» — фаза 21.
- Расписание на телефоне — фаза 23 (SHELL-03).
- Массовые переносы, отмена диапазона и учёт перерывов из `Teaching breaks.md` — чат, фаза 23 (или по запросу владельца).
- Вторая зона как настройка аккаунта в базе и зона из карточки ученика — по запросу.
- Серия с заранее заданным числом уроков — по запросу.
- Вкладка All в списке учеников и серверный поиск — не нужны при 25 карточках.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHED-01 | The teacher creates single lessons and weekly series for a student. | Schema (Pattern 1), `POST /schedule/lessons` with `repeats` (API surface), core `zonedInstant` for `starts_at`, series `starts_on` = chosen date and `weekday` derived from it (CHECK `isodow`) |
| SCHED-02 | The teacher moves or cancels a single occurrence without touching the rest of the series. | `lesson_exceptions` upsert on `(series_id, original_on)` (Pattern 3, occurrence operations), occurrence-key validation `isSeriesDate`, past guard (D-05) server-side |
| SCHED-03 | The teacher moves a whole series (new weekday and time) from the schedule. | Series cut transaction (Pattern 2): lock, `ends_on = from - 1`, new series, moved exceptions to `lessons`, cancelled exceptions deleted, empty series deleted |
| SCHED-04 | The schedule shows a week grid with week navigation and displays Vietnam time by default with a second zone available. | Week window query (Pattern 4), core zone helpers, Intl display rules and `Asia/Saigon` pitfall, WeekGrid notes (Pattern 6), E1/E2 tokens |
| SCHED-05 | Past lessons are kept intact when a series is changed or ended. | Immutable rule columns, cut never removes an occurrence that started, `from` validation against now, End series only removes dates after a date that is today or later |
| CARD-04 | The students list has status tabs, search, and shows remaining lessons and the next lesson per student. | Tabs Active/Archived already exist in `students-screen.tsx`; add search (E6, E7) and `StudentRow.nextLessonAt` computed by core `nextLessons` in `listCards` (ripple through `card-rows.ts`) |
</phase_requirements>

## Project Constraints (from CLAUDE.md and project rules)

- The project `CLAUDE.md` asks for GitNexus impact analysis; the owner's global rule 3 overrides it: GitNexus is not used. The worktree has no `.codegraph/` either, so navigation is grep and Read.
- GSD does not commit unless the phase runs in the owner's worktree mode (memory "GSD полным циклом с коммитами": worktree `gsd/phase-N-*`, executor commits per task). `.planning/config.json` has `"executor_rules": false`, and `.planning/EXECUTOR-RULES.md` still governs executors.
- No code comments anywhere. Copied files (TimePicker has a header comment and section banners) must be stripped. [VERIFIED: design-lab `time-picker.tsx:3-4,38-40`]
- Interface text English only. Base UI only; Radix and `cmdk` are forbidden (ESLint rule and grep gate).
- No new unit, integration or e2e tests. Existing tests stay green (`apps/api/test/migrate.test.ts` and `packages/db/test/roles.test.ts` count migration folders dynamically, so a fourth folder does not break them). Acceptance runs through typecheck, lint, build, one-off scripts in `scripts/dev-checks`, SQL counters through `node scripts/dev-checks/sql.mjs`, and the browser in both themes.
- Public repository: no student names, amounts or notes in files, logs or SUMMARY. Probes use fictional cards `Alex Example NNNN` and remove them.
- At most one web plan per wave (shared `.next` and dev server). `yarn workspace @dv-lab/api build` only in a plan that names it. `yarn test` truncates `dvlab_test`: never during parallel executors.
- The executor shell hook rejects `$(...)`, heredocs, `sed -i`, compound commands and `git -C`: acceptance logic goes into a script file run by path.
- Design system everywhere: an element missing from variant A and from the UI-SPEC goes to the Design dude session first. DR-3, DR-4, DR-5 are OPEN; the UI-SPEC fallback is binding until answered.
- Minimal solution: no new packages, no wrappers or abstractions that were not asked for.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Lesson, series, exception storage and integrity | Database | API | CHECKs, PK `(series_id, original_on)` and FKs hold the invariants that do not need the clock |
| Occurrence expansion, next lesson, overlap detection, zone arithmetic | `packages/core` (pure) | API calls it; web calls only overlap and date helpers | One implementation shared with phases 21-25 (UI-SPEC "Data") |
| Series cut, end, exception upsert, past guard | API | Database (row lock, transaction) | Needs `now`, a transaction and the lock; the browser clock is not trusted |
| Week read (expanded blocks) | API | core | The UI never expands series itself |
| Second zone choice | Browser (`localStorage`) | — | D-07: nothing written to the database |
| Grid layout (lanes, pixel positions, now line, scroll) | Browser | core (zone parts) | Pure presentation |
| Students list search | Browser | — | D-12: client filter over 25 loaded cards |
| `nextLessonAt` per student | API (`listCards`) | core | Same expansion as the grid (UI-SPEC E8) |

## Standard Stack

No new packages. Everything below is already pinned in the workspace.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm / drizzle-kit | 1.0.0-rc.4 | Schema, generated migration, queries | Project ORM; `time()`, `date()`, `smallint()` builders exist in rc.4 [VERIFIED: `node_modules/drizzle-orm/pg-core/columns/time.d.ts:28-33`, `date.d.ts:36-37`, `smallint.d.ts` present] |
| PostgreSQL | 18.6 (dev) | Storage, `date + time at time zone`, `isodow` | Project database [VERIFIED: probe below] |
| hono | 4.13.13 | API routes | Existing routers [VERIFIED: `apps/api/package.json`] |
| zod | 4.6.5 | Request schemas in `packages/contracts` | Existing contracts [VERIFIED: `packages/contracts/package.json`] |
| `Intl.DateTimeFormat` (ICU 78.3, tzdata 2026b in Node) | built-in | Zone arithmetic and display | No date library installed; `Temporal` absent in Node 24.17 [VERIFIED: probe below] |
| @base-ui/react | 1.8.0 | Dialog, Select, Combobox, Popover, ScrollArea | Design system [VERIFIED: `apps/web/package.json`] |
| react-day-picker | 10.0.1 | `Calendar` inside `DateField` | Already used [VERIFIED: `apps/web/package.json`] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 1.53.0 | `CalendarPlus`, `CalendarClock`, `CalendarX2`, `CalendarCheck2`, `ChevronLeft/Right`, `Globe`, `ArrowRight`, `ClockIcon` | Icons named in the UI-SPEC |
| tailwindcss | 4.3.3 | Utilities; arbitrary property `[--scroll-fade-size:...]` | Compact fade override |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Intl helpers in core | `date-fns-tz`, `@js-temporal/polyfill` | Forbidden by "no new packages"; the helper is about 30 lines |
| Expansion in TypeScript | SQL `generate_series` over dates | Would split the rule between SQL and core; D-01 and UI-SPEC require one core function shared with Google sync |
| `time` column for `start_time` | `smallint` minutes since midnight | D-01 names the column `start_time`; `time` reads naturally in SQL. Cost: pg returns `HH:MM:SS`, map to `HH:MM` at the boundary |

**Installation:** none. The worktree has no `node_modules`; the orchestrator runs `yarn install --immutable` once before wave 1 (no lockfile change is expected because no package is added). [VERIFIED: `ls` of the worktree root shows no `node_modules`]

## Package Legitimacy Audit

No external packages are installed in this phase. The two copied files (`time-picker.tsx`, `input-group.tsx`) come from the owner's design-lab working copy and passed the UI-SPEC registry grep gate.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| none | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Existing Code Map (what the planner can rely on)

### Database package
- Schema in one file `packages/db/src/schema.ts`; tables use `uuid('id').defaultRandom().primaryKey()`, `timestamp(..., { withTimezone: true })`, `date(...)` (string mode), named `check('<table>_<what>_ck', sql\`...\`)`, named `index`/`uniqueIndex`, FKs `references(() => students.id, { onDelete: 'restrict' })`. [VERIFIED: `packages/db/src/schema.ts:91-131,174-209`]
- Migrations: folder per migration `packages/db/drizzle/<timestamp>_<name>/{migration.sql,snapshot.json}`; three exist: `20261009120830_init`, `20261009150610_accounts`, `20261009194959_student_cards`. [VERIFIED: `ls packages/db/drizzle`]
- Procedure used in phase 19 and to repeat now, quoted from 19-05-SUMMARY line 63: "Миграция `packages/db/drizzle/20261009194959_student_cards` создана `yarn workspace @dv-lab/db db:generate --name student_cards`, руками не правилась". The plan forbade `drizzle-kit push`, hand edits, DROP/RENAME; it applied the migration through the source entry point under `dvlab_migrator` to `dvlab_dev` and to `dvlab_test` (`NODE_ENV=test`), with `DATABASE_URL`/`MIGRATOR_DATABASE_URL` removed from the child env, and checked journal rows equal folders (now 4). A second `db:generate` must print "No schema changes, nothing to migrate". [VERIFIED: `19-05-SUMMARY.md:63-64,88-89`, `19-05-PLAN.md:32,52,113,148`]
- Migrator: `runMigrations` takes `pg_advisory_lock(hashtext('dvlab_migrations'))`, runs drizzle `migrate`, returns `count(*)` of `drizzle.__drizzle_migrations`. [VERIFIED: `packages/db/src/migrate.ts`]
- Grants: no GRANT in migrations. New tables created by `dvlab_migrator` get CRUD for `dvlab_app` from default privileges, verbatim: [VERIFIED: `deploy/postgres/ensure-db.sql:33-34`]
  ```
  ALTER DEFAULT PRIVILEGES FOR ROLE dvlab_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dvlab_app;
  ALTER DEFAULT PRIVILEGES FOR ROLE dvlab_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO dvlab_app;
  ```
  No RLS anywhere (roles are `NOBYPASSRLS` but no policy exists). The home dev database may not have been provisioned by this exact script, so the migration plan adds one SQL check after migrating: `select has_table_privilege('dvlab_app','lesson_exceptions','insert')` and the same for `lessons`, `lesson_series` on `dvlab_dev` and `dvlab_test`.
- Raw `pg` parses `date` into a local-zone JS `Date` (the `sql.mjs` probe printed `date '2026-10-14' - 1` as `2026-10-12T17:00:00.000Z`). Drizzle's `date()` column in string mode returns `YYYY-MM-DD` (phase 19's `openingBalanceOn` works this way). In raw SQL, cast dates to `::text`. [VERIFIED: probe below]

### Contracts package
- `packages/contracts/src/students.ts` holds request schemas (zod) and response types; `isIsoDate` and `isTimeZone` are exported, but the `isoDate` zod helper is module-private (line 74). A new `schedule.ts` either exports `isoDate` from `students.ts` or builds its own from `isIsoDate`. [VERIFIED: `packages/contracts/src/students.ts:42-74`]
- Constants to reuse: `LESSON_MINUTES_MIN = 15`, `LESSON_MINUTES_MAX = 240`. [VERIFIED: `students.ts:29-30`]
- `StudentRow` today, verbatim: `id`, `displayName`, `status`, `rateMinor`, `currency`, `defaultLessonMinutes`, `balanceMinutes`. `StudentDetail = StudentRow & {...}`. [VERIFIED: `students.ts:139-151`]
- Error codes are a closed `as const` array; `errorBody` is typed on it, so a new code must be added here first. Verbatim: [VERIFIED: `packages/contracts/src/auth.ts:42-60`]
  ```
  'invalid_request', 'unauthenticated', 'invalid_credentials', 'forbidden', 'forbidden_origin', 'not_found',
  'login_taken', 'wrong_current_password', 'password_unchanged', 'card_has_account', 'account_already_linked',
  'term_exists', 'payment_already_assigned', 'locked', 'busy', 'unavailable', 'internal_error'
  ```
- `index.ts` re-exports `./session.ts`, `./identity.ts`, `./auth.ts`, `./students.ts`; a new `./schedule.ts` is added there. [VERIFIED: `packages/contracts/src/index.ts`]

### Core package
- Files: `balance.ts` (`balanceMinutes(opening, credited[])`), `lessons.ts`, `money.ts`; `index.ts` re-exports with `.ts` extensions. No dependencies. The API runs it from source (`node --watch src/server.ts`, and `scripts/dev-checks/api.mjs` spawns `apps/api/src/server.ts`), so core must stay erasable TypeScript: no `enum`, no `namespace`, no parameter properties, imports with `.ts`. [VERIFIED: `packages/core/src/*.ts`, `apps/api/package.json` scripts, `scripts/dev-checks/api.mjs:60`]
- Trap: `localIsoDate(date)` in `lessons.ts` formats with no `timeZone`, i.e. the process zone. Do not reuse it for Vietnam dates. [VERIFIED: `packages/core/src/lessons.ts`]

### API
- Router pattern: `const routes = new Hono<AppEnv>(); routes.use('*', noStore, requireSession(db), requireRole('teacher'))`; local helpers `invalidRequest` (400), `notFound` (404); uuid params through `z.uuid().safeParse`; body through `readJson(c, schema)` returning `null` on failure; responses `c.json({...} satisfies XResponse, status)`; deletes `c.body(null, 204)`. [VERIFIED: `apps/api/src/routes/students.ts`, `payments.ts`]
- Services live in `apps/api/src/cards/*.ts`, take `DbExecutor` (db or tx); transactions use `db.transaction(async (tx) => ...)` with `.for('update')` row locks (`setOpeningBalance`); results are discriminated unions `{ kind: 'not_found' } | ...`. [VERIFIED: `apps/api/src/cards/cards.ts:136-159`, `payments.ts`]
- Wiring: `app.route('/students', ...)`, `app.route('/payments', ...)` in `createApp`; a new `app.route('/schedule', scheduleRoutes({ db: deps.db }))` goes next to them. Web calls `/api/...`, rewritten by `next.config.ts` to the API. [VERIFIED: `apps/api/src/app.ts`, `apps/web/next.config.ts:9-12`, `apps/web/lib/api-client.ts`]
- `listCards` sorts by `lower(display_name)`, computes balances in one batched query (`cardBalances`) and maps with `toCardRow(row, balance)`. `toStudentDetail` spreads `toCardRow`; `createCard` returns `toStudentDetail(row, null, null)`. Adding `nextLessonAt` to `StudentRow` therefore touches `card-rows.ts` (`toCardRow`, `toStudentDetail` signatures) and `cards.ts` (`createCard`, `toDetail`, `listCards`). Web files `assign-payment-dialog.tsx` and `unassigned-payments.tsx` only consume the type. [VERIFIED: `apps/api/src/cards/cards.ts:68-98` (`toDetail` 68, `createCard` 74, `listCards` 85), `card-rows.ts:41-71`, grep of `StudentRow`]

### Web
- `/schedule` is a stub: server component calling `requireTeacherPage()`, rendering `PageScroll > PageHeader title="Schedule" > EmptyLine`. [VERIFIED: `apps/web/app/(app)/schedule/page.tsx`]
- `/students` screen is a client component reading `GET /students` through `apiRequest`, with `Tabs defaultValue="active"` and three tabs Active / Archived / Unassigned payments already present. CARD-04 "status tabs" is already met; search and "Next lesson" remain. [VERIFIED: `apps/web/app/(app)/students/_components/students-screen.tsx`]
- `components/ui` has 22 files; `input-group.tsx` and `time-picker.tsx` do not exist yet (copy list in UI-SPEC). `table.tsx` container: `<div data-slot="table-container" className="relative w-full overflow-x-auto">`. [VERIFIED: `ls apps/web/components/ui`, `table.tsx:8`]
- `DateField` has `max` (`disabled={max ? { after: toDate(max) } : undefined}`), no `min`; it builds dates with local `new Date(y, m - 1, d)`, which is fine for calendar dates but must not leak into zone maths. [VERIFIED: `apps/web/components/app/date-field.tsx`]
- `ScrollArea` accepts `viewportClassName`; on touch-primary devices it renders a native `overflow-y-auto` div instead of Base UI. `PageScroll` uses `ScrollArea className="min-h-0 flex-1"` with no `viewportClassName` today (E3). [VERIFIED: `apps/web/components/ui/scroll-area.tsx`, `components/app/layout-parts.tsx`]

### Scroll fade state (D-14)
Already ported from the lab; nothing to copy. [VERIFIED: `apps/web/app/globals.css`]
- `@keyframes sf-reveal-start`, `sf-reveal-end`, `sf-divider-*` inside `@theme inline` at lines 125-156.
- `@property --sf-start` / `--sf-end` at lines 412-421.
- The unlayered rule to delete, verbatim, lines 423-426:
  ```
  .scroll-fade,
  .scroll-fade-x {
  	--scroll-fade-size: 48px;
  }
  ```
- Mask rules inside `@supports (animation-timeline: scroll())` at lines 466-511, `.scroll-fade` uses `scroll(self)`, `.scroll-fade-x` uses `scroll(self inline)`.
- `--scroll-fade-size` and `--scroll-fade-size-compact` are not in `:root` (grep returns only the line-425 rule and uses). Tokens to add, verbatim from `tokens.css:57-58`: `--scroll-fade-size: 48px;` `--scroll-fade-size-compact: 24px;`.
- gcal tokens absent from `globals.css` (0 matches); values verbatim from `/Volumes/T7/personal/dv-lab/.planning/design/variant-a/tokens.css`: light 93-96 `--gcal-line: #dadce0; --gcal-today: #1a73e8; --gcal-today-ink: #ffffff; --gcal-now: #ea4335;`, dark 164-167 `--gcal-line: #3c4043; --gcal-today: #8ab4f8; --gcal-today-ink: #202124; --gcal-now: #f28b82;`, theme 234-237 `--color-gcal-line: var(--gcal-line); --color-gcal-today: var(--gcal-today); --color-gcal-today-ink: var(--gcal-today-ink); --color-gcal-now: var(--gcal-now);`.
- Why the deletion matters, verified by compiling with the installed Tailwind 4.3.3: the arbitrary property `[--scroll-fade-size:var(--scroll-fade-size-compact)]` is emitted inside `@layer utilities`, and an unlayered rule beats any layered rule, so the 48px rule would always win. The same probe showed `@keyframes` declared inside `@theme` are emitted when plain CSS references them. [VERIFIED: local `@tailwindcss/node` compile, output below]
- Existing users of `scroll-fade` (`select.tsx:387`, `combobox.tsx:760`, `dropdown.tsx:447`, `sidebar.tsx:226,237`) keep 48px after the change because `:root` supplies the default.

## Architecture Patterns

### System Architecture Diagram

```
Teacher (browser, any OS zone)
   |  week = Monday date in VN (computed by core from Date.now())
   v
ScheduleScreen (client) --GET /api/schedule/week?start=YYYY-MM-DD--> Next rewrite --> Hono /schedule
   ^                                                                                  |
   |                                                                       requireSession + requireRole('teacher')
   |                                                                                  v
   |                                                     schedule service (DbExecutor)
   |                                                       | 1 lessons      where starts_at in [weekFrom, weekTo)
   |                                                       | 2 lesson_series where starts_on <= sunday and (ends_on null or ends_on >= monday)
   |                                                       | 3 lesson_exceptions where original_on in [monday, sunday]
   |                                                       |                   or (kind='moved' and starts_at in [weekFrom, weekTo))
   |                                                       |   (+ series rows owning those exceptions, + student names)
   |                                                       v
   |                                         core.scheduleWindow(series, exceptions, lessons, window)
   |                                                       v
   +--------------- ScheduleWeekResponse { blocks[], series[] } <--------------------+
   |
   +-- WeekGrid: lanes per day (web), pixel top/height from core.zonedParts(VN), now line, 08:00 scroll
   +-- dialogs --POST /api/schedule/...--> service: tx, lock series FOR UPDATE, validate with core
   |                                         (isSeriesDate, now guard), write, commit --> 2xx | 404 | 409
   |                                         web refetches the visible week on success, 409/404 -> banner + refetch
   |
Students screen --GET /api/students--> listCards + core.nextLessons(now) --> StudentRow.nextLessonAt
```

### Recommended Project Structure
```
packages/db/src/schema.ts                      lessons, lesson_series, lesson_exceptions
packages/db/drizzle/<ts>_schedule/             generated migration
packages/core/src/zoned.ts                     zonedParts, zonedInstant, addDays, weekdayOf, mondayOf
packages/core/src/schedule.ts                  SCHEDULE_TIME_ZONE, isSeriesDate, seriesDates, scheduleWindow, nextLessons, overlaps
packages/contracts/src/schedule.ts             request schemas, ScheduleBlock, ScheduleWeekResponse
apps/api/src/schedule/schedule.ts              read and mutation services
apps/api/src/routes/schedule.ts                Hono router
apps/web/app/(app)/schedule/_components/       schedule-screen, week-grid, lesson-block, dialogs, second-zone-select
apps/web/lib/schedule-format.ts                Intl display helpers (day label, range, zone caption)
```

### Pattern 1: Schema (recommended exact shape)

What: the three D-01 tables with invariants a CHECK can hold without the clock.

```typescript
export const lessonSeries = pgTable(
	'lesson_series',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		studentId: uuid('student_id')
			.notNull()
			.references(() => students.id, { onDelete: 'restrict' }),
		weekday: smallint('weekday').notNull(),
		startTime: time('start_time').notNull(),
		durationMinutes: integer('duration_minutes').notNull(),
		startsOn: date('starts_on').notNull(),
		endsOn: date('ends_on'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index('lesson_series_student_idx').on(table.studentId),
		check('lesson_series_weekday_ck', sql`${table.weekday} between 1 and 7`),
		check('lesson_series_starts_on_ck', sql`extract(isodow from ${table.startsOn}) = ${table.weekday}`),
		check('lesson_series_ends_on_ck', sql`${table.endsOn} is null or ${table.endsOn} >= ${table.startsOn}`),
		check('lesson_series_start_time_ck', sql`extract(second from ${table.startTime}) = 0`),
		check('lesson_series_minutes_ck', sql`${table.durationMinutes} between 15 and 240`),
	]
)

export const lessonExceptions = pgTable(
	'lesson_exceptions',
	{
		seriesId: uuid('series_id')
			.notNull()
			.references(() => lessonSeries.id, { onDelete: 'restrict' }),
		originalOn: date('original_on').notNull(),
		kind: text('kind').notNull(),
		startsAt: timestamp('starts_at', { withTimezone: true }),
		durationMinutes: integer('duration_minutes'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ name: 'lesson_exceptions_pk', columns: [table.seriesId, table.originalOn] }),
		index('lesson_exceptions_moved_idx').on(table.startsAt).where(sql`${table.kind} = 'moved'`),
		check('lesson_exceptions_kind_ck', sql`${table.kind} in ('cancelled', 'moved')`),
		check(
			'lesson_exceptions_moved_ck',
			sql`(${table.kind} = 'moved') = (${table.startsAt} is not null and ${table.durationMinutes} is not null)`
		),
		check(
			'lesson_exceptions_minutes_ck',
			sql`${table.durationMinutes} is null or ${table.durationMinutes} between 15 and 240`
		),
	]
)

export const lessons = pgTable(
	'lessons',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		studentId: uuid('student_id')
			.notNull()
			.references(() => students.id, { onDelete: 'restrict' }),
		startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
		durationMinutes: integer('duration_minutes').notNull(),
		status: text('status').default('scheduled').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index('lessons_starts_at_idx').on(table.startsAt),
		index('lessons_student_starts_idx').on(table.studentId, table.startsAt),
		check('lessons_status_ck', sql`${table.status} in ('scheduled', 'cancelled')`),
		check('lessons_minutes_ck', sql`${table.durationMinutes} between 15 and 240`),
	]
)
```

Notes:
- Every identifier above (`lesson_series`, `lesson_exceptions`, `lessons`, columns, `scheduled | cancelled`, `cancelled | moved`, `weekday` 1-7) comes from D-01; index and constraint names follow the `<table>_<what>_ck|idx|pk` pattern of `schema.ts`. Constraint and index names are this document's proposal [ASSUMED naming, pattern VERIFIED: `schema.ts`].
- `extract(isodow ...)` returns Monday = 1 ... Sunday = 7, matching D-01 numbering; the CHECK makes `starts_on` the first occurrence date. [VERIFIED: probe `mon: "1"`, `sun: "7"`]
- No 15-minute CHECK on times: the UI snaps to 15 minutes, but phase 25 accepts arbitrary minutes from Google. Seconds are forbidden (`extract(second from start_time) = 0`; probe: `extract(second from time '18:00:30')` = `30.000000`, `extract(second from time '18:00') = 0` = `true`). [VERIFIED: `sql.mjs` probe on `dvlab_dev`]
- `lessons` gets no `series_id`: converted moved exceptions (Pattern 2) become plain single lessons.
- `drizzle-kit` must emit the `isodow` CHECK and the partial index verbatim; the executor reads `migration.sql` before applying it (phase 19 confirmed `sql\`...\`` expressions pass through unchanged, `19-05-PLAN.md:203`).

### Pattern 2: Series cut (D-03, D-04) as one transaction

What: Move series = end the old rule the day before `from`, insert a new rule, resolve the old rule's exceptions on or after `from`.

Recommended semantics [ASSUMED, fills D-03/D-04 gaps; confirm the starred items with the owner]:
1. `select ... from lesson_series where id = $1 for update`. Missing: 404. Already ended before today (`ends_on < today`): 409.
2. Inputs: `from` (date, `>= today` in VN), `weekday`, `startTime`. Reject (400) if `weekday` and `startTime` equal the old ones (UI copy "Choose a different day or time.").
3. Past guard (SCHED-05): every old occurrence on or after `from` must start after `now`. If `from = today` and today's old occurrence already started, reject with 409 (the UI default `from` = next occurrence never hits this). This keeps the cut from swallowing a lesson that already took place.
4. Old rule: `ends_on = from - 1`. If that is before `starts_on` (the series had no occurrence before `from`), the old row cannot keep a valid range; see step 6.
5. Old exceptions with `original_on >= from`:
   - `moved` → insert one `lessons` row per exception (`student_id` of the series, `starts_at`, `duration_minutes`, `status 'scheduled'`), then delete the exception. This is the plain reading of D-04 "остаются отдельными уроками". It changes those occurrences' key from (series, date) to a lesson id; that is safe now (no marks exist for future lessons, Google sync does not exist yet), and it matches how Google treats a recurring event whose range shrinks: instances outside the new range stop existing, so a kept moved instance has to become a standalone event anyway (*). [CITED: developers.google.com/workspace/calendar/api/v3/reference/events — `originalStartTime` "uniquely identifies the instance within the recurring event series"; the out-of-range behaviour itself is ASSUMED]
   - `cancelled` → delete (D-04 "сбрасываются").
6. If step 4 produced an empty range, delete the old series row after step 5 (no exception refers to it any more, and it had no occurrence before `from`, which is today or later, so nothing past is lost) (*).
7. Insert the new rule: same `student_id` and `duration_minutes`, `weekday`, `start_time`, `starts_on = firstOnOrAfter(from, weekday)`. `ends_on` = the old series' `ends_on` when it was set (the teacher had already ended it) and is not before the new `starts_on`, the last new-weekday date `<=` it otherwise; if no new-weekday date fits before the old end, reject with 400. Only an open old series gives an open new one. Moving must never silently remove an end the teacher set.
8. Commit; respond with the new series (toast "Series moved ... from {new day}").

Rule columns (`weekday`, `start_time`, `duration_minutes`, `starts_on`) are never updated in place. Google identifies an instance by its original start time, which is derived from `original_on + start_time + zone`; changing `start_time` in place would silently re-key every occurrence. Only `ends_on` changes after insert.

### Pattern 3: Occurrence operations, End series, single lessons

Invariant kept by the API: every exception's `original_on` is a real date of its series (`isSeriesDate`: weekday matches, `starts_on <= d`, `ends_on` null or `d <= ends_on`). It makes expansion simple and lets the API answer a stale key with 409.

| Operation | Precondition (else) | Write |
|-----------|---------------------|-------|
| Move occurrence `(seriesId, originalOn)` to `date, startTime` | series exists (404); `isSeriesDate` (409); current effective start `>= now` (409); not cancelled (409); new date `>= today` VN (400); new start differs from current (400) | upsert exception `kind 'moved'`, `starts_at = zonedInstant(date, startTime, VN)`, `duration_minutes` = series duration (or the existing moved duration) |
| Cancel occurrence | same existence/date/past checks; not already cancelled (409) | upsert `kind 'cancelled'`, `starts_at null`, `duration_minutes null` (a moved one becomes cancelled; Restore returns it to the original slot) |
| Restore occurrence | a `cancelled` exception exists (409); original start `>= now` (409) | delete the exception |
| End series `lastOn` | series exists (404), not ended before today (409); `lastOn >= today` (400); `lastOn` not after an existing `ends_on` (400: End never extends a series) | `ends_on` = last series date `<= lastOn`; delete every exception with `original_on > ends_on` (copy: "Later lessons are removed from the schedule") (*); if no series date `<= lastOn` exists, delete exceptions and the series row ("series was removed from the schedule") |
| Create single | student exists and `active` (400); duration 15-240 | insert `lessons` (past dates allowed, UI-SPEC default) |
| Create series | student active; `date >= today` VN (400) | insert `lesson_series` with `weekday = weekdayOf(date)`, `starts_on = date` |
| Move single | lesson exists (404); status scheduled (409); current start `>= now` (409); new date `>= today` (400) | update `starts_at` in place (no ghost, UI-SPEC default) |
| Cancel / Restore single | status scheduled / cancelled respectively (409); start `>= now` (409) | update `status` |

(*) End series deletes moved exceptions after the end date instead of converting them, which differs from Move series. It follows the approved UI copy; confirm with the owner (Open Question 2).

All mutations run in `db.transaction` with the series row (or lesson row) locked `for update`, the same way `setOpeningBalance` locks the student. Two tabs racing produce one success and one 409, never a lost write. No version column is needed.

Error code: add one code to `errorCodes`, recommended `'lesson_changed'` (409, "This lesson was changed elsewhere"), used for every state mismatch and past-guard hit; 404 stays `not_found`; 400 stays `invalid_request`. The UI-SPEC already treats 409 and 404 alike (banner and refetch). [ASSUMED name]

### Pattern 4: Week query that does not miss moved lessons

What: a lesson moved from another week into this one belongs to an exception whose `original_on` is outside this week. Expanding only by `original_on in week` drops it, and the same mistake would drop it from `nextLessonAt`.

```typescript
const from = zonedInstant(monday, '00:00', SCHEDULE_TIME_ZONE)
const to = zonedInstant(addDays(monday, 7), '00:00', SCHEDULE_TIME_ZONE)
const sunday = addDays(monday, 6)
```
- `lessons`: `starts_at >= from and starts_at < to` (both statuses; cancelled are drawn struck through).
- `lesson_exceptions`: `(original_on between monday and sunday) or (kind = 'moved' and starts_at >= from and starts_at < to)`.
- `lesson_series`: rows with `starts_on <= sunday and (ends_on is null or ends_on >= monday)`, plus the rows owning any exception from the previous query (needed for `movedFrom`).
- Students: join for `display_name` and `status` (archived students' lessons still show).

Week start validation: `start` must be an ISO date whose `weekdayOf` is 1; otherwise 400. Bound it to a sane range (for example years 2000-2100) so a crafted request cannot ask for an absurd loop.

Volumes: 25 students, at most a few dozen series; all three queries hit an index or a tiny table. No pagination, no caching.

### Pattern 5: `packages/core` API (pure, no I/O)

```typescript
export const SCHEDULE_TIME_ZONE = 'Asia/Ho_Chi_Minh'

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type ZonedParts = { date: string; time: string; weekday: Weekday; minutes: number }

export function zonedParts(instant: Date, zone: string): ZonedParts
export function zonedInstant(date: string, time: string, zone: string): Date
export function addDays(date: string, days: number): string
export function weekdayOf(date: string): Weekday
export function mondayOf(date: string): string
export function firstOnOrAfter(date: string, weekday: Weekday): string

export type SeriesRule = {
	id: string
	studentId: string
	weekday: Weekday
	startTime: string
	durationMinutes: number
	startsOn: string
	endsOn: string | null
}

export type SeriesException =
	| { seriesId: string; originalOn: string; kind: 'cancelled' }
	| { seriesId: string; originalOn: string; kind: 'moved'; startsAt: Date; durationMinutes: number }

export type SingleLesson = {
	id: string
	studentId: string
	startsAt: Date
	durationMinutes: number
	status: 'scheduled' | 'cancelled'
}

export type OccurrenceRef = { kind: 'single'; lessonId: string } | { kind: 'series'; seriesId: string; originalOn: string }

export type ScheduleBlock = {
	ref: OccurrenceRef
	studentId: string
	startsAt: Date
	durationMinutes: number
	status: 'scheduled' | 'cancelled' | 'moved'
	movedTo: Date | null
	movedFrom: Date | null
}

export function isSeriesDate(rule: SeriesRule, date: string): boolean
export function seriesStart(rule: SeriesRule, date: string): Date
export function scheduleWindow(input: {
	series: readonly SeriesRule[]
	exceptions: readonly SeriesException[]
	lessons: readonly SingleLesson[]
	from: Date
	to: Date
}): ScheduleBlock[]
export function nextLessons(input: {
	series: readonly SeriesRule[]
	exceptions: readonly SeriesException[]
	lessons: readonly SingleLesson[]
	now: Date
}): Map<string, Date>
export function overlaps(
	blocks: readonly ScheduleBlock[],
	candidate: { startsAt: Date; durationMinutes: number },
	exclude?: OccurrenceRef
): ScheduleBlock[]
```

Semantics:
- `scheduleWindow` emits, for every series date whose natural start is in `[from, to)`: `scheduled` (no exception), `cancelled` (cancelled exception, natural time), or `moved` (the ghost at the natural time, `movedTo` = destination). For every moved exception whose `startsAt` is in `[from, to)`: a `scheduled` block at the destination with `movedFrom` = natural start. For every single lesson in the window: its own status. A moved occurrence whose original and destination are both in the week produces two blocks with the same `ref`; React keys need a suffix (`:from` / `:to`).
- `nextLessons` per student: the minimum over (a) the first series date whose natural start is `>= now` and that has no exception (iterate from today's VN date, stop at `ends_on` or after 366 days), (b) moved exceptions with `startsAt >= now`, (c) single lessons with `status 'scheduled'` and `startsAt >= now`. A started lesson is not "next". For the API query, load series with `ends_on is null or ends_on >= today` and all their exceptions, plus, independently of that series filter, every exception with `kind = 'moved' and starts_at >= now` (a lesson moved past the end of a series that has since ended must still count, the same hole as Pitfall 1), plus lessons with `starts_at >= now and status = 'scheduled'`.
- `overlaps` ignores `cancelled` blocks and `moved` ghosts (UI-SPEC "ignores cancelled and moved blocks"), compares `[start, start + duration)` half-open intervals, and skips `exclude` (the lesson being moved).
- Weekday from a date: `new Date(Date.UTC(y, m - 1, d)).getUTCDay()` is 0 for Sunday; map with `((day + 6) % 7) + 1`. Never `new Date().getDay()` (browser zone).
- Date arithmetic on `YYYY-MM-DD` strings goes through `Date.UTC` and `toISOString().slice(0, 10)`, never through local `Date` constructors.

`zonedInstant` (two-pass offset, works for DST zones too):

```typescript
const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(zone: string): Intl.DateTimeFormat {
	let found = formatters.get(zone)
	if (!found) {
		found = new Intl.DateTimeFormat('en-US', {
			timeZone: zone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			weekday: 'short',
		})
		formatters.set(zone, found)
	}
	return found
}

function offsetMs(instant: number, zone: string): number {
	const parts = Object.fromEntries(formatter(zone).formatToParts(instant).map((part) => [part.type, part.value]))
	const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
	return wall - Math.floor(instant / 1000) * 1000
}

export function zonedInstant(date: string, time: string, zone: string): Date {
	const [y, m, d] = date.split('-').map(Number)
	const [hh, mm] = time.split(':').map(Number)
	const wall = Date.UTC(y, m - 1, d, hh, mm)
	const first = wall - offsetMs(wall, zone)
	const second = wall - offsetMs(first, zone)
	return new Date(second)
}
```
Cross-check: SQL `(date '2026-10-14' + time '18:00') at time zone 'Asia/Ho_Chi_Minh'` = `2026-10-14T11:00:00.000Z`; the helper must give the same instant. The planner adds this comparison to the core plan's acceptance script (a one-off script, not a test file). [VERIFIED: SQL probe]

### Pattern 6: Web grid mechanics (beyond the UI-SPEC)

- Client component; compute `now`, today and the current Monday after mount (`useEffect`), not during server render, so server and client markup match. Second-zone trigger renders after mount (UI-SPEC).
- Block geometry: `top = minutesOfDay / 15 * 14` px and `height = max(28, duration / 15 * 14)` px from `zonedParts(startsAt, VN).minutes`; clip at 1344px (24 h). One `ResizeObserver` is not needed: horizontal placement is percentage-based (`left = lane / lanes * 100%`).
- Lane layout: sort a day's blocks by start; build clusters while the next start is before the running cluster end; assign the first free lane; width `1 / lanes`. This is presentation and stays in web (for example `week-grid.tsx` or `lib/schedule-layout.ts`).
- Empty-cell click: `event.target === event.currentTarget`, `offsetY` from `getBoundingClientRect`, `minutes = floor(offsetY / 14) * 15`.
- Now line: `setInterval` 60 s; when the VN date changes, recompute today and the current week (midnight roll-over).
- Initial scroll: in `useLayoutEffect` after the first render with data, `body.scrollTop = 392` (08:00 at 56px below the top). Keep the offset on week changes.
- Stale responses on fast week navigation: ignore any response whose requested `start` is not the current one (or abort with `AbortController`).
- Second-zone hour labels: compute with `Intl` per row for one reference date (today's VN date in the current week, the week's Monday otherwise). A DST change in the second zone in the middle of a week shifts labels by one hour on the other days; accepted, the block `title` and dialogs use each block's own date.
- Overlap warning in New lesson and Move dialogs: if the chosen date is in the visible week, use the loaded blocks; otherwise fetch that week through the same endpoint, then run core `overlaps`.

### Anti-Patterns to Avoid
- **Comparing zone ids as strings after Intl:** `resolvedOptions().timeZone` for `Asia/Ho_Chi_Minh` is `Asia/Saigon` in Node 24 (ICU 78.3). Filter Vietnam out of the second-zone list by both aliases and store the user's chosen id as given.
- **Updating a series rule in place:** re-keys every occurrence (Google `originalStartTime`, phase 21 marks).
- **Expanding series in the browser:** the UI-SPEC forbids it; the browser gets blocks.
- **Using the process zone:** `new Date().getDay()`, `localIsoDate`, `toLocaleDateString()` without `timeZone`. The API container's zone is not Vietnam.
- **Static fade or shadcn `scroll-fade`:** D-14 forbids both; the lab version is already in `globals.css`.
- **Putting the grid's header or time-axis caption inside the scroller:** the mask fades them. Header row outside, body inside (UI-SPEC Week frame 1-2).
- **Copying A's `MoveForm` clash blocking:** D-09, overlaps never block.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zone offsets | A table of fixed offsets per zone | `Intl.DateTimeFormat` with `timeZone` (tzdata 2026b bundled) | DST and historical changes in the second zone |
| Zone list | A hand-written list | `Intl.supportedValuesOf('timeZone')` in the browser | 418 ids in Node; browsers differ; build client-side only |
| Date picker, time picker, selects | Custom popovers | `DateField` (+E5 `min`), copied `TimePicker`, Base UI `Select`/`Combobox` | Design system |
| Row locking | Version columns or optimistic retries | `select ... for update` in `db.transaction` | Existing pattern (`setOpeningBalance`) |
| Migration SQL | Hand-written DDL | `yarn workspace @dv-lab/db db:generate --name schedule` | Phase 19 procedure, snapshot stays consistent |
| Scroll fade | New CSS | Existing `scroll-fade` / `scroll-fade-x` classes | Already in `globals.css` |

**Key insight:** the whole phase is about one rule (a series date is a real occurrence unless an exception says otherwise). Keeping that rule in exactly one core module, and keeping series rows immutable, is what keeps phases 21, 24 and 25 simple.

## Common Pitfalls

### Pitfall 1: Moved lesson vanishes when its week differs from its original week
**What goes wrong:** a lesson moved from Wednesday next week to Monday this week shows nowhere, and "Next lesson" skips it.
**Why it happens:** exceptions selected only by `original_on` within the window.
**How to avoid:** Pattern 4 query and `scheduleWindow` emitting destinations by `startsAt`.
**Warning signs:** the ghost appears in one week but the destination is missing in the other.

### Pitfall 2: The cut deletes a lesson that already happened today
**What goes wrong:** Move series with `from = today` after today's lesson sets `ends_on = yesterday`, and today's past occurrence disappears (violates SCHED-05).
**How to avoid:** Pattern 2 step 3 (server check), UI default `from` = next occurrence.

### Pitfall 3: `Asia/Saigon` vs `Asia/Ho_Chi_Minh`
**What goes wrong:** the second-zone list still offers Vietnam, or a saved value is judged unknown and reset.
**How to avoid:** never compare canonicalised ids; validate a saved id by `try { new Intl.DateTimeFormat('en-US', { timeZone }) }` (`isTimeZone` in contracts already does this); exclude both aliases. Check the actual browser list in the browser step, Node is only evidence for Node. [VERIFIED for Node: probe below]

### Pitfall 4: `time` column returns seconds
**What goes wrong:** `start_time` comes back as `18:00:00`; contracts and UI expect `HH:MM`.
**How to avoid:** map with `.slice(0, 5)` at the service boundary; write `HH:MM` (Postgres accepts it). [ASSUMED for drizzle's pass-through of node-pg's string; verify in the API acceptance script]

### Pitfall 5: The unlayered fade rule
**What goes wrong:** compact 24px fades stay at 48px; or, if the rule is deleted without adding `:root` tokens, every existing fade (Select, Combobox, sidebar) breaks.
**How to avoid:** E2 lands as one edit: add both tokens to `:root`, delete lines 423-426. [VERIFIED: Tailwind compile probe]

### Pitfall 6: Hydration mismatch from "now"
**What goes wrong:** the server renders a different today or now line than the client.
**How to avoid:** compute time-dependent state after mount; the server page only calls `requireTeacherPage()` and renders the client screen (same as `/students`).

### Pitfall 7: `StudentRow` ripple breaks typecheck in a parallel plan
**What goes wrong:** adding `nextLessonAt` in the contracts plan breaks `apps/api` typecheck until the API plan lands.
**How to avoid:** put the `StudentRow` field and the `card-rows.ts`/`cards.ts` changes in the same API plan.

### Pitfall 8: Copied TimePicker carries comments and A's Russian labels and static fades
**How to avoid:** UI-SPEC copy-time edits plus stripping all comments (project rule), then the Radix grep gate.

### Pitfall 9: Lesson across midnight
**What goes wrong:** a 23:00 lesson of 120 minutes draws past the grid or overlaps the next day's column.
**How to avoid:** clip at 24:00 on its start day (UI-SPEC default); dialogs show the full range.

## Code Examples

### Route skeleton (follows `routes/payments.ts`)
```typescript
export function scheduleRoutes({ db }: ScheduleRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))

	routes.get('/week', async (c) => {
		const start = weekStartQuery.safeParse(c.req.query('start'))
		if (!start.success) return invalidRequest(c)
		return c.json((await readWeek(db, start.data)) satisfies ScheduleWeekResponse, 200)
	})

	routes.post('/series/:id/move', async (c) => {
		const id = uuidParam(c, 'id')
		if (id === null) return notFound(c)
		const input = await readJson(c, moveSeriesRequest)
		if (!input) return invalidRequest(c)
		const result = await moveSeries(db, id, input, new Date())
		if (result.kind === 'not_found') return notFound(c)
		if (result.kind === 'changed') return lessonChanged(c)
		if (result.kind === 'invalid') return invalidRequest(c)
		return c.json({ series: result.series } satisfies ScheduleSeriesResponse, 200)
	})

	return routes
}
```

### Recommended API surface [ASSUMED, Claude's discretion per CONTEXT]
| Method and path | Body | Success |
|-----------------|------|---------|
| `GET /schedule/week?start=YYYY-MM-DD` (Monday) | — | 200 `ScheduleWeekResponse { start, blocks, series }` |
| `POST /schedule/lessons` | `{ studentId, date, startTime, durationMinutes, repeats: 'once' \| 'weekly' }` | 201 `{ lesson }` or `{ series }` |
| `POST /schedule/lessons/:id/move` | `{ date, startTime }` | 200 |
| `POST /schedule/lessons/:id/cancel`, `/restore` | — | 200 |
| `POST /schedule/series/:id/occurrences/:originalOn/move` | `{ date, startTime }` | 200 |
| `POST /schedule/series/:id/occurrences/:originalOn/cancel`, `/restore` | — | 200 |
| `POST /schedule/series/:id/move` | `{ from, weekday, startTime }` | 200 `{ series }` (new) |
| `POST /schedule/series/:id/end` | `{ lastOn }` | 200 `{ series \| null }` (`null` = removed) |

Wire format: instants as ISO strings (`toISOString()`), dates `YYYY-MM-DD`, times `HH:MM` (regex `^([01]\d|2[0-3]):[0-5]\d$`). `ScheduleBlock` on the wire: `{ key, ref, studentId, studentName, studentStatus, startsAt, durationMinutes, status, movedTo, movedFrom }`, `key` = `l:<lessonId>` or `s:<seriesId>:<originalOn>`. `series` lists the rules referenced by the blocks (`id, weekday, startTime, durationMinutes, startsOn, endsOn`) for dialog copy ("Every Wednesday at 18:00", "From ... until ...", Move series default `from`).

### Display (verified in Node)
```typescript
new Intl.DateTimeFormat('en-GB', {
	weekday: 'short',
	day: 'numeric',
	month: 'short',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23',
	timeZone: 'Asia/Ho_Chi_Minh',
}).format(new Date('2026-10-14T11:00:00Z'))
```
Output `Wed 14 Oct, 18:00`. [VERIFIED: probe below]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| date-fns-tz / moment-timezone | `Intl` and (later) `Temporal` | `Temporal` not available in Node 24.17 | Use the Intl helper now; swapping to `Temporal` later is internal to `zoned.ts` |
| Materialised rows per occurrence | Rule plus exceptions (RFC 5545 style, Google's model) | — | Matches D-01 and Google `recurringEventId` / `originalStartTime` |

**Deprecated/outdated:** none relevant.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The series zone is a core constant `SCHEDULE_TIME_ZONE`, no `time_zone` column on `lesson_series` now | Pattern 5, Open Q1 | Adding the column later is an additive migration with default `'Asia/Ho_Chi_Minh'`; low cost, but D-01 is one-way, so confirm |
| A2 | Move series converts the old series' future moved exceptions into `lessons` rows and deletes the cancelled ones | Pattern 2 | Keeping them attached to the old series instead changes expansion (detached exceptions) and the Google mapping in phase 24 |
| A3 | A cut or end that leaves no occurrence deletes the series row; CHECK `ends_on >= starts_on` | Pattern 1-3 | Alternative is an empty "tombstone" range; matters for phase 24 deletes |
| A4 | End series deletes exceptions after the end date, including moved ones | Pattern 3 | Owner may expect moved lessons to survive as with Move series |
| A5 | Google drops instances outside a shortened recurrence range | Pattern 2 | Only affects the rationale for A2, not this phase's behaviour |
| A6 | Error code name `lesson_changed`, route paths and response shapes | Pattern 3, Code Examples | Naming only |
| A7 | Drizzle returns `time` as `HH:MM:SS` string | Pitfall 4 | Mapping code adjusts; caught by the API acceptance script |
| A8 | Constraint and index names | Pattern 1 | Naming only |
| A9 | Single lessons may be created in the past; series only from today; moves only to today or later (date-level, not time-level) | Pattern 3 | UI-SPEC marks these as defaults/unresolved |
| A10 | Move series carries an existing `ends_on` over to the new series; End series never extends an existing end | Pattern 2-3 | Otherwise a move silently reopens an ended series |

## Open Questions

1. **Where does the series' time zone live?** (affects the migration, D-01 is one-way)
   - What we know: D-01 says `start_time` is local to "the series' zone" but lists no zone column; D-07 fixes the grid to Vietnam and leaves `students.time_zone` unused; Vietnam has no DST.
   - What's unclear: whether the owner wants the column now.
   - Recommendation: no column, core constant `SCHEDULE_TIME_ZONE = 'Asia/Ho_Chi_Minh'`; phase 24 adds `time_zone text not null default 'Asia/Ho_Chi_Minh'` if Google needs it. Confirm before the migration plan runs.
2. **End series and already moved lessons after the end date.** Move series keeps them (D-04); the approved End series copy says later lessons are removed. Recommendation: delete (follow the copy); confirm.
3. **Success criterion 2 vs D-04.** Criterion 2 says "later changes to the series keep that exception"; D-04 resets cancelled exceptions on a series move. Moved ones are kept (as single lessons). Recommendation: D-04 wins (it is the owner's later, explicit decision); the verifier reads criterion 2 as "moved exceptions survive".
4. **DR-3, DR-4, DR-5 still OPEN** at the Design dude session. The planner puts the "request from design" step first in the UI plans; the UI-SPEC fallback is binding until an answer arrives.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | API from source, scripts | ✓ | v24.17.0 (ICU 78.3, tz 2026b) | — |
| `Temporal` | — | ✗ | `typeof Temporal` = `undefined` | Intl helper (Pattern 5) |
| Yarn | install, workspaces | ✓ (pinned `yarn@4.18.1`) | 4.18.1 | — |
| `node_modules` in the worktree | typecheck, build, dev | ✗ | — | `yarn install --immutable` once before wave 1 |
| PostgreSQL dev (`dvlab_dev`, `dvlab_test`) | migration, API checks | ✓ | 18.6 | — |
| Playwright Chromium (`web.mjs`) | browser checks | not probed | — | manual browser check |

Probe output (this session):
```
node -e: 418 false true true false true false
  (supportedValuesOf length; includes Asia/Ho_Chi_Minh, Asia/Saigon, Europe/Moscow, Europe/Kyiv, Europe/Kiev, UTC)
Asia/Saigon                    (resolvedOptions().timeZone for 'Asia/Ho_Chi_Minh')
Wed 14 Oct, 18:00              (en-GB format, Asia/Ho_Chi_Minh, 2026-10-14T11:00:00Z)
10/10/2026, GMT+3              (Europe/Moscow short name)
78.3 2026b                     (ICU, tzdata)
typeof Temporal: undefined

sql.mjs .env app:
version "PostgreSQL 18.6 (Debian 18.6-1.pgdg13+2) ...", starts "2026-10-14T11:00:00.000Z",
mon "1", sun "7", prev "2026-10-12T17:00:00.000Z"

Tailwind 4.3.3 compile:
KEYFRAMES_PRESENT
@layer utilities { .\[--scroll-fade-size\:var\(--scroll-fade-size-compact\)\] { --scroll-fade-size: var(--scroll-fade-size-compact); } }
```

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `node_modules` (install step), `Temporal` (Intl helper).

## Acceptance Checks (no new tests)

The Validation Architecture section is omitted: `workflow.nyquist_validation` is `false` in `.planning/config.json`, and the owner's rule forbids new tests. Acceptance per plan (scripts, SQL, browser) is listed below for the planner.

| Req | Acceptance (no test files) |
|-----|----------------------------|
| SCHED-01 | API script in `scripts/dev-checks` (or the scratch dir) on `dvlab_test`: create single and weekly for `Alex Example NNNN`, read three consecutive weeks, count blocks; SQL `select count(*) from lesson_series` before and after; browser: create from empty cell and from New lesson |
| SCHED-02 | Script: move and cancel one occurrence, read the week, other dates unchanged; restore; 409 on a stale key; 409 on a past occurrence |
| SCHED-03 | Script: move series from next occurrence; old `ends_on`, new `starts_on`, moved exception now a `lessons` row, cancelled exception gone; past blocks of previous weeks byte-identical before and after |
| SCHED-04 | Browser with the OS zone set away from Vietnam: today circle, week edges, now line follow VN; second zone None / MSK / one DST zone; both themes |
| SCHED-05 | Script: snapshot of last week's blocks before and after Move series and End series is identical |
| CARD-04 | Browser: search filters both tabs, "Next lesson" shows `Wed 14 Oct, 18:00` style or "None"; API `GET /students` returns `nextLessonAt` equal to the earliest block from the week reads |
| Core | One-off script comparing `zonedInstant` with SQL `at time zone` for several dates, and `weekdayOf` with `isodow` |

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (existing) | session cookie, `requireSession` |
| V3 Session Management | no (existing) | unchanged |
| V4 Access Control | yes | `requireRole('teacher')` on the whole `/schedule` router; student accounts get 403 |
| V5 Input Validation | yes | zod schemas in contracts: uuid params, ISO date via `isIsoDate`, `HH:MM` regex, weekday 1-7, minutes 15-240, week start must be a Monday within a bounded year range |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-site request forcing a mutation | Tampering | Existing global `sameOrigin(appOrigin)` middleware; mutations are POST with JSON |
| Lost update between two tabs | Tampering | Row lock `for update` plus state preconditions returning 409 |
| Editing past lessons through the API | Tampering | Server-side past guard (D-05), not just hidden buttons |
| Unbounded loop from a crafted date | Denial of service | Bounded week range; `nextLessons` iteration cap (366 days) |
| Student data in logs or docs | Information disclosure | Request logs carry method, path, status only; `originalOn` in paths is a date, not personal data; fixtures use `Alex Example NNNN` |
| SQL injection | Tampering | Drizzle parameterised queries only |

## Suggested Plan Decomposition

Constraints: one web plan per wave, one plan naming `yarn workspace @dv-lab/api build` if any, `yarn install` before wave 1, design request step before UI tasks.

| Wave | Plan | Content | Depends on |
|------|------|---------|------------|
| 0 (orchestrator) | — | `yarn install --immutable` in the worktree; confirm Open Questions 1-2 | — |
| 1 | 20-01 db | Schema (Pattern 1), `db:generate --name schedule`, apply to `dvlab_dev` and `dvlab_test`, journal = 4 folders, privilege SQL check, CHECK probes in `begin ... rollback` | — |
| 1 | 20-02 core | `zoned.ts`, `schedule.ts` (Pattern 5), index exports; one-off script cross-checking with SQL | — |
| 1 | 20-03 contracts | `schedule.ts` schemas and types, `lesson_changed` error code (not yet `StudentRow`) | — |
| 1 | 20-04 web infra | E1, E2, E3, E4, E5, E6; copy `TimePicker` + `InputGroup` with edits; `lib/schedule-format.ts`; browser check that existing fades still work and compact override applies | — |
| 2 | 20-05 api | `schedule` service and router, wiring in `app.ts`, all mutations (Patterns 2-4), `StudentRow.nextLessonAt` with `card-rows.ts`/`cards.ts`; acceptance script on `dvlab_test` | 01, 02, 03 |
| 2 | 20-06 web frame | Schedule page client screen: header (month title, range, Today, arrows, `SecondZoneSelect`), WeekGrid frame, axis with second zone, today column, now line, 08:00 scroll, empty-cell click handler; design request DR-3 first | 02, 03, 04 |
| 3 | 20-07 web read + create | Week fetch, blocks with lanes and statuses, lesson dialog (read-only parts, past caption), New lesson dialog with overlap warning, toasts, ReadError, live region; DR-4 request | 05, 06 |
| 4 | 20-08 web changes | Move this lesson, Cancel/Restore, Move series, End series, 409/404 banner and refetch, focus return | 07 |
| 5 | 20-09 web students | Controlled tabs, search, "Next lesson" column, tabs strip fade (E7), uses E4/E6 | 05 (can swap with 20-08 if the owner wants CARD-04 earlier) |

Wave 1 has four independent plans while `parallelization.max_concurrent_agents` is 3; either the fourth starts when a slot frees, or 20-03 contracts merges into 20-02 core (both small, disjoint files). The planner decides.

Squad review is worth running on 20-01 and 20-05 (one-way schema and transactions); the web plans follow an approved contract.

## Sources

### Primary (HIGH confidence)
- Codebase, read this session: `packages/db/src/schema.ts`, `migrate.ts`, `connection.ts`, `postgres-errors.ts`, `packages/db/drizzle/*`, `deploy/postgres/ensure-db.sql`, `packages/contracts/src/{students,auth,index}.ts`, `packages/core/src/*`, `apps/api/src/{app,request-context}.ts`, `routes/{students,payments}.ts`, `cards/{cards,card-rows,payments}.ts`, `apps/web/app/globals.css`, `components/app/{date-field,layout-parts}.tsx`, `components/ui/{scroll-area,table}.tsx`, `students-screen.tsx`, `schedule/page.tsx`, `lib/api-client.ts`, `knip.json`, `.github/workflows/ci.yml`, `scripts/dev-checks/*`
- Design lab: `src/app/lab/a/_components/schedule-view.tsx` (WeekGrid, clusters, block tones), `src/components/lab/a/ui/time-picker.tsx` header, `src/app/globals.css` fade rules
- Probes: Node Intl, PostgreSQL 18.6 via `sql.mjs`, Tailwind 4.3.3 compile

### Secondary (MEDIUM confidence)
- [CITED: developers.google.com/workspace/calendar/api/v3/reference/events] event `id` charset "base32hex ... lowercase letters a-v and digits 0-9", length 5-1024; `originalStartTime` identifies an instance "even if the instance was moved". Phase 24 note: uuid hex digits are base32hex-legal, hyphens are not, so ids derived from uuids drop the hyphens.

### Tertiary (LOW confidence)
- Google's handling of instances outside a shortened recurrence (A5), training knowledge.

## Metadata

**Confidence breakdown:**
- Code map and environment: HIGH, every path and value read or probed this session
- Data model and transactions: MEDIUM, consistent with D-01..D-05 but A1-A4 fill gaps the decisions leave open
- Web mechanics: HIGH for existing parts, MEDIUM for grid geometry (UI-SPEC values, browser tuning needed)

**Research date:** 2026-10-10
**Valid until:** 2026-11-09 (stable stack; re-check if Node or Tailwind versions change)
