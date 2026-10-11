# Phase 21: Lesson Accounting and Today - Research

**Researched:** 2026-10-10
**Domain:** учёт уроков (отметки, остаток), правило вхождений расписания, экран Today; Yarn 4 monorepo (Next 16, Hono, Drizzle v1 rc.4, `@dv-lab/core`, `@dv-lab/contracts`)
**Confidence:** HIGH по коду и схеме (всё прочитано в этой сессии), MEDIUM по UI (часть экранов ещё не нарисована в дизайн-системе v35)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Отметки уроков
- **D-01:** Отметка хранится отдельной таблицей `lesson_marks`: ключ вхождения = `series_id + original_on` либо `lesson_id` одиночного урока, `kind` = `done` | `no_show` | `none`, `updated_at`. Отмена и перенос остаются в расписании (`lesson_exceptions`, `lessons.status`), их схема не меняется. Исправление отметки меняет `kind` (в том числе на `none`), строки не удаляются (D-16 фазы 20). — **Reversibility:** one-way — таблица и ключ вхождения лягут в миграцию, их читают чат (фаза 22) и Google Calendar (фазы 24-25).
- **D-02:** Вычет считается при чтении по длительности вхождения (`occurrenceAt`), снимка минут нет: 60 минут = 1 урок, 90 = 1.5 (LEDG-03). Правка длительности и исправление отметки сразу меняют остаток на всех экранах (LEDG-06).
- **D-03:** Флаг `students.no_show_deducts boolean not null default true` — один на ученика (LEDG-04). Его выключение действует на все неявки ученика, прошлые тоже; остаток всегда функция текущих данных.
- **D-04:** Отметку можно ставить, когда урок уже начался (`starts_at <= now`); исправлять можно в любое время. Будущие уроки отметить нельзя.

#### Что считается остатком
- **D-05:** Урок вычитается, если его дата по Вьетнаму (`SCHEDULE_TIME_ZONE`) строго позже `opening_balance_on` ученика — та же граница, что у оплат (D-09 фазы 19). Уроки в день открытия остатка и раньше не считаются; до ввода открывающего остатка остаток «не задан».
- **D-06:** Остаток может уйти ниже нуля; он показывается как долг («-1.5», «owes 1.5 lessons»), не обрезается нулём.
- **D-07:** Отмена или перенос отмеченного урока: отметка остаётся в `lesson_marks`, вычет за этот момент не считается (LEDG-05); при Restore вычет возвращается вместе с уроком. Отмена не блокируется отметкой.

#### Today и «скоро платить»
- **D-08:** В «скоро платить» попадают активные ученики с остатком не больше N уроков, включая долг. Ученики с остатком «не задан» в список не входят (не равно нулю, D-09 фазы 19). Остаток в уроках = минуты / `default_lesson_minutes` ученика.
- **D-09:** Порог N хранится в базе на аккаунте учителя, меняется в Settings → General, по умолчанию 2 (LEDG-07). Чат фазы 22 читает те же данные. Таблицы настроек сегодня нет; место (колонка аккаунта или маленькая таблица) выбирает исследование.
- **D-10:** Счётчики Today: уроков сегодня, проведено, ждут отметки (прошедшие уроки без отметки), скоро платить.
- **D-11:** Отметки ставятся и исправляются в двух местах: быстрые кнопки в списке уроков Today и диалог урока в расписании; одна логика, два входа. Профиль ученика получит их в фазе 23.

#### Дизайн фазы 20 и дизайн-запросы
- **D-12:** Правки дизайна фазы 20 (пункты 1-18 из памяти `phase21-design-followups`, артефакт v35) идут двумя UI-планами до работы с отметками: (1) пункты 1-11 — подсказки, None, TimePair, токены текста, гаттер, тулбар, баг обрезки времени, фэйды; (2) пункты 12-18 — протяжка создания урока, метки зон, TimeZonePicker, избранные зоны. Диалог урока получает кнопки отметок после этих планов. Исходник пунктов: `phase21-design-followups`, `~/dv-lab-design/` (версию брать из `VERSION`).
- **D-12a:** Дизайн-системе v35 нужны от Design dude: экран Today dv-lab (счётчики, уроки дня с быстрыми Done / No-show, «скоро платить»), кнопки отметок в LessonDialog и EventTooltip, настройка N, флаг «неявка вычитает» в карточке ученика, DueList без срока и суммы (LEDG-07 считает уроки). Запросы уходят сессии «Design dude» сразу; UI-планы ждут ответа.

#### Архитектура (решения 21-ARCH-REVIEW.md)
- **D-13:** Находка 1 (в этой фазе): правило «что входит в остаток» переезжает в `packages/core`; SQL в `apps/api` отдаёт сырые строки (оплаты, отметки с длительностью), core решает; подпись формы `ledger-text.tsx` берёт правило из core. Отдельным планом до планов, которые трогают остаток.
- **D-14:** Находка 2 (в этой фазе): исход вхождения (запланирован, проведён, неявка, отменён, перенесён) определяет один владелец в core (на базе `occurrenceAt`); `rows.ts`, `changes.ts`, контракты и ветки web читают его, а не повторяют словарь.
- **D-15:** Находка 3 (в этой фазе): одна функция «сегодня» и границы даты в зоне Вьетнама вместо `localIsoDate` (зона браузера), `latestPaymentDate` (UTC) и `todayOf`.
- **D-16:** Находка 4 (в этой фазе, вместе с D-13): перевод минут в уроки и проверка порога N — функции core; клиент их не дублирует; `null` («не задан») отличается от нуля.
- Находка 5 (две одинаковые формулы минут): отложена, остаётся в 21-ARCH-REVIEW.md.

### Claude's Discretion
- Решения D-01..D-16 подтверждены владельцем явно, пунктов «по умолчанию, не просмотрено» нет.
- Имена колонок и таблицы настроек, формы API, раскладка Today и порядок планов выбирают исследование и планировщик в рамках решений выше; недостающий элемент дизайна запрашивается у «Design dude».

### Deferred Ideas (OUT OF SCOPE)
- Быстрые отметки и отмена из чата, ответы из данных — фаза 22.
- Профиль ученика с уроками и «Ask in chat», Today и расписание на телефоне — фаза 23.
- Синхронизация отметок с Google Calendar — фазы 24-25.
- Две одинаковые формулы минут (`creditedMinutes` и `lessonsToMinutes`) — находка 5, отложена.
- Начальные балансы владелец вводит сам после выката; импорт их не заполняет.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LEDG-03 | Marking a lesson done deducts its actual duration: a 60-minute lesson takes 1, a 90-minute lesson takes 1.5. | Таблица `lesson_marks` (§Схема), вычет при чтении по `occurrence.durationMinutes` через `deductedMinutes` в core (§Правило остатка), загрузка отметок `loadMarkRows` (§Загрузка) |
| LEDG-04 | Marking a no-show deducts the lesson duration by default, and this can be turned off per student. | `students.no_show_deducts` (§Схема), параметр `noShowDeducts` в `deductedMinutes`, поле в `saveStudentRequest`/`StudentDetail` (§API) |
| LEDG-05 | Marking a lesson cancelled or moved deducts nothing. | Исход `cancelled` не вычитает; отмена/возврат прошлых уроков разрешаются (Pitfall 1); призрак переноса не имеет своей отметки (Pitfall 3) |
| LEDG-06 | The teacher can correct any mark and the balance recomputes. | Upsert `kind` (включая `none`) под `lockSeries`/`lockLesson`; остаток — функция текущих строк, снимков нет; экраны перечитывают данные после мутации |
| LEDG-07 | The "pays soon" list shows students with at most N lessons left or none; N is a setting that defaults to 2. | `teacher_settings.pays_soon_lessons` (§Хранение N), предикат `paysSoon` в core, `GET/PATCH /settings`, `GET /today` |
| LEDG-08 | Every balance number comes from `packages/core` functions shared by forms and chat tools. | Находки 1, 3, 4: `balanceMinutes` получает сырые строки, `scheduleToday`/`scheduleDate`, `balancePhrase`, `paysSoon`; `cardFacts` — единственный вызывающий в api |
| SHELL-05 | The Today screen shows counters, today's lessons and the "pays soon" list from real data. | `GET /today` (новый модуль `apps/api/src/today`), `todayCounts` в core, экран `app/(app)/page.tsx` по дизайну Design dude (D-12a) |
</phase_requirements>

