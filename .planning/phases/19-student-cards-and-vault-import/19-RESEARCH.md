# Phase 19: Student Cards and Vault Import - Research

**Researched:** 2026-10-10
**Domain:** Postgres schema + Hono api + Next 16 screens for student cards, payments and balance; one-off markdown import from the vault
**Confidence:** HIGH for code/schema/data shapes (read this session), MEDIUM for UI component reuse, LOW only where tagged `[ASSUMED]`

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Карточка и привязка аккаунта (по умолчанию, не просмотрено)
- **D-01:** Таблица `students` — карточка: `id` uuid, `display_name`, `status` (`active` | `archived`), `rate_minor` и `currency` (ставка за урок; оба пусты или оба заданы), `default_lesson_minutes` (по умолчанию 60, диапазон 15-240), `parent`, `level`, `goals` (короткие строки шапки), `time_zone` (IANA, пусто = как у учителя), `opening_balance_minutes`, `opening_balance_on`, `import_key` (уникален, если задан), `created_at`, `updated_at`, `archived_at`. Короткие `level` и `goals` — поля шапки, длинный текст живёт в секциях (D-02). — **Reversibility:** costly — схема карточки определяет импорт, расписание и баланс.
- **D-02:** Шесть markdown-секций (general info, interests, level, goals, typical mistakes, lesson ideas) лежат в таблице `student_sections` (`student_id`, `kind`, `body`, `updated_at`; ключ `student_id + kind`, `kind` — из набора шести значений в `packages/contracts`). Нет строки = пустая секция. Список карточек не читает тела секций.
- **D-03:** Словарь — таблица `student_terms` (`id`, `student_id`, `term`, `note`, `created_at`), уникальность `student_id + lower(term)`. Учитель добавляет, правит заметку и удаляет термин.
- **D-04:** Связь аккаунта с карточкой — столбец `accounts.student_id` (FK на `students`, пустой для учителя) с частичным уникальным индексом по непустым значениям и CHECK «только роль student». Один аккаунт — одна карточка (один столбец), у карточки максимум один аккаунт (индекс). Операции: создать аккаунт из карточки (имя берётся из карточки, логин и пароль по правилам фазы 18) и привязать существующий непривязанный аккаунт ученика; отвязки нет. Нарушения отвечают 409 с кодами `card_has_account` и `account_already_linked`. — **Reversibility:** costly — от связи зависят вход ученика, фаза 26 (аккаунты ielts) и чат.
- **D-05:** Маршруты и экран `/students` из фазы 18 (список аккаунтов) заменяются списком карточек; аккаунтом управляют из карточки (`/students/:id/account`). `apps/api/src/auth/accounts.ts` остаётся единственным владельцем создания и деактивации аккаунтов; карточки живут в отдельном модуле `apps/api`.

### Деньги и баланс (по умолчанию, не просмотрено)
- **D-06:** Новый пакет `packages/core` (JIT, без Node API и базы): чистые функции денег и остатка — уроки по сумме, зачтённые минуты, остаток в минутах, показ уроков с долями. Формы и маршруты фазы 19 вызывают их; фаза 21 добавляет правила уроков в тот же пакет (LEDG-08). Импорт и api зависят от него, он не зависит от других пакетов. — **Reversibility:** costly — место правил баланса определяет формы, чат и расчёт «кому скоро платить».
- **D-07:** Деньги хранятся целым числом в минимальных единицах валюты (знаков после запятой берёт `Intl` для кода валюты) вместе с трёхбуквенным кодом ISO 4217; показ через `Intl.NumberFormat`. Из vault приходят RUB (знак ₽) и KZT.
- **D-08:** Таблица `payments`: `id`, `student_id` (пусто = несопоставленный), `paid_on` (дата), `amount_minor`, `currency` (пусто только при пустом `student_id`), `lessons_count` (numeric(7,2), пусто = «не посчитано»), `credited_minutes` (целое, не меньше 0, по умолчанию 0), `note`, `source` (`manual` | `vault`), `import_key` (уникален, если задан), `created_at`. `credited_minutes` = `lessons_count × default_lesson_minutes` карточки на момент записи и позже не пересчитывается. Предзаполнение уроков в форме = сумма / ставка с округлением до 2 знаков, только если валюта платежа равна валюте ставки и ставка задана; поле всегда правится. — **Reversibility:** costly — оплаты определяют деньги и остаток.
- **D-09:** Остаток карточки = `opening_balance_minutes + Σ credited_minutes` платежей карточки с `paid_on` позже `opening_balance_on` (уроки вычитает фаза 21). Пока открывающий остаток не задан, остаток «не задан» и вместо числа показывается «Set opening balance»: все импортированные оплаты в остаток не входят (критерий 6). Остаток в уроках = минуты / `default_lesson_minutes` карточки, до двух знаков без хвостовых нулей (1.5, 0.25).
- **D-10:** Открывающий остаток задаётся на карточке полем «Lessons left» и датой «as of» (по умолчанию сегодня); в базе — минуты `lessons × default_lesson_minutes`. Оплата с датой в день открытия или раньше считается уже учтённой в числе; подсказка рядом с датой это говорит.
- **D-11:** Оплаты: учитель записывает, удаляет (опечатка = удалить и записать заново, с подтверждением) и назначает несопоставленную на ученика. Правка существующей оплаты отложена.
- **D-12:** Несопоставленная оплата (критерий 3) — строка `payments` без `student_id`, в том числе перевод 2026-06-22 от Евгения из `Unmatched transfers.md` с валютой «не указана». При назначении учитель выбирает ученика и, если валюта пуста, валюту (по умолчанию валюта ставки ученика); уроки можно задать сразу.

### Импорт vault (по умолчанию, не просмотрено)
- **D-13:** Импорт — одна утилита `import-vault` в `apps/api` с двумя шагами. `parse <путь-к-vault>` читает md локально у владельца и пишет JSON-пакет в stdout; `apply` читает пакет из stdin и пишет в базу под ролью приложения (на сервере: `docker compose run --rm -T import < пакет`, выполняет Server guy по команде из RUNBOOK). Пакет с данными учеников лежит вне репозитория: маска в `.gitignore` и `.dockerignore`, в образ и логи не попадает. Сначала прогон на `dvlab_dev`, на сервер — после приёмки владельцем.
- **D-14:** Идемпотентность по естественным ключам: карточка ищется по `import_key` (имя папки ученика в vault), новая получает свежий uuid; у существующей карточки ничего не перезаписывается (поля, секции, словарь и правки учителя остаются), добавляются только отсутствующие секции, термины (по `lower(term)`) и оплаты (по `import_key`). Повторный запуск вставляет 0 строк и не создаёт дублей (критерий 2).
- **D-15:** Ключ оплаты = хэш sha256 от «ключ ученика | дата | сумма | валюта | порядковый номер среди одинаковых оплат в этом файле»; две одинаковые оплаты в один день получают разные ключи, а повторный разбор даёт те же.
- **D-16:** Сопоставление только по папке: оплаты берутся из `Payments.md` внутри папки ученика, имя в заметке оплаты («Bank transfer reported by Vika» и подобные) — просто текст заметки, никогда не связь; папка `Vika` — карточка ученицы (CARD-06). `Unmatched transfers.md` даёт оплаты без ученика. `Students Index.md`, `Payments Index.md`, `Teaching breaks.md` и `Lesson history.md` не импортируются.
- **D-17:** Поля карточки берутся только из регулярных мест: заголовок H1 главной страницы (иначе имя папки) → `display_name`; строка `- Listed rate: N ₽|KZT / M min` в `Payments.md` → ставка, валюта и `default_lesson_minutes`; `status` главной страницы (`active`, `to-learn` и пусто) → `active`, архивных при импорте нет. `parent`, `level`, `goals`, `time_zone` остаются пустыми (сведения лежат в секциях), владелец заполняет при желании. Нет строки ставки → ставка пуста.
- **D-18:** Файлы папки → секции: `General info` → general info, `Interests and Hobbies` → interests, `Level info` → level, `Goals and IELTS` → goals, `Typical mistakes` → typical mistakes, `Lesson ideas` → lesson ideas. Тело берётся без frontmatter, wiki-ссылки `[[A]]` и `[[A|B]]` заменяются текстом `A` и `B`, остальной markdown сохраняется. Главная страница ученика секцией не становится.
- **D-19:** `Learnt vocabulary.md`: строки таблиц (`Item | Meaning/use | …`) → термин и заметка из «Meaning/use»; маркированные пункты под заголовками → термин без заметки; обратные кавычки снимаются, повторы по `lower(term)` схлопываются. Заголовки групп не сохраняются.
- **D-20:** Приёмка импорта без новых тестов (директива 2026-10-09): `parse` печатает в stderr сводку (учеников, секций, терминов, оплат, несопоставленных), `apply` печатает «вставлено / пропущено» по таблицам; приёмка = 25 карточек с разными uuid, второй прогон «вставлено 0», SQL-счётчики на `dvlab_dev`, у ученицы Vika нет связанных оплат по заметкам.

