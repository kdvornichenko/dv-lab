# Phase 24: Google Calendar Connection and Outbound Sync — Research

**Researched:** 2026-10-11. **Revision:** Google-authoritative D-13/D-14 + shared-read C2.
**Domain:** серверный OAuth, confirmed Google reads, serialized commands, recovery и preservation.

## User Constraints (from CONTEXT.md)

### Принятые границы

- **D-01:** Google Calendar — источник истины уже в Phase 24; фазы идут 21 → 21.1 → 24 → 25 → 22 → 23 → 26. Полная ручная приёмка календаря проводится после двухсторонней синхронизации.
- **D-02:** OAuth обрабатывает API. Refresh token хранится зашифрованным; браузер, URL логов и публичные артефакты его не получают. Calendar OAuth не заменяет существующий вход в приложение.
- **D-03:** Callback уже задан как `https://dv-lab.dev/api/google/callback`. Его нельзя молча заменить. Calendar API включён; заявленные scopes — `calendar.events` и `calendar.calendarlist.readonly`. Client credentials сохранены вне репозитория. При подготовке секреты не требуются и не читаются.
- **D-04:** Приложение OAuth пока в Testing. Runtime подключения не реализован. Публикация Production и проверка через 8 дней остаются настоящими внешними критериями, а не результатами локальной имитации.
- **D-05:** У команды и Google representation есть устойчивая детерминированная identity. Один владелец очереди выполняет команды; клиент не запускает параллельные Google writes. Очередь `pg-boss` обеспечивает сериализацию и recovery. Постановка в очередь не означает сохранение урока. Подтверждённая локальная проекция меняется только после фактического результата Google.
- **D-06:** Серия представлена одним recurring event, исключения — его instances. Перенос вхождения не создаёт одновременно независимое событие и изменённый instance. Cut/end сохраняют историю; прошлые уроки не размножаются.
- **D-07:** Зона берётся из урока/серии, а не из сервера. Фаза 21.1 владеет схемой зоны, core recurrence и семантикой cut. Фаза 24 потребляет их контракт и не дублирует расчёты.
- **D-08:** Локальные уроки, серии, исключения и отметки физически не удаляются. Предложение disconnect/revocation должно явно описать судьбу токенов, очереди и Google events. Подготовка не выполняет такие действия.
- **D-09:** Homepage публично описывает продукт и ведёт на privacy/terms. Privacy отражает фактические доступ, использование, хранение и передачу Calendar data. Нельзя обещать несуществующие механизмы удаления или retention. Тексты и маршруты подготавливаются локально, без публикации и смены Branding.
- **D-10:** Существующий SettingsCalendar v40 относится сразу к 24–25. В Phase 24 нельзя показывать работающие Live updates, Last full check или Events to review до реализации соответствующего поведения Phase 25.
- **D-11:** Пользователь выбрал только основной Google Calendar: «Только основной календарь». Selector и автоматическая смена target не входят в Phase 24. После подключения UI показывает фактический основной календарь. Reconnect сохраняет прежнюю identity; другой аккаунт или календарь не подменяет её молча.
- **D-12:** Disconnect останавливает dispatch, отзывает grant и очищает действующие credentials. Локальные данные, Google events, mappings и незавершённые intents сохраняются. Ошибка revoke остаётся видимым состоянием; reconnect к прежнему календарю восстанавливает чтение и разрешает исход ранее отправленных команд. Локальные неподтверждённые изменения не считаются сохранённым расписанием.

- **D-13:** Прямое решение владельца: «без подключенного гугла календарь вообще не работает, он только отображает и помогает гуглу». Без подключённого primary Calendar запрещены новые изменения расписания. Подключение читает события Google; календарь dv-lab не является независимым источником событий. Существующая локальная история сохраняется; её наличие не запускает автоматическую публикацию старых уроков в Google.
- **D-14:** Ответ владельца: При временной недоступности Google не подтверждать сохранение до ответа Google; оставить просмотр последнего состояния. Save success требует подтверждённого Google результата. Timeout с неизвестным исходом остаётся явным pending/unknown, пока reconciliation не установит результат; его нельзя превращать в local success. Новые offline edits не принимаются.

### Инженерные решения подготовки

Исследование должно определить command journal → Google confirmation → local projection boundary, окно чтения из Google, очередь и порядок версий, restart/retry reconciliation, ID mapping серии/instance/cut, OAuth state/PKCE/session binding, envelope encryption и rotation, reconnect/refresh coordination, paginated conflict windows и E2E через реальные границы приложения. Данные до Google ack не становятся confirmed lesson/series state. Existing local IDs/marks/accounting history сохраняются; внешние события без lesson binding отображаются как события Google/busy time, автоматический matching остаётся Phase 25. Новые внешние записи, пакеты или окружение сейчас не создаются.

## Summary

Google — источник событий уже в Phase 24. Один серверный owner читает Google, сохраняет минимальную подтверждённую проекцию и обслуживает Schedule, будущие уроки Today и `nextLessonAt`. Локальные будущие legacy-записи без binding не входят в эти ответы. Первое подключение выполняет чтение; оно не создаёт Google events из локального расписания.

Команда проходит `journal → Google result → confirmed projection`. До provider acknowledgement допустимы журнал, резервирование identity и статус pending. Строки подтверждённого расписания и Save success появляются только после подтверждения. Google HTTP и PostgreSQL не образуют общей транзакции. После сбоя результат восстанавливается по журналу и Google reads.

Это пересмотр прежнего исследования под D-13/D-14, а не параллельная модель. Старые 14 PLAN не являются доказательством текущего контракта. Phase 21.1 принята: 13 планов, 37 задач, 9 волн; код ещё не реализован.

## Scope и Phase Requirements

Текущий write set: только этот RESEARCH, [ARCH-REVIEW](24-ARCH-REVIEW.md) и [COVERAGE](COVERAGE.md). Код, Git, зависимости, env, DB, браузер, Google и deployment не меняются.

| Критерий | Решение / доказательство будущего исполнения |
| --- | --- |
| SC1 / GCAL-01 | Серверный OAuth, encrypted refresh credentials, primary identity, реальные Production/day-8 |
| SC2 / GCAL-02 | Полное Google window read; command acknowledgement; stable identity; recovery; сохранённая история |
| SC3 / GCAL-03 | Один writer, явные preconditions, журнал попыток и projection commit после Google |
| SC4 / GCAL-09 | Public read/mutation gates, last-known read-only, reconnect до новых команд |
| SC5 / GCAL-10 | Все страницы пересечений, точные границы и ошибка вместо ложного clean |
| SC6 / GCAL-01 | Публичные homepage/privacy/terms с реальными потоками данных и отдельным deployed proof |

Номер C2 ниже означает consistency-уточнение SC2/SC4: Schedule, Today upcoming и `nextLessonAt` читают одного owner. Финансы и история отметок остаются локальными.

**Work map:** OAuth и gate → общий read owner / DTO → command journal / recovery → recurring/cut → UI/privacy / E2E handoff → статическая проверка документов. Каждый шаг закрывает строки таблицы. **Stop:** все строки имеют владельца, контракт и наблюдаемое доказательство; после статической проверки завершить подготовку без runtime claims.

## Architectural Responsibility Map

| Owner | Ответственность | Граница |
| --- | --- | --- |
| Existing core / Phase 21.1 | Зоны, recurrence для команд, cut/end, local accounting | Никаких Google DTO, OAuth или второго recurrence engine |
| `calendar/read-model.ts` | Единственный confirmed event store, windows, next index, freshness/revision | Не считает деньги и не делает matching по названиям |
| `calendar/reads.ts` | Google pagination, admission probe, refresh проекции перед локальной read transaction | Не подменяет ошибку пустым расписанием |
| `calendar/commands.ts`, `journal.ts` | Preconditions, immutable command, identity reservation, receipt | Не сохраняет будущий урок до Google |
| `calendar/worker.ts`, `transitions.ts` | Serial dispatch, reconcile, stage recovery | Не вычисляет собственный cut или timezone rules |
| `schedule/command-plan.ts`, `command-apply.ts` | Подготовка domain result без записи; применение подтверждённого результата | Existing marks сохраняются; повтор cut не создаёт новые IDs |
| `calendar/connection.ts`, `credentials.ts` | OAuth, envelope, generation, refresh/revoke | Calendar OAuth не заменяет app login |
| `calendar/gateway.ts` | Валидированные Google calls, ETag, страницы, typed errors | SDK/raw DTO не выходит в web/contracts |
| Today/cards/routes | Берут будущие факты из общего read model; прошлые marks/balance из прежних owners | Нет fallback на local legacy future |
| Web | Safe DTO, pending/last-known/blocked, English UI copy | Нет browser Google SDK, recurrence или optimistic Save |

## Project Constraints

Сохраняются owners из `AGENTS.md`: config только через `loadConfig`; DB URL через `resolveDatabaseUrl`; app factory без startup; lifecycle через `Closable`; миграции генерируются и только добавляют. `DbExecutor = Database | Transaction`. Сетевые обращения выполняются вне SQL transaction. `cards` и `schedule` используют новый read model; `schedule` не начинает импортировать `cards`. Contracts остаются типами/zod/константами.