## Project Constraints (from CLAUDE.md и AGENTS.md)

- Код без комментариев; интерфейс на английском; ответы и документы на русском. [VERIFIED: ~/.claude/CLAUDE.md]
- Новых юнит-, интеграционных и e2e-тестов нет (решение владельца с фазы 18, `workflow.nyquist_validation: false`); приёмка — `typecheck`, `lint`, `build`, `knip`, разовые скрипты в `scripts/dev-checks/`, SQL и браузер ведущей сессией. Сломанный существующий тест править минимально. [VERIFIED: память feedback-no-new-tests-manual-check, .planning/config.json]
- Репозиторий публичный: имён, сумм и заметок учеников нет в коде, скриптах, `.planning/`, SUMMARY. Проверки на `dvlab_dev` используют только вымышленные карточки `Alex Example NNNN` и убирают их за собой. [VERIFIED: AGENTS.md, scripts/dev-checks/README.md]
- Приложение ничего не удаляет из данных расписания; у `dvlab_app` нет DELETE и TRUNCATE на таблицах расписания. Новая таблица отметок получает тот же отзыв. [VERIFIED: packages/db/drizzle/20261010103628_schedule_revoke_delete/migration.sql:1]
- Миграции только добавляют, генерируются `yarn db:generate`, руками не правятся, `drizzle-kit push` не используется; CI проверяет синхронность схемы и миграций. [VERIFIED: AGENTS.md, .github/workflows/ci.yml:130-138]
- `packages/core` без зависимостей, без `node:*`, `pg`, `@dv-lab/*`, `process.env`; web не импортирует api и db. Проверяет шаг CI `Web and api boundary`. [VERIFIED: AGENTS.md]
- Все мутации расписания в web идут через `mutate` из `schedule-mutations.ts`; клиентские запросы — только `apiRequest`. [VERIFIED: AGENTS.md]
- Дизайн: источник правды `~/dv-lab-design/` (версия `v35`, файл `VERSION`), читать `principles.md`, README и `preview.html` компонента, `tokens.css`; нет компонента или состояния — запрос Design dude, не придумывать. Версию записать в план. [VERIFIED: ./CLAUDE.md, ~/dv-lab-design/VERSION]
- Фэйд `scroll-fade`/`scroll-fade-x` на всех скроллерах; ошибка чтения экрана = один `ReadError` с Refresh. [VERIFIED: память scroll-fade-everywhere, design-system-everywhere]
- GSD в этом проекте работает полным циклом с коммитами в worktree `gsd/phase-21-*` (исключение из глобального правила «GSD не коммитит», память feedback-gsd-full-cycle-commits). Исследователь сам не коммитит.

## Summary

Фаза добавляет одну новую сущность (отметку вхождения) и переносит три правила в `packages/core`: что входит в остаток, какой исход у вхождения, какое «сегодня». Сегодня остаток считает SQL в `card-facts.ts` (фильтр `gt(payments.paidOn, students.openingBalanceOn)` и `gt(payments.creditedMinutes, 0)`), а core только суммирует (`balanceMinutes(openingMinutes, credited[])`). Правило вхождения уже живёт в core (`occurrenceAt`, `scheduleWindow`), но словарь исхода повторяется в `rows.ts`, `changes.ts`, контракте и четырёх файлах web, а смысл `moved` различается: у `Occurrence` это «сам урок на новом месте», у `ScheduleBlock` — «призрак на старом месте».

Главная нестыковка, которую надо снять в планах: критерий 3 («done → cancelled») и D-07 («отмена не блокируется отметкой») требуют отменять и возвращать уже начавшиеся уроки, а `refusal()` в `changes.ts` сейчас отвечает `lesson_in_past` на любую правку прошлого (фаза 20 D-05: «Прошедшие вхождения в этой фазе только смотреть… Отметки проведён и неявка добавляет фаза 21»). Рекомендация: разрешить cancel/restore для прошлого, оставить move только для будущего. Тогда «перенос отмеченного урока» структурно невозможен (отметка — после начала, перенос — до начала), и правило «перенесённый урок не вычитается» выполняется без нового поля.

Вторая нестыковка — критерий 5 говорит «covered by unit tests», а владелец запретил новые тесты. Рекомендация: приёмочный скрипт `scripts/dev-checks/ledger-core.mjs` по образцу `schedule-core.mjs` (импортирует исходники core напрямую под Node 24) и чтение критерия как «те же функции core на всех экранах». Нужна строка подтверждения владельца.

**Primary recommendation:** сначала углубить core (сегодня по Вьетнаму, правило остатка от сырых строк, исход вхождения с действиями), затем одной миграцией добавить `lesson_marks`, `students.no_show_deducts`, `teacher_settings` и отдельной custom-миграцией отозвать DELETE на `lesson_marks`; api отдаёт сырые строки, считает только core; web строит Today и кнопки отметок по ответу Design dude.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Правило остатка (граница даты, вычет, долг, null) | `packages/core` | — | LEDG-08, D-13: одно правило для форм, Today и чата фазы 22 |
| Исход вхождения и доступные действия | `packages/core` (`schedule.ts`) | api повторно проверяет в транзакции | D-14; клиент и сервер вызывают одну функцию |
| «Сегодня» и дата по Вьетнаму | `packages/core` (`zoned.ts`/`schedule.ts`) | — | D-15 |
| Хранение отметок, флага неявки, порога N | Database (`packages/db`) | — | D-01, D-03, D-09 |
| Запись отметки (блокировка, проверка, upsert) | API (`apps/api/src/schedule`) | core (проверка) | Мутации расписания принадлежат модулю `schedule`, транзакции с `FOR UPDATE` |
| Загрузка сырых строк для остатка | API (`schedule/rows.ts` для отметок, `cards/card-facts.ts` для оплат) | — | `cardFacts` — единственный владелец производных фактов карточки |
| Данные Today | API (новый модуль `apps/api/src/today`) | core (счётчики, порог) | Собирает `schedule` и `cards`; `schedule` не импортирует `cards` |
| Порог N (чтение/запись) | API (новый модуль `apps/api/src/settings`) | DB | Не смешивать с `auth/` |
| Экран Today, кнопки отметок, настройка N, флаг неявки | Browser (`apps/web`) | — | По дизайну v35 + ответам Design dude |

## Standard Stack