### Интерфейс (по умолчанию, не просмотрено)
- **D-21:** Экран Students: список карточек (имя, статус-точка, ставка, остаток) с вкладками Active и Archived и третьей вкладкой Unassigned payments со счётчиком и действием Assign; кнопка «New student». Поиск, статус-вкладки расширенные и «next lesson» — фаза 20.
- **D-22:** Профиль `/students/[id]`: шапка (имя, статус-точка, ставка, остаток) и вкладки Overview (поля, открывающий остаток, аккаунт), Notes (шесть секций), Vocabulary, Payments. Точная раскладка — UI-SPEC фазы 19.
- **D-23:** Markdown: хранится текстом, показывается через `react-markdown` с `remark-gfm` без сырого HTML (`skipHtml`), правится в textarea; версии закреплены точно, возрастной барьер Yarn не снимается.
- **D-24:** Архивирование карточки не трогает аккаунт ученика; профиль показывает состояние аккаунта, деактивирует его учитель отдельным действием (D-08 фазы 18). Восстановление возвращает карточку во вкладку Active.
- **D-25:** Недостающие элементы дизайна (выбор ученика, markdown-редактор, строка оплаты) берутся из копии варианта A; если там их нет — шаг «запросить у дизайна» (Design dude) в планах UI, а не самодельный элемент.
- **D-26:** Часовой пояс — выбор из `Intl.supportedValuesOf('timeZone')`, пусто означает «как у учителя».
- **D-27:** Маршруты карточек, оплат, словаря и аккаунтов карточки доступны только роли teacher; ученик получает 403 (в карточке персональные данные и деньги).
- **D-28:** Данные учеников не попадают в репозиторий: маска файлов-пакетов импорта в `.gitignore` и `.dockerignore`, в `AGENTS.md` добавляется правило и владелец `import-vault`; в RUNBOOK — раздел запуска импорта на сервере.

### Claude's Discretion
- Имена маршрутов, столбцов и кодов ошибок, кроме названных выше.
- Раскладка файлов внутри `apps/api` и `packages/core`.
- Порядок строк в таблицах и точный вид пустых состояний (по правилам варианта A).

### Deferred Ideas (OUT OF SCOPE)
- Правка существующей оплаты (пока удалить и записать заново) — по запросу владельца.
- Импорт главной страницы ученика (Summary, Quick profile) и `Lesson history.md` — история уроков не нужна остатку, сводка дублирует секции.
- Разбор `Teaching breaks.md` в паузы расписания — фаза 20.
- Отвязка аккаунта от карточки и перенос аккаунта между карточками — не требуется ROADMAP.
- Заполнение `parent`, `level`, `goals`, `time_zone` из свободного текста vault — слишком хрупко, владелец вводит сам.
- Аккаунты ielts и их привязка к карточкам — фаза 26 (использует операцию «привязать существующий аккаунт» из D-04).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CARD-01 | Teacher creates, edits, archives, restores a card (name, status, rate+currency, default lesson length, parent, level, goals, time zone) | Schema §Pattern 1 (`students` CHECKs), routes §Pattern 4, time-zone validation Pitfall 9, Select/Combobox copy §UI components |
| CARD-02 | Card keeps six markdown sections the teacher edits | `student_sections` §Pattern 1, react-markdown 10.1.0 + remark-gfm 4.0.1 + `.typeset` CSS §Standard Stack, empty-body rule Risk R8 |
| CARD-03 | Vocabulary list of terms with notes | `student_terms` expression unique index §Pattern 1, 409 `term_exists` §Pattern 5 |
| CARD-06 | All 25 vault students imported with stable ids, sections, vocabulary, payments; "Vika" is a card, not linked by notes | Shape Catalogue, parser rules §Pattern 6, idempotent apply §Pattern 7, Risks R1-R5 |
| CARD-07 | Unmatched transfers appear as unassigned payments, assignable | `payments.student_id` null, assign-by-conditional-UPDATE §Pattern 5, Risk R1 |
| ACCT-04 | Account links to exactly one card; card has at most one account | `accounts.student_id` + partial unique index + CHECK §Pattern 2, race analysis Pitfall 6, Risk R6 |
| LEDG-01 | Teacher records a payment; lessons prefilled = amount / rate, editable | `suggestLessons` §Pattern 3, money parsing Pitfall 2 |
| LEDG-02 | Balance stored in minutes, shown in lessons with fractions | `creditedMinutes`, `formatLessons` §Pattern 3, rounding Pitfall 7 |
| LEDG-09 | Teacher sets opening balance; balance counts from it | `balanceMinutes` §Pattern 3, opening-date semantics Pitfall 8 |
</phase_requirements>

## Summary

The phase is mostly additive: one Drizzle migration adds `students`, `student_sections`, `student_terms`, `payments` and a nullable `accounts.student_id`; a new JIT package `packages/core` holds money/lesson maths; `apps/api` gets a card module, payment routes and a two-step `import-vault` CLI bundled by tsdown like `bootstrap-teacher`; `apps/web` replaces the phase-18 account list with card screens. Every needed primitive exists or is verified: Drizzle `1.0.0-rc.4` returns `numeric` as string and `date` as `'YYYY-MM-DD'` string by default (no time-zone shift), PostgreSQL 18 on `dvlab_dev` has `gen_random_uuid()` and `uuidv7()`, the default privileges in `ensure-db.sql` already grant `dvlab_app` SELECT/INSERT/UPDATE/DELETE on any table `dvlab_migrator` creates, and `react-markdown 10.1.0` / `remark-gfm 4.0.1` pass the legitimacy gate.

The real work and risk is the vault parser. Reading all 25 folders shows the data is far less regular than D-17..D-19 assume: only 11 folders have a main page and sections, 6 of those name the goals file `Goals.md` (not mapped by D-18), every section file starts with an H1 and ends with a `## Links` block of wiki-links, the vocabulary files use 18 different table header sets (only one is `Item | Meaning/use`) plus bullet banks mixed with non-vocabulary instruction lists, two rate lines put `KZT` before a comma-grouped amount, 4 payments inside student folders have currency "not specified" (conflicts with the D-08 CHECK), and 1 payment row has no amount. All of this is catalogued below with counts and concrete parser rules; with those rules a prototype extracts about 760 unique terms.

Three locked decisions need small, explicit adjustments (see "Risks to locked decisions"): allow a null currency on assigned vault payments (R1), map `Goals.md` too and strip the H1/Links scaffolding (R2, R3), and scope the "one account per card" index to active accounts so a deactivated account cannot block a card forever (R6). None changes the architecture.

**Primary recommendation:** Build in four waves: (1) `packages/core` + contracts + schema/migration, (2) api card/payment/account routes + `import-vault parse/apply`, (3) web screens with copied variant-A Select/Combobox/Textarea/Popover/DateField and the `.typeset` stylesheet, (4) deploy wiring (compose `import` service, RUNBOOK, ignore masks, CI boundary for core, knip) and a dry run on `dvlab_dev` checked with the SQL recipe below.

## Project Constraints (from CLAUDE.md / AGENTS.md)

- No comments in code; UI strings in English; Russian for docs/reports to the owner.
- No new tests (owner directive 2026-10-09, nyquist disabled). Acceptance = scripts, logs, SQL, browser. Existing tests stay green (see Pitfall 11: two existing assertions must be updated).
- Versions pinned exactly (no `^`/`~`); Yarn `npmMinimalAgeGate: 1440` is never disabled.
- TypeScript 6.0.3; Drizzle `drizzle-orm`/`drizzle-kit` `1.0.0-rc.4`; migrations only via `yarn db:generate`, never hand-edited, never `drizzle-kit push`; one release's migrations only add objects.
- `apps/web` never imports `@dv-lab/api` / `@dv-lab/db`; no `transpilePackages`; `packages/contracts` depends only on `zod`, no `pg`, `node:*`, `@dv-lab/*`, `process.env`.
- Module owners: `loadConfig` reads api env; `resolveDatabaseUrl` picks DB URL; `errorBody` owns the error envelope; `accounts.ts` owns account creation/deactivation; `apiRequest` is the only web→api client; `requireTeacherPage` guards teacher pages; UI only Base UI + copied variant-A components (no `radix-ui`, `@radix-ui/*`, `cmdk`).
- Public repository: no student names, amounts, notes, server addresses or passwords anywhere in git, `.planning/`, images or logs. `.env*` never committed nor in Docker context.
- Ad-hoc SQL only against `_dev` / `_test` databases.
- Every design element comes from variant A; a missing element = "ask Design dude" step, not a home-made one.
- GSD agents do not commit (owner rule); orchestrator commits.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Money/lesson maths (minor units, lessons prefill, credited minutes, balance fold, lesson display) | `packages/core` (pure TS) | web forms, api routes, import | D-06; one rule set used by browser prefill and server writes |
| Request/response shapes, section kinds, currency allow-list, error codes | `packages/contracts` | — | Shared web/api contract, zod only |
| Card, section, term, payment persistence and invariants | Database (CHECK, FK, unique indexes) | api module | Invariants survive concurrent requests and the import |
| Card/payment business operations, teacher-only access | API (`apps/api/src/students/*`, `routes/*`) | — | D-05, D-27 |
| Account creation/deactivation/linking | API `auth/accounts.ts` | DB partial unique index | D-05 keeps one owner |
| Vault parsing (md → packet) | Owner's machine (`import-vault parse`, Node) | — | Vault never leaves the owner's machine except as the packet |
| Packet apply | API image one-off container (`import-vault apply`, app role) | DB `ON CONFLICT DO NOTHING` | Same pattern as `bootstrap` |
| Markdown rendering, forms, tabs | Browser (client components) | Next server only for `requireTeacherPage` | Existing screen pattern: client fetch via `apiRequest` |

## Standard Stack

### Core (already installed, versions from manifests)

| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| drizzle-orm / drizzle-kit | 1.0.0-rc.4 | schema, queries, migrations | [CITED: packages/db/package.json]; installed copy reports `1.0.0-rc.4` |
| pg | 8.23.1 | driver | [CITED: packages/db/package.json] |
| zod | 4.6.5 | contracts, packet validation | [CITED: packages/contracts/package.json] |
| hono | 4.13.13 | api routes | [CITED: apps/api/package.json] |
| tsdown | 0.23.0 | api bundles incl. new `import-vault.mjs` | [CITED: apps/api/package.json] |
| @base-ui/react | 1.8.0 | Select, Combobox, Popover, Field primitives (exports `./select`, `./combobox`, `./popover`, `./field`, `./number-field`, `./autocomplete` confirmed via `npm view @base-ui/react@1.8.0 exports`) | Keep 1.8.0; 1.9.0 appeared 2026-10-09, no reason to bump |
| next / react | 16.4.0 / 19.3.0 | web | [CITED: apps/web/package.json] |