Репозиторий публичный. Event titles, реальные student IDs, токены и fixture secrets не входят в research, логи или опубликованные evidence. Рукописный код при исполнении проходит действующие simplify/quality gates. Исследование не создаёт test suite и не измеряет несуществующий код.

## Standard Stack

### Core

Это предложения установки, не установленные зависимости. Названия подтверждены official repositories; строгий VERIFIED registry tag удержан из-за SUS verdict. [CITED: https://github.com/timgit/pg-boss] [CITED: https://github.com/googleapis/google-api-nodejs-client]

| Library                                                              | Exact proposal | Purpose                                             | Published / evidence                                 |
| -------------------------------------------------------------------- | -------------- | --------------------------------------------------- | ---------------------------------------------------- |
| `pg-boss` [WARNING: flagged as suspicious — verify before using.]    | 12.37.1        | PostgreSQL queue, worker leases/retry/maintenance   | 2026-10-08T15:56:14.199Z; npm view; package gate SUS |
| `googleapis` [WARNING: flagged as suspicious — verify before using.] | 185.0.0        | Official OAuth2 client and typed Calendar v3 client | 2026-10-08T17:11:09.982Z; npm view; package gate SUS |

### Supporting — retain existing pins

Manifest baseline, не предложение обновления: `"node": ">=24"`, `"packageManager": "yarn@4.18.1"`, `"@playwright/test": "1.63.0"`, `"typescript": "6.0.3"`; API: `"hono": "4.13.13"`, `"drizzle-orm": "1.0.0-rc.4"`, `"pg": "8.23.1"`, `"zod": "4.6.5"`. [CITED: package.json:6-8,27-35] [CITED: apps/api/package.json:14-24]

Use Node crypto for authenticated encryption/randomness; preserve PostgreSQL/Drizzle and existing Playwright. Do not add a second queue, Redis, ORM, date package, OAuth browser SDK or crypto wrapper. Это решение минимального write set; Node supplies authenticated cipher primitives. [CITED: https://nodejs.org/docs/latest-v24.x/api/crypto.html]

### Alternatives Considered

| Instead of            | Rejected alternative                           | Decision                                                                                              |
| --------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Official client       | Handwritten OAuth/token and Calendar transport | Сохранить official SDK; app code владеет policy, не реализацией OAuth                                 |
| One connection writer | Независимые workers master и occurrence        | Cut пересекает несколько identities; connection serialization проще и достаточно для teacher calendar |

Решения основаны на CONTEXT и documented singleton policy. [CITED: .planning/phases/24-google-calendar-connection-and-outbound-sync/24-CONTEXT.md:27-36] [CITED: https://raw.githubusercontent.com/timgit/pg-boss/12.37.1/docs/api/queues.md]

**Installation — only after dependency authority and package checkpoint:**

```sh
yarn workspace @dv-lab/api add --exact pg-boss@12.37.1 googleapis@185.0.0
```

Это будущая команда, сейчас не выполнялась. Перед исполнением обновить package/age evidence. Не отключать Yarn age gate. Уже выданное разрешение на зависимости не запрашивать повторно. [VERIFIED: current user scope]

## Package Legitimacy Audit

Executed seam and npm metadata queries on 2026-10-11; no install. Official repositories identify both packages, but seam returned SUS for latest publication age. Absence of postinstall metadata is recorded only as that observation, not a safety or compatibility guarantee. [CITED: https://github.com/timgit/pg-boss] [CITED: https://github.com/googleapis/google-api-nodejs-client] [VERIFIED: package-legitimacy seam output, 2026-10-11]

| Package    | Registry | Package age / release age                | Weekly downloads | Source Repo                                    | Verdict      | Disposition                                           |
| ---------- | -------- | ---------------------------------------- | ---------------: | ---------------------------------------------- | ------------ | ----------------------------------------------------- |
| pg-boss    | npm      | Created 2016-03-18; release about 3 days |        2,615,763 | github.com/timgit/pg-boss                      | SUS: too-new | Keep proposal; retain existing installation authority |
| googleapis | npm      | Created 2012-09-18; release about 3 days |       10,854,397 | github.com/googleapis/google-api-nodejs-client | SUS: too-new | Keep proposal; retain existing installation authority |

**SLOP removed:** none. **SUS flagged:** both. These verdicts do not assert maliciousness. Declared Node constraints are respectively `>=22.12.0` and `>=22.0.0`; Node >=24 satisfies these present ranges. No runtime compatibility probe was permitted. [CITED: https://registry.npmjs.org/pg-boss/12.37.1] [CITED: https://registry.npmjs.org/googleapis/185.0.0]

Verification commands:

```sh
node /Users/kdvornichenko/.codex/gsd-core/bin/gsd-tools.cjs query package-legitimacy check --ecosystem npm pg-boss googleapis
npm view pg-boss version engines repository.url scripts.postinstall time --json
npm view googleapis version engines repository.url scripts.postinstall time --json
```

All completed exit 0. Postinstall field absent for both in returned metadata; no scripts were executed. [VERIFIED: command results, 2026-10-11]

## API Capability Coverage — plan:pre

Полная матрица: [COVERAGE](COVERAGE.md). Discovery revision `20261005`: 38 Calendar methods + 4 OAuth capabilities. Внедряются только CalendarList.list и Events.list/get/insert/patch/instances. Все Calendar writes идут через writer; exchange/refresh/revoke — через connection owner.

Scopes ровно `https://www.googleapis.com/auth/calendar.events` и `https://www.googleapis.com/auth/calendar.calendarlist.readonly`. Callback ровно `https://dv-lab.dev/api/google/callback`. Primary разрешается в фактический calendar ID по всем страницам CalendarList с `showHidden=true`; нужны `primary=true`, действующая запись и роль owner/writer. Calendar ID сохраняется, keyword primary не становится устойчивой identity. Reconnect к другому target отклоняется.

Локальная база фактов: [CalendarList.list](../../../docs/google-calendar/articles/v3/reference/calendarList/list.md), [Events.list](../../../docs/google-calendar/articles/v3/reference/events/list.md), [get](../../../docs/google-calendar/articles/v3/reference/events/get.md), [insert](../../../docs/google-calendar/articles/v3/reference/events/insert.md), [patch](../../../docs/google-calendar/articles/v3/reference/events/patch.md), [instances](../../../docs/google-calendar/articles/v3/reference/events/instances.md), [Discovery](../../../docs/google-calendar/calendar-v3.discovery.json). Поля методов и scopes сверены с Discovery.

В Phase 25 остаются watch/channels, syncToken и его 410 recovery, matching/Assign/Ignore, постоянная доставка внешних правок и nightly reconciliation. Обычное чтение Google и отображение его фактов относятся к 24. Запрет watch не разрешает Schedule показывать local-first данные. Внешнее изменение видно при следующем обычном чтении; оно не вызывает обратную отправку старого local state.

## Architecture Patterns

### 1. Общая confirmed projection и C2

`calendar/read-model.ts` хранит факты, действительно полученные от Google, с provenance: bound calendar, connection generation, provider ID/ETag, snapshot revision и fetch time. Snapshot не является копией всего Google resource. Все выборки teacher/account-scoped. Состояние cache не доказывает доступность сети.

Для выбранной недели `calendar/reads.ts` получает `events.list(singleEvents=true,timeMin,timeMax)` до отсутствия nextPageToken. Query неизменен между страницами; пустая промежуточная страница не завершает чтение. Only after all pages validate, одна SQL transaction публикует полный snapshot и coverage окна. При сбое между страницами сохраняется предыдущий complete snapshot. Незавершённое окно никогда не получает `fresh` или «нет событий». Google API не обещает SQL-подобную атомарность между страницами; это last observed complete traversal, с ETag/precondition на каждую последующую команду. [Pagination](../../../docs/google-calendar/articles/guides/pagination.md)

Обычный read upsert известных provider identities обновляет общий read model. Новая версия инвалидирует затронутые более старые window/next proofs; read response не смешивает версии. Projection commit команды также обновляет этот owner и инвалидирует пересекающиеся proofs. Out-of-order response имеет generation/revision CAS и не откатывает более новую проекцию. Для области с pending command обычный read может показать фактическое Google состояние, но не снимает command barrier.

Bindings разрешаются только по уже сохранённому mapping. Unmapped Google event — read-only внешний event; совпавшее имя ученика не создаёт lesson. Timed/all-day, status и transparency берутся из Google. Busy означает `status != cancelled && transparency != transparent`, а не любой внешний event. Малформированный event делает read incomplete; он не исчезает молча. Персональные внешние события не включаются в уроки Today и расчёт next lesson.

**Минимальные existing callers:**

- `routes/schedule.ts GET /week`: вызывает общий refresh/read owner; больше не отдаёт будущие строки из `readWeek` как независимое расписание.
- `routes/today.ts → today/today.ts`: будущая часть `lessons`, upcoming/next/counts берётся из той же Google projection. Остаются локальные прошлые marks/Earlier и Pays soon. Нет второго network reader в Today.
- `routes/students.ts GET /, GET /:id`: refresh необходимого next index до read transaction. `cards/card-facts.ts::cardNextLessons` читает этот index вместо `loadScheduleRows → core.nextLessons`. `cardBalances` не меняется.
- `cards/cards.ts::toDetail/listCards` и `card-rows.ts::toCardRow` передают next value вместе с freshness. Create/update/archive/restore/opening-balance responses используют тот же cached reader без Google HTTP внутри своей transaction. Они не изобретают fresh из локального изменения карточки.
- Все account-scope/generation параметры передаются явно от teacher route/composition owner; новый read model не читает произвольную connection «первой строкой».

**Next index без вымышленного горизонта.** Для запрошенных student IDs reader выполняет один ordered stream `events.list(singleEvents=true,orderBy=startTime,timeMin=now)`. Привязывает только известные mappings и не использует title matching. Первая активная timed occurrence с binding ученика после полностью прочитанного предшествующего prefix доказывает его `nextLessonAt`. Stream заканчивается после нахождения всех искомых next либо Google end-of-list. Не найденное значение — `none` только после end-of-list или доказанного отсутствия любых bindings этого ученика. Если request deadline/страница прервала поиск, unresolved student получает `unknown`; это не «нет уроков». Не вводить скрытый 30/90-day horizon. Бесконечные recurring calendars не требуют бесконечного ожидания: bounded request может вернуть unknown. Всю batch публикацию index выполнить атомарно; факты отдельного proved prefix не превращают incomplete week в complete.

Schedule/Today используют общий window cache, index использует те же normalized events и mapping revision. При пересекающихся свежих reads один event не получает разные время/status на двух экранах. Если версия index отстала или last-known next уже прошёл, показать unknown/last-known; не вычислять следующий урок из legacy recurrence. Metadata позволяет отличить observed absence от unavailable.

**Local history boundary.** Сохранить existing IDs/marks/payments/balances. Записать `historyCutoverAt` при первой активации нового Calendar режима в account metadata. До него существовавшие прошлые local occurrences и все existing marks доступны как local history. Legacy future без binding не переходит в «состоявшийся урок» только от течения времени; его нельзя позднее автоматически включать в Earlier или принимать новую mark как подтверждённый Google lesson. `schedule/marks.ts` и historical read filter закрывают этот случай. Уже существующие marks не удаляются и не пересчитываются. Новые confirmed lessons после cutover становятся историей обычным путём. Это сохраняет деньги локально и не подтверждает несуществовавшие Google events.

### 2. Public gates и DTO для UI/planner

Все следующие DTO и функции — **новый предписанный контракт**, ещё не source. Schemas находятся в `packages/contracts/src/calendar.ts`; новые Calendar DTO сначала аддитивны. Действующие StudentRow/TodayResponse становятся обязательными в одной задаче с реальными producers06; schedule routes переключаются на новые Calendar response types в05/07. Existing schedule input schemas и ScheduleSeries21.1 переиспользуются без второго owner. `ScheduleOccurrenceRef` наследуется из schedule. ISO strings валидируются; чужие Google objects не выходят из gateway.

```ts
type CalendarIssue =
  | 'connection_required' | 'reconnect_required' | 'permission_required'
  | 'provider_unavailable' | 'command_pending' | 'external_change'
  | 'disconnect_failed' | 'invalid_provider_data' | 'history_only'

type GoogleConnectionSnapshot = {
  state: 'not_connected' | 'connected' | 'reconnect_required'
    | 'permission_required' | 'disconnecting' | 'disconnect_failed'
  calendar: { id: string; label: string; timeZone: string } | null
  generation: number
  issue: CalendarIssue | null
  pendingCommandCount: number
  disconnectResolution: 'none' | 'provider_confirmed' | 'operator_confirmed'
  allowedActions: ('connect' | 'reconnect' | 'disconnect' | 'retry_disconnect' | 'confirm_revoked')[]
}

type CalendarReadStatus =
  | { state: 'fresh'; fetchedAt: string; revision: string }
  | { state: 'last_known'; fetchedAt: string; revision: string; reason: CalendarIssue }
  | { state: 'unavailable'; reason: CalendarIssue }

type CalendarEventView = {
  eventKey: string
  title: string | null
  when: { kind: 'timed'; startsAt: string; endsAt: string; timeZone: string }
    | { kind: 'all_day'; startsOn: string; endsBefore: string; timeZone: string }
  status: 'confirmed' | 'tentative' | 'cancelled'
  blocksTime: boolean
  binding: { kind: 'lesson'; ref: ScheduleOccurrenceRef; version: string }
    | { kind: 'transition'; commandId: string }
    | { kind: 'external' }
  editBlock: CalendarIssue | null
}

type CalendarRange = { start: string; end: string; timeZone: string }
type CalendarSeriesContext = { series: ScheduleSeries; version: string }
type GoogleScheduleWindow = {
  requestedRange: CalendarRange
  snapshotRange: CalendarRange | null
  connection: GoogleConnectionSnapshot
  read: CalendarReadStatus
  events: CalendarEventView[]
  series: CalendarSeriesContext[]
  write: { state: 'ready' } | { state: 'blocked'; reason: CalendarIssue }
}

type NextLessonRead = {
  status: CalendarReadStatus
  result: 'known' | 'none' | 'unknown'
  startsAt: string | null
}

type CalendarCommandReceipt = { commandId: string; statusUrl: string }
type CalendarCommandSnapshot = {
  commandId: string
  requestId: string
  generation: number
  expectedVersion: string
  operation: 'create' | 'move' | 'cancel' | 'restore' | 'move_series' | 'end_series'
  effect: 'none' | 'unknown' | 'partial' | 'confirmed'
  state: 'pending' | 'dispatching' | 'outcome_unknown' | 'projection_pending'
    | 'applied' | 'failed' | 'partial_recovery' | 'recovery_required'
  issue: CalendarIssue | 'precondition_failed' | 'not_applied' | null
  confirmedRevision: string | null
  affectedRefs: ScheduleOccurrenceRef[]
  nextAction: 'wait' | 'refresh' | 'retry_new_command' | 'resume_recovery' | 'none'
}

type CalendarCommandMeta = { requestId: string; expectedVersion: string }
```

`write.ready` — производная capability конкретного свежего read, не обещание будущей доступности. Server проверяет connection и делает актуальное Google probe/GET при admission и dispatch независимо от UI. `connected` означает проверенный grant/target, а не бессрочный `isGoogleAvailable`. `unavailable` даёт events=[], но UI не показывает empty-calendar success. Last-known доступен только для покрытого persisted window; другая неделя не заполняется местными legacy rows.

**D2 / Whole series:** `GoogleScheduleWindow.series` передаёт контекст каждой доступной для whole-series операции mapped серии. `CalendarSeriesContext.series` использует принятый `ScheduleSeries` из 21.1: id/studentId, weekday/startTime/durationMinutes/startsOn/endsOn, stored timeZone и referenceOccurrence. `version` — precondition всей серии, не version отдельного instance. Consumers находят context по series.id после каждого read/reload; память ранее открытой формы и старый ScheduleWeekResponse не являются источником. Отсутствие context блокирует Whole series/End для этой серии; оно не означает отсутствие Google events.

Owner `calendar/reads.ts` формирует context через общий read model: проверяет mapped master и поддерживаемое canonical rule, а первый future reference подтверждает полным ordered prefix Google reads, как next index. Reference несёт natural originalOn/ruleStartsAt и actualStartsAt по контракту 21.1; moved actual time не становится weekly rule. Master ETag, mapping и projection revision входят в whole-series version; admission заново проверяет provider preconditions. Если complete proof недоступен, правило Google не поддерживается или известен partial/unknown command, контекст для редактирования не публикуется, event получает соответствующий editBlock. Last-known view остаётся read-only и может иметь series=[]. Второй endpoint, browser recurrence и fallback к непроверенному legacy rule не вводятся. Context собирается из подтверждённых provider facts и существующих local identity/history; новые raw provider fields в persisted cache не требуются. E2E: reload → Whole series для серии с moved reference occurrence; natural weekday/time/zone и whole-series version сохранены, stale context отклоняется.

Exact endpoint handoff:

| Endpoint без /api | Новый результат / gate |
| --- | --- |
| POST /google/connect | authenticated teacher → authorization URL; existing session/Origin protections |
| GET /google/callback | fixed callback; clean redirect с safe result, never credentials |
| GET /google/connection | `GoogleConnectionSnapshot`; нет fake network success |
| GET /schedule/week?start=YYYY-MM-DD | `GoogleScheduleWindow`; disconnected last-known или unavailable с blocked writes |
| POST /schedule/lessons | прежний create body + command meta; `expectedVersion` fresh window token |
| POST /schedule/lessons/:id/{move,cancel,restore} | прежний body + command meta; version именно target projection |
| POST /schedule/series/:id/occurrences/:originalOn/{move,cancel,restore} | прежний body + command meta; originalOn неизменен |
| POST /schedule/series/:id/{move,end} | прежний body + command meta; version whole affected series |
| Все перечисленные schedule POST | `202 CalendarCommandReceipt`; только pending, не `Schedule*Response` success |
| GET /google/commands/by-request/:requestId | account-scoped lookup после потери POST response; 404 означает «journal ещё не найден», retry только того же requestId/body |
| GET /google/commands?state=unresolved | unresolved command snapshots для восстановления UI после reload/new tab; count считает commands, не stages/jobs |
| GET /google/commands/:commandId | ownership-scoped `CalendarCommandSnapshot`; после applied перечитать общий read owner |
| POST /google/commands/:commandId/resume | только `partial_recovery/recovery_required`, явное продолжение после свежей проверки; не новая копия команды |
| POST /google/conflicts | fresh authenticated finite check; strict union ниже |
| POST /google/disconnect | остановить dispatch, durable revoke; статус читать через connection |
| POST /google/disconnect/confirm-revoked | явное подтверждение удаления доступа в Google; operator evidence, не provider success |
| Existing /mark endpoints | локальные marks; разрешены только сохранённая history или confirmed binding; external/pending/legacy future rejected |

Schedule rejection до acceptance: 409 `precondition_failed/command_pending/external_change/history_only`; 503 `provider_unavailable`; 409 connection/reconnect/permission-required с safe code; нет вставленного confirmed урока. `requestId` — UUID retry identity: одинаковые account/requestId/body возвращают прежний receipt/result; иной body с тем же ID — 409. Transport retry одного POST сохраняет requestId. После definitive failed пользователь отправляет новый requestId с новым expectedVersion.

`StudentRow.nextLessonAt` остаётся для текущих callers, но определяется только `NextLessonRead.startsAt`; добавить `nextLesson: NextLessonRead`. `known` требует non-null, `none/unknown` требуют null; strict schema проверяет корреляцию. TodayResponse получает `calendarRead: CalendarReadStatus` и `calendarWrite: GoogleScheduleWindow['write']`; будущие lessons идут из общей projection. Историческая часть и balance fields остаются прежними. UI не переводит unknown в «No next lesson» и не прячет весь Today/Pays soon при Google outage.

Browser `mutate` возвращает receipt и сопровождает status polling; `kind:ok` и close/success toast допустимы только после applied. У pending command должен остаться recoverable status после reload. Network loss при отправке POST разрешается тем же requestId/status lookup. Не менять форму/закрывать dialog как saved на 202. Read-only включает drag, create, move, cancel/restore и whole-series actions во всех callers, включая Today.

### 3. Command journal, retry и единственный writer

1. Admission читает текущую connection/generation и Google target/window. Валидирует input, expectedVersion, local history eligibility и canChange через existing core. SQL transaction захватывает entity barrier, резервирует IDs и immutable command plan. Она не вызывает existing mutators, которые меняют confirmed domain.
2. Записать command ID, account, target identity, operation/input hash, expected Google ETags и local projection revision, captured rule/zone, reserved IDs/lineage, generation и dispatch deadline. Job содержит только command ID; DB journal хранит необходимый payload без логирования. pg-boss — durable wake-up. Потерянный wake-up восстанавливается из journal.
3. Один writer сериализуется по stable connection, что сильнее требования «один на lesson». Lease — DB session advisory lock на выделенном app connection; per-process concurrency не является глобальным lock. Перед каждым HTTP stage фиксировать attempt/ID/If-Match и generation. Abort/timeouts и lifecycle освобождают ресурсы; утрата lease переводит неизвестную попытку в reconciliation barrier.
4. Unsent command после истечения admission deadline, outage, disconnect или restart с утраченным admission не отправляется позднее: `failed/not_applied`, confirmed state не меняется. Новая отправка требует нового явного Save. SDK auto-retry writes отключён; Google 400, 403 permission, 429 либо иной доказанный отказ не становится скрытым поздним edit.
5. После dispatch с неизвестным результатом — `outcome_unknown`. Сначала GET/instances, сравнить identity, operation digest, owned fields и исходный unowned writable fingerprint. Marker сам по себе не доказывает текущий результат. При совпадении подтвердить фактический результат. При доказанном неприменении завершить failed. Если нужен повтор уже pending операции, допускается только тот же deterministic insert ID или тот же conditional PATCH/If-Match после reconcile; не новый payload и не новая generation representation.
6. После подтверждения Google записать минимальный provider acknowledgement/stage. Затем idempotent SQL transaction применяет prepared domain plan, IDs/marks mapping, confirmed projection, revision и applied. Сбой между remote accept и сохранением acknowledgement восстанавливается GET; между acknowledgement и projection commit — `projection_pending`, без нового Google write.
7. Конкурентная команда к той же identity/series получает 409 barrier. После applied клиент перечитывает версию и может отправить следующий edit. FIFO старых payloads и coalescing подтверждённого пользователю local state исключены. Поздний ответ сверяется с command/stage/generation, не подтверждает другую команду.
8. Reads/unknown reconciliation допускают ограниченный backoff по документированным transient errors. При исчерпании request budget остаётся visible recovery_required, не false failed/success. `resume` заново проверяет Google, продолжает тот же журнал и не меняет исходную задачу. Definitive failed не возобновляется автоматически.

Для OAuth refresh допустим один coordinated refresh после 401; повтор Calendar write разрешён лишь если первая попытка доказанно отклонена и исходный command всё ещё явно pending в admission deadline. По окончании — failed/reconnect, не offline queue. Вновь подключённый grant сначала разрешает все previously dispatched unknown/partial команды; unsent старые команды не оживают.

[Errors](../../../docs/google-calendar/articles/guides/errors.md) и [conditional modifications](../../../docs/google-calendar/articles/guides/version-resources.md) описывают 409/412/404/5xx, но не гарантируют транзакцию с нашей DB. 409 insert требует GET ownership; 412 показывает изменившийся Google факт и запрещает слепой overwrite. 404 отдельно проверяется на потерю доступа к calendar. External edit остаётся видимым Google фактом; неподдерживаемое изменение mapped rule делает его read-only/external_change до соответствующего Phase 25 reconcile. Нельзя восстанавливать старое local правило автоматически.

### 4. Recurring identity, restore и cut

ID standalone/master = valid prefix + SHA-256 canonical tuple `(stableConnectionId,calendarId,entityKind,localEntityId,representationGeneration)`. UUID entity заранее резервируется в command journal. OAuth generation, время, название и current default zone не входят в ID. Representation generation меняется только при доказанном окончании старой representation; это не retry counter.

Ownership marker содержит opaque local identity, schema version и command/stage digest. Это не student title. Private marker ограничивается documented sizes. Для recovery search применять один identity predicate и проверить результат локально: статья extended-properties и reference расходятся в описании нескольких private predicates, поэтому не строить корректность на их AND/OR. [Extended properties](../../../docs/google-calendar/articles/guides/extended-properties.md)

Recurring event — один master. start/end используют canonical first occurrence и stored zone; RRULE weekly с UTC UNTIL последнего canonical occurrence. DTSTART/DTEND не помещаются в recurrence. Instance ID получить через instances с originalStart естественного instant, showDeleted=true и all pages; не угадывать suffix и не искать по moved effective time. OriginalOn остаётся natural date старого rule. Move/cancel/restore modifies canonical instance; отдельный insert occurrence запрещён.

**Restore одиночного события:** cancelled resource может исчезнуть; бесконечный PATCH прежнего ID после 404 недопустим. Сначала validate bound calendar access, разрешить все unknown attempts и прочитать старый ID. Если tombstone есть — conditional restore с сохранёнными полями. Если он исчез, нужно реальное доказательство отсутствия active representation: authenticated GET, все страницы identity search с showDeleted, сохранённые cancellation/attempt facts; 404 без проверки доступа недостаточен. После этого в одной journal transaction резервировать следующую representationGeneration, сохранить старый mapping как history и insert нового deterministic ID. Все retries используют эту generation. При неполном/противоречивом proof — recovery_required. Реальная disappearing-tombstone ветка остаётся provider E2E gate; injected 404 не доказывает Google semantics. [Events.insert: status](../../../docs/google-calendar/articles/v3/reference/events/insert.md#status)

**Cut/end — несколько Google requests, не remote atomic operation:**

1. Prepare core cut/end result без domain writes. Reserve new series/detached lesson IDs once. Journal фиксирует old natural key → reserved new ID, old zone/instant и ownership marks. Existing legacy rule без Google binding не является remote master: такой cut блокируется history_only.
2. GET master/affected instances/prefix exceptions; validate preconditions and persist observed ETags. До первого mutating request нет confirmed local cut.
3. Под сериализацией отменить только old tail representations, которые переходят в detached singles; trim old master; проверить, что old tail не active. Затем создать detached singles/new master по зарезервированным IDs и восстановить допустимые prefix exceptions при необходимости. Empty old series → cancelled master, не invalid RRULE.
4. Каждый acknowledged stage сохраняет факты в journal/read model. При partial failure публикуется фактическое частичное Google состояние с command `partial_recovery`; новые remote representations до domain commit имеют binding transition/commandId и read-only. Не показывать старый local future как актуальную замену. Нельзя показывать полный Save или полный rollback.
5. Unknown stage reconcile перед следующим stage; definitive failure следующего stage требует explicit resume, а не скрытой будущей команды. Resume использует прежние IDs/lineage и актуальные provider preconditions. Автоматическая compensation, которая может стереть external edit, не применяется.
6. Только после всех обязательных Google proofs применить domain cut/end один раз. SQL transaction сохраняет old prefix, новые IDs, прежние marks/instants/zones, mapping и applied. Marks могли меняться локально во время provider ожидания: их актуальные значения читать/копировать под domain locks при apply; не перезаписывать captured старой mark. Mapping journal позволяет публиковать known partial facts, не перепривязывая history к случайному новому ID.

Реальное поведение Google trim/prefix exceptions/DST доказывается E2E. [Recurring events](../../../docs/google-calendar/articles/guides/recurringevents.md) подтверждает master/instance модель и предостерегает от массовой модификации instances для whole-series. Ни документ, ни локальная симуляция не доказывают сохранение всех требуемых cut cases.

### 5. Exact dependency на Phase 21.1

Канонический контракт: [21.1 RESEARCH](../21.1-default-time-zone/21.1-RESEARCH.md), Stable Interface; [21.1 PLAN-INDEX](../21.1-default-time-zone/21.1-PLAN-INDEX.md), review clarifications.

- `TeacherSettings.defaultTimeZone` — зона нового input/display/accounting. Её смена не создаёт Calendar command.
- `SeriesRule/ScheduleSeries.timeZone` и `SingleLesson/ScheduleLesson/ScheduleBlock.timeZone` — stored creation/rule zone; startsAt остаётся instant.
- `ScheduleOccurrenceRef = {kind:'single';lessonId:string} | {kind:'series';seriesId:string;originalOn:string}`.
- `localTimeCandidates(date:string,time:string,zone:string): readonly Date[]`; `startOfZonedDay(date:string,zone:string): Date` — core owners. Manual gap reject, fold first, recurring gap skip.
- `nextSeriesReference({rule,exceptions,now}) → {originalOn,actualStartsAt:Date,ruleStartsAt:Date|null}|null`. `ScheduleSeries.referenceOccurrence` сериализует этот объект в ISO; whole-series использует natural ruleStartsAt, не moved actual.
- Cut success `{kind:'ok';oldEndsOn;newRule;lessons:CutLesson[]}`; newRule/CutLesson имеют timeZone; CutLesson.originalOn несёт lineage. Новый rule получает current default zone, detached tail — прежние instant/mark/zone.
- Phase 24 разделяет нынешние mutation functions на prepare/apply и добавляет возврат reserved lineage. Это необходимое изменение API owner 24; оно не переносит Google в core и не требует переделать принятые zone rules.

### 6. OAuth, disconnect, encryption и runtime

OAuth: authenticated teacher + Origin; одноразовый state digest, TTL, PKCE verifier encrypted, account/session ID и session epoch, expected connection generation. Callback атомарно consume flow до exchange; проверить текущую сессию, fixed redirect и оба реально выданных scopes. Проверить primary target до замены старого рабочего grant. Отсутствующий refresh_token в refresh response не очищает сохранённый token. Client/refresh credentials и encryption key остаются server-only. [Web-server OAuth](../../../docs/google-calendar/articles/related/identity/protocols/oauth2/web-server.md), [best practices](../../../docs/google-calendar/articles/related/identity/protocols/oauth2/resources/best-practices.md)

Envelope: authenticated encryption Node crypto, случайный nonce, key ID, AAD account/connection/credential generation; ключи вне БД. Rotation re-encrypt/CAS, прежний key читается до завершения rotation. Access token держать только в server memory; durable refresh ciphertext и flow verifier зашифрованы. Refresh/dispatch/revoke координирует один connection lease; refresh persistence generation CAS исключает старый ответ. Logs — safe codes/requestId, не SDK objects, code/state/token/query. Caddy OAuth query redaction обязательна наряду с app logger; callback no-store/no-referrer.

Disconnect сразу прекращает новые admission/dispatch, увеличивает generation и сохраняет history, cache, mappings и journals. Unsent commands получают not_applied; previously dispatched work остаётся видимым unresolved. Credentials становятся revoke-only. Отозвать grant, затем очистить live ciphertext и memory. Google events не удаляются. После reconnect к прежнему target прочитать Google и разрешить старые attempts до новых edits; никакого local export.

**Revoke recovery:** Google документирует 200 как success и 400 как error, с возможной задержкой вступления revoke в силу. Lost reply → retry 400 не означает success. Сохранить disconnect_failed и действия retry / проверить удаление доступа в Google Account. После прекращения всех old revoke attempts пользователь может удалить grant через Google Account и явно подтвердить это endpoint `confirm-revoked`; record `operator_confirmed`, очистить credentials и разрешить новый consent. Этот путь не выдаётся за provider-confirmed revoke. Пока идут старые revoke attempts, новый consent запрещён: revoke действует на scopes проекта и не должен отозвать новый grant. Никакого бессрочного terminal state без пути восстановления. [Token revocation](../../../docs/google-calendar/articles/related/identity/protocols/oauth2/web-server.md#tokenrevoke)

pg-boss schema/queues создаёт migration role; runtime отключает DDL/reindex и получает только нужные queue-schema privileges. Domain no-delete policy сохраняется. Не отключать требуемый maintenance ради сокрытия grants error. server composition запускает pump/worker; lifecycle сначала прекращает admission/work, сохраняет unknown attempts, закрывает worker/pump, затем pool. `Closable = {name:string;close:()=>Promise<void>}`. Работа app factory не запускает worker.

### 7. Пересечения

Server принимает typed create/move/series proposal из существующих schemas и optional edited ref. Canonical `inputKey` покрывает operation, current default/rule zone, ref/version и check-through. Core 21.1 строит candidate intervals. Для bounded series проверить весь конечный диапазон, для unbounded — явную inclusive `checkThrough`; до его выбора состояние not_checked. Проверка advisory для найденных overlaps; unavailable Google одновременно закрывает write capability, поэтому прежнее «local Save доступен при outage» не сохраняется.

```ts
type GoogleConflictEvent = CalendarEventView & { matchedStartsAt: string[] }
type GoogleConflictResult =
  | { state: 'not_checked'; inputKey: string }
  | { state: 'complete'; complete: true; inputKey: string; checkedRange: CalendarRange;
      checkedAt: string; events: GoogleConflictEvent[] }
  | { state: 'unavailable'; inputKey: string; reason: CalendarIssue }
```

Gateway читает каждую страницу объединённого finite interval. Google timeMin ограничивает event end, timeMax — event start. Локальный strict overlap фильтрует результат по каждому candidate; ответ содержит только overlaps. Для series `matchedStartsAt` перечисляет все candidate starts, с которыми пересекается event. Исключать лишь точно редактируемые representations; при occurrence move не исключать весь master. All-day exclusive end преобразуется через core startOfZonedDay в calendar zone. Cancelled/transparent не блокируют. Failed page, repeated token, malformed time или изменившийся generation → unavailable, не clean. Stale inputKey/late responses UI отбрасывает.

### 8. Минимальный persisted snapshot и privacy

Хранить в app DB только поля для last-known calendar и shared next/index:
`accountId,connectionId,calendarId,generation,snapshotRevision,windowStart,windowEnd,displayTimeZone,calendarTimeZone,fetchedAt,coverageState`; event fields:
`eventId,etag,recurringEventId?,originalStartTime?,summary|null,start(date|dateTime,timeZone),end(date|dateTime,timeZone),status,transparency,eventType`; mapping:
`localRef|null,studentId|null,representationGeneration,commandId?`.
Opaque keys/versions derived from these facts. Status/search coverage для next index: `asOf,revision,result,startsAt|null,checkedAt,completePrefix/endOfList`. title в UI = summary либо neutral English fallback; raw description/attendees/location/Meet/attachments не сохраняются и не показываются.

Journal хранит validated user operation/input, reserved IDs, expected ETags, owned write payload/digest, observed ack/stage facts, timestamps/errors. Summary для создаваемого lesson берётся из локальной карточки в момент команды; обычное изменение student name остаётся локальным и само не запускает deferred Calendar write. Запись в Google отправляет summary, start/end, stored zone, recurrence/status и opaque private markers. Marks, balance, payments, rates, notes и credentials туда не отправляются.

Unsaved form draft хранится только в памяти вкладки; offline autosave или replay draft отсутствует. Для lost POST/reload sessionStorage может хранить только opaque requestId/commandId, без title/time/input. Accepted command payload хранится в DB journal, не в browser storage.

Cache persists после restart и Disconnect для last-known view. При следующем успешном read того же window snapshot заменяется. Удаление истории не добавлено; автоматический TTL или гарантированный срок удаления не обещается. Raw provider responses и conflict bodies не архивируются. Выбранные provider fields могут оставаться в DB backups по реальной политике эксплуатации; очистка live credentials не означает немедленную очистку backups.

Получатели: Google при consent/token и Calendar reads/writes; сервер dv-lab и его DB/backups для перечисленных данных; authenticated teacher browser для safe view. Browser не получает refresh/access tokens, envelope keys, full provider payload или private journal. Не добавляются ad/analytics recipients. Privacy должна прямо описать чтение названий/времени, хранение last-known cache и journal, purpose восстановления, локальность финансов и сохранение Google events при Disconnect.

Public `/welcome`, `/privacy`, `/terms` — вне authenticated route group; explicit proxy allowlist; root Today остаётся приватным. Branding homepage = /welcome. UI не показывает Phase 25 Live updates/Last full check/Events to review. [OAuth policies](../../../docs/google-calendar/articles/related/identity/protocols/oauth2/policies.md), [Brand verification](../../../docs/google-calendar/articles/related/identity/protocols/oauth2/production-readiness/brand-verification.md)

## Planned write set и точные internal signatures

Это inventory **будущей реализации**. Каждый файл нужен указанному критерию. Планировщик распределяет его по ограниченным задачам. Текущая подготовка пишет только три документа.

| Module / files | Изменение | Критерий |
| --- | --- | --- |
| `packages/contracts/src/{calendar,today,students,auth,index}.ts` | Calendar DTO/schema/errors; week response, command meta/receipt, Today freshness, StudentRow.nextLesson | SC1–5, C2 |
| `packages/db/src/calendar-schema.ts`, `src/index.ts`, `drizzle.config.ts`; generated migration | Connection/flow, normalized event cache/coverage/next index, command/stage/mapping/reservation; historyCutoverAt | SC1–4, C2 |
| `apps/api/src/calendar/{read-model,reads,gateway,event-mapping}.ts` | Единые reads/projection, all pages, mapped binding, next proofs | SC2,4,5, C2 |
| `apps/api/src/calendar/{commands,journal,worker,transitions}.ts` | Admission, serialization, deterministic command/stage recovery | SC2,3 |
| `apps/api/src/calendar/{connection,credentials}.ts` | OAuth/PKCE/envelope/refresh/revoke/operator recovery | SC1,4 |
| `apps/api/src/schedule/{command-plan,command-apply}.ts` | Pure preparation + confirmed apply; existing mutation seams routed here | SC2,3 |
| `apps/api/src/schedule/{schedule,changes,series,rows,marks}.ts` | Убрать ранние domain writes из публичного calendar пути; confirmed ID/mark lineage; legacy history filter | SC2,3,4, C2 |
| `apps/api/src/{today/today,cards/card-facts,cards/card-rows,cards/cards}.ts` | Shared future read, next status; сохранить cardBalances/Pays soon | C2 |
| `apps/api/src/routes/{google,schedule,today,students}.ts`; `app.ts` | Authenticated API, command receipts, common refresh before DB snapshot, account context | SC1–5, C2 |
| `apps/api/src/{config,server,lifecycle,migrate}.ts` | Load config, queue roles/start/close, resource registration | SC1,3 |
| `deploy/postgres/ensure-db.sql`, `deploy/compose.yaml`, `deploy/env.example`, `.env.example`, `deploy/caddy/Caddyfile` | Names-only config, queue schema grants, query redaction; без live действия | SC1,3 |
| `apps/web/app/(app)/settings/_components/{settings-screen,calendar-card}.tsx` | Connection/disconnect/error/resume guidance; new calendar-card | SC4 |
| `apps/web/app/(app)/schedule/_components/{schedule-screen,week-grid,lesson-block,event-tooltip,lesson-details,lesson-dialogs,new-lesson-content,lesson-move-form,move-series-dialog,end-series-dialog,schedule-mutations,use-slot-drag}.*` | Provider view/external/all-day, barriers, 202 polling, approved dialogs/conflicts | SC2,4,5 |
| `apps/web/components/app/{google-calendar-state,google-conflicts}.tsx` | Shared status/read capability/conflict UI; proposed new files | SC4,5, C2 |
| `apps/web/app/(app)/_components/today-screen.tsx`, `today-lessons.tsx`; `apps/web/app/(app)/students/_components/students-screen.tsx` | Upcoming/next uses same status; historical marks remain usable | C2 |
| `apps/web/app/{welcome,privacy,terms}/page.tsx`, `apps/web/proxy.ts` | Public pages and exact allowlist | SC6 |
| `e2e/{calendar,move,marks,today}.spec.ts`; `e2e/support/{api,data,test,calendar}.ts` | Durable public journeys, target/persistence binding, controlled runtime failure; calendar files new | SC1–6, C2 |
| `apps/api/package.json`, `yarn.lock` | Approved exact pg-boss/googleapis installation only | SC1–3 |

Звёздочка в schedule UI inventory обозначает уже существующее расширение .ts/.tsx, а не неизвестный module owner; PLAN должен назвать реальные пути до edits. `apps/web/lib/api-client.ts` сохраняет свой transport ownership; менять его только если реализация receipt parsing требует этого, с inventory update. Generated migration paths фиксируются после `yarn db:generate`; generated output вручную не править.

Новые API signatures:

```ts
type CalendarReadContext = { accountId: string; now: Date }
type CalendarReadSelection =
  | { kind: 'window'; start: Date; end: Date; displayTimeZone: string }
  | { kind: 'next'; studentIds: readonly string[] }

refreshCalendarRead(context: CalendarReadContext, selection: CalendarReadSelection): Promise<void>
readCalendarWindow(executor: DbExecutor, context: CalendarReadContext,
  selection: Extract<CalendarReadSelection, { kind: 'window' }>): Promise<GoogleScheduleWindow>
readNextLessons(executor: DbExecutor, context: CalendarReadContext,
  studentIds: readonly string[]): Promise<ReadonlyMap<string, NextLessonRead>>
submitCalendarCommand(context: CalendarReadContext,
  input: ValidatedCalendarCommand): Promise<CalendarCommandReceipt>
readCalendarCommand(context: CalendarReadContext, commandId: string): Promise<CalendarCommandSnapshot>
prepareScheduleCommand(executor: DbExecutor, input: ValidatedCalendarCommand,
  context: CalendarReadContext): Promise<PreparedCalendarCommand>
applyConfirmedCommand(tx: DbExecutor, command: PreparedCalendarCommand,
  confirmation: VerifiedGoogleResult): Promise<void>
```

`ValidatedCalendarCommand` — discriminated union существующих create/move/cancel/restore/series-move/end input schemas с target и CalendarCommandMeta. `PreparedCalendarCommand` — immutable typed journal plan из раздела 3; `VerifiedGoogleResult` — валидированный набор provider/stage facts, не флаг `confirmed:boolean`. SQL journal владеет их версиями. Не создавать generic JSON bag/any или отдельный provider framework.

`cardFacts(executor,cards,now)` получает дополнительный `accountId`; new `CardFacts.nextLesson` обязателен. `getCard/listCards/updateCard/archiveCard/restoreCard/setOpeningBalance` передают context к private toDetail/cardFacts; соответствующие routes и readToday перечислены выше. `createCard` возвращает unknown/none с корректным status без сети; importCard не вызывает facts и не расширяется. Existing tests/fixtures, которые вызывают изменённые signatures, сохраняются и адаптируются; новых isolated test suites нет.

## Планирование и минимальное доказательство

| Wave | Outcome | SC / условие перехода |
| --- | --- | --- |
| 0 | Принятый 21.1 dependency, DTO/schema/journal/projection; failure scenarios до behavior | SC1–5, C2; execution сначала сверяет фактические 21.1 exports |
| 1 | OAuth/credentials/connection gates + public pages | SC1,4,6; public teacher/anonymous paths |
| 2 | Complete Google window и shared future/next owner, cache/freshness | SC2,4, C2; отсутствие legacy future на всех трёх surfaces |
| 3 | Single command tracer, queue/lease/ack/apply/restart | SC2,3; no false Save, one active event |
| 4 | Recurring/instance/restore/cut stage recovery | SC2,3; history/marks/zone proofs |
| 5 | UI receipts/recovery/conflicts + exact privacy integration | SC4,5,6, C2; consumers собраны без local-first ветки |
| External | Deployment/Branding Production и day-8 real refresh | SC1,6; отдельная authority и timestamped evidence |

### Failure modes → durable public E2E

| Scenario / ожидаемый результат | Journey owner | Критерий |
| --- | --- | --- |
| No connection; first connect with existing legacy future | calendar + today: empty/unavailable until Google read; legacy не экспортируется и не попадает upcoming/next | SC2,4, C2 |
| Week page 2 fails/restart between pages | calendar: старый complete cache read-only; incomplete не публикуется fresh | SC2,4 |
| Google event на второй странице / external all-day / private sparse data | calendar + move: provider facts видны; unmapped read-only; нет student matching | SC2,5 |
| Google changed mapped time; Schedule → Today → Students | today + move: одинаковые provider facts/revision или явный stale/unknown; нет legacy fallback | C2 |
| Next search deadline/end-of-list/next already passed | today: unknown отличается от none; balance/Pays soon не меняются | C2 |
| Bad/replayed state, other session/student, denied consent/partial scope | calendar: чужой grant не сохранён, старый valid grant не потерян | SC1,4 |
| Refresh expiry, invalid_grant, concurrent refresh | calendar: coordinated refresh/reconnect; no new writes до разрешения old dispatched work | SC1,4 |
| Revoke response lost → retry 400 | calendar: disconnect_failed, не false success; operator-confirmed recovery допускает новый consent после quiescence | SC4 |
| Create/move/cancel/restore: до dispatch failure, после provider accept loss, после ack DB crash | move: unsent failed не оживает; unknown pending; projection_pending recover; one active representation | SC2,3 |
| Два edits от одной base version / delayed first reply | move: второй 409; первый response не подтверждает второй command | SC3 |
| Confirmed cancelled single tombstone disappeared | move: real access/absence proof, следующая deterministic representation generation, old history intact | SC2 |
| Cut/end: moved/marked/cancelled tail, effective-past moved occurrence, crash после каждого material stage | move + marks: honest partial Google view, stable reserved IDs, current marks intact, resume без повторного cut | SC2,3 |
| Legacy future later becomes past / existing historical mark | marks + today: нельзя создать ложную confirmed history; старая mark/balance сохранена | C2 |
| Default-zone change, natural reference, midnight, gap/fold | move: core21.1 oracle, same identity; no reschedule от settings change | SC2 |
| Conflict page 2, all-day boundary, own-instance exclusion, full finite range, unavailable provider | move: все overlap, явный range; stale input отброшен, offline Save blocked | SC5,4 |
| Anonymous /welcome/privacy/terms; private Today/Settings | calendar: public exact allowlist; real data flow copy | SC6 |
| Production grant → >=8×24h → real token refresh + public read | calendar acceptance: без повторного consent на том же grant/generation | SC1,6 |

Сценарии пишутся в существующем E2E harness до behavior. Реальные Google calls/данные требуют разрешённого target; этот research их не выполняет. Fault injection может рвать transport или процесс после настоящего provider accept, но не выдавать synthetic 200/404 за факт Google. Недостижимая provider ветка остаётся UNVERIFIED, не заменяется красивым mock.

**P1: воспроизводимый public-path запуск.** Existing `yarn test:e2e` сначала запускает `scripts/dev-checks/wait-dev.mjs up`, который проверяет localhost:3000/4000. `E2E_TARGET_ORIGIN` сам по себе это не исправляет. Для authorized HTTPS target использовать direct command:

```sh
E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/calendar.spec.ts e2e/move.spec.ts e2e/marks.spec.ts e2e/today.spec.ts --grep '\[calendar\]' --project=light
```

Это **будущая**, сейчас не запущенная команда. `e2e/support/{data,test,calendar}.ts` должен сначала связать public origin, actual API build и разрешённую _dev/_test persistence/fixtures одного runtime. При несовпадении fail preflight до записи. Не направлять локальный SQL fixture в другую БД, пока browser работает с публичным origin. Callback остаётся fixed; новый environment/deploy не подразумевается. Direct `yarn playwright test ... --list` используется для статического discovery сценариев без localhost preflight. Light/dark smoke берётся только в нужных UI ветках.

Evidence каждого будущего E2E: diff/build fingerprint, scenario/fixture refs, expected/observed provider count/fields и public UI state, numeric exit, exact rerun command, target/persistence identity без secrets/user content. Static check и provider behavior — разные доказательства.

## Security Domain и Runtime State Inventory

| State / риск | Owner / контроль |
| --- | --- |
| OAuth flow replay/session swap | One-use state, encrypted verifier, PKCE, epoch/TTL/generation |
| Credential exposure | Authenticated envelope, server key ring, no raw SDK logs, Caddy query redaction |
| Projection/cache leak | Teacher/account filter, minimal fields, no-store HTTP, private DB/evidence |
| Queue/stale worker race | Immutable command/stage, lease + generation CAS + provider If-Match, unknown barrier |
| Partial pages/unknown write falsely accepted | Complete-window publication, typed states, explicit recovery; no optimistic domain commit |
| Foreign event/ETag collision | Persisted mapping + validated ownership + observed fields; no blind force-write |
| Local history changed by retries | Reserved IDs, idempotent apply, copy current marks under lock; no row deletion |

Применимость ASVS 5.0.0: V2 validation, V6/V7 existing auth/session, V8 authorization, V10 OAuth, V11 crypto, V12 transport, V14 data protection, V16 logging. Это design mapping, не certification. Сохраняется прежний проверенный источник: [ASVS 5.0.0](https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.json). Ни отдельный security audit, ни новый test layer не добавлен.

Do not hand-roll: OAuth SDK/crypto primitives, PostgreSQL queue, второй recurrence resolver, frontend Google client. У pg-boss runtime нет migrator credentials; transient faults не оправдывают повышенные grants.

## Assumptions Log и Open Questions

| ID | Проверяемое допущение / основание | Опровержение / proof |
| --- | --- | --- |
| A1 | 21.1 contract принят, source ещё не реализован; user + PLAN-INDEX 13/37/9 | Исполнитель сверяет реальные exports после 21.1; изменение принятого контракта требует обновить dependent plan |
| A2 | Google expansion/trim сохраняет нужные prefix/DST semantics при выбранном representation; docs дают методы, но не runtime proof | Real recurring/cut E2E; до него UNVERIFIED |
| A3 | OAuth app остаётся Testing; текущий CONTEXT D-04 | Console/Production evidence перед внешней приёмкой |
| A4 | Marks/accounting остаются локальными; прямое уточнение пользователя | Только новое явное расширение задачи на финансы изменит границу |

Primary-only, no offline edits, Google acknowledgement, first read/no legacy export и preservation — принятые решения, не assumptions. Открытых product questions нет. Технические recovery/read choices определены выше; повторное engineering approval не требуется.

## Sources

Локальная точка входа: [READING](../../../docs/google-calendar/READING.md), snapshot 2026-10-11. Прочитаны relevant Google articles/methods и сверены exact methods/fields/scopes с Discovery revision 20261005. Local references рядом с решениями обязательны для PLAN. Before execution проверять актуальность внешнего API по сохранённым original URLs; заново собирать весь docs corpus не требуется.

OAuth Production/day-8: [OAuth overview, expiration](../../../docs/google-calendar/articles/related/identity/protocols/oauth2.md#expiration); Testing с Calendar scopes выдаёт refresh token с семидневным сроком. Deployed homepage/Branding и фактический refresh после восьми суток здесь не проверены.

Сохранённые primary package/runtime references: [pg-boss queues](https://raw.githubusercontent.com/timgit/pg-boss/12.37.1/docs/api/queues.md), [workers](https://raw.githubusercontent.com/timgit/pg-boss/12.37.1/docs/api/workers.md), [constructor](https://raw.githubusercontent.com/timgit/pg-boss/12.37.1/docs/api/constructor.md), [ops](https://raw.githubusercontent.com/timgit/pg-boss/12.37.1/docs/api/ops.md), [OAuth BCP](https://www.rfc-editor.org/rfc/rfc9700.html), [Caddy log filters](https://caddyserver.com/docs/caddyfile/directives/log), [Node crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html). Ранее проверенные package facts не становятся runtime compatibility PASS.

## Metadata and Evidence

**Confidence:** MEDIUM. Provider calls, application tests/build, package install, migrations, deployed pages, Production и day-8 — NOT RUN / UNVERIFIED в этой подготовке. Статическая проверка ниже доказывает только структуру, ссылки, signatures inventory, coverage и fingerprints прочитанных inputs.

### Reproducible static document proof

Команда выполняется из корня этого worktree. Python 3.9.6; Node v24.17.0. Hash scope: 41 прочитанный input/source/API документ, не весь repository. UI B1–B6/D7 прочитаны как требования binding; файл меняет другой owner и не объявляется frozen.

```sh
python3 - <<'PY'
from pathlib import Path
import hashlib,json,re
p=Path('.planning/phases/24-google-calendar-connection-and-outbound-sync')
names=['24-RESEARCH.md','24-ARCH-REVIEW.md','COVERAGE.md']
texts={n:(p/n).read_text() for n in names}
r=texts[names[0]]
baseline=json.loads(r.split('<!-- INPUT_HASHES_START -->\n\x60\x60\x60json\n',1)[1].split('\n\x60\x60\x60',1)[0])
changed=[q for q,h in baseline.items() if hashlib.sha256(Path(q).read_bytes()).hexdigest()!=h]
assert not changed, changed
links=[]
for name,t in texts.items():
 for label,dest in re.findall(r'\[([^]\n]+)\]\(([^)]+)\)',t):
  dest=dest.strip('<>')
  if '://' in dest or dest.startswith('#'): continue
  path=dest.split('#')[0]
  target=(p/path).resolve()
  assert target.is_file(), (name,dest)
  if '#' in dest:
   anchor=dest.split('#',1)[1]
   assert ('id="'+anchor+'"') in target.read_text(), (name,dest,'anchor')
  links.append((name,dest))
required=['GoogleScheduleWindow','CalendarSeriesContext','CalendarCommandReceipt','CalendarCommandSnapshot',
 'CalendarCommandMeta','NextLessonRead','GoogleConflictResult','GoogleConflictEvent',
 'CalendarReadContext','refreshCalendarRead','readCalendarWindow','readNextLessons',
 'submitCalendarCommand','readCalendarCommand','prepareScheduleCommand','applyConfirmedCommand',
 'outcome_unknown','projection_pending','partial_recovery','historyCutoverAt',
 '/google/commands/by-request/:requestId','operator_confirmed','requestedRange','snapshotRange']
assert all(q in r for q in required)
assert all('D-'+str(i).zfill(2) in r for i in range(1,15))
assert all('SC'+str(i) in r for i in range(1,7))
assert all('GCAL-'+q in r for q in ['01','02','03','09','10'])
assert len(re.findall(r'^## AR-0[1-5] ',texts['24-ARCH-REVIEW.md'],re.M))==5
discovery=json.loads(Path('docs/google-calendar/calendar-v3.discovery.json').read_text())
actual={a+'.'+b for a,d in discovery['resources'].items() for b in d.get('methods',{})}
rows=re.findall(r'^\|\s*([A-Za-z]+\.[A-Za-z]+)\s*\|\s*(INTEGRATE|OPT-OUT)\s*\|([^\n]+)\|',texts['COVERAGE.md'],re.M)
calendar={a for a,b,c in rows if not a.startswith('oauth.')}
assert calendar==actual, (calendar^actual)
assert len(rows)==42 and len({a for a,b,c in rows})==42
assert sum(b=='INTEGRATE' for a,b,c in rows)==10
assert all(c.strip() for a,b,c in rows)
print(json.dumps({'status':'PASS','inputs':len(baseline),'changed_inputs':changed,
 'local_links':len(links),'signatures_and_states':len(required),'decisions':14,
 'requirements':5,'criteria':6,'architecture_decisions':5,'coverage_rows':len(rows)}))
PY
```

Native coverage command указан в COVERAGE. Runtime/E2E/install/build здесь не запускались. Source signature snippets описывают **planned** interfaces; static presence check не выдаётся за TypeScript compilation.

### Input fingerprints (SHA-256)

<!-- INPUT_HASHES_START -->
```json
{
  "AGENTS.md": "fbef0e319fe49ffb5ab0067e8feac8093172f958b0a70808ff5a376bbb72c9be",
  ".planning/EXECUTOR-RULES.md": "1eca1fa30e110bd04658cbf885d1b2189ce854f3cd3ed49664194f6121cbd449",
  ".planning/ROADMAP.md": "8086f1c229dd3cedc531db4421c9806cd9e72382598358dfaa2e75ce8cd5b93e",
  ".planning/REQUIREMENTS.md": "fcd333a9311950f02baa649052a9716c77826931bae45394c8d278064589cf27",
  ".planning/phases/24-google-calendar-connection-and-outbound-sync/24-CONTEXT.md": "ac66b788f6df2dba913b123bd60dd518896ea88915038421e9366834f88317c3",
  "docs/google-calendar/READING.md": "3d8d9ce8a7efc33c7cfa9fb5762e68d2b978eeb8f0a14673cd80aaf63dba5d6f",
  "docs/google-calendar/calendar-v3.discovery.json": "664963309b45f751a05c851b774a795f007653200ab3e5684076619ca9c56c1d",
  "apps/api/src/routes/schedule.ts": "04ca5d16195d184fefb83125dcd3b0908a468adebc8a3b3e02aad803e74a2529",
  "apps/api/src/routes/today.ts": "c3ed42cb1b0d487a90723239e5f55ae389a5bc375702ae582b29e79b6dbbd8f9",
  "apps/api/src/routes/students.ts": "77a0566a7f6711660e36f47c0e439710c2714bd361b76d8fc28bc03019378a28",
  "apps/api/src/today/today.ts": "dcc5b2f1126b3a9f34f0ffbf076a437651c378ad4318b4170886eef07d2cc11e",
  "apps/api/src/cards/card-facts.ts": "dfe6f168fdf78715ed8da076c8e09d88adabe3137fedd13886285a6dafb25948",
  "apps/api/src/cards/card-rows.ts": "8c430aa7dbda7e4bbc7d7c586ce58b0c9002d410c4b530262a550014cd94e67f",
  "apps/api/src/cards/cards.ts": "492678fefa2b54ed09ccdd29cdddbd4b79fecde9dead50aeaaff615a6ceaf741",
  "apps/api/src/schedule/series.ts": "b4a1eba21ccad6be1b4ad5b95fedabc8fc9ef86f1afcf6446f64d63455ec4d3b",
  "apps/api/src/schedule/schedule.ts": "6ccc98f1616d036e617fbe85fe0ee1232a677047160b1e4fa3ce44921eba0370",
  "apps/api/src/schedule/marks.ts": "bd34ff3f9084dc8eb1d7de192bf47b407c04298890db6541163aa3209f483a71",
  "packages/contracts/src/schedule.ts": "8aca7568586280125042611c28574f5ff79f600132435693aee96c134a306eed",
  "packages/contracts/src/today.ts": "a9011daf4de98d811c0385318a341936a91aa8b10f88431f2f53ccbf81ba3346",
  "packages/contracts/src/students.ts": "91a2cd1de3a3045e1f1788110689469f686d74697eb96c8bd32465dbf2f67d44",
  "scripts/dev-checks/wait-dev.mjs": "bbc8ffd87e685198f0c094c8dc16d23d9af6adb7a838e08e018da017d56ba22f",
  "e2e/support/data.ts": "3b81b170d66b82f9263a37091fc2f2c6acf026749b2fa1ad30a8563d4c85c1c7",
  "package.json": "bc9cf52234fcc3fb194e04c805af0bb9264cc69f69d3b236c3541aa013d3b62a",
  ".planning/phases/21.1-default-time-zone/21.1-RESEARCH.md": "3db87f2370abb6cbfd6b94e563b8bc7d67eb42b23a4e09bf09647f7efeded657",
  ".planning/phases/21.1-default-time-zone/21.1-PLAN-INDEX.md": "a95caaa4ac5015c5979dc7bac32e807b2e9a67b996dce8982954d8eefbd9e8e5",
  "docs/google-calendar/articles/guides/recurringevents.md": "42882969cfc66b2ca1207438be55839098064f0dd434d8fe4c58a9dfd28ff955",
  "docs/google-calendar/articles/guides/errors.md": "0a1aeff40da4803beeb5b596aefd4addc02856284f73c610e14a010d95d372a6",
  "docs/google-calendar/articles/guides/version-resources.md": "813c9eb7af279ef18f06fa82101c4fa398af72bc0e4ac412ba12387d0d0c2a31",
  "docs/google-calendar/articles/guides/pagination.md": "a727b2120e1f15d3808d86be3d9eeef801abc5ccb2bfb185fd1b6a34946b0890",
  "docs/google-calendar/articles/guides/extended-properties.md": "9bb505e3d785c3515d76dbdb7c3cb0ab72767ef2772f19abada4d6ce0332d417",
  "docs/google-calendar/articles/v3/reference/events/get.md": "a151f8346d958507c066c981a02b34010acee544fbd62f0d24a462c4e31e5e96",
  "docs/google-calendar/articles/v3/reference/events/insert.md": "a7fee13437da33cd537e141965422600ff647fd24eeaf9de4f027ea8596a1cdb",
  "docs/google-calendar/articles/v3/reference/events/patch.md": "343b1948faf7d5786440629adef676a372c7a3017c6a7687c1adfa59eea3423e",
  "docs/google-calendar/articles/v3/reference/events/instances.md": "ae65371ce34090383ac6fd9ba708ab1ebba07b62cc65487c9ac70d386aacd2b0",
  "docs/google-calendar/articles/v3/reference/events/list.md": "12f04274c628c8b50afa1eeae6ea97d6a4a9f30e1f86fc1046bc6afa230f5e23",
  "docs/google-calendar/articles/v3/reference/calendarList/list.md": "032c33da9ba14e08e085b03d89184e75f84520251f21557f104424f75a1a3e24",
  "docs/google-calendar/articles/related/identity/protocols/oauth2/web-server.md": "e45ccbeadf3fce6b72cdb00f7daa138d079c7f9346cabb079a34c48e5a8e7ba8",
  "docs/google-calendar/articles/related/identity/protocols/oauth2.md": "742616758dc5ee80a2727e64a9d39dff2cf7c3f06c0f5c8b330856c0e829f61f",
  "docs/google-calendar/articles/related/identity/protocols/oauth2/resources/best-practices.md": "4885ac400edc53d3348014937e29e741568efda7176c6d8bdd1f9f668a9bf3d2",
  "docs/google-calendar/articles/related/identity/protocols/oauth2/policies.md": "cc39d3add5b0ec4e660b5f94e435113a3534d855dba676fecf79bfd24a3bc328",
  "docs/google-calendar/articles/related/identity/protocols/oauth2/production-readiness/brand-verification.md": "7ac4ed8fc4c6383f6ba24ae31104b80744f6a4fc708d46ed6b082a92fc44ced0"
}
```
<!-- INPUT_HASHES_END -->

**Static results (2026-10-11):** Python document proof — exit 0, PASS: 41 inputs, changed_inputs=[], 37 local links, 24 signature/state assertions, 14 decisions, 5 requirements, 6 criteria, 5 architecture decisions, 42 coverage rows. Native coverage command — exit 0, passed=true, surface=42, integrate=10, optout=32. Runtime checks — NOT RUN. Это scoped document proof, не полный source audit и не готовность старых PLAN.
**Stop condition:** три assigned документа согласованы с D-13/D-14/C2 и дают exact handoff. Изменение остальных planning files и readiness executable PLAN принадлежат parent.