Новых библиотек фаза не добавляет. Используется то, что уже закреплено в репозитории.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm / drizzle-kit | 1.0.0-rc.4 | схема, запросы, `db:generate` (в т.ч. `--custom`) | закреплено в проекте [VERIFIED: packages/db/package.json, node_modules/drizzle-orm/package.json] |
| zod | 4.6.5 | схемы запросов в `@dv-lab/contracts` | закреплено [VERIFIED: packages/db/package.json] |
| hono | (как в apps/api) | маршруты api | закреплено [VERIFIED: apps/api/src/routes/*.ts] |
| Next 16, Base UI-копия варианта A | как в apps/web | экраны | закреплено, `radix-ui`/`cmdk` запрещены ESLint [VERIFIED: AGENTS.md] |

**Installation:** не требуется. В worktree нет `node_modules` (проверено `ls`): исполнителю нужен `yarn install` в корне worktree до `typecheck`.

## Package Legitimacy Audit

Не требуется: фаза не устанавливает внешних пакетов. Шаги research-plan seam и package-legitimacy check не выполнялись, потому что внешних вопросов о библиотеках нет; все факты получены чтением кода репозитория и дизайн-системы.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | новых пакетов нет |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Как устроено сегодня (точные файлы и сигнатуры)

### Остаток
- `packages/core/src/balance.ts:1-4` — единственная функция: [VERIFIED: packages/core/src/balance.ts:1-4]
  ```ts
  export function balanceMinutes(openingMinutes: number | null, credited: readonly number[]): number | null {
  	if (openingMinutes === null) return null
  	return credited.reduce((sum, minutes) => sum + minutes, openingMinutes)
  }
  ```
- `apps/api/src/cards/card-facts.ts:15-44` — `cardBalances` отбирает оплаты в SQL: `gt(payments.paidOn, students.openingBalanceOn)`, `gt(payments.creditedMinutes, 0)`, `isNotNull(students.openingBalanceOn)`; `cardFacts(executor, cards, now)` возвращает `CardFacts = { balanceMinutes: number | null; nextLessonAt: string | null }`. Вызывают: `cards.ts::toDetail` (`:34`), `cards.ts::listCards` (`:55`). [VERIFIED: apps/api/src/cards/card-facts.ts:9-68, apps/api/src/cards/cards.ts:33-64]
- `FactSource = Pick<CardRecord, 'id' | 'openingBalanceMinutes' | 'openingBalanceOn'>` — придётся расширить `noShowDeducts` (и `status`, `defaultLessonMinutes` для порога). [VERIFIED: card-facts.ts:13]
- `packages/core/src/lessons.ts`: `formatLessons(minutes, lessonMinutes)` (Intl, `signDisplay: 'negative'`, отрицательные уже печатаются как `-1.5`), `lessonsPhrase`, `creditedMinutes`, `lessonsToMinutes`, `localIsoDate(date)` (зона среды). [VERIFIED: packages/core/src/lessons.ts:44-70]
- web: `LessonsText` в `components/app/ledger-text.tsx:31-37`; `balanceCaption` повторяет правило `paidOn <= openingBalance.on` (`:79-88`). Показы остатка: `students-screen.tsx:116-119`, `student-profile.tsx:92-115` (`SummaryLine`), `opening-balance-panel.tsx:113-116`. [VERIFIED: grep + Read этих файлов]

### Вхождения
- `packages/core/src/schedule.ts` [VERIFIED: packages/core/src/schedule.ts:1-341]:
  - `export type BlockStatus = 'scheduled' | 'cancelled' | 'moved'` (`:33`);
  - `Occurrence = { key, ref, studentId, naturalStart, startsAt, durationMinutes, status: BlockStatus }` (`:46-54`); у `Occurrence` `status: 'moved'` значит «урок стоит на новом месте» (`:99-101`);
  - `ScheduleBlock` (`:35-44`) — вид для сетки; у блока `status: 'moved'` значит «призрак на старом месте» с `movedTo`, а блок на новом месте имеет `status: 'scheduled'`/`'cancelled'` и `movedFrom` (`:133-160`); у призрака и настоящего блока **один и тот же `key`**;
  - `occurrenceAt(rule, date, exception?)` (`:92-111`), `movedAway` (`:113-115`), `scheduleWindow({series, exceptions, lessons, from, to})` (`:123-177`), `nextLessons({..., now})` (`:201-235`), `overlaps` (`:239-251`, считает только `status === 'scheduled'`), `cutSeries` (`:288-321`), `endSeriesAt` (`:328-341`);
  - `const todayOf = (now: Date) => zonedParts(now, SCHEDULE_TIME_ZONE).date` (`:183`, не экспортируется);
  - `canChange(startsAt, now)` = `startsAt > now` (`:62-64`);
  - `occurrenceKey`: `` `l:${ref.lessonId}` `` / `` `s:${ref.seriesId}:${ref.originalOn}` `` (`:66-68`).
- `zonedParts(instant, zone).date` вызывается напрямую ещё в `changes.ts:64`, `schedule/schedule.ts:131`, `schedule-screen.tsx:95,108`. [VERIFIED: Read этих файлов]

### Загрузка строк и мутации
- `apps/api/src/schedule/rows.ts`: `seriesColumns`, `exceptionColumns`, `lessonColumns`, `toSeriesRule`, `toSeriesException`, `toSingleLesson`, `lockSeries`, `lockLesson`, `seriesException`, `seriesExceptionsFrom`, `readSnapshot(db, read)` (repeatable read, read only), `loadScheduleRows(executor, { from, to, studentIds? })`. [VERIFIED: apps/api/src/schedule/rows.ts:18-214]
- `apps/api/src/schedule/changes.ts`: `refusal(allowed, startsAt, expected, now)` возвращает `CHANGED` или `IN_PAST` (`:58-61`); `moveOccurrence`, `cancelOccurrence`, `restoreOccurrence`, `moveLesson`, `cancelLesson`, `restoreLesson`; upsert исключения `markException` через `onConflictDoUpdate({ target: [seriesId, originalOn], set: {..., updatedAt: sql\`now()\`} })` (`:82-107`). [VERIFIED: apps/api/src/schedule/changes.ts:33-233]
- `ChangeFailure` [VERIFIED: changes.ts:33-38]:
  ```ts
  | { kind: 'not_found' } | { kind: 'changed' } | { kind: 'invalid' } | { kind: 'in_past' } | { kind: 'target_in_past' }
  ```
- `apps/api/src/schedule/schedule.ts::toWireBlock` пишет `status: block.status` и `changeable: canChange(block.startsAt, now)` (`:67-84`); `readWeek(executor, monday, now)` (`:96-108`). [VERIFIED]
- `apps/api/src/schedule/series.ts`: `moveSeries`/`endSeries` вставляют перенесённые вхождения хвоста строками `lessons` (`:31-33`, `:53-55`) по `CutLesson = { studentId, startsAt, durationMinutes }` без исходной даты. [VERIFIED: series.ts:20-58, core schedule.ts:263]
- `apps/api/src/routes/schedule.ts`: `routes.use('*', noStore, requireSession(db), requireRole('teacher'))`; пути `/week`, `/lessons`, `/series/:id/occurrences/:originalOn/{move,cancel,restore}`, `/lessons/:id/{move,cancel,restore}`, `/series/:id/{move,end}`; `refused(c, failure)` отображает `in_past` → 400 `lesson_in_past`, `changed` → 409 `lesson_changed`. [VERIFIED: routes/schedule.ts:47-190]

### Контракты
- `packages/contracts/src/schedule.ts`: `ScheduleBlockStatus = 'scheduled' | 'cancelled' | 'moved'` (`:57`), `ScheduleBlock` с полями `key, ref, studentId, studentName, studentStatus, studentGoal, startsAt, durationMinutes, status, movedTo, movedFrom, changeable` (`:62-75`), `ScheduleOccurrence = { seriesId, originalOn, status, startsAt }` (`:101-106`), `lessonActionRequest = z.object({ expectedStartsAt })` (`:41-43`). [VERIFIED: packages/contracts/src/schedule.ts:41-110]
- `packages/contracts/src/students.ts`: `StudentRow = { id, displayName, status, rateMinor, currency, defaultLessonMinutes, balanceMinutes: number | null, nextLessonAt: string | null }` (`:139-148`), `StudentDetail` (`:152-160`), `saveStudentRequest` (`:82-93`, используется и для POST, и для PATCH целиком). [VERIFIED]
- Коды ошибок `errorCodes` в `packages/contracts/src/auth.ts:42-65`, в том числе `'lesson_changed'`, `'lesson_in_past'`, `'target_in_past'`, `'invalid_request'`, `'not_found'`, `'forbidden'`. Новые коды добавляются в этот массив. [VERIFIED: packages/contracts/src/auth.ts:42-65]

### Web
- Today — заглушка: `app/(app)/page.tsx` рендерит `PageHeader title="Today"` и `EmptyLine` только для учителя. [VERIFIED: apps/web/app/(app)/page.tsx:12-21]
- Разделы сайдбара: `today`, `chat`, `students`, `schedule`; страницы и пункта Settings нет. [VERIFIED: apps/web/app/(app)/_components/sections.ts:11-16]
- Читатели статуса блока: `lesson-block.tsx` (`blockSlot` `:13-15`, `DOT` `:24-28`, `LessonStatus` `:30-45`, `STATUS_CLASS` `:47-51`, `statusWord` `:79-84`), `event-tooltip.tsx:74,97`, `lesson-dialog.tsx:116-119,168,189`, `schedule-screen.tsx:168,274`, `lib/schedule-format.ts:156-165` (`weekSummary`). [VERIFIED: grep + Read]
- `lesson-dialog.tsx`: `live = block.changeable && canChange(start, now)` прячет Cancel/Restore у прошлых уроков; текст «This lesson has already taken place and cannot be changed.» (`:189-193`). [VERIFIED]
- Минутный «сейчас» для экрана: `useScheduleNow()` в `schedule-screen.tsx:56-77` (`useSyncExternalStore`, тик раз в минуту). Пригоден для Today. [VERIFIED]
- `localIsoDate` вызывается в `opening-balance-panel.tsx:38,140` и `record-payment-dialog.tsx:57`; `latestPaymentDate(now)` = UTC-дата + 1 сутки в `routes/payments.ts:34-38`, импортирован в `routes/students.ts:47,120`. [VERIFIED]

## Схема миграции

### `lesson_marks` (рекомендация)
```ts
export const lessonMarks = pgTable(
	'lesson_marks',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		seriesId: uuid('series_id').references(() => lessonSeries.id, { onDelete: 'restrict' }),
		originalOn: date('original_on'),
		lessonId: uuid('lesson_id').references(() => lessons.id, { onDelete: 'restrict' }),
		kind: text('kind').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex('lesson_marks_occurrence_uq').on(table.seriesId, table.originalOn),
		uniqueIndex('lesson_marks_lesson_uq').on(table.lessonId),
		check('lesson_marks_kind_ck', sql`${table.kind} in ('done', 'no_show', 'none')`),
		check(
			'lesson_marks_ref_ck',
			sql`(${table.seriesId} is null) = (${table.originalOn} is null) and (${table.seriesId} is null) <> (${table.lessonId} is null)`
		),
	]
)
```
- Конструкторы `pgTable`, `uuid`, `date`, `text`, `timestamp`, `uniqueIndex`, `check`, `sql` и стиль имён (`*_uq`, `*_ck`, FK `onDelete: 'restrict'`) взяты из текущей схемы. [VERIFIED: packages/db/src/schema.ts:1-16, 238-287]
- Уникальные индексы — обычные, не частичные: в Postgres NULL по умолчанию различаются, поэтому строки одиночных уроков (`series_id is null`) не конфликтуют по `(series_id, original_on)`, а строки серий — по `lesson_id`. Upsert пишется как у `markException`: `onConflictDoUpdate({ target: [lessonMarks.seriesId, lessonMarks.originalOn], set: { kind, updatedAt: sql\`now()\` } })` и `target: lessonMarks.lessonId` — без `targetWhere`. Альтернатива с частичными индексами (`.where(...)`, как `accounts_student_uq` в `schema.ts:39-41`) тоже поддержана: в drizzle 1.0.0-rc.4 есть `targetWhere?: SQL`. [VERIFIED: node_modules/drizzle-orm/pg-core/query-builders/insert.d.ts:87-90] Выбор: обычные индексы, меньше кода.
- `student_id` в отметку не денормализуется: студент берётся join'ом с `lesson_series`/`lessons` (колонки правила серии после вставки не меняются, AGENTS.md). [VERIFIED: AGENTS.md «Колонки правила серии после вставки не меняются»]
- `kind = 'none'` — явная «снятая» отметка (D-01); отсутствие строки и `none` в правиле означают одно и то же.

### `students.no_show_deducts`
`noShowDeducts: boolean('no_show_deducts').default(true).notNull()` — нужен импорт `boolean` из `drizzle-orm/pg-core` (сейчас его в списке импортов нет). [VERIFIED: schema.ts:2-16 — `boolean` не импортирован]

### Хранение порога N: таблица `teacher_settings`
```ts
export const teacherSettings = pgTable(
	'teacher_settings',
	{
		accountId: uuid('account_id').primaryKey().references(() => accounts.id, { onDelete: 'restrict' }),
		paysSoonLessons: integer('pays_soon_lessons').default(2).notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [check('teacher_settings_pays_soon_ck', sql`${table.paysSoonLessons} between 0 and 20`)]
)
```
Почему таблица, а не колонка `accounts`:
- Строки `accounts` в ответы api отображает только `auth/account-rows.ts`, учётными записями владеет `auth/accounts.ts`; колонка настроек в `accounts` втянула бы `auth/` в учёт уроков. [VERIFIED: AGENTS.md «Модули-владельцы»]
- В `accounts` лежат и ученики (`accounts_role_ck`: `'teacher', 'student'`), порог им не нужен. [VERIFIED: schema.ts:49]
- Впереди ещё настройки учителя (месячный бюджет чата CHAT-11 в фазе 22, Google Calendar в фазах 24-25) — им нужно одно место, а не колонки в таблице входа.
- Таблица ключом `account_id` остаётся «на аккаунте учителя» (D-09); учитель активный один (`accounts_one_active_teacher_uq`). [VERIFIED: schema.ts:46-48]
- `app_info` (`key text pk, value text`) не подходит: значение текстом без типа и CHECK, не привязано к аккаунту, сейчас используется только тестом ролей. [VERIFIED: schema.ts:18-22, packages/db/test/roles.test.ts:36-48]

Нет строки — действует значение по умолчанию из core (`PAYS_SOON_LESSONS_DEFAULT = 2`); запись — upsert по `account_id`. Диапазон `0..20` и целое N — `[ASSUMED]`, уточнить у Design dude вместе с видом поля.

### Две миграции
1. `yarn db:generate --name lesson_marks` (точное имя на усмотрение планировщика) — таблица `lesson_marks`, колонка `students.no_show_deducts`, таблица `teacher_settings`.
2. `yarn workspace @dv-lab/db db:generate --custom --name lesson_marks_revoke_delete` и в `migration.sql` одна строка:
   ```sql
   REVOKE DELETE, TRUNCATE ON "lesson_marks" FROM "dvlab_app";
   ```
   Прецедент: `db:generate --custom --name schedule_revoke_delete`, после него повторный `db:generate` — «No schema changes». [VERIFIED: .planning/phases/20-schedule/20-REVIEW-FIX.md:51] Нужна потому, что `ensure-db.sql` выдаёт DELETE на каждую новую таблицу по умолчанию: [VERIFIED: deploy/postgres/ensure-db.sql:33] `ALTER DEFAULT PRIVILEGES FOR ROLE dvlab_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dvlab_app;`
- CI шаг «Migrations are in sync with the schema» запускает `yarn db:generate` и падает на любых изменениях в `packages/db/drizzle`. [VERIFIED: .github/workflows/ci.yml:130-138]
- `scripts/dev-checks/schedule-db.mjs` ждёт ровно 5 папок миграций (`const EXPECTED_FOLDERS = 5`) и таблицы `['lesson_series', 'lesson_exceptions', 'lessons']` без DELETE: после фазы скрипт надо обновить (7 папок, `lesson_marks` в списке таблиц) или проверку новых таблиц вынести в новый скрипт. [VERIFIED: scripts/dev-checks/schedule-db.mjs:9-11,41]
- `teacher_settings` отзыв DELETE не нужен (не расписание), но приложение строки не удаляет.

## Правило остатка в core (D-13, D-15, D-16)

### «Сегодня» и дата по Вьетнаму
```ts
export function scheduleDate(instant: Date): string
export function scheduleToday(now: Date): string
```
Обе — `zonedParts(instant, SCHEDULE_TIME_ZONE).date`. Заменяют:
- приватный `todayOf` в `schedule.ts:183` и прямые `zonedParts(now, SCHEDULE_TIME_ZONE).date` в `changes.ts:64`, `schedule/schedule.ts:131`, `schedule-screen.tsx:108`;
- `localIsoDate` (удалить из `lessons.ts`, вызовы в `opening-balance-panel.tsx:38,140`, `record-payment-dialog.tsx:57`);
- `latestPaymentDate` (`routes/payments.ts:34-38`, `routes/students.ts:47,120`) → проверка `input.paidOn > scheduleToday(now)`.

Изменение поведения: `latestPaymentDate` пропускал дату до «UTC + 1 сутки», `scheduleToday` пропускает только сегодняшнюю дату по Вьетнаму. Это намеренно по D-15; учитель работает по времени Вьетнама. [VERIFIED: routes/payments.ts:34-38]

### Остаток
```ts
export type MarkKind = 'done' | 'no_show' | 'none'

export type BalanceCard = { openingMinutes: number | null; openingOn: string | null; noShowDeducts: boolean }
export type BalancePayment = { paidOn: string; creditedMinutes: number }
export type BalanceLesson = { startsAt: Date; durationMinutes: number; outcome: LessonOutcome }

export function countsAfterOpening(date: string, openingOn: string): boolean
export function deductedMinutes(outcome: LessonOutcome, durationMinutes: number, noShowDeducts: boolean): number
export function balanceMinutes(
	card: BalanceCard,
	payments: readonly BalancePayment[],
	lessons: readonly BalanceLesson[]
): number | null
```
- `openingMinutes === null || openingOn === null` → `null` («не задан», D-08/D-16).
- Оплата входит, если `countsAfterOpening(paidOn, openingOn)` (строго позже, D-09 фазы 19). Фильтр `credited_minutes > 0` в SQL убрать: нулевая оплата ничего не меняет (находка 5 называет его лишним).
- Урок входит, если `countsAfterOpening(scheduleDate(lesson.startsAt), openingOn)` — дата того места, где урок стоит сейчас (`occurrence.startsAt`, не `naturalStart`); ночной урок 00:30 VN относится к своей дате по Вьетнаму, а не к дате в Москве.
- `deductedMinutes`: `done` → `durationMinutes`; `no_show` → `noShowDeducts ? durationMinutes : 0`; остальные исходы → 0.
- Результат не обрезается нулём (D-06).
- `balanceCaption` в `ledger-text.tsx` вызывает `countsAfterOpening(paidOn, openingBalance.on)` вместо `paidOn <= openingBalance.on`.

### Уроки и порог (D-16)
```ts
export const PAYS_SOON_LESSONS_DEFAULT = 2
export function paysSoon(balance: number | null, lessonMinutes: number, threshold: number): boolean
export function paysSoonList<T extends { status: string; balanceMinutes: number | null; defaultLessonMinutes: number }>(
	cards: readonly T[],
	threshold: number
): T[]
export function balancePhrase(minutes: number, lessonMinutes: number): string
```
- `paysSoon`: `balance !== null && balance <= threshold * lessonMinutes` — сравнение в минутах, без деления с плавающей точкой.
- `paysSoonList`: только `status === 'active'`, сортировка по остатку в уроках по возрастанию (долг первым), затем по имени — порядок `[ASSUMED]`, подтвердить у Design dude вместе с DueList.
- `balancePhrase`: `minutes >= 0` → `"0.5 lessons left"` / `"1 lesson left"`; `minutes < 0` → `"owes 1.5 lessons"` / `"owes 1 lesson"` (D-06, DueList README: «owes 1 lesson»). Строится на `formatLessons` с модулем числа. [CITED: ~/dv-lab-design/project/components/DueList/README.md]
- `N` — в уроках (D-08), остаток в уроках = минуты / `default_lesson_minutes` карточки.

## Исход вхождения у одного владельца (D-14)

Схема расписания не меняется. В core `schedule.ts`:
```ts
export type LessonOutcome = 'planned' | 'done' | 'no_show' | 'cancelled' | 'moved'

export function lessonOutcome(status: BlockStatus, mark: MarkKind | null): LessonOutcome

export type LessonActions = { move: boolean; cancel: boolean; restore: boolean; mark: boolean }

export function lessonActions(outcome: LessonOutcome, startsAt: Date, now: Date): LessonActions

export function awaitsMark(outcome: LessonOutcome, startsAt: Date, now: Date): boolean
```
- `lessonOutcome`: `status === 'moved'` (призрак) → `'moved'`; `'cancelled'` → `'cancelled'`; `'scheduled'` → `done`/`no_show` по отметке, иначе `'planned'`. Для `Occurrence` (путь остатка) вход — `occurrence.status === 'cancelled' ? 'cancelled' : 'scheduled'`: `Occurrence` всегда «сам урок», призраком не бывает.
- `lessonActions`:
  - `move`: исход `planned` и `canChange(startsAt, now)` (как сейчас);
  - `cancel`: исход `planned`, `done` или `no_show` в любое время (D-07, критерий 3);
  - `restore`: исход `cancelled` в любое время;
  - `mark`: исход `planned`, `done` или `no_show` и `!canChange(startsAt, now)` (D-04: урок начался);
  - у `moved` (призрак) действий нет — действия у блока на новом месте с тем же ключом.
- `awaitsMark`: исход `planned` и урок начался.
- `scheduleWindow` получает необязательный `marks?: ReadonlyMap<string, MarkKind>` (ключ `occurrenceKey`) и кладёт в `ScheduleBlock` поле `outcome`; либо отдельная функция `withOutcomes(blocks, marks)`. Выбор планировщика; главное — словарь в одном месте.

Места, которые перейдут на владельца (сейчас повторяют словарь):
| Слой | Файл:строки | Что меняется |
|------|-------------|--------------|
| core | `schedule.ts:139,157,171,218,229,232,247,271` | внутренняя логика `status` остаётся, наружу — `outcome` |
| api | `schedule/schedule.ts:79,82` (`toWireBlock`) | `outcome`, `actions` вместо `status`, `changeable` |
| api | `schedule/changes.ts:58-61,121,146,173,206,219,229` | `refusal` спрашивает `lessonActions(...)`: cancel/restore без `IN_PAST`, move как сейчас |
| api | `schedule/changes.ts:103` (`ScheduleOccurrence.status`) | ответ мутации с `outcome` |
| contracts | `schedule.ts:57,71,74,104` | `ScheduleLessonOutcome`, `outcome`, `actions` |
| web | `lesson-block.tsx:13-15,24-51,76-84,119,123` | DOT, STATUS_CLASS, слова по исходу; `blockSlot` = `outcome === 'moved' ? 'from' : 'to'` |
| web | `event-tooltip.tsx:74,97` | слово статуса по исходу (Held и т.д.) |
| web | `lesson-dialog.tsx:116-119,168,189-193` | кнопки по `block.actions`, текст про прошлое только для move |
| web | `schedule-screen.tsx:168,274`, `lib/schedule-format.ts:156-165` | `weekSummary` и `OverlapBlock`: урок = исход `planned`/`done`/`no_show` |

Принцип дизайна уже задаёт вид: «a held lesson is dimmed to 60%, a cancelled one is outlined with a struck title, a moved one is dashed with an arrow to the new date»; слово в тултипе — «Held». Вид неявки (`no_show`) в дизайне не описан — запрос Design dude. [CITED: ~/dv-lab-design/project/principles.md (Open decisions), components/EventTooltip/README.md]

## Загрузка сырых строк

Остаток считается по отметкам, а не раскруткой окна от самой ранней даты открытия: O(отметок), 25 карточек.

`apps/api/src/schedule/rows.ts` (модуль `schedule` — единственный загрузчик строк расписания) получает:
```ts
export type MarkRow = { ref: OccurrenceRef; studentId: string; kind: MarkKind; occurrence: { startsAt: Date; durationMinutes: number; status: BlockStatus } | null }
export async function loadMarkRows(executor: DbExecutor, studentIds: readonly string[]): Promise<MarkRow[]>
export async function loadMarks(executor: DbExecutor, refs: readonly OccurrenceRef[]): Promise<Map<string, MarkKind>>
```
- `loadMarkRows`: один запрос `lesson_marks` left join `lesson_series` по `series_id`, left join `lesson_exceptions` по `(series_id, original_on)`, left join `lessons` по `lesson_id`, фильтр `coalesce(lesson_series.student_id, lessons.student_id) in (...)`. Серийная отметка разрешается через `occurrenceAt(toSeriesRule(...), originalOn, toSeriesException(...))`; если `occurrenceAt` вернул `null` (дата вне `[starts_on, ends_on]`), отметка не вычитается. Одиночная — через `toSingleLesson`.
- `loadMarks` — для окна недели и Today: отметки по ключам видимых блоков (`or(and(eq(seriesId), eq(originalOn)) ...)`, `inArray(lessonId)`).
- `cards/card-facts.ts::cardBalances` грузит оплаты без фильтра даты (`studentId in`, `paidOn`, `creditedMinutes`), вызывает `loadMarkRows`, передаёт всё в `balanceMinutes` core. `card-facts` уже импортирует `schedule/rows.ts`, обратного импорта нет. [VERIFIED: card-facts.ts:6]
- Все чтения — внутри `readSnapshot` (repeatable read), как `listCards` и `getCard` сейчас. [VERIFIED: routes/students.ts:72,84]

## API

| Маршрут | Модуль | Тело / ответ | Ошибки |
|---------|--------|--------------|--------|
| `POST /schedule/series/:id/occurrences/:originalOn/mark` | `routes/schedule.ts` + `schedule/marks.ts` | `{ kind: 'done' \| 'no_show' \| 'none', expectedStartsAt? }` → `{ mark: { ref, kind, outcome } }` | 404 `not_found`; 409 `lesson_changed` (устаревший `expectedStartsAt`, вхождение отменено для `done`/`no_show`, вхождения нет); 400 `lesson_not_started` (новый код, D-04) |
| `POST /schedule/lessons/:id/mark` | то же | то же | то же |
| `POST .../cancel`, `.../restore` (существующие) | `schedule/changes.ts` | без изменений формы | `lesson_in_past` больше не отдаётся cancel/restore |
| `GET /today` | новый `routes/today.ts` + `apps/api/src/today/today.ts` | `{ date, lessons: TodayLesson[], paysSoon: StudentRow[], paysSoonLessons }` | только `requireRole('teacher')` |
| `GET /settings`, `PATCH /settings` | новый `routes/settings.ts` + `apps/api/src/settings/settings.ts` | `{ paysSoonLessons }` | 400 `invalid_request` |
| `PATCH /students/:id` (существующий) | `cards/cards.ts` | `saveStudentRequest` + `noShowDeducts: boolean`; `StudentDetail.noShowDeducts` | без изменений |

- Все новые роуты: `routes.use('*', noStore, requireSession(db), requireRole('teacher'))`, конверт `errorBody(code, message)`, монтирование в `app.ts` рядом с `app.route('/schedule', ...)`. [VERIFIED: routes/schedule.ts:86, request-context.ts:60-62, app.ts:68-71]
- Id аккаунта для настроек — `c.get('session').account` (сессию кладёт `requireSession`). [VERIFIED: auth/middleware.ts:74-90]
- Запись отметки — транзакция: `lockSeries` + `seriesException` → `occurrenceAt` (как `lockOccurrence` в `changes.ts:71-80`) или `lockLesson`; проверка `lessonActions(...).mark` и `stale(expectedStartsAt)`; upsert. `kind: 'none'` разрешён и на отменённом уроке (снять отметку можно всегда, D-04 «исправлять в любое время»), `done`/`no_show` на отменённом — 409. Снято планом 21-04 (D3 ревью): `none` подчиняется тому же `actions.mark`, что `done` и `no_show` — на будущем уроке 400 `lesson_not_started`, на отменённом или перенесённом 409.
- `TodayLesson` = поля `ScheduleBlock` с `outcome` и `actions`; Today берёт `scheduleWindow` за `[zonedInstant(today,'00:00'), zonedInstant(addDays(today,1),'00:00'))` + `loadMarks` + `cardFacts` активных карточек + порог из `teacher_settings`.
- Счётчики (D-10) считает core `todayCounts(lessons, paysSoonCount, now)`: уроков сегодня = исход `planned`/`done`/`no_show`; проведено = `done`; ждут отметки = `awaitsMark`; скоро платить = длина списка. Web вызывает ту же функцию с минутным `now` (`useScheduleNow`), чтобы «ждут отметки» менялось без перезагрузки; это вызов core, не копия правила.
- `noShowDeducts` в `saveStudentRequest` ломает typecheck импорта: `importCard` собирает `cardValues({ ...card, parent: null, level: null, goals: null, timeZone: null })` из `Pick<SaveStudentInput, ...>`. Либо `cardValues` не пишет флаг (действует default базы), либо импорт передаёт `noShowDeducts: true`. [VERIFIED: apps/api/src/cards/cards.ts:16-31,123-131, apps/api/src/import/apply-packet.ts:38-44] Где переключатель на экране (форма карточки или профиль) решает дизайн; если вне формы — отдельный `PUT /students/:id/no-show-deducts`.
- Разрез и окончание серии (`series.ts`) переносят отметки: перенесённое вхождение хвоста становится строкой `lessons`, а его отметка на ключе `s:<series>:<original_on>` после этого не разрешается (`occurrenceAt` → `null`). Случай реален: вхождение со следующей недели перенесли на завтра, урок прошёл и отмечен, потом серию разрезали с даты до исходной. В `CutLesson` добавить исходную дату (`originalOn`), а `moveSeries`/`endSeries` после вставки `lessons` вставляют `lesson_marks` с `lesson_id` и тем же `kind`; старая строка остаётся как история. [VERIFIED: series.ts:31-33,53-55; core schedule.ts:263-279]

## Web

- Today (`app/(app)/page.tsx`) — клиентский экран по образцу `students-screen.tsx`: `ReadState` loading/error/ready, `ReadError`, `apiRequest('GET', '/today')`, после отметки — повторное чтение. Готовые части: `PageHeader`, `PageScroll`, `ReadError`, `EmptyLine`, `Skeleton*`, `TimePair`, `Avatar`, `Button`, `Banner`, `Elevated`. [VERIFIED: apps/web/components/*, students-screen.tsx:9-31]
- Нет в коде, есть в дизайн-системе: `Stat`, `LessonList`, `DueList`, `Switch`, `SettingsGeneral`, `TimeZonePicker`. [VERIFIED: ls ~/dv-lab-design/project/components]
- Нет в дизайне v35 (D-12a, ждать Design dude): экран Today dv-lab (лабораторный эталон `assets/Reference/light-today.png` показывает другие счётчики и денежные суммы; `TeacherHome` — главная IELTS), быстрые Done / No-show в строке `LessonList`, кнопки отметок и вид неявки в `LessonDialog`/`EventTooltip`, поле N в `SettingsGeneral`, флаг «no-show deducts» в карточке, `DueList` без срока и суммы, слово для неявки, подписи «owes»/«left», текст подсказки «As of» (сейчас «Payments dated on or before this date are already counted in the number.» — после фазы туда же относятся уроки). [VERIFIED: ~/dv-lab-design/project/components/{DueList,LessonList,Stat,SettingsGeneral,LessonDialog,EventTooltip}/README.md, principles.md]
- Глоссарий владельца: «Upcoming payments» (не «Pays soon»), «Lessons today», «Lessons left». Принцип LessonDialog: «Past lessons show "How did it go: Held or Cancelled"». [CITED: ~/dv-lab-design/project/principles.md, Copy glossary и Behaviour contracts]
- Кнопки отметок — один компонент для двух входов (D-11), вызов через `mutate(ref, 'mark', { kind, expectedStartsAt })`: расширить `LessonAction` до `'mark'` и `LessonBody` полем `kind` в `schedule-mutations.ts` (`pathOf` уже собирает путь по `action`, `mutate` шлёт `POST` — поэтому маршрут отметки `POST`, как cancel/restore/move; повтор безопасен, запись — upsert). [VERIFIED: schedule-mutations.ts:19-21,63] Today импортирует мутации из `../schedule/_components/schedule-mutations` (прецедент: `students-screen.tsx` импортирует `useSecondZone` из расписания). [VERIFIED: schedule-mutations.ts:19-67, students-screen.tsx:29]
- Страницы Settings нет. Пункт 18 памяти `phase21-design-followups` (второй UI-план) сам вводит `SettingsGeneral` с карточкой «Time zones» и `TimeZonePicker`; поле N добавляется в эту же страницу после ответа Design dude. Порядок: UI-план 2 создаёт `/settings` (строка Settings последней в сайдбаре, вкладка General), план отметок/Today добавляет карточку N. Вкладки Google Calendar и Assistant в этой фазе не строятся — как показать одну вкладку, спросить у Design dude. [VERIFIED: память phase21-design-followups п.18; CITED: SettingsGeneral/README.md]
- 18 пунктов D-12 не пересказываются здесь: источник — память `phase21-design-followups` и README компонентов v35.

## Рекомендуемый порядок планов

| Волна | План | Слои | Зависит от |
|-------|------|------|-----------|
| 1 | UI-1: пункты 1-11 (D-12) | web расписания | — |
| 1 | Core-1: `scheduleToday`/`scheduleDate`, правило остатка от сырых строк, `paysSoon`, `balancePhrase`, `countsAfterOpening`; `card-facts` отдаёт сырые оплаты; замена `localIsoDate`/`latestPaymentDate`/`todayOf`; `ledger-text` из core (D-13, D-15, D-16) | core, api cards, web students | — |
| 1 | DB: схема + custom REVOKE, `schedule-db.mjs` | db, scripts | — |
| 2 | UI-2: пункты 12-18, создаёт `/settings` General | web | UI-1 |
| 2 | Core-2 + API: исход вхождения и действия (D-14), контракт `outcome`/`actions`, cancel/restore прошлого, отметки (`marks.ts`, маршруты, перенос отметок при разрезе), `noShowDeducts`, `/settings`, `/today` | core, contracts, api | Core-1, DB |
| 3 | Web: читатели исхода, кнопки отметок в LessonDialog, Today, карточка N, флаг неявки | web | UI-2, Core-2, ответ Design dude |

Две части `lesson-block.tsx`/`event-tooltip.tsx`/`lesson-dialog.tsx` трогают и UI-1 (токены, тексты), и переход на `outcome` — поэтому web-часть исхода идёт после UI-1. Предел параллельности проекта — 3 агента. [VERIFIED: .planning/config.json `max_concurrent_agents: 3`]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Дата и «сегодня» по Вьетнаму | `new Date().toISOString().slice(0,10)`, `Intl` без зоны | `scheduleToday`/`scheduleDate` поверх `zonedParts` | ночные уроки и браузер не во Вьетнаме |
| Вхождение серии | разбор `lesson_exceptions` по `kind` | `occurrenceAt` | D-17 фазы 20: вхождение считается не по наличию строки |
| Upsert отметки | SELECT + INSERT/UPDATE | `onConflictDoUpdate` как `markException` | гонки, один запрос |
| Деление минут на уроки на клиенте | `minutes / lessonMinutes` в JSX | `formatLessons`, `balancePhrase`, `paysSoon` | D-16, null ≠ 0 |
| Даты в UI | ручной формат | `lib/schedule-format.ts`, `TimePair` | двойное время D-19 фазы 20 |

## Common Pitfalls

### Pitfall 1: отмена прошлого урока запрещена кодом фазы 20
**What goes wrong:** «done → cancelled» (критерий 3) отвечает 400 `lesson_in_past`, в диалоге нет кнопки Cancel у прошлого урока.
**Why it happens:** `refusal()` проверяет `canChange` для cancel/restore/move одинаково (`changes.ts:58-61`), `toWireBlock` пишет `changeable: canChange(...)`, диалог прячет действия по `live`. Фаза 20 D-05 закрыла прошлое до фазы 21.
**How to avoid:** cancel/restore спрашивают `lessonActions`; move остаётся будущим (`moveTarget` и так требует будущее время). Тексты «already taken place» и `lesson_in_past` — только у move.
**Warning signs:** скрипт `ledger-api.mjs` получает 400 на cancel прошлого вхождения.

### Pitfall 2: дата урока не по той зоне
**What goes wrong:** урок 00:30 VN 11 октября при `opening_balance_on = 2026-10-10` не вычитается (по Москве это 10 октября), либо вычитается урок дня открытия.
**How to avoid:** граница только через `scheduleDate(occurrence.startsAt)`; в web нет `localIsoDate`.
**Warning signs:** `ledger-core.mjs` кейс «ночной урок» падает.

### Pitfall 3: отметка на призраке переноса
**What goes wrong:** у перенесённого вхождения два блока с одним `key`; кнопки на призраке ставят отметку «старому месту», Today считает призрак в «ждут отметки».
**How to avoid:** исход призрака `moved`, `lessonActions` у него пуст, счётчики берут `planned/done/no_show`. API не знает о призраке: отметка по ref относится к вхождению на текущем месте. В списке Today React-ключ строки = `key` + слот (`from`/`to`), как `data-slot` в `lesson-block.tsx:110`, иначе две строки одного вхождения получат один ключ.

### Pitfall 4: потеря отметки при разрезе серии
См. §API, последний пункт: копировать отметку на новую строку `lessons`.

### Pitfall 5: «не задан» как ноль
**What goes wrong:** ученик без открывающего остатка попадает в «Upcoming payments» или показывает «0 lessons left».
**How to avoid:** `paysSoon(null, …) === false`; web показывает «Set opening balance» как сейчас.

### Pitfall 6: новые таблицы и проверки фазы 20
`schedule-db.mjs` ждёт 5 папок и не знает `lesson_marks`; CI sync упадёт, если custom-миграцию править после генерации снапшота. Генерировать по порядку: сначала схема, потом `--custom`, затем `yarn db:generate` должен ответить «No schema changes».

### Pitfall 7: `noShowDeducts` ломает импорт
См. §API: `importCard` → `cardValues`.

## Code Examples

```ts
// Source: apps/api/src/schedule/changes.ts:87-94 (образец upsert)
const [row] = await executor
	.insert(lessonExceptions)
	.values({ seriesId: exception.seriesId, originalOn: exception.originalOn, kind: exception.kind, ...time })
	.onConflictDoUpdate({
		target: [lessonExceptions.seriesId, lessonExceptions.originalOn],
		set: { kind: exception.kind, ...time, updatedAt: sql`now()` },
	})
	.returning(exceptionColumns)
```

```ts
// Source: apps/api/src/schedule/changes.ts:71-80 (образец блокировки вхождения)
async function lockOccurrence(executor: DbExecutor, seriesId: string, originalOn: string): Promise<LockedOccurrence | null> {
	const rule = await lockSeries(executor, seriesId)
	if (rule === null) return null
	const exception = await seriesException(executor, seriesId, originalOn)
	return { rule, occurrence: occurrenceAt(rule, originalOn, exception ?? undefined) }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SQL отбирает оплаты в остаток | core решает по сырым строкам | эта фаза | одно правило для чата фазы 22 |
| `status` + `changeable` в контракте блока | `outcome` + `actions` из core | эта фаза | новые исходы не размножаются по слоям |
| `localIsoDate`, `latestPaymentDate`, `todayOf` | `scheduleToday`/`scheduleDate` | эта фаза | одна граница даты |

**Deprecated:** `localIsoDate` (удаляется, `knip` найдёт неиспользуемый экспорт), `latestPaymentDate`.

## Риски

- **Часовые пояса.** Все даты — по `SCHEDULE_TIME_ZONE`; браузер может быть в Москве. Кейсы для скрипта: урок 00:30 VN, урок 23:30 VN, урок в день открытия, оплата в день открытия.
- **Производительность.** 25 карточек, отметок — сотни в год; один запрос отметок с join, один запрос оплат. `cardFacts` вызывается для списка, профиля и Today; `nextLessons` уже грузит окно «от сейчас». Индексы: уникальные индексы `lesson_marks` покрывают join по ключу; фильтр по студенту идёт через `lesson_series_student_idx` и `lessons_student_starts_idx`. [VERIFIED: schema.ts:229,283]
- **Согласованность экранов.** Список, профиль, Today и «Upcoming payments» берут `balanceMinutes` из `cardFacts` → core; Today не считает остаток сам. Экраны перечитывают данные после мутации; живого обновления между вкладками нет (это фаза 22).
- **Фаза 22.** Инструменты чата вызывают `cardFacts`, `paysSoonList`, `todayCounts` и маршрут/модуль отметок; «Undo» в чате = запись прежнего `kind` (строки не удаляются).
- **Фазы 24-25.** Ключ вхождения отметки = ключ события Google; при разрезе серии отметки уезжают на одиночные уроки вместе с перенесёнными вхождениями (тот же маппинг, что нужен событиям, AGENTS.md «Ключ вхождения стабилен только…»). Принцип «календарь — источник правды о проведённых уроках» (память schedule-google-calendar-style) пересечётся с `lesson_marks` в фазе 24 — сейчас не решается.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Порог N — целое число в диапазоне 0..20 | Хранение N | поле N в настройках другого вида (доли, иной предел) — правка CHECK отдельной миграцией |
| A2 | «Ждут отметки» (D-10) считает только сегодняшние начавшиеся уроки | API / Today | владелец хотел все прошлые без отметки после даты открытия — меняется запрос и подпись счётчика |
| A3 | Порядок «Upcoming payments»: по остатку по возрастанию, затем имя | Правило остатка | другой порядок в дизайне Today |
| A4 | Перенос начавшегося урока остаётся запрещён (move — только будущее). **Снято решением владельца 2026-10-10 (D-17, план 21-17):** перенос разрешён в любое время и на любую дату; снимок времени отметки не нужен — отметка принадлежит вхождению и едет с ним, вычет считается по новой дате | Pitfall 1 | если владелец хочет переносить прошедший урок, D-07 потребует снимка времени отметки в `lesson_marks` |
| A5 | Критерий 5 «covered by unit tests» читается как приёмочный скрипт core, без новых тестов | Приёмка | владелец ждёт настоящие юнит-тесты core — нужен тест-раннер в `packages/core` |
| A6 | `kind: 'none'` можно ставить и на отменённый урок, `done`/`no_show` на отменённый — 409. Снято планом 21-04 (D3 ревью): `none` подчиняется `actions.mark`, на отменённом — 409 | API | иная политика для отменённых отметок |
| A7 | D-02 «правка длительности» читается как «остаток следует за текущей длительностью вхождения»; маршрута правки длительности в фазе нет | Правило остатка | владелец ждёт правку длительности урока в этой фазе — новый маршрут и UI |

## Open Questions (RESOLVED)

1. **Критерий 5 и правило «без новых тестов».**
   - What we know: ROADMAP требует «covered by unit tests», память владельца запрещает новые тесты, у `packages/core` нет тест-раннера (`yarn test` идёт в db, contracts, api).
   - Recommendation: `scripts/dev-checks/ledger-core.mjs` (кейсы правила, сверка дат с SQL как в `schedule-core.mjs`); подтвердить у владельца одной строкой до плана приёмки.
   - RESOLVED: D-12h
2. **«Ждут отметки» — сегодня или вся история после открытия?** Рекомендация: сегодня (A2); спросить вместе с запросом Today у Design dude.
   - RESOLVED: D-12c / D-12m
3. **Settings с одной вкладкой.** SettingsGeneral описывает три вкладки; в фазе 21 есть только General. Спросить Design dude, как показать.
   - RESOLVED: D-12b
4. **Правка длительности (D-02).** Длительность задаётся только при создании (`createLessonRequest.durationMinutes`); `moveLessonRequest` = `{ date, startTime, expectedStartsAt }`, исключение `moved` копирует длительность вхождения. Входа «изменить длительность» в коде нет. [VERIFIED: packages/contracts/src/schedule.ts:27-39, apps/api/src/schedule/changes.ts:126-129] Рекомендация: правило остатка читает текущую `durationMinutes` вхождения (D-02 выполнен по построению), новый маршрут правки длительности в фазу не входит (A7).
   - RESOLVED: D-12j
5. **Где флаг «no-show deducts».** В форме карточки (тогда поле `saveStudentRequest`) или переключатель `Switch` в профиле (тогда отдельный маршрут). Ответ Design dude.
   - RESOLVED: форма карточки StudentForm v36 (`Switch` в форме ученика, поле `saveStudentRequest`), 21-UI-SPEC C4

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | всё | ✓ | v24.17.0 | — |
| Yarn | установка, скрипты | ✓ | 4.18.1 | — |
| `node_modules` в worktree | typecheck, build, скрипты | ✗ | — | `yarn install` в корне worktree (в основном репо есть) |
| dev-база `dvlab_dev` (домашний сервер) | приёмка | ✓ | — | — |
| Данные dev | приёмка | 25 карточек, 29 оплат, 0 серий/уроков/исключений, 0 открытых остатков | — | скрипты создают фикстуры `Alex Example NNNN` и убирают их |

**Missing dependencies with no fallback:** нет.
**Missing dependencies with fallback:** `node_modules` в worktree — `yarn install`.

## Приёмка критериев 1-5 (вместо Validation Architecture)

`nyquist_validation: false`; новых тестов нет. Каждый план цитирует вывод скриптов в SUMMARY.

| Критерий | Как проверить | Инструмент |
|----------|---------------|-----------|
| 1. 60 мин → 1, 90 мин → 1.5 | кейсы `balanceMinutes`/`deductedMinutes` в core; на `dvlab_test`: карточка с открытием вчера, урок 60 и урок 90 вчера+1, отметка `done`, `GET /students/:id` → `balanceMinutes` уменьшился на 60 и 90 | `ledger-core.mjs`, `ledger-api.mjs` (по образцу `schedule-api.mjs`, `api.mjs::startApi/call/teacherCookie`) |
| 2. неявка вычитает, выключается флагом; отмена/перенос не вычитают | `no_show` при `noShowDeducts` true/false; cancel отмеченного прошлого урока → вычет пропал, restore → вернулся; перенесённое вхождение: призрак без действий | `ledger-api.mjs`, SQL-счётчик `lesson_marks` не уменьшается |
| 3. исправление отметки пересчитывает на всех экранах | `done → none → no_show → cancel`; после каждого шага `GET /students`, `GET /students/:id`, `GET /today` дают одно число | `ledger-api.mjs`; браузер: Today, Students, профиль в светлой и тёмной теме |
| 4. «Upcoming payments» с N, по умолчанию 2; Today из реальных данных | без строки `teacher_settings` → N = 2; `PATCH /settings` → список меняется; «не задан» не в списке, долг в списке; счётчики Today | `ledger-api.mjs`; браузер Today под учителем из `.env` (`DEV_TEACHER_LOGIN`) |
| 5. одни функции core | `grep` в `apps/api` и `apps/web`: нет `paidOn <=`/`> openingBalance`, нет деления `balanceMinutes /`, нет `localIsoDate`, `latestPaymentDate`; `knip` чистый | скрипт или шаг плана с grep, `yarn knip` |
| БД | две новые папки миграций, REVOKE в тексте, `has_table_privilege('dvlab_app','public.lesson_marks','delete') = false`, повторный `db:generate` без изменений | обновлённый `schedule-db.mjs` или `ledger-db.mjs` |

Браузер проверяет ведущая сессия (у исполнителей нет инструментов браузера); dev-стек: `yarn workspace @dv-lab/api dev` и `yarn workspace @dv-lab/web dev`, ожидание `scripts/dev-checks/wait-dev.mjs up`. [VERIFIED: AGENTS.md «Команды», «Помощники для агентов»]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | нет (без изменений) | `requireSession` |
| V3 Session Management | нет | `auth/sessions.ts` |
| V4 Access Control | да | `requireRole('teacher')` на всех новых роутах; настройки по `account.id` из сессии, не из тела |
| V5 Input Validation | да | zod в `@dv-lab/contracts` (`kind` enum, uuid, `isIsoDate`, N в пределах), `readJson` |
| V6 Cryptography | нет | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Ученик ставит отметку или читает Today | Elevation of privilege | `requireRole('teacher')` |
| Удаление истории отметок | Tampering / Repudiation | REVOKE DELETE, TRUNCATE у `dvlab_app`, FK RESTRICT |
| Гонка двух отметок / отметка на изменённом уроке | Tampering | транзакция с `FOR UPDATE`, `expectedStartsAt` → 409 |
| Данные учеников в публичном репо через скрипты приёмки | Information disclosure | только `Alex Example NNNN`, `privacy-check.mjs` |

## Sources

### Primary (HIGH confidence)
- Код репозитория, прочитанный в этой сессии: `packages/core/src/{balance,lessons,schedule,zoned,index}.ts`, `packages/db/src/schema.ts`, `packages/contracts/src/{schedule,students,auth}.ts`, `apps/api/src/cards/{card-facts,cards,card-rows}.ts`, `apps/api/src/schedule/{rows,changes,schedule,series}.ts`, `apps/api/src/routes/{schedule,students,payments}.ts`, `apps/api/src/auth/middleware.ts`, `apps/api/src/import/apply-packet.ts`, `apps/web/app/(app)/{page.tsx,_components/sections.ts}`, `schedule/_components/{lesson-dialog,lesson-block,schedule-mutations,schedule-screen}.tsx`, `students/_components/students-screen.tsx`, `components/app/ledger-text.tsx`, `deploy/postgres/ensure-db.sql`, `.github/workflows/ci.yml`, `scripts/dev-checks/{README.md,schedule-core.mjs,schedule-db.mjs,sql.mjs}`.
- `node_modules/drizzle-orm` 1.0.0-rc.4 типы `onConflictDoUpdate` (основной репо).
- Дизайн-система `~/dv-lab-design` v35: `principles.md`, README `DueList`, `LessonList`, `Stat`, `SettingsGeneral`, `LessonDialog`, `EventTooltip`, `Switch`, `TeacherHome`; `assets/Reference/light-today.png`.
- `.planning`: 21-CONTEXT, 21-ARCH-REVIEW, REQUIREMENTS, ROADMAP, STATE, 19-CONTEXT, 20-CONTEXT, 20-REVIEW-FIX; память проекта.

### Secondary / Tertiary
- Нет (внешний веб-поиск не понадобился).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — новых пакетов нет, версии из файлов.
- Architecture: HIGH — сигнатуры и места правок прочитаны; формы новых функций — рекомендация.
- Pitfalls: HIGH для 1-4, 6-7 (код прочитан); MEDIUM для UI-частей (ждут Design dude).

**Research date:** 2026-10-10
**Valid until:** 2026-11-09 (код меняется только этой фазой)