### New packages to install (web only)

| Library | Version (pin exactly) | Published | Purpose |
|---------|----------------------|-----------|---------|
| react-markdown | 10.1.0 | 2025-03-07 | render section markdown; peer `react >=18`, `@types/react >=18` [VERIFIED: npm registry] |
| remark-gfm | 4.0.1 | 2025-02-10 | tables, task lists, strikethrough, autolinks [VERIFIED: npm registry] |
| react-day-picker | 10.0.1 (not 10.0.2) | 2026-05-15 | only if the variant-A `DateField` (Popover + Calendar) is copied; deps `date-fns ^4.1.0`, `@date-fns/tz ^1.4.1` [VERIFIED: npm registry] |

`react-markdown` v10 removed the `className` prop (wrap it in a `div`) [CITED: github.com/remarkjs/react-markdown/blob/main/changelog.md]. It is "secure by default", HTML is escaped unless `skipHtml` (drop) or `rehype-raw` (render) is used; `defaultUrlTransform` allows only `http`, `https`, `irc`, `ircs`, `mailto`, `xmpp` [CITED: github.com/remarkjs/react-markdown/blob/main/readme.md]. It is ESM-only and has no hooks, so it works in client components (where this app renders screens) and in server components.

No Tailwind typography plugin is installed (`apps/web/app/globals.css` line 1 is `@import 'tailwindcss';`, and `grep -c typeset` there returns 0). Variant A styles rendered markdown with the `.note-content.typeset` rules in design-lab `src/app/globals.css` lines 375-392 and the `@layer components { :where(.typeset) … }` block at lines 394-~1180, built on the same `--fs-*`/`--lh-*` tokens apps/web already defines (`--text-body: var(--fs-body)` etc.). Copy that block; wrap `<Markdown>` in `<div className="note-content typeset">`. Variant A itself renders markdown with a `unified().use(remarkParse).use(remarkGfm).use(remarkRehype)` pipeline (`src/app/lab/_components/note-markdown.tsx`); D-23 locks react-markdown, which uses the same remark/rehype stack internally, so the visual result is the same with the copied CSS.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-day-picker DateField | native `<input type="date">` styled with `components/ui/input` | zero deps, but not the variant-A look; use only if Design dude rejects the copy |
| `uuid defaultRandom()` (`gen_random_uuid()`) | `uuidv7()` (exists on PG 18.6 dev server) | Drizzle rc.4 `uuid` builder only has `defaultRandom()`; v7 needs `.default(sql\`uuidv7()\`)`; keep v4 for consistency with `accounts.id` |
| `bigint({ mode: 'number' })` for money | `integer` | integer max 2 147 483 647 minor units = 21.4 M RUB per payment, enough; but `sum(integer)` already returns `bigint` (string) — see Pitfall 4. Recommend `integer` columns + explicit casts in aggregates |

**Installation (apps/web):**
```bash
yarn workspace @dv-lab/web add react-markdown@10.1.0 remark-gfm@4.0.1
yarn workspace @dv-lab/web add react-day-picker@10.0.1
```
Then confirm `package.json` has no `^` (Yarn writes the exact spec given). The worktree has no `node_modules`; run `yarn install` first.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| react-markdown@10.1.0 | npm | 19 mo | 36.7M/wk | github.com/remarkjs/react-markdown | OK | Approved |
| remark-gfm@4.0.1 | npm | 20 mo | 43.8M/wk | github.com/remarkjs/remark-gfm | OK | Approved |
| react-day-picker (latest 10.0.2) | npm | 10 days | 44.1M/wk | github.com/gpbl/react-day-picker | SUS ("too-new") | Pin 10.0.1 (2026-05-15) instead; if 10.0.2 is wanted, planner adds `checkpoint:human-verify` |
| date-fns (transitive) | npm | 4.4.0, 2026-05 | 98.7M/wk | github.com/date-fns/date-fns | OK | Approved |
| @date-fns/tz (transitive) | npm | 1.5.0, 2026-05-21 | 36.6M/wk | github.com/date-fns/tz | OK | Approved |

No postinstall scripts on any of them (`signals.postinstall: null`).
**Packages removed due to [SLOP]:** none. **Flagged [SUS]:** react-day-picker@10.0.2 only (avoided by pinning 10.0.1).

## Architecture Patterns

### System Architecture Diagram

```
Owner's Mac                                  VPS / dvlab_dev
-----------                                  ---------------
vault/students/*.md
   │
   ▼
import-vault parse <dir> ──stdout──► packet.json (outside repo, git/docker-ignored)
   │ stderr: counts + warnings                │
   │                                          ▼  scp by owner, then
   │                     docker compose --profile tools run --rm -T import apply < packet.json
   │                                          │ (local: node --env-file=.env apps/api/src/import-vault.ts apply < packet.json)
   │                                          ▼
   │                         zod-validate packet ─► one tx + advisory lock
   │                                          ├─ students  INSERT … ON CONFLICT DO NOTHING (import_key)
   │                                          ├─ sections  INSERT … ON CONFLICT DO NOTHING (student_id,kind)
   │                                          ├─ terms     INSERT … ON CONFLICT DO NOTHING (student_id,lower(term))
   │                                          └─ payments  INSERT … ON CONFLICT DO NOTHING (import_key)
   │                                          ▼ stdout: inserted/skipped per table (no names)
Browser (teacher)                            Postgres 18
   │ /students, /students/[id]                ▲
   ▼                                          │
Next page (requireTeacherPage) ─► client screen ─apiRequest('/api/…')─► Caddy ─► Hono api
                                                    │                          │ requireSession + requireRole('teacher')
            packages/core (prefill, display) ◄──────┘                          │ zod (contracts) → students module / accounts.ts
                                                                               │ packages/core (credited minutes, balance fold)
                                                                               ▼
                                                                         SQL with CHECK/FK/unique → 409 mapping
```

### Recommended Project Structure

```
packages/core/                 # JIT like contracts: package.json exports "./src/index.ts", no deps
  src/index.ts                 # export * from './money.ts', './lessons.ts', './balance.ts'
  src/money.ts                 # currencyDigits, parseMoney, formatMoney, minorToInput
  src/lessons.ts               # parseLessons, hundredths<->decimal string, suggestLessons, creditedMinutes, formatLessons
  src/balance.ts               # balanceMinutes
packages/contracts/src/students.ts   # section kinds, currency list, card/payment/term schemas and response types
packages/db/src/schema.ts            # + students, studentSections, studentTerms, payments, accounts.studentId
apps/api/src/students/               # card module (D-05: separate from auth/)
  cards.ts  card-rows.ts  sections.ts  terms.ts  payments.ts
apps/api/src/routes/students.ts      # rewritten: cards
apps/api/src/routes/payments.ts      # unassigned list, assign, delete
apps/api/src/import-vault.ts         # CLI entry: parse | apply
apps/api/src/import/parse-vault.ts   # md → packet (node:fs, node:crypto)
apps/api/src/import/apply-packet.ts  # packet → db
apps/api/src/import/packet.ts        # zod schema of the packet
apps/web/app/(app)/students/_components/…   # list screen, unassigned tab, new-card dialog
apps/web/app/(app)/students/[id]/page.tsx + _components/   # profile tabs
apps/web/components/app/markdown.tsx         # react-markdown wrapper with .typeset
```

### Pattern 1: Schema in Drizzle rc.4 (matches existing `schema.ts` style)

Existing conventions [VERIFIED: packages/db/src/schema.ts:1-40]: `import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'`; ids `uuid('id').defaultRandom().primaryKey()`; timestamps `timestamp('created_at', { withTimezone: true }).defaultNow().notNull()`; enums as `text` + `check('accounts_status_ck', sql\`${table.status} in ('active', 'deactivated')\`)`; partial unique `uniqueIndex('accounts_active_login_uq').on(table.login).where(sql\`${table.status} = 'active'\`)`; FK `.references(() => accounts.id, { onDelete: 'restrict' })`; length checks `char_length(${table.displayName}) between 1 and 80`.

Verified type facts in the installed `drizzle-orm@1.0.0-rc.4` (`/Volumes/T7/personal/dv-lab/node_modules/drizzle-orm`):
- `numeric(name, { precision, scale, mode? })`, default mode returns `data: string`; `mode: 'number'` and `'bigint'` exist (`pg-core/columns/numeric.d.ts`). Use the default string mode for `lessons_count` and convert with core's string helpers (never `parseFloat * 100`).
- `date(name)` without config resolves to `PgDateStringBuilder` (`data: string`, codec `date:string`); node-postgres session maps `types.builtins.DATE` to a noop parser (`node-postgres/session.js:12-24`), so `paid_on` round-trips as `'YYYY-MM-DD'` with no time-zone shift. `mode: 'date'` would re-parse into `Date` — do not use it.
- `index().on(...)` accepts `SQL` items, so `uniqueIndex('student_terms_term_uq').on(t.studentId, sql\`lower(${t.term})\`)` is valid; `onConflictDoNothing({ target })` accepts only `PgColumn` (`type IndexColumn = PgColumn`, `pg-core/indexes.d.ts:35`) — so use target-less `onConflictDoNothing()` for terms.
- FK actions: `'cascade' | 'restrict' | 'no action' | 'set null' | 'set default'`.

```typescript
// Proposed (names are suggestions under Claude's Discretion)
export const students = pgTable('students', {
  id: uuid('id').defaultRandom().primaryKey(),
  displayName: text('display_name').notNull(),
  status: text('status').default('active').notNull(),
  rateMinor: integer('rate_minor'),
  currency: text('currency'),
  defaultLessonMinutes: integer('default_lesson_minutes').default(60).notNull(),
  parent: text('parent'), level: text('level'), goals: text('goals'), timeZone: text('time_zone'),
  openingBalanceMinutes: integer('opening_balance_minutes'),
  openingBalanceOn: date('opening_balance_on'),
  importKey: text('import_key').unique('students_import_key_uq'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
}, (t) => [
  index('students_status_idx').on(t.status),
  check('students_status_ck', sql`${t.status} in ('active', 'archived')`),
  check('students_archived_at_ck', sql`(${t.status} = 'archived') = (${t.archivedAt} is not null)`),
  check('students_rate_ck', sql`(${t.rateMinor} is null) = (${t.currency} is null) and (${t.rateMinor} is null or ${t.rateMinor} > 0)`),
  check('students_currency_ck', sql`${t.currency} is null or ${t.currency} ~ '^[A-Z]{3}$'`),
  check('students_lesson_minutes_ck', sql`${t.defaultLessonMinutes} between 15 and 240`),
  check('students_opening_ck', sql`(${t.openingBalanceMinutes} is null) = (${t.openingBalanceOn} is null)`),
  check('students_display_name_ck', sql`char_length(${t.displayName}) between 1 and 80`),
])
```
- `student_sections`: PK `(student_id, kind)` via `primaryKey({ columns: [...] })`, `kind` CHECK against the six values, `body text not null` with a length CHECK (≤ 50 000 chars; largest vault section is ~7.6 KB), FK `on delete cascade`.
- `student_terms`: `uuid` PK, `term` (1..200 chars; longest vault term 74), `note` (≤ 1000), unique `(student_id, lower(term))`, FK cascade.
- `payments`: `paid_on date not null`, `amount_minor integer not null check > 0`, `currency text` (CHECK format, plus Risk R1 rule), `lessons_count numeric(7,2)` CHECK `> 0`, `credited_minutes integer default 0 not null check >= 0`, CHECK `student_id is not null or (lessons_count is null and credited_minutes = 0)`, `source` CHECK `in ('manual','vault')`, `import_key text unique` (plain UNIQUE: NULLs are distinct, so "unique if set" holds and it can be an `ON CONFLICT` target without a predicate), FK `student_id → students on delete restrict`, index `(student_id, paid_on)`.
- Use plain `.unique()` for both `import_key` columns rather than a partial index: identical semantics for nullable columns, and a partial index would require repeating its `WHERE` in every `ON CONFLICT` clause.

### Pattern 2: `accounts.student_id` (ACCT-04)

```typescript
studentId: uuid('student_id').references(() => students.id, { onDelete: 'restrict' }),
// in the accounts extra-config array:
uniqueIndex('accounts_student_uq').on(table.studentId).where(sql`${table.studentId} is not null and ${table.status} = 'active'`),
check('accounts_student_role_ck', sql`${table.studentId} is null or ${table.role} = 'student'`),
```
- Generated SQL will be `ALTER TABLE "accounts" ADD COLUMN "student_id" uuid;` + `ADD CONSTRAINT … CHECK` + `CREATE UNIQUE INDEX … WHERE …` + `ADD CONSTRAINT … FOREIGN KEY`. Nullable column without default is a catalog-only change in PG; CHECK/FK validation scans the (tiny) table. Additive only → complies with the AGENTS.md release rule; phase-18 code keeps working because it selects explicit columns (`studentRowColumns`) and inserts without `student_id`.
- The thunk `() => students.id` resolves lazily, so declaration order inside `schema.ts` does not matter.
- `dvlab_dev` currently has 1 active student account and 1 teacher [VERIFIED: read-only query on dvlab_dev]; after the migration that account is "unlinked" and can be linked to a card from the UI — a ready manual test for criterion 5.

### Pattern 3: `packages/core` functions (pure, integer arithmetic)

Represent lessons as integer **hundredths** in code; convert to/from the `numeric(7,2)` string at the edges.

```typescript
export function currencyDigits(currency: string): number                         // new Intl.NumberFormat('en-US',{style:'currency',currency}).resolvedOptions().maximumFractionDigits
export function parseMoney(text: string, currency: string): number | null        // strip \s, U+00A0, U+202F, U+2009; one '.' or ',' decimal sep with ≤ digits decimals; → minor units; null if invalid or ≤ 0
export function formatMoney(amountMinor: number, currency: string): string       // Intl currency, currencyDisplay 'narrowSymbol', trailingZeroDisplay 'stripIfInteger'
export function minorToInput(amountMinor: number, currency: string): string      // '1234', '1234.5' for form prefill
export function parseLessons(text: string): number | null                         // → hundredths, 1..9_999_999, ≤ 2 decimals
export function hundredthsToDecimal(h: number): string                           // 125 → '1.25' (for numeric column)
export function decimalToHundredths(s: string): number                           // '1.25' → 125, string split, no float
export function suggestLessons(amountMinor: number, currency: string, rate: { rateMinor: number; currency: string } | null): number | null
                                                                                 // null if no rate, currency differs, rateMinor <= 0; else Math.round(amountMinor * 100 / rateMinor)
export function creditedMinutes(hundredths: number | null, lessonMinutes: number): number   // null → 0; Math.round(hundredths * lessonMinutes / 100)
export function lessonsToMinutes(hundredths: number, lessonMinutes: number): number         // opening balance, same rounding, may be negative
export function balanceMinutes(opening: { minutes: number; on: string } | null, payments: { paidOn: string; creditedMinutes: number }[]): number | null
                                                                                 // null when opening is null; else opening.minutes + Σ credited where paidOn > opening.on (string compare on YYYY-MM-DD)
export function formatLessons(minutes: number, lessonMinutes: number): string    // Intl 'en-US' maximumFractionDigits 2 of minutes / lessonMinutes → '1.5', '0.25', '-1.33'
```
Probed in Node 24.17: `maximumFractionDigits` is 2 for RUB and KZT, 0 for JPY/KRW/CLP/ISK/HUF/IDR/VND, 3 for BHD; `formatMoney` with `narrowSymbol` + `stripIfInteger` renders a whole RUB amount as `₽` + grouped digits with no decimals, a fractional one with two decimals, and KZT with `₸`; `maximumFractionDigits: 2` gives `1.5`, `0.25`, `2`, `-1.33`; `1.15 * 100` = `114.99999999999999` (why hundredths must be parsed from strings).

Package wiring (copy `packages/contracts`): `package.json` `{ "name": "@dv-lab/core", "private": true, "type": "module", "exports": { ".": "./src/index.ts" }, "scripts": { "typecheck": "tsc --noEmit" }, "devDependencies": { "typescript": "6.0.3" } }` (no `test` script — no tests); `tsconfig.json` extending `../../tsconfig.base.json` with `"lib": ["ES2023"]` — `Intl.supportedValuesOf` / `trailingZeroDisplay` need `"ES2023"` + DOM-free typing; if `tsc` complains about `trailingZeroDisplay`, add `"ES2023.Intl"` or `"esnext"` to `lib`. Relative imports use `.ts` extensions (`allowImportingTsExtensions`, `erasableSyntaxOnly` in `tsconfig.base.json` — no enums/namespaces). Consumers add `"@dv-lab/core": "workspace:*"` to `apps/api` and `apps/web`. Nothing to change in Dockerfiles (`turbo prune` follows workspace deps; `tsconfig.base.json` is copied explicitly) or tsdown (`deps.alwaysBundle: [/^@dv-lab\//]` already covers it [VERIFIED: apps/api/tsdown.config.ts:11]). Add to `knip.json` `"packages/core": { "entry": ["src/index.ts"], "project": ["src/**/*.ts"] }` and to CI "Web and api boundary" mirrored rules: no dependencies at all, no `pg`/`node:`/`@dv-lab/` imports, no `process.env` in `packages/core/src`.

### Pattern 4: Routes (teacher-only, same middleware chain)

`routes.use('*', noStore, requireSession(db), requireRole('teacher'))` as in the current `routes/students.ts` → students get 403 (D-27). Suggested surface:

| Method + path | Purpose |
|---|---|
| GET `/students` | card list rows (no section bodies, D-02) + `unassignedCount` |
| POST `/students` | create card |
| GET `/students/:id` | card detail + balance + account summary |
| PATCH `/students/:id` | edit fields |
| POST `/students/:id/archive`, `/restore` | status |
| PUT `/students/:id/opening-balance` | `{ lessons, on }` → minutes via core |
| PUT `/students/:id/sections/:kind` | `{ body }` (empty string stored, see R8) |
| GET/POST `/students/:id/terms`, PATCH/DELETE `/students/:id/terms/:termId` | vocabulary |
| GET/POST `/students/:id/payments`, DELETE `/payments/:id` | payments |
| GET `/payments/unassigned`, POST `/payments/:id/assign` | CARD-07 |
| GET `/students/:id/account/candidates` | active unlinked student accounts (for "link existing") |
| POST `/students/:id/account` | create account from card (login, optional password) |
| POST `/students/:id/account/link` | `{ accountId }` |
| POST `/students/:id/account/deactivate` | calls `deactivateStudent(accountId)` |

`apiRequest` accepts only `'GET' | 'POST'` [VERIFIED: apps/web/lib/api-client.ts:6] — extend the union with `'PUT' | 'PATCH' | 'DELETE'` (sameOrigin already guards every non-safe method). Every `:id` is parsed with `z.uuid()` → 404 like the current deactivate route.

### Pattern 5: 409 plumbing and race-safe writes

- Add codes to `errorCodes` in `packages/contracts/src/auth.ts` (current tail [VERIFIED: packages/contracts/src/auth.ts:51-59] `'not_found', 'login_taken', 'wrong_current_password', 'password_unchanged', 'locked', 'busy', 'unavailable', 'internal_error', ] as const`): `card_has_account`, `account_already_linked` (locked names), plus suggested `term_exists`, `payment_already_assigned`, `card_archived`. `errorBody(code, message)` is typed by this union, so the api will not compile with an unknown code.
- Detect unique violations with the existing `violatesUnique(error, constraint)` helper exported from `auth/accounts.ts` (walks `cause` 5 levels for `code === '23505'`).
- Create account from card: single `INSERT INTO accounts (…, student_id)`; 23505 on `accounts_student_uq` → `card_has_account`; on `accounts_active_login_uq` → `login_taken`. Display name = card name (truncate rule identical: both limited to 80 chars).
- Link: `UPDATE accounts SET student_id = $card, updated_at = now() WHERE id = $acc AND role = 'student' AND status = 'active' AND student_id IS NULL RETURNING id` → 0 rows: re-read to choose `account_already_linked` vs `not_found`; 23505 → `card_has_account`. No explicit locks needed; the index serialises concurrent links.
- Assign unassigned payment: in one tx read card (`default_lesson_minutes`, rate) then `UPDATE payments SET student_id, currency = coalesce(currency, $cur), lessons_count, credited_minutes WHERE id = $id AND student_id IS NULL RETURNING …`; 0 rows → `payment_already_assigned` (or 404).
- Record payment: same tx pattern; `credited_minutes = creditedMinutes(h, card.defaultLessonMinutes)` computed from the card row read in that tx (`SELECT … FOR SHARE` keeps a concurrent card edit from changing minutes mid-write).

### Pattern 6: Vault parser rules (derived from the Shape Catalogue)

1. Enumerate direct subdirectories of the given `students` dir (sorted); `import_key` = folder name. Ignore nested dirs and any file not listed below.
2. Strip frontmatter with `/^---\n[\s\S]*?\n---\n/` (all files LF, no BOM, no CR — verified).
3. `display_name` = first `# ` line of `<folder>/<folder>.md` if the file exists, else the folder name (trimmed, collapsed spaces, ≤ 80 chars). Status → always `active`.
4. Sections: map `General info`, `Interests and Hobbies`, `Level info`, `Goals and IELTS` **or** `Goals`, `Typical mistakes`, `Lesson ideas`. Body = file minus frontmatter, minus the first line if it is an H1, minus the trailing `## Links` heading and everything after it (R3); then wiki-link rewrite: `\[\[([^\]|]+)\|([^\]]+)\]\]` → `$2`; `\[\[([^\]]+)\]\]` → last path segment of `$1` without `#anchor`; `![[…]]` embeds (none today) → drop. Trim; skip empty.
5. Rate: line matching `^- Listed rate:\s*(?:(KZT|RUB)\s+)?([\d][\d\s.,]*?)\s*(₽|KZT|RUB)?\s*/\s*(\d+)\s*min` → currency (₽→RUB), amount (strip spaces; treat `,` followed by exactly 3 digits as a group separator), minutes. Any other form → no rate (warn).
6. Payments: in `Payments.md` take every markdown table whose header row contains `Date`, `Amount` and `Currency`; ignore all other tables. Note column = `Note`, else `Covers`, else empty. Currency cell: `₽`/`RUB` → RUB, `KZT` → KZT, `not specified`/empty → null. Amount cell: digits with spaces; `—`/empty → skip row with a stderr warning. Date must match `^\d{4}-\d{2}-\d{2}$` else skip+warn.
7. `Unmatched transfers.md` (sibling of folders): same table rule; header `Date | Sender / label | Amount | Currency | Status`; note = `Sender / label` + ` — ` + `Status`; `student` = null; key prefix `unmatched`.
8. Payment `import_key` = `sha256(studentKey | paid_on | amount_minor | currency or '' | ordinal)` hex, ordinal = count of earlier rows in the same file with equal (date, amount, currency) (D-15). Computed in `apply`'s sibling module with `node:crypto` (core has no Node API).
9. Vocabulary (`Learnt vocabulary.md`): see the rules in Shape Catalogue §Vocabulary; strip `**` and backticks, dedupe by `lower(term)` keeping the first non-empty note.
10. stderr summary: students, sections, terms, payments (with/without currency), unmatched, skipped rows with reasons. Folder names may appear in `parse` stderr (owner's terminal only); `apply` must print counts only.

### Pattern 7: Idempotent apply

- Validate stdin JSON with a zod packet schema (`version: 1`).
- One transaction for the whole packet (25 students, ~850 rows — milliseconds) with `select pg_advisory_xact_lock(hashtext('dvlab_import_vault'))`, mirroring `createTeacher` [VERIFIED: apps/api/src/auth/accounts.ts:55 uses `hashtext('dvlab_bootstrap_teacher')`]. A failure leaves nothing half-applied; a concurrent second run waits and then inserts 0.
- Per student: `insert(students).values(…).onConflictDoNothing({ target: students.importKey }).returning({ id })`; if empty, `select id where import_key = …` (existing card, nothing overwritten). Then sections/terms/payments with target-less `.onConflictDoNothing().returning({ … })`; `inserted = returned.length`, `skipped = attempted - inserted`.
- Imported payments: `source='vault'`, `lessons_count` null, `credited_minutes` 0 (STATE blocker: "lessons covered: to calculate").
- Runs under `dvlab_app`: default privileges give it `arwd` on tables created by `dvlab_migrator` [VERIFIED: deploy/postgres/ensure-db.sql:33 `ALTER DEFAULT PRIVILEGES FOR ROLE dvlab_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dvlab_app;`; confirmed on dvlab_dev: `pg_default_acl` shows `dvlab_app=arwd/dvlab_migrator`, TRUNCATE false, DELETE true].
- CLI shape (mirror `bootstrap-teacher.ts`): `parseArgs`, exit codes 0/1/2, `createDb(resolveDatabaseUrl('app', process.env))` only in `apply`, `pool.end()` in `finally`, `postgresCode()` for error output without data.
- tsdown: add `'import-vault': 'src/import-vault.ts'` to `entry`; knip: add `src/import-vault.ts` to `apps/api.entry` [VERIFIED: knip.json:26 `"entry": ["src/server.ts", "src/migrate.ts", "src/bootstrap-teacher.ts"]`].
- compose: new service copied from `bootstrap` [VERIFIED: deploy/compose.yaml:87-98 `bootstrap:` uses `profiles: ['tools']`, `restart: 'no'`, `entrypoint: ['node', 'apps/api/dist/bootstrap-teacher.mjs']`, `DATABASE_URL: postgresql://dvlab_app:${APP_PASSWORD:?}@db:5432/dvlab`] with `entrypoint: ['node', 'apps/api/dist/import-vault.mjs', 'apply']`. RUNBOOK command: `dc --profile tools run --rm -T import < /path/packet.json` (the RUNBOOK already uses `dc --profile tools run --rm -T migrate`), then `shred -u` the packet.
- Local: `node apps/api/src/import-vault.ts parse /Volumes/T7/personal/vault/md/personal/vika/students > ~/dvlab-vault-import.json` and `node --env-file=.env apps/api/src/import-vault.ts apply < ~/dvlab-vault-import.json` (Node 24 type stripping; symlinked workspace sources resolve to real paths outside `node_modules`, the same way `yarn workspace @dv-lab/api dev` runs `src/server.ts`).
- Ignore masks: add e.g. `*.vault-import.json` to `.gitignore` and `.dockerignore` and tell the owner to write the packet outside the repo anyway.

### Call sites that change when `/students` switches from accounts to cards

From `git grep` of `StudentRow|StudentListResponse|createStudentRequest|CreateStudentResponse|DeactivateStudentResponse|listStudents|createStudent|deactivateStudent|toStudentRow|studentRowColumns|/students` over `apps` and `packages`:

| File | Change |
|---|---|
| `apps/api/src/app.ts:67` (`app.route('/students', studentRoutes({ db: deps.db }))`) | mount rewritten card routes; add `app.route('/payments', …)` |
| `apps/api/src/routes/students.ts` | rewrite for cards; old `POST /` (create account) and `POST /:id/deactivate` (account id) removed, replaced by `/students/:id/account*` |
| `apps/api/src/auth/accounts.ts` | `createStudent` gains `studentId` (insert with link, maps `accounts_student_uq` → `card_has_account`); new `linkStudentAccount`, `listUnlinkedStudentAccounts`; `listStudents` loses its only caller → delete or repurpose (knip flags unused exports across files); `deactivateStudent` reused |
| `apps/api/src/auth/account-rows.ts` | `studentRowColumns` / `toStudentRow` become the card's account summary (add `studentId` if needed) |
| `packages/contracts/src/auth.ts` | `StudentRow`, `StudentListResponse`, `CreateStudentResponse`, `DeactivateStudentResponse` retyped or replaced by card types in a new `students.ts`; `errorCodes` extended |
| `packages/contracts/test/auth.test.ts` | update the exact `errorCodes` list; keep or remove `createStudentRequest` tests together with the export (Pitfall 11) |
| `apps/web/app/(app)/students/_components/students-screen.tsx` | replaced by the card list (Active / Archived / Unassigned payments) |
| `apps/web/app/(app)/students/_components/create-student-dialog.tsx` | becomes "Create account" inside the profile (login + optional password, name from card); one-time password reveal kept |
| `apps/web/app/(app)/students/_components/deactivate-student-dialog.tsx` | moves to the profile Overview, calls `/students/:id/account/deactivate` |
| `apps/web/lib/api-client.ts:6` | method union + `PUT`/`PATCH`/`DELETE` |
| `apps/web/app/(app)/_components/sections.ts`, `command-palette.tsx`, `app-sidebar.tsx`, `apps/web/proxy.ts`, `lib/session.ts` | no change (path `/students` unchanged; `requireTeacherPage` reused for `/students/[id]`) |

### UI components for D-21..D-27

| Need | Status | Source |
|---|---|---|
| Tabs, Table, Dialog, Tooltip, Button, Input, Badge, Banner, Skeleton (`SkeletonTable`, `SkeletonProfileHeader`), ScrollArea, DropdownSearch | available in `apps/web/components/ui` | — |
| PageHeader, PageScroll, Panel, EmptyLine, ReadError, Avatar, TextField, PasswordField | available in `apps/web/components/app` | — |
| Toast | available: `useToast` in `app/(app)/_components/toasts.tsx` | — |
| Select (currency, lesson minutes, time zone) | missing | design-lab `src/components/ui/select.tsx` (Base UI `@base-ui/react/select`) |
| Combobox (student picker for Assign, time zone search) | missing | design-lab `src/components/ui/combobox.tsx` (needs `hooks/use-keyboard-nav-gate`) |
| Textarea (section editor, notes) | missing | design-lab `src/components/lab/a/ui/textarea.tsx` |
| Popover + Calendar → DateField (`paid_on`, opening "as of") | missing | design-lab `components/lab/a/ui/{popover,calendar}.tsx` + `app/lab/a/_components/date-field.tsx` (react-day-picker) |
| Payment dialog layout | reference | design-lab `app/lab/a/_components/payment-dialog.tsx` (Select student, amount, date, lessons, note) |
| Student profile layout | reference | design-lab `app/lab/a/_components/student-view.tsx`, `students-view.tsx` |
| Markdown view | missing | `react-markdown` + copied `.typeset` CSS |
| Base UI `Field` / `NumberField` | not copied in variant A; not needed (TextField + parse in core) | — |

Anything not in these sources (e.g. vocabulary row editor, unassigned-payment row) = "ask Design dude" step (D-25).

### Anti-Patterns to Avoid

- Computing balance with `sum()` in SQL and also in core — two rule copies. Fetch `(student_id, paid_on, credited_minutes)` rows (hundreds at most) and fold with `balanceMinutes`.
- `parseFloat(lessons) * 100`, `Number(amount) * 100` — float drift (Pitfall 7).
- Deleting a section row when the teacher clears it — a later re-import would resurrect vault text (R8).
- Identifying payment tables by section heading — 4 lesson-log tables live next to them.
- Printing names/amounts from `apply` — container logs.
- `new Date().toISOString().slice(0, 10)` for "today" — UTC date, wrong for N hours a day in a UTC+N zone.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering / sanitising | regex → HTML, `dangerouslySetInnerHTML` | `react-markdown` 10.1.0 + `remark-gfm` 4.0.1, `skipHtml` | XSS-safe defaults, GFM tables used by 17 vault section files |
| Markdown typography | new prose CSS | copied variant-A `.typeset` block | design fidelity rule |
| Currency formatting / minor digits | symbol tables | `Intl.NumberFormat` (+ allow-list R7) | D-07 |
| Student / currency / time-zone pickers | custom listbox | copied variant-A `select.tsx` / `combobox.tsx` (Base UI 1.8.0) | a11y, keyboard, design |
| Date picker | custom calendar | variant-A `DateField` (Popover + Calendar, react-day-picker 10.0.1) | design source has it |
| Unique-violation detection | string matching on messages | `violatesUnique()` in `auth/accounts.ts` | already walks `cause` chain |
| Concurrency on link/assign | SELECT-then-UPDATE in app code | conditional UPDATE + unique index | race-free without locks |
| Import idempotency | pre-SELECT existence checks | `ON CONFLICT DO NOTHING … RETURNING` | atomic, gives inserted counts |
| Payment key hashing | custom hash | `node:crypto` `createHash('sha256')` | D-15 |

## Shape Catalogue (vault data, counts only)

Students are numbered #1..#25 by alphabetical folder order (`ls` order of `/Volumes/T7/personal/vault/md/personal/vika/students/`). No names, amounts or note text appear here by design. All files are UTF-8, LF line endings, no BOM; **no** U+00A0, U+202F, U+2009, U+2007 or U+200B anywhere in the 25 folders or the four root files (scanned) — amounts use plain ASCII spaces. The parser still strips those characters for teacher input.

### Folder composition

| Shape | Count | Students |
|---|---|---|
| Full profile: main page `<folder>.md` + 6 section files + `Learnt vocabulary.md` + `Lesson history.md` | 11 | #3 #4 #6 #8 #9 #11 #13 #15 #20 #21 #24 |
| …of those, with `Payments.md` | 7 | #3 #4 #9 #11 #13 #20 #21 |
| …of those, without `Payments.md` | 4 | #6 #8 #15 #24 (#24 is the CARD-06 card) |
| Only `Payments.md` | 13 | #1 #2 #5 #7 #10 #12 #14 #16 #17 #18 #19 #23 #25 |
| `Payments.md` + `Lesson history.md`, no main page | 1 | #22 |
| Extra file `Vocabulary to learn <date>.md` (not imported) | 1 | #20 |
| Nested subfolders `assessments/`, `mistakes/`, `materials/` (6 files, not imported) | 3 | #4 #13 #20 |
| Folders without a main page → `display_name` = folder name | 14 | |

Root files: `Unmatched transfers.md` (imported), `Students Index.md`, `Payments Index.md`, `Teaching breaks.md` (not imported). Folder names include nickname-style suffixes (e.g. a relation word or a city) — the teacher may rename cards after import.

### Main page (11 files)

- Frontmatter keys: `type: student-index`, `student`, `status`, `tags`, `created`, `updated`; one file also has `aliases`.
- `status`: `active` in 11 of 11 (no `to-learn`, no empty values observed).
- Exactly one H1, equal to the folder name, in 11 of 11.

### Section files (66 = 11 × 6)

| Shape | Count |
|---|---|
| `General info.md`, `Interests and Hobbies.md`, `Level info.md`, `Typical mistakes.md`, `Lesson ideas.md` | 11 each |
| Goals file named `Goals and IELTS.md` | 5 |
| Goals file named `Goals.md` (not in D-18's mapping) | 6 |
| Frontmatter present (keys `type`, `student`, `tags`, `created`, `updated`) | 66 / 66 |
| Exactly one H1, first line after frontmatter, equal to the section name | 66 / 66 |
| Last `##` heading is `## Links` containing only `- [[…]]` bullets (203 bullets total) | 66 / 66 |
| Wiki-links outside the Links block (alias form `[[target|label]]`, to nested docs) | 14 |
| Wiki-links with a path prefix, `#anchor` or `![[embed]]` | 0 |
| Files containing GFM tables | 17 |
| Raw HTML tags, code fences, task lists | 0 |
| Empty bodies (also after dropping the H1 and the `## Links` block) | 0 — all 66 stay non-empty |
| Body size after parser rule 4 | ~150 to ~7 400 chars |

Common `##` headings: `Links` (66), `To clarify` (26), `Confirmed` (14), `Tracking table` (8), `Main goal` (8).

### Payments.md (21 files)

| Shape | Count |
|---|---|
| Frontmatter `type: student-payments`, `student`, `aliases`, `updated` (one file also `parent`) | 21 |
| Rate line `- Listed rate: N NNN ₽ / 60 min` (amount, space-grouped, then `₽`) | 17 |
| Rate line `- Listed rate: KZT N,NNN / 60 min` (currency first, comma-grouped) | 2 |
| No `Listed rate` line (one says the rate is "not provided", one describes a package price in prose) | 2 (#4, #21) |
| Lesson length in rate lines | 60 min in 19 / 19 |
| Sentence "No bank transfers were included …" and no payment table | 5 |
| Payment tables with header `Date | Amount | Currency | Note` | 15 |
| Payment table with header `Date | Amount | Currency | Covers` | 1 (#13) |
| Non-payment tables `Date | Duration` / `Date | Duration | Running total …` (lesson logs) | 4 (in #4 and #13) |
| Payment tables under `## Bank transfers` / `## Bank transfers / payment markers` / `### Bank transfer` | 14 / 1 / 1 |
| Files with at least one payment row | 16 |
| Payment rows total | 29 |
| Date cells `YYYY-MM-DD` | 29 / 29 (no yearless dates; those exist only in `Payments Index.md`) |
| Amount cells `NN NNN` / `N NNN` / `—` (no amount) | 19 / 9 / 1 (#7) |
| Currency cells `₽` / `not specified` / `KZT` | 25 / 4 (#4 ×1, #21 ×3) / 0 |
| Same date + amount + currency twice in one file | 0 |
| `- Status:` lines: "active unless updated later" / "active" / "stopped lessons" / none | 18 / 1 / 1 (#16) / 1 |
| Notes naming the teacher (the CARD-06 name) | most rows; matching is by folder only (D-16) |

Expected import result: 28 student payments (29 rows minus the amount-less one) of which 4 have null currency, plus 1 unmatched payment (null currency) = 29 `payments` rows. 19 cards get a rate (17 RUB, 2 KZT, all 60 min); 6 cards have no rate (#4, #21, and the 4 without `Payments.md`).

### Unmatched transfers.md

Frontmatter `type: payment-reconciliation`; one table `Date | Sender / label | Amount | Currency | Status` with 1 row (currency `not specified`); a `## Rule` paragraph (ignored).

### Learnt vocabulary.md (11 files)

| Shape | Count |
|---|---|
| Files with real vocabulary | 7 (#3 #4 #8 #9 #13 #20 #21) |
| Files with only placeholders and topic lists (0 terms) | 4 (#6 #11 #15 #24) |
| Distinct table header sets | 18 |
| `Item | Meaning/use | Example prompt | Status` (the only D-19 form) | 1 table |
| `Word or phrase | Russian meaning | Usage note` | 1 table (21 rows) |
| Correction tables `Original… | Stored form / Preferred form | Note` (first column is the **wrong** form) | 4 tables |
| Lexical-range table `Basic phrase | More precise option | <student>'s example | Mastered?` | 1 table |
| Tracking tables `Date | Word or chunk / Word/chunk | Topic… | <student>'s example | Recycled on | Independent use?` | 11 (one per file); 10 hold only a placeholder row of `—` cells, 1 (#8) has 2 real rows |
| Bullets total | ~950, all top-level (no nested lists) |
| Bullets of the form `- **term**` or `- **term** — note` | ~480 (#4 #9 #13 #20) |
| Plain bullets `- term` / `- term — note` | ~470 |
| Correction bullets `` - `wrong` → **right** `` | 20 (#4) |
| Bullets with `[[wiki-links]]` (Links blocks) | 40 |
| H2/H3 group headings (vocabulary groups, dropped per D-19) | 3-30 per file |

Non-vocabulary bullet lists appear under these headings (deny-list, case-insensitive): `Links`, `Status`, `Recycling guidance`, `Teaching note`, `Teaching priorities`, `Useful future clusters`, `Vocabulary log template`, `Tracking table`, `Suggested tracking`, `Vocabulary tracking`. Revision/lesson-ready cluster bullets repeat bank terms and collapse on dedupe.

Parser rules that reproduce ~760 unique terms (prototype: per-file 180 / 188 / 0 / 8 / 99 / 0 / 91 / 0 / 146 / 51 / 0; longest term 74 chars; ~66 with notes):
- Table term column = first header among `Item`, `Word or phrase`, `Word or chunk`, `Word/chunk`, `Preferred form`, `Stored form`, `More precise option`; note column = first among `Meaning/use`, `Russian meaning`, `Checked meaning`, `Note`, `Usage note`. Tables without a term column are ignored. Rows whose term cell is empty or `—` are skipped.
- Bullet under a non-denied heading: if it contains `→`, term = first `**bold**` after the arrow; else split on the first ` — ` / ` – ` into term and note. Skip bullets containing `[[`.
- Clean: remove `**` and backticks, trim, drop trailing `;`. Dedupe by `lower(term)`; keep the first note that is non-empty.

## Common Pitfalls

### Pitfall 1: `paid_on` / "today" time zones
**What goes wrong:** a payment recorded shortly after local midnight in a UTC+N zone gets yesterday's date. **Why:** `toISOString()` is UTC; `mode: 'date'` columns convert through `Date`. **Avoid:** keep `date()` in string mode; compute today in the browser with `new Intl.DateTimeFormat('en-CA').format(new Date())` (local `YYYY-MM-DD`); compare dates as strings. **Warning sign:** off-by-one dates near midnight.

### Pitfall 2: Number parsing "1 234", "9,999", "1 234,50"
**What goes wrong:** `Number('1 234')` is `NaN`; `"9,999"` read as 9.999. **Avoid:** in forms, whitespace (incl. U+00A0/U+202F/U+2009) is the only group separator and one `.`/`,` is the decimal separator with ≤ currency digits; the vault parser handles the KZT `N,NNN` rate form explicitly. Variant A's `parseNumber` (`text.replace(/[\s ]/g,"").replace(",",".")`) is the same idea.

### Pitfall 3: Wiki-link and scaffolding noise
Stripping links literally turns 66 `## Links` blocks into lists of bare file names; the H1 duplicates the tab title. Apply parser rule 4.

### Pitfall 4: `sum()` returns bigint → string
On `dvlab_dev`: `pg_typeof(sum(int))` = `bigint`, `pg_typeof(sum(numeric))` = `numeric`; node-postgres returns both as strings. Avoid SQL sums for balance (fold in core); for counts use `count(*)::int` or `.mapWith(Number)`.

### Pitfall 5: Re-import after teacher edits
`ON CONFLICT DO NOTHING` only protects rows that still exist: a payment, term or section the teacher deleted will be re-inserted by a second `apply`. **Avoid:** treat import as one-shot after the owner's acceptance; RUNBOOK says "re-run only expecting inserted 0"; store cleared sections as empty rows (R8). Renaming a vault folder creates a second card (key = folder name).

### Pitfall 6: Account/card link races
Two concurrent "create account" for one card: the second insert hits `accounts_student_uq` → 409 `card_has_account`. Linking one account to two cards concurrently: second conditional UPDATE matches 0 rows → `account_already_linked`. No advisory locks needed. Card name change does not rename the account's `display_name` (owned by accounts.ts) — show the card name in the UI.

### Pitfall 7: Rounding drift
`credited_minutes = round(hundredths × minutes / 100)`: with 60-minute lessons every 0.01 lesson = 0.6 min, so 0.33 → 20 min (displays 0.33), three × 0.33 → 60 min (displays 1, not 0.99); with 45-minute lessons 1.5 → 67.5 → 68 min (displays 1.51). Bound: ≤ 0.5 min per payment. Display is always derived from minutes ÷ the card's current `default_lesson_minutes`; changing that field later changes displayed lessons for the same minutes (by design of D-08/D-09).

### Pitfall 8: Opening-balance date semantics
Payments with `paid_on <= opening_balance_on` are ignored (D-10), so a payment recorded today on a card whose opening date is today does not change the balance. The form must show the D-10 hint and the payment dialog could warn when `paid_on <= opening_balance_on`. Opening balance may be negative (student owes lessons) — see Open Question 2.

### Pitfall 9: Time-zone list differs by runtime
Node 24's `Intl.supportedValuesOf('timeZone')` has 418 entries, excludes `UTC`, and V8 reports some zones under legacy alias names; browsers differ again. Validate on the api with `try { new Intl.DateTimeFormat('en-US', { timeZone }) }` (accepts any valid IANA name/alias) instead of list membership; the web picker lists `Intl.supportedValuesOf('timeZone')` plus an empty "Teacher's time zone" option.

### Pitfall 10: Unassigned payments must not credit
CHECK `student_id is not null or (lessons_count is null and credited_minutes = 0)`; assignment computes credit from the target card.

### Pitfall 11: Existing tests and knip break on contract changes
`packages/contracts/test/auth.test.ts:140-157` asserts the exact `errorCodes` array [VERIFIED: read this session] — adding codes requires updating that assertion (maintenance of an existing test, not a new test). The same file tests `createStudentRequest`; knip only scans `src/**`, so if routes stop using it, knip reports an unused export. Keep it alive by deriving the card-account schema from it (`createStudentRequest.omit({ displayName: true })`) or delete the export and its test block together.

### Pitfall 12: Copying design components drags dependencies
design-lab `components/ui/combobox.tsx` imports `@/hooks/use-keyboard-nav-gate` (absent from `apps/web/hooks`); `components/lab/a/ui/*.tsx` import `cn` from `"cn"` (must become `@/lib/utils`) and use a different `Button`/`buttonVariants` (`components/lab/a/ui/button.tsx`). Copied files go under `components/ui` (knip-ignored); any new `lib/`/`hooks/` file needs a `knip.json` ignore entry and the AGENTS.md "двенадцать файлов lib" line updated. Comments are stripped on copy (phase 18 D-24 practice); Russian strings (`ru` locale import in `date-field.tsx`) become English.

### Pitfall 13: Next 16 dynamic params
`app/(app)/students/[id]/page.tsx` receives `params` as a Promise (`const { id } = await params`); call `requireTeacherPage()` first, as `students/page.tsx` does.

## Risks to locked decisions

| # | Decision | Evidence | Recommendation (smallest change) |
|---|---|---|---|
| R1 | D-08 "currency empty only when student_id empty" | 4 payments inside student folders have currency `not specified` (#4, #21); neither card has a rate | Allow null `currency` on any payment whose `lessons_count` is null and `credited_minutes = 0` (CHECK `currency is not null or (lessons_count is null and credited_minutes = 0)`); UI shows "Currency not set"; the D-12 "set currency" step applies to these too (assign-like action restricted to filling a null currency). Do not invent RUB — the vault file says not to infer it |
| R2 | D-18 maps only `Goals and IELTS` | 6 of 11 profiles use `Goals.md` | Map both names to `goals` |
| R3 | D-18 "rest of markdown kept" | 66/66 files start with an H1 equal to the section name and end with a `## Links` block of wiki-links only | Drop the leading H1 and the trailing `## Links` block before link rewriting |
| R4 | D-19 table/bullet rule | 18 header sets, only 1 is `Item | Meaning/use`; correction tables put the wrong form first; instruction lists under 10 heading kinds; `**bold**` markers on ~480 bullets; `—` placeholder rows | Use the column map, deny-list, arrow rule and bold stripping in the Shape Catalogue; acceptance ≈ 760 terms |
| R5 | D-17 rate line `N ₽|KZT / M min` | 2 lines are `KZT N,NNN / 60 min`; one `Payments.md` says lessons stopped, but D-17 imports it as active; 1 row has no amount | Accept currency before or after the amount; leave status active (teacher archives in UI); skip the amount-less row with a stderr warning |
| R6 | D-04 partial unique index "по непустым значениям" | Phase 18 deactivation keeps the account row; with the literal index a deactivated account blocks the card forever (no unlink, D-04) | Index predicate `student_id is not null and status = 'active'`: a card has at most one *active* account; history kept |
| R7 | D-07 digits from `Intl` | CLDR (Intl) differs from ISO 4217 for some codes (HUF 0 vs 2, ISK, IDR, UZS) and engines may differ | Keep `Intl` but restrict `currency` to an allow-list in contracts (RUB, KZT, USD, EUR — all 2 digits everywhere) |
| R8 | D-02 "no row = empty section" | Deleting the row on clear lets a re-import resurrect vault text | On clear, upsert `body = ''`; readers treat `''` as empty |
| R9 | D-23 react-markdown vs variant A's own pipeline | Variant A renders with unified/remark-rehype + `.typeset` CSS | Keep react-markdown (locked); copy `.typeset` so output looks identical |
| R10 | D-25 date field | Variant A's `DateField` needs react-day-picker; 10.0.2 is SUS (too new) | Pin 10.0.1; fallback native date input only if Design dude says so |

## Code Examples

### Render a section
```tsx
// Source: react-markdown readme (Options: skipHtml, remarkPlugins, components)
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function SectionMarkdown({ body }: { body: string }) {
	return (
		<div className="note-content typeset">
			<Markdown remarkPlugins={[remarkGfm]} skipHtml components={{ table: (props) => <div className="my-6 w-full overflow-x-auto"><table {...props} className="my-0" /></div> }}>
				{body}
			</Markdown>
		</div>
	)
}
```
The `table` wrapper is the one variant A uses in `note-markdown.tsx`.

### Target-less idempotent insert with counts
```typescript
const inserted = await tx.insert(studentTerms).values(rows).onConflictDoNothing().returning({ id: studentTerms.id })
counts.terms.inserted += inserted.length
counts.terms.skipped += rows.length - inserted.length
```

### Conditional link
```typescript
const [row] = await db.update(accounts)
	.set({ studentId: cardId, updatedAt: sql`now()` })
	.where(and(eq(accounts.id, accountId), eq(accounts.role, 'student'), eq(accounts.status, 'active'), isNull(accounts.studentId)))
	.returning({ id: accounts.id })
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-markdown `className` prop | wrap in an element | v10.0.0 (2025-02-20) | wrapper `div` carries `.typeset` |
| Drizzle 0.x `date` → `Date` by default in some drivers | rc.4 default `string` mode, noop DATE parser in node-postgres | v1 rc | dates are strings end to end |
| `gen_random_uuid()` only | PG 18 adds `uuidv7()` | PG 18 | optional; not needed here |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Next 16.4 compiles TS from `packages/core` without `transpilePackages`, as it does for `packages/contracts` | Pattern 3 | web build fails; fix = check how contracts is resolved (it already works, so low risk) |
| A2 | `lib: ["ES2023"]` types include `trailingZeroDisplay` and `Intl.supportedValuesOf` in TS 6.0.3 | Pattern 3 | typecheck error; add `ES2023.Intl`/`esnext` lib |
| A3 | `docker compose run --rm -T` forwards host stdin to the container | Pattern 7 | apply reads nothing; the RUNBOOK already uses `-T` with stdin for `pg_restore`, so low risk |
| A4 | Term counts (~760) from a Python prototype match the TS parser within ±10 % | Shape Catalogue | acceptance threshold off; use parse stderr as the truth after review |
| A5 | design-lab `src/app/globals.css` lines 394-~1180 are self-contained `.typeset` rules | Standard Stack | missing tokens; copy any referenced variables too |
| A6 | Opening balance may be negative | Pitfall 8 | CHECK too strict/loose — Open Question 2 |

## Open Questions

1. **Null currency on 4 imported student payments (R1).** Recommended default: allow null currency for unaccounted payments and let the teacher set it via the assign-like action. Alternative: import them as unassigned (breaks D-16).
2. **Negative opening balance.** Recommended default: allow (student owes lessons); UI shows a minus sign.
3. **Index predicate for one account per card (R6).** Recommended default: active accounts only.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | api, parse, typecheck | yes | 24.17.0 local (images 24.21.0) | — |
| Yarn | install | yes | 4.18.1 (repo release) | — |
| node_modules in worktree | everything | **no** | — | run `yarn install` in the worktree first |
| PostgreSQL dev server | migrate, apply, SQL checks | yes | 18.6 (`dvlab_dev`, `dvlab_test`) | — |
| psql client | manual SQL | yes | 17.10 | — |
| Docker | `run --rm -T import` | no (local) | — | server-only step via Server guy; local apply runs with `node` |
| Vault folder | parse | yes | `/Volumes/T7/personal/vault/md/personal/vika/students/` | — |

## Manual verification recipe

Use `psql "$DATABASE_URL"` against `dvlab_dev` only; `:'key06'` = the CARD-06 folder name (passed with `-v key06=…`, not written into git).

1. **Criterion 1 (CARD-01/02/03):** browser `/students` → New student → fill all fields incl. rate/currency/minutes/time zone → profile shows them; edit, archive (moves to Archived), restore (back in Active); Notes tab: edit a section with a table and a link, view renders as variant-A typeset, raw `<script>` text is not rendered; Vocabulary: add a term, add the same term in another case → 409 message, edit note, delete. As a student account `curl -b 'cookie' http://localhost:4000/students` → 403.
2. **Criterion 2 (CARD-06):** run `parse` (stderr ≈ 25 students, 66 sections, ~760 terms, 28 payments + 1 unmatched, 1 skipped row) then `apply` twice; second run prints `inserted 0` for every table. SQL: `select count(*), count(distinct id) from students where import_key is not null;` → 25, 25. `select count(*) from student_sections;` → 66. `select count(*) from payments where source = 'vault';` → 29. `select count(*) from payments p join students s on s.id = p.student_id where s.import_key = :'key06';` → 0. Re-run: ids unchanged (`select id from students order by import_key` before/after diff empty).
3. **Criterion 3 (CARD-07):** `select count(*) from payments where student_id is null;` → 1; UI Unassigned tab shows count 1 → Assign to a card, choose currency, optional lessons → row disappears, appears in that card's Payments; a second concurrent assign (two tabs) gets the 409 toast.
4. **Criterion 4 (LEDG-01/02):** on a card with rate R, enter amount = 2.5 × R → lessons prefilled `2.5`; change currency → prefill clears; save with 1.5 lessons → `select lessons_count, credited_minutes from payments order by created_at desc limit 1;` → `1.50`, `90` (60-min card); delete it with confirmation → gone.
5. **Criterion 5 (ACCT-04):** link the existing dev student account to card A → OK; link it to card B → 409 `account_already_linked`; create a new account from card A → 409 `card_has_account`; `select student_id, count(*) from accounts where student_id is not null and status = 'active' group by 1 having count(*) > 1;` → 0 rows; try `update accounts set student_id = … where role = 'teacher'` as migrator on `dvlab_dev` → CHECK violation.
6. **Criterion 6 (LEDG-09):** imported card shows "Set opening balance"; set 3 lessons as of today → shows `3`; record a payment dated today with 2 lessons → still `3` (D-10 hint visible); change the opening date to yesterday → `5`. SQL: `select opening_balance_minutes, opening_balance_on from students where id = …`.
7. **Release hygiene:** `git status` shows no packet file; `git grep -n -i -e 'vault-import' -- . ':!*.md' ':!.gitignore' ':!.dockerignore'` shows only code; `yarn typecheck && yarn lint && yarn test && yarn build && yarn knip` green; `yarn db:generate` leaves `packages/db/drizzle` unchanged.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no change | phase 18 sessions |
| V3 Session Management | no change | phase 18 |
| V4 Access Control | yes | `requireSession` + `requireRole('teacher')` on every card/payment/account route; web `requireTeacherPage` |
| V5 Input Validation | yes | zod schemas in contracts; DB CHECKs; uuid params via `z.uuid()` |
| V6 Cryptography | yes (hash only) | `node:crypto` sha256 for payment keys; scrypt untouched |
| V8 Data Protection | yes | packet outside repo + ignore masks; `apply` prints counts only; no student data in `.planning/` |

| Pattern | STRIDE | Mitigation |
|---------|--------|-----------|
| Stored XSS via markdown | Tampering | react-markdown escapes HTML, `skipHtml`, no `rehype-raw`, `defaultUrlTransform` |
| Student reading other students' cards/money | Information disclosure | teacher-only routes (D-27) |
| CSRF on new PUT/PATCH/DELETE | Tampering | existing `sameOrigin` middleware covers all non-safe methods |
| Student data leak through git/image/logs | Information disclosure | D-28 masks, `.dockerignore` already excludes `.env*` and `.planning`, counts-only output |

## Sources

### Primary (HIGH confidence)
- Repo files read this session: `packages/db/src/schema.ts`, `packages/db/drizzle/20261009150610_accounts/migration.sql`, `deploy/postgres/ensure-db.sql`, `deploy/compose.yaml`, `apps/api/src/{app,server,bootstrap-teacher}.ts`, `apps/api/src/auth/{accounts,account-rows,middleware}.ts`, `apps/api/src/routes/students.ts`, `apps/api/tsdown.config.ts`, `knip.json`, `turbo.json`, both Dockerfiles, `.github/workflows/ci.yml`, `packages/contracts/src/auth.ts`, `packages/contracts/test/auth.test.ts`, web students screen, `lib/api-client.ts`, `lib/session.ts`, `proxy.ts`, `globals.css`.
- Installed `drizzle-orm@1.0.0-rc.4` type and runtime files (numeric, date, uuid, bigint, indexes, insert, node-postgres session/codecs).
- Read-only queries on `dvlab_dev` (PG 18.6): tables, default ACLs, `uuidv7()`, aggregate types.
- All 25 vault folders and root files (local read-only scan with scratch scripts).
- npm registry + `gsd-tools package-legitimacy`: react-markdown, remark-gfm, react-day-picker, date-fns, @date-fns/tz, @base-ui/react exports.

### Secondary (MEDIUM confidence)
- react-markdown readme and changelog on GitHub.
- design-lab variant A sources: `payment-dialog.tsx`, `date-field.tsx`, `note-markdown.tsx`, `components/ui/{select,combobox}.tsx`, `components/lab/a/ui/{textarea,popover,calendar}.tsx`, `src/app/globals.css`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions from manifests and registry, legitimacy checked.
- Schema/Drizzle: HIGH — installed rc.4 types and dev DB probed.
- Vault shapes: HIGH for counts; MEDIUM for the vocabulary term total (prototype).
- UI reuse: MEDIUM — copy paths identified, not compiled.

**Research date:** 2026-10-10
**Valid until:** 2026-11-10 (vault content may change before the import is run; re-run `parse` and compare counts)
