---
phase: '24'
slug: 'google-calendar-connection-and-outbound-sync'
status: approved
reviewed_at: '2026-10-11T11:12:11Z'
shadcn_initialized: false
preset: none
created: '2026-10-11'
design_version: 'v40'
---

# Phase 24 — UI Design Contract

Контракт календаря с Google как источником событий: подключение, чтение, подтверждение команд, восстановление, пересечения и публичные страницы. UI copy — English. D-13/D-14 меняют поведение принятого v40. Изменённые bindings согласованы со stable RESEARCH и проверяются отдельным static proof; прежние визуальные решения сохраняются. Runtime, Production и работа подключения через 8 дней не проверены.

## Scope Contract

| Поле | Контракт |
| --- | --- |
| Outcome | Один актуальный UI-SPEC по D-01…D-14 для planner/executor |
| C1 | Без Google изменения расписания недоступны; после подключения отображается полное Google window; при сбое последний подтверждённый вид доступен только для чтения с freshness |
| C2 | Save success появляется только после подтверждения Google и локальной проекции; pending/unknown, reconnect и сохранение ввода не теряют команду и не создают повтор |
| C3 | Полная проверка пересечений конечного диапазона; внешние unmapped события доступны только для чтения; public copy соответствует реальным потокам данных |
| C4 | SC1…SC6 и GCAL-01/02/03/09/10 имеют наблюдаемую UI-проекцию, будущие E2E и явные технические зависимости |
| In scope | Состояния, English copy, композиция v40, narrow/light/dark, keyboard/focus, DTO needs, будущая E2E matrix |
| Out of scope | Реализация, независимое OAuth/queue research, watch/syncToken/410/nightly, matching/Assign/Ignore, chat, новый большой интерфейс, перенос marks/accounting в Google |
| Owned write | Только `.planning/phases/24-google-calendar-connection-and-outbound-sync/24-UI-SPEC.md` в ROOT Phase 24; public/source signatures не меняются |
| Prohibited work | Source writes, Git, env/secrets, DB, dependencies/install, runtime/build/browser/CUA, provider writes, другие агенты, новая test suite |
| Work map | D-13/D-14 и состояния просмотра → C1; command/recovery/draft → C2; conflicts/external events/public copy → C3; bindings/matrix/static proof → C4 |
| Verification | Структура, SC/GCAL, локальные ссылки, требуемые сигнатуры/семантика, hashes прочитанных входов; без запуска приложения |
| Stop | B1–B6 связаны со stable RESEARCH, changed-binding static proof завершён; runtime/Production/day-8 PASS не заявлен |

### Falsifiable assumptions

1. **A1:** Принятая копия дизайна остаётся v40. Основание: `VERSION` и запрос. Опровержение: новая принятая версия; сверяется только затронутый дизайн.
2. **A2:** 21.1 — принятая зависимость планирования (13 plans / 37 tasks / 9 waves), implementation ещё нет. Основание: запрос и Stable Interface for Phase 24. Опровержение: реализованные сигнатуры отличаются; planner обновляет binding.
3. **A3:** Marks и accounting остаются локальными. Основание: прямой запрос и CONTEXT A3. Опровержение: явное расширение продуктового запроса на эти данные.
4. **A4:** Installed inventory в ROOT неизвестен: root/web `node_modules` и `components.json` отсутствуют. Опровержение: разрешённая среда с установленными зависимостями; executor проверяет exports/version.

### Authority and sources

Пути репозитория относятся к `/Users/kdvornichenko/.codex/worktrees/phase-24-google-calendar-preparation/dv-lab`.

| Источник | Использование |
| --- | --- |
| [24-CONTEXT.md](24-CONTEXT.md), D-01…D-14 | Google source, ACK до success, read-only outage, primary-only, reconnect, сохранение истории |
| [ROADMAP](../../ROADMAP.md), Phase 24; [REQUIREMENTS](../../REQUIREMENTS.md) | SC1…SC6; GCAL-01/02/03/09/10; граница 25 |
| [24-RESEARCH.md](24-RESEARCH.md); [24-ARCH-REVIEW.md](24-ARCH-REVIEW.md) | Единственный владелец точных API/DTO и privacy storage; старый local-first контракт не переносится в эту ревизию |
| [READING](../../../docs/google-calendar/READING.md) | Локальный snapshot Google 2026-10-11, Discovery revision 20261005; прочитан до статей |
| [Events: list](../../../docs/google-calendar/articles/v3/reference/events/list.md); [Pagination](../../../docs/google-calendar/articles/guides/pagination.md) | Полные статьи: primary, singleEvents, all pages, окно, роли/скрытые детали |
| [Discovery](../../../docs/google-calendar/calendar-v3.discovery.json) | events.list parameters; Events.nextPageToken; Event summary/start/end/transparency/eventType; EventDateTime date/dateTime/timeZone |
| `/Users/kdvornichenko/dv-lab-design/VERSION`, `project/principles.md`, `project/tokens.css` | v40, Base UI Variant A, English, плотность, темы, поверхности |
| `project/components/SettingsCalendar/{README.md,preview.html}` в design root | Connection/Sync Panels, reconnect и подтверждение Disconnect; copy обновлена по D-13/D-14 |
| `project/components/{WeekGrid,ScheduleAgenda,EventTooltip}/README.md` | Существующие grid/list/block/tooltip; отдельного EventBlock README нет; не создавать новый главный экран |
| `project/components/{NewLessonDialog,DateField,Banner}/README.md` | Формы, конечный Check through, предупреждения и сохранение ввода |
| `apps/web/app/(app)/settings/_components/settings-screen.tsx`, `components/app/layout-parts.tsx` | Settings shell, URL tab, Panel, PageHeader/PageScroll |
| `apps/web/app/globals.css`, `lib/font-weight.ts`, `components/ui/*` | Реальная app-scale и Base UI wrappers |
| `apps/web/proxy.ts`, `app/(app)/{page,layout}.tsx`, `app/layout.tsx`, `app/login/page.tsx` | `/` — приватный Today; общий theme и login |
| `apps/web/app/(app)/schedule/_components/new-lesson-content.tsx`, `components/app/{confirm-dialog,date-field,time-pair}.tsx` | Существующие формы, focus и форматирование |
| [21.1 RESEARCH](../21.1-default-time-zone/21.1-RESEARCH.md) и [21.1 PLAN-INDEX](../21.1-default-time-zone/21.1-PLAN-INDEX.md) | Stable Interface for Phase 24; зона и occurrence identity |

D-11: только основной календарь, без selector и account email. D-12: stop dispatch → revoke/clear live credentials; история, Google events, mappings и незавершённые intents сохраняются. Reconnect к прежнему target сначала разрешает исход отправленных команд. D-13/D-14: первая connection читает Google, не экспортирует старые уроки; очередь не означает сохранённый урок. Открытых продуктовых выборов нет. Прежние 14 PLAN не подтверждены этой спецификацией. AgentFlow suspended; workflow остаётся work-router → GSD UI preparation без делегирования.

## Design System

| Property          | Value                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| Tool              | Manual: существующая копия Variant A v40; shadcn CLI/preset отсутствует                                 |
| Preset            | Not applicable; новый preset не вводить                                                                 |
| Component library | Только Base UI через локальные wrappers; Radix и cmdk запрещены                                         |
| Icon library      | Существующие lucide-react/icons wrappers; никаких новых icon packs или Google logo assets               |
| Font              | Локальный Inter Variable; JetBrains Mono уже существует, но новый моноширинный текст здесь не требуется |
| Registry          | Новых registry blocks нет; install/init/search с запуском пакетов не выполнялись                        |

shadcn gate: отсутствие `components.json` не означает отсутствие дизайна. Существующая библиотека подтверждена source; текущий запрос запрещает установку. Повторное согласование дизайна и инициализация не нужны.

## Component Inventory

Could not enumerate: root/web node_modules and components.json are absent in this ROOT on 2026-10-11; installation and package execution are outside the authorized preparation scope. Installed export count and resolved package version are unknown.

Manifest pins `@base-ui/react` 1.8.0 и `lucide-react` 1.53.0 — заявленные версии, не установленный inventory. Проверка наличия: `python3 -c 'from pathlib import Path; print({p:Path(p).exists() for p in ["node_modules","apps/web/node_modules","components.json","apps/web/components.json"]})'` из ROOT; все четыре значения — False. Ниже неполный перечень проверенных source counterparts, не закрытый allowlist пакета.

| Component                              | Import path                                                                          | Назначение                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| PageHeader, PageScroll, Panel          | `@/components/app/layout-parts`                                                      | Settings, публичная типографика и поверхности; PageHeader без eyebrow                                                |
| Tabs, TabsList, TabItem, TabPanel      | `@/components/ui/tabs`                                                               | General / Google Calendar; существующие клавиши и focus                                                              |
| Button                                 | `@/components/ui/button`                                                             | Connect, Reconnect, Refresh, confirmation                                                                            |
| Banner, BannerTitle, BannerDescription | `@/components/ui/banner`                                                             | Reconnect, ошибка, loading/partial conflict state                                                                    |
| Dialog family, ConfirmDialog           | `@/components/ui/dialog`, `@/components/app/confirm-dialog`                          | Подтверждение Disconnect по D-12; Keep connected focus и нейтральное primary action                                  |
| Skeleton / SkeletonText                | `@/components/ui/skeleton`                                                           | Загрузка connection snapshot без ложного disconnected                                                                |
| ReadError                              | `@/components/app/read-error`                                                        | Ошибка чтения вкладки с Refresh                                                                                      |
| ScrollArea                             | `@/components/ui/scroll-area`                                                        | Уже существующие scroll/fade и прокрутка списка conflicts                                                            |
| TimePair                               | `@/components/app/time-pair`                                                         | Использовать после привязки formatter к 21.1; не размножать расчёт зон                                               |
| DateField / Calendar / Popover         | `@/components/app/date-field`, `@/components/ui/calendar`, `@/components/ui/popover` | Check through для серии; пустое значение — новое состояние существующего поля, не существующая возможность DateField |

Source discovery воспроизводится через `rg -n '^export|@base-ui/react' apps/web/components/ui/{button,tabs,dialog,banner,select,skeleton,scroll-area}.tsx apps/web/components/app/{confirm-dialog,time-pair}.tsx`. Это не перечисление установленного пакета.

## Spacing Scale

| Token | Value | Usage                                                              |
| ----- | ----- | ------------------------------------------------------------------ |
| xs    | 4px   | Подпись под основной строкой                                       |
| sm    | 8px   | Группы кнопок и иконок                                             |
| row   | 12px  | Внутренний gap строк и вертикальный padding существующего Panel    |
| md    | 16px  | Padding карточек, между карточками, поля формы                     |
| lg    | 24px  | Верхний desktop gap и публичные секции                             |
| xl    | 32px  | Desktop page gutter через PageScroll                               |
| 2xl   | 48px  | ReadError/empty panel и внешние отступы длинной публичной страницы |
| 3xl   | 64px  | Нижний резерв страницы через PageScroll                            |

Новая раскладка использует только эти кратные 4 значения. Существующие wrappers сохраняют внутренние 2px rings/offsets и другие внутренние метрики; это не новая spacing scale. Высоты: 28px compact actions, 36px обычные actions, 32px navigation rows; при переносе текста строка растёт. Desktop defaults не повышать до новой плотности. Карточки radius 16px, controls 8px; эти значения унаследованы.

## Typography

| Role                 | Size | Weight | Line Height  |
| -------------------- | ---- | ------ | ------------ |
| Caption              | 12px | 400    | 16px / 1.333 |
| Body / control label | 13px | 400    | 20px / 1.538 |
| Card heading         | 16px | 600    | 22px / 1.375 |
| Page heading         | 22px | 600    | 28px / 1.273 |

Четыре размера и два CSS weight для новых частей. Page heading использует существующий `.app-scale` (22/28), а не отдельную 28px шкалу design preview. `fontWeights.semibold` внутри скопированных wrappers задаёт variable axis 550; это существующая реализация semantic semibold. Не переписывать её или кнопки ради унификации числового weight. Public pages используют ту же app-scale. Не добавлять hero typography, uppercase labels, eyebrow или labels `State: connected` из лабораторного preview.

## Color

| Role                | Light / Dark                                                            | Usage                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Dominant (60%)      | `surface-1` #fafafa / #171717; `surface-2` #fcfcfc / #1e1e1e            | Shell и основной фон                                                                                                    |
| Secondary (30%)     | `surface-3` #ffffff / #252525, `shadow-2`                               | Connection, Sync, public content, вложенная поверхность                                                                 |
| Accent (до 10%)     | `link` oklch(0.5 0.17 265) / oklch(0.75 0.13 265); `focus-ring` #6b97ff | Только текстовые ссылки Home/Privacy policy/Terms и существующий focus indicator                                        |
| Primary action      | `primary` oklch(0.205 0 0) / oklch(0.922 0 0)                           | Нейтральные Connect/Reconnect/Sign in                                                                                   |
| Warning             | `warning` #f59e0b / #fcd34d                                             | Reconnect и conflicts: существующий Banner с иконкой и текстом                                                          |
| Error / destructive | `destructive` oklch(0.577 0.245 27.325) / oklch(0.704 0.191 22.216)     | Существующий error Banner, включая failed revoke; Disconnect сохраняет события и использует нейтральный primary confirm |
| Connected marker    | `correct` #15803d / #4ade80                                             | Одна check-circle рядом с подтверждённым connected status                                                               |

60/30/10 задаёт иерархию поверхностей, а не требование заполнить 10% страницы цветом. Текст — `foreground`/`muted-foreground`; warning tint через существующий Banner, не оранжевый body text. Никаких новых цветов уроков в Phase 24: сохранить текущий `selected`. Google color sync и маркировка входящих событий не выдаются за готовые функции. Темы наследуются от общего ThemeProvider.

## Surface and Interaction Contract

### Settings → Google Calendar

Одна вкладка `Google Calendar` после `General`, URL `/settings?tab=calendar`. Прямой переход/refresh сохраняют вкладку; неверный tab использует General fallback. Заголовок `Settings`, Tabs, колонка max-width 720px, gap 16px. Connection, затем Sync при известном target. Не монтировать Phase 25 UI: Live updates, Last full check, Events to review, Assign/Ignore; нет disabled заглушек этих функций.

Connection использует прежний Panel. Actual primary calendar label — plain text из safe DTO. Calendar selector отсутствует. Account email не запрашивается и не выводится; calendar ID не служит подписью и не попадает в browser logs. Ошибка snapshot не превращается в Not connected. На narrow действие переносится под статус.

Sync остаётся простым Panel со строками состояния. Description: `Calendar requests and their confirmation status.` Счётчик `Unconfirmed changes` означает ещё не завершённые команды, а не сохранённые уроки. Ноль допустим только из достоверного snapshot. Не складывать queue jobs, provider substeps и команды в один count. Неизвестный count не равен нулю. `pendingCommandCount` из `GoogleConnectionSnapshot` считает unresolved commands; stages/jobs не считаются отдельными изменениями. Если сохранённые незавершённые команды существуют после Disconnect, они остаются видимым paused/recovery статусом; отсутствие credentials не стирает их из UI. Нет progress percentage, Sync now или browser writer.

### Binding to safe API contracts

Единственный владелец DTO — `packages/contracts/src/calendar.ts`; нормативный handoff — RESEARCH §1/§2/§7/§8. Это предписанные будущие сигнатуры, ещё не реализованный source. Таблица связывает существующие схемы handoff с UI и не создаёт вторую схему. Запросы web используют `apiRequest`; пути ниже без `/api`.

| Binding | Exact contract → UI | Status |
| --- | --- | --- |
| B1 connection | `GoogleConnectionSnapshot`: `state`, `calendar`, `generation`, `issue`, `pendingCommandCount`, `disconnectResolution`, `allowedActions`; Settings/connection gate | BOUND / RESEARCH §2 |
| B2 shared read | `GoogleScheduleWindow`: `requestedRange`, `snapshotRange`, `connection`, `read: CalendarReadStatus`, `events: CalendarEventView[]`, `write`; `NextLessonRead` и `TodayResponse.calendarRead/calendarWrite` используют общий confirmed owner | BOUND / §1 C2, §2 |
| B3 command | `CalendarCommandMeta { requestId, expectedVersion }` → `202 CalendarCommandReceipt { commandId, statusUrl }`; `CalendarCommandSnapshot` связывает результат с request/generation/version и confirmed revision | BOUND / §2 |
| B4 recovery | `GET /google/commands?state=unresolved`, `GET /google/commands/:commandId`, `POST /google/commands/:commandId/resume`; `nextAction` и `effect` управляют восстановлением; `confirm-revoked` — отдельное operator evidence | BOUND / §2, §6 |
| B5 conflicts | `GoogleConflictResult`: `not_checked`, `complete`, `unavailable`; complete содержит `inputKey`, `checkedRange: CalendarRange`, `checkedAt`, `events: GoogleConflictEvent[]` с `matchedStartsAt` | BOUND / §7 |
| B6 privacy/draft | Persisted fields/retention из §8 ниже; draft inputs только в памяти вкладки, sessionStorage только opaque requestId/commandId | BOUND / §8 |

| Endpoint / operation | Exact UI binding |
| --- | --- |
| `POST /google/connect` | Teacher/Origin-protected authorization URL; действовать только при `allowedActions` connect/reconnect |
| `GET /google/callback` | Fixed server callback; clean Settings redirect, safe outcome; новый read проверяет connection, query flag не доказывает success |
| `GET /google/connection` | `GoogleConnectionSnapshot`; connected grant не означает network availability |
| `GET /schedule/week?start=YYYY-MM-DD` | `GoogleScheduleWindow`; использовать snapshotRange для нарисованного окна, requestedRange для запрошенного |
| `POST /schedule/lessons` | Прежний create body + `CalendarCommandMeta`; expectedVersion — fresh window token |
| `POST /schedule/lessons/:id/{move,cancel,restore}` | Прежний body + meta; expectedVersion — версия target projection |
| `POST /schedule/series/:id/occurrences/:originalOn/{move,cancel,restore}` | Body + meta; originalOn сохраняется в rule zone |
| `POST /schedule/series/:id/{move,end}` | Body + meta; expectedVersion охватывает affected series |
| Все schedule POST выше | Только `202 CalendarCommandReceipt`; это ещё не `kind:ok`, close или success toast |
| `GET /google/commands/by-request/:requestId` | Account-scoped lookup после потери ответа POST; 404 не доказывает not_applied; retry допустим только того же requestId/body |
| `GET /google/commands?state=unresolved` | Unresolved command snapshots для Settings/schedule recovery после reload/new tab; не private journal |
| `GET /google/commands/:commandId` | Ownership-scoped `CalendarCommandSnapshot`; после applied перечитать общий read owner |
| `POST /google/commands/:commandId/resume` | Только `partial_recovery`/`recovery_required` и `nextAction: resume_recovery`; fresh check и продолжение той же команды |
| `POST /google/conflicts` | Fresh authenticated finite check; B5, полные Google pages |
| `POST /google/disconnect` | Stop admission/dispatch и durable revoke; progress читать через connection |
| `POST /google/disconnect/confirm-revoked` | Явное подтверждение ручного удаления grant в Google Account; результат `operator_confirmed`, не provider success |
| Existing `/mark` endpoints | Локально; только сохранённая history или confirmed lesson binding; external/pending/legacy future rejected |

Connection `state`: `not_connected`, `connected`, `reconnect_required`, `permission_required`, `disconnecting`, `disconnect_failed`. Calendar содержит `{ id, label, timeZone }` либо null. Показывать label, не ID/account email. Actions выводить только из `allowedActions`: `connect`, `reconnect`, `disconnect`, `retry_disconnect`, `confirm_revoked`. Нельзя вывести доступный Reconnect только из expired copy: server gate учитывает незавершённые revoke attempts. Ошибка нового consent не отменяет прежний валидный grant.

`CalendarIssue` mapping: `connection_required` → C01/C22/C33; `reconnect_required` → C03/C21; `permission_required` → C26; `provider_unavailable` → C35 или C36 без snapshot; `command_pending` → C39; `external_change` → C28; `disconnect_failed` → C09; `invalid_provider_data` → C54/C36; `history_only` → C55/C56. Command-only `precondition_failed` → C57, `not_applied` → C42 только при effect none. Consent C04–C08 — safe callback outcomes, не новые CalendarIssue values. Provider text не выводится.

### Connection and calendar view states

`CalendarReadStatus` и write capability — отдельные оси. `write.state: ready` — разрешение конкретного свежего read; сервер повторяет probe/GET при admission/dispatch. `write.state: blocked` всегда закрывает calendar actions и показывает `write.reason`; нельзя открыть Save только по `connection.state: connected` или `read.state: fresh`.

| Exact read state | Observable view | Write behavior |
| --- | --- | --- |
| `fresh` с `fetchedAt`, `revision` | Complete last observed Google traversal; C34 с временем/зоной; пустой events → C37 только для полного snapshotRange | Только write ready; per-event binding/editBlock и command barrier остаются обязательными |
| `last_known` с `fetchedAt`, `revision`, `reason` | Последний complete persisted snapshot покрытого окна; C34 + Read-only, причина по CalendarIssue | Blocked; ни offline queue, ни optimistic lesson |
| `unavailable` с `reason` | events=[] не означает пустой календарь; C36 и доступное Connect/Reconnect/Refresh | Blocked; не заполнять неделю legacy rows |
| Transport loading/error | Skeleton при первом read; прежний вид остаётся с прежними датами и stale label, если он уже был подтверждён | До нового достоверного DTO actions закрыты |

`CalendarRange { start, end, timeZone }` использует server bounds; end исключителен. `requestedRange` не переименовывает старый `snapshotRange`; при другой неделе без persisted coverage показывать unavailable. Refresh/navigation читает Google в Phase 24. `Last checked` относится к read.fetchedAt, не к времени изменения event, не к Last full check/nightly и не к live updates. Partial pages, repeated token или malformed event не публикуются как fresh/empty. Revision/generation не дают позднему read откатить новую проекцию.

Whole series и End получают `CalendarSeriesContext { series: ScheduleSeries; version: string }` из `GoogleScheduleWindow.series` по series.id. Это включает stored rule/timeZone и `referenceOccurrence` 21.1; форма использует natural ruleStartsAt, а moved actualStartsAt остаётся временем вхождения. `version` относится ко всей серии и передаётся в command meta. После reload context перечитывается через тот же window owner; без context действия закрыты. Не использовать память прежней формы, instance version или непроверенный legacy rule. Проверка существующего journey: reload → Whole series с moved reference occurrence; правильные weekday/time/zone, fresh whole-series precondition и явный отказ stale version.

| Connection/recovery presentation | Observable UI and transition |
| --- | --- |
| Not connected | C01/C33 + allowed Connect; last-known, если сохранён, read-only; New lesson/drag/move/cancel/restore/end-series/Save недоступны |
| Consent opening/return | `Opening Google…`, затем `Checking Google connection…`; duplicate CTA disabled; filled form остаётся в исходной вкладке |
| Connected | C02 и actual primary label; window/read/write отдельно определяют доступность calendar |
| Expired/revoked or permission lost | C03 или C26; Reconnect только из allowedActions; last-known read-only |
| Wrong target during reconnect | C27; прежняя identity сохраняется, новый target не подменяется |
| Same-target reconnect | C14/C39; read/reconciliation ранее dispatched work до новых edits; unsent/not_applied команды не оживают |
| Disconnecting | C31; stop dispatch, retained cache/history/journal; нет нового consent до остановки старых revoke attempts |
| Disconnect failed | state disconnect_failed, C09; только разрешённые retry_disconnect/confirm_revoked; lost reply + Google 400 не считается success |
| Disconnect complete | state not_connected; disconnectResolution provider_confirmed → C29; operator_confirmed → C46 + C29; не смешивать источники evidence |

### Shared Today and next-lesson binding

Schedule и будущие lessons/upcoming/counts Today читают один confirmed-calendar projection. `TodayResponse.calendarRead: CalendarReadStatus` показывает тот же freshness/reason; `TodayResponse.calendarWrite: GoogleScheduleWindow['write']` закрывает calendar actions Today. При unavailable календарная часть показывает C36; Earlier, существующие marks, balances и Pays soon остаются доступны по прежним правам. Unmapped external event, pending draft и legacy future не входят в Today upcoming/next.

`StudentRow.nextLessonAt` определяется только `nextLesson.startsAt`; рядом приходит `nextLesson: NextLessonRead`. Нельзя интерпретировать null в прежнем поле без `nextLesson.result/status`.

| `NextLessonRead` result/status | Display |
| --- | --- |
| `known`, fresh, non-null startsAt | Существующий TimePair/date для подтверждённого next; status.fetchedAt/revision относятся к его proof |
| `known`, last_known, non-null startsAt | C51 и C34; если прошлое next уже истекло, не вычислять новое из legacy recurrence: reader должен вернуть unknown/last-known, UI показывает C50 |
| `none`, fresh, startsAt=null | C49 `No next lesson` только при доказанном end-of-list или отсутствии bindings |
| `none`, last_known, startsAt=null | C49 `No next lesson at the last check` + C34; не текущая гарантия отсутствия |
| `unknown`, startsAt=null, либо unavailable | C50; interrupted page/deadline или устаревший proof не превращаются в none |

Known требует non-null, none/unknown требуют null; invalid DTO идёт через read error. Нет скрытого горизонта поиска или browser recurrence. Card mutations используют cached next reader: локальный update карточки не делает Calendar fresh. Existing IDs/marks/payments/balances сохраняются. `historyCutoverAt` отделяет прежнюю историю: legacy future без mapping не становится confirmed history с течением времени и не получает новую mark. Существующие marks не удаляются/не пересчитываются; confirmed lessons становятся историей обычным путём.

Первая connection читает Google, а не экспортирует локальные future lessons. Прежняя история остаётся в existing card/history surfaces. Если она уже показана в schedule, label `Local history` и read-only не выдают её за Google confirmation. Mapped events не дублируются с history.

### Unresolved requests and explicit recovery

В существующем Sync Panel показать C47 и компактный список из `GET /google/commands?state=unresolved`. Строка показывает operation label: create → `Create lesson`, move → `Move lesson`, cancel → `Cancel lesson`, restore → `Restore lesson`, move_series → `Move series`, end_series → `End series`; затем state copy; key — commandId. Не выводить private journal, request payload, expectedVersion, provider IDs или выдуманное время отправки. Snapshot содержит `requestId`, `generation`, `expectedVersion`, `operation`, `effect`, `state`, `issue`, `confirmedRevision`, `affectedRefs`, `nextAction` для связи status с правильным запросом.

Loading/error списка — C53; empty — C58 только после достоверного полного списка и pendingCommandCount=0. Reload/new tab восстанавливает список с сервера, даже если browser IDs потеряны. Запрос одной строки читает `GET /google/commands/:commandId`. Переход к статусу из schedule использует те же данные, не второй writer.

| `nextAction` | UI behavior |
| --- | --- |
| `wait` | Pending status/poll; no new write action |
| `refresh` | `Refresh` читает status/общий calendar owner; не повторяет mutation |
| `retry_new_command` | Только definitive failed с известным effect none: fresh version + явный новый Save с новым requestId |
| `resume_recovery` | C48 `Resume recovery`, только state partial_recovery/recovery_required; POST resume после user click; disabled до ответа, затем прочитать status |
| `none` | Нет recovery CTA; applied перечитывает общий projection, без повторного success после reload |

`CalendarEventView.binding` управляет adapter: lesson `{ ref, version }` открывает существующие lesson details; transition `{ commandId }` показывает фактическое промежуточное Google состояние read-only и ведёт к status; external остаётся read-only. `editBlock` и общий write gate обязательны. Provider event status confirmed не означает, что связанная команда applied. `eventKey`, `title`, `when`, `status`, `blocksTime` показываются по существующей геометрии ниже; schema status также допускает tentative/cancelled. `when.kind: timed` несёт startsAt/endsAt/timeZone; `when.kind: all_day` — startsOn/endsBefore/timeZone.

### Confirm access removed in Google Account

`confirm_revoked` показывается только из свежего `allowedActions`, когда server уже прекратил все old revoke attempts. C44 объясняет порядок: пользователь сам удаляет dv-lab grant в Google Account, затем выбирает `Confirm access removed`. Открыть существующий ConfirmDialog с C45 и первоначальным focus на `Back`. Это не автоматическое удаление grant и не сообщение об успехе Google.

После подтверждения вызвать `POST /google/disconnect/confirm-revoked`, disabled повторный click, затем перечитать connection. Только `disconnectResolution: operator_confirmed` и not_connected показывают C46; запись server evidence и очистка live credentials не подтверждают provider response. Новое Connect появляется только из allowedActions после этой операции. Ошибка/потеря ответа сохраняет C32 и Refresh status; не показывать C46 по одному POST/timeout. Никаких новых credentials/scopes или forced reconnect здесь нет.

### Google events in the existing schedule

WeekGrid и ScheduleAgenda принимают server-normalized events; браузер не раскрывает recurring rules. Mapped lesson использует существующие lesson block/tooltip/dialog, student linkage и локальные marks. Unmapped external event — read-only calendar item: разрешённый plain-text title, fallback `Busy`, дата/время, `Google Calendar event` и `Read-only`. Не выводить student avatar, lesson mark, deducts count, topic, Assign/Ignore или кнопки изменения. Для доступа без hover click/Enter открывает тот же Dialog shell только с details и `Close`; touch не зависит от tooltip.

Timed event использует текущую геометрию блока и `selected`. All-day event получает компактную строку `All day` над часовой сеткой того же дня; в agenda — строку дня с All day вместо часов. Это узкое расширение существующего view, не отдельный экран. Multi-day end исключителен: последний видимый день — день перед `endsBefore`. Не превращать all-day в 00:00–00:00. Полные даты доступны в read-only details. Тип Google события не превращает его в урок автоматически.

Availability берётся из server result: busy блокирует время, transparent показывается как `Available` и не считается конфликтом. Cancelled event не изображается активной занятостью; локальная cancellation history остаётся по существующему контракту. Restricted/private details используют только разрешённые поля; description, attendee email, conference links, HTML и raw Google response не выводятся. Google color sync не добавляется; текущие темы/tokens v40 сохраняются.

### Save, pending and unknown outcome

Существующие forms/CTA сохраняются. `CalendarCommandMeta.requestId` — UUID, создаётся до первого POST; expectedVersion берётся из нужного fresh window/lesson/series projection. Одинаковые account/requestId/body возвращают прежний receipt/result; иной body с тем же ID даёт 409. HTTP 202, queue receipt, journal commit и timeout не являются `kind:ok` или success.

| Exact state / effect | Form and feedback | Recovery |
| --- | --- | --- |
| Draft, ready | Существующие fields/CTA, complete conflict result; approved write capability | До POST хранить input только в памяти и opaque retry identity отдельно |
| `pending` / `dispatching` | C11; disabled duplicate submit и изменение target уже отправленного запроса | Dialog не закрывается как saved; прежний confirmed block остаётся, draft frame не становится lesson |
| `outcome_unknown`, effect unknown | C38 + Check status; не success и не definitive failure | GET by-request/command, без новой команды/ID; reconciler определяет фактический результат |
| `projection_pending`, effect confirmed | C40; Google подтвердил, локальный commit ещё не завершён | Status wait/refresh; нет нового Google write и нет success toast |
| `partial_recovery`, effect partial | C41; отображать известные Google facts, transition binding read-only | Только nextAction resume_recovery открывает C48; продолжает тот же commandId |
| `recovery_required` | C39 или C41 по effect; inputs/status остаются recoverable | nextAction resume_recovery → явный Resume recovery после свежей проверки; не false failed/success |
| `applied`, effect confirmed | Совпадающие requestId/commandId/generation/expectedVersion и confirmedRevision разрешают один `kind:ok`, close/success toast | Перечитать общий projection; affectedRefs связывают move/cut с правильными blocks; replay read после reload не повторяет toast |
| `failed`, effect none, issue not_applied | C42 и прежняя in-memory форма | nextAction retry_new_command → свежий expectedVersion, новый requestId и явный Save; не auto-submit |
| Reject до acceptance | Safe 409/503 reason; форма сохранена, confirmed lesson не вставлен | Не открывать offline queue; connection/access/precondition/history errors идут по mapping выше |

C40 projection_pending, C41 partial_recovery и отдельный recovery_required сохраняются как три разные presentation states. Partial не обещает remote atomicity или rollback. Причина отказа не стирает поля. Marks и accounting остаются локальными по existing `/mark` eligibility: сохранённая history или confirmed binding. Calendar outage не блокирует допустимую historical mark/balance operation; external/pending/legacy future новой mark не получают.

Потеря POST response: `GET /google/commands/by-request/:requestId`. 404 означает только «journal ещё не найден»: C52; при сохранённом исходном body возможен transport retry того же requestId/body, без изменения payload. После reload при утраченном draft body не восстанавливать его из догадок и не повторять POST; читать unresolved list/status. Definitive failed отличается от неизвестного результата. Новый requestId допустим только для нового явного Save после известного исхода и fresh read.

Pending можно закрыть через `View schedule`, сохранив status/opaque IDs; это не success и не cancel provider request. После reload status восстанавливается с сервера, а несохранённые inputs не обещаются восстановленными. Старый response не закрывает другую форму. Для той же identity/series server barrier возвращает command_pending; другие actions подчиняются свежей write capability. Browser mutate сопровождает receipt/status polling, Google writer/retry/reconciliation принадлежат серверу.

### Conflicts while planning a lesson or series

Существующий warning Banner над fields NewLessonDialog/move forms. Само полное предупреждение о пересечении не блокирует разрешённый Save: C17/C18 + C19. Это правило v40 не открывает запись при отсутствии Google, incomplete check или неразрешённом command outcome.

Проверять single interval и все candidate occurrences конечного диапазона. Для серии с концом — весь заданный диапазон. Для открытой серии — `Check through` под Repeats, DateField с пустым исходным значением `Choose date`, min = первый проверяемый день. Дата включительна для выбора проверяемых вхождений и не завершает серию. Пока она не выбрана, C25; check и Save недоступны. Planner расширяет empty state существующего DateField/Calendar/Popover, не передаёт пустую дату formatter. Скрытого default horizon нет.

Полный запрос включает полный конец каждого проверяемого урока. `checkedRange.start` включителен, `checkedRange.end` исключителен; подписи используют `checkedRange.timeZone`. Это `CalendarRange`, а не прежние startsAt/endsAt/displayTimeZone fields. Принимать только `inputKey` текущих validated inputs. `complete: true` требует всех Google pages и всех candidate intervals. Сервер проверяет union lesson intervals, поэтому событие между weekly lessons не становится overlap. При ошибке поздней страницы state unavailable с reason и C20, а не partial list/total/No overlaps. Loading и неполнота держат Save disabled; complete conflicts разрешают его при общей ready capability.

Complete `GoogleConflictResult` содержит `checkedAt`, `events: GoogleConflictEvent[]`; каждый event = CalendarEventView плюс `matchedStartsAt`, все candidate starts пересечений. Count берётся из events.length, строки key — eventKey. Timed rows читают `when.startsAt/endsAt/timeZone`; all-day rows — `when.startsOn`…день перед exclusive `when.endsBefore` в календарной зоне. matchedStartsAt позволяет показать конкретные даты пересечений серии без browser recurrence. Private title → `Busy`. Список без дубликатов и self-overlap; при occurrence move остальные instances серии не исключаются. `Show all {count} conflicts` раскрывает весь полный список, `Show fewer conflicts` сворачивает до первых двух; недоступный `and N more` запрещён. Браузер не пагинирует Google и не вычисляет recurrence.

| Check state | Observable result |
| --- | --- |
| Invalid/unfilled candidate or range / `not_checked` | Fields/C25; inputKey связывает незавершённую проверку с формой; нет check и Save |
| Loading or stale response | C15; предыдущий результат не считается текущим; Save disabled |
| `complete`, events=[] | C16 и точный checked range/checkedAt; complete: true обязателен |
| `complete`, one/many events | C17/C18 + C19, все строки и matchedStartsAt доступны |
| `unavailable` / failure / incomplete | reason из CalendarIssue; C20 + Check again; Save disabled до полной проверки и ready capability |
| Expired/revoked or no connection | C21/C22 + Settings/Reconnect; значения сохраняются |

Неожиданное изменение в Google даёт C28, fresh read и сохранённый draft. Нет Force overwrite или ложного success. Обычное чтение может показать новые Google facts уже в 24; автоматическое matching и continuous inbound delivery остаются 25.

### Time-zone dependency (Phase 21.1)

`TeacherSettings.defaultTimeZone` задаёт новые inputs и labels; `ScheduleSeries.timeZone`, `ScheduleLesson`/`ScheduleBlock.timeZone` — сохранённая зона. `startsAt` — instant. Смена default меняет вид, не Google event time. `originalOn` — natural date rule zone; не выводить его из отображаемой даты. Cut меняет refs; UI не дублирует старый и новый урок.

TimePair и существующие formatters — единственные владельцы показа зон. Conflict list использует одну default zone, Start time helper сохраняет вторую. Не hardcode VN/UTC offset. Checked range включает год при переходе года. Manual DST gap — field error; fold следует контракту 21.1. Browser не создаёт второй recurrence engine.

### Focus, drafts and narrow layouts

- Base UI Tabs/Dialog сохраняют keyboard semantics. Disconnect открывается с focus на `Keep connected`; confirm-revoked — на `Back`. После принятия control operation modal закрывается, progress/error остаётся в Panel; focus возвращается к connection heading. Закрытие modal не объявляет revoke завершённым.
- Unsaved draft inputs остаются только в памяти исходной вкладки. Из заполненной формы открыть `/settings?tab=calendar` в новой вкладке с noopener и C43; OAuth идёт в ней. Исходную форму сохранять mounted. Same-tab переход из dirty form проходит existing unsaved-input guard и предлагает оставить форму открытой; не заменять его обещанием восстановления после reload.
- SessionStorage содержит только opaque requestId/commandId для lost POST/status recovery. Никаких title/time/input, expectedVersion, generation, tokens, raw Google data или полноценного form draft. Accepted command payload находится в server DB journal; private journal не возвращается в браузер.
- После возвращения в исходную вкладку явно перечитать connection/window/status, проверить account/session/generation/target/version и заново проверить conflicts. Исходные fields остаются в памяти, draft сам не отправляется. Переключение account/logout очищает форму и opaque IDs. После confirmed success/явного Discard очистить in-memory draft; не считать закрытие pending status отменой команды.
- Если opaque IDs потеряны или browser storage недоступен, unresolved list восстанавливается с сервера. Reload/new tab не восстанавливает несохранённые поля и не реконструирует accepted payload для replay. Copy не обещает этого; сохранение ввода при reconnect обеспечивается оставленной открытой исходной вкладкой.
- Pending form разрешает `View schedule` со status recovery. Error остаётся видимым; icon-only controls имеют label, busy spinner — текст. Existing focus-ring/status/alert wrappers сохраняются.
- 320px/375px: 16px боковые отступы, одна колонка, actions/labels/ranges wrap, `overflow-wrap:anywhere`; горизонтальная прокрутка только существующих Tabs. Read-only details доступны click/Enter/touch. Dialog scroll не расширяет viewport.
- Light/dark используют действующие tokens. Motion наследует wrappers/reduced-motion; новых эффектов, illustrations или eyebrow нет.

## Copywriting Contract

| ID / context | English copy |
| --- | --- |
| C01 / Not connected | `Connect your primary Google Calendar to view events and manage lessons. Calendar changes require a working Google connection.` / `Connect Google Calendar` |
| C02 / Connected | `Google Calendar connected` / actual calendar label / `Disconnect` |
| C03 / Expired or revoked | `Google access expired or was revoked. Reconnect to use the calendar. The last checked view is read-only.` / `Reconnect` |
| C04 / Denied consent | `Google Calendar was not connected. You can try again when you are ready.` |
| C05 / Missing scope | `Calendar access was not granted. Allow the requested calendar permissions to connect.` |
| C06 / Invalid callback | `This connection request could not be verified. Start again from Settings.` |
| C07 / Connect failure | `Could not connect Google Calendar. Try again from Settings.` |
| C08 / App session absent | `Sign in to connect Google Calendar.` / `Sign in` |
| C09 / Revoke failed | `Calendar changes are stopped. Google access removal is not confirmed.` / `Retry disconnect` / `Refresh status`; C44 только при allowed confirm_revoked |
| C10 / Unconfirmed count | `Unconfirmed changes: None` / `Unconfirmed changes: 1` / `Unconfirmed changes: {count}` |
| C11 / Pending | `Waiting for Google Calendar to confirm this change…` |
| C12 / Status read error | `Could not load Google Calendar status.` / `Refresh status` |
| C13 / Command interrupted | `This change has not been confirmed. Check its status before trying again.` / `Check status` |
| C14 / Connection restored | `Google Calendar reconnected. Checking the calendar and earlier requests…` |
| C15 / Checking | `Checking Google Calendar for overlaps…` |
| C16 / Complete empty check | `No Google Calendar overlaps in the checked range.` |
| C17 / One conflict | `This overlaps a Google Calendar event` |
| C18 / Many conflicts | `This overlaps {count} Google Calendar events` |
| C19 / Complete conflict help | `You can still save this change. Google Calendar must confirm it before it is saved.` / `Checked range: {from}–{to} ({zone}).` |
| C20 / Incomplete check | `Could not check the full calendar range. Check again before saving.` / `Check again` |
| C21 / Check needs reconnect | `Reconnect Google Calendar before checking overlaps or saving calendar changes.` |
| C22 / No connection | `Connect Google Calendar to view events and make calendar changes.` / `Google Calendar settings` |
| C23 / Disclosure | `Show all {count} conflicts` / `Show fewer conflicts` |
| C24 / Disconnect confirmation | Title `Disconnect Google Calendar?`; body `Calendar changes will stop. Google access will be revoked and live connection credentials cleared. Your local history, Google events and unfinished request records will stay. Reconnecting the same calendar checks earlier requests before you can make new changes.`; `Keep connected`, `Disconnect`; `Disconnecting…` |
| C25 / Open series range | `Check through`; `Choose date`; `Choose the last date to check for overlaps before saving. This does not end the series.`; error `Choose the first lesson date or a later date.` |
| C26 / Permission lost | `Access to the connected calendar is unavailable. Reconnect to restore calendar access.` |
| C27 / Wrong reconnect target | `This Google account does not match the connected calendar. Reconnect with the original account.` |
| C28 / External edit | `This event changed in Google Calendar. Your change is not confirmed. Refresh the calendar before trying again.` |
| C29 / Disconnect complete | `Google Calendar disconnected. Your local history, Google events and unfinished request records were kept.` |
| C30 / Paused request | `Calendar requests are paused. Unconfirmed changes are not shown as saved.` |
| C31 / Disconnect progress | `Disconnecting Google Calendar…` / `Calendar changes are stopped. Waiting for Google access to be revoked and live connection credentials to be cleared.` |
| C32 / Unknown disconnect POST | `Could not confirm the disconnect request. Refresh the connection status before trying again.` / `Refresh status` |
| C33 / Disconnected schedule | `Connect Google Calendar to use the calendar. Previously saved history is available for viewing.` |
| C34 / Freshness | `Last checked: {date}, {time} ({zone})` |
| C35 / Outage with snapshot | `Google Calendar is unavailable. Showing the last checked view. Calendar changes are disabled.` / `Read-only` / `Refresh` |
| C36 / No confirmed window | `No checked calendar view is available for these dates.` / `Refresh` |
| C37 / Complete empty window | `No Google Calendar events in this range.` |
| C38 / Unknown command | `Google Calendar may have received this change. Its result is not confirmed. Check the status before making another change.` / `Check status` / `View schedule` |
| C39 / Reconciliation | Active: `Checking earlier calendar requests before allowing new changes…`; awaiting resume: `Earlier calendar requests need recovery before you can make new changes.` |
| C40 / Projection pending | `Google Calendar confirmed the change. Updating the displayed calendar…` |
| C41 / Partial command | Active: `Only part of this calendar change is confirmed. Checking the remaining steps…`; awaiting resume: `Only part of this calendar change is confirmed. Resume recovery to check the remaining steps.` |
| C42 / Known not applied | `This change was not applied. Refresh the calendar before trying again.` |
| C43 / Filled form reconnect | `Keep this tab open to preserve your unsaved form. Reconnect in another tab, then return here.` / `Open calendar settings` |
| C44 / Manual access removal | `If you removed dv-lab's access in your Google Account, confirm it here.` / `Confirm access removed` |
| C45 / Confirm-revoked dialog | Title `Confirm Google access was removed?`; body `Confirm only after you have removed dv-lab's access in your Google Account. This records your confirmation and clears stored connection credentials. Your calendar events and local history stay.`; `Back`, `Confirm access removed`; pending `Recording your confirmation…` |
| C46 / Operator-confirmed disconnect | `Disconnected after your confirmation that Google access was removed.` |
| C47 / Unresolved list | `Unresolved calendar requests` / `View status` |
| C48 / Resume same command | `Resume recovery` / `Checking this calendar request…` |
| C49 / Proven no next | Fresh: `No next lesson`; last_known: `No next lesson at the last check` |
| C50 / Unknown next | `Next lesson could not be determined.` / `Refresh` |
| C51 / Last-known next | `Last known next lesson: {date}, {time} ({zone})` + C34 |
| C52 / Request lookup 404 | `This request has not been found yet. Check again before sending another change.` / `Check status` |
| C53 / Request list loading/error | `Loading calendar requests…` / `Could not load calendar requests.` / `Refresh status` |
| C54 / Invalid provider data | `Could not read a complete calendar view from Google.`; when last-known exists add `The last checked view is read-only.` |
| C55 / History-only calendar action | `This record is local history. Calendar changes are unavailable.` |
| C56 / Ineligible lesson mark | `This event is not a confirmed lesson. It cannot receive a lesson mark.` |
| C57 / Stale precondition | `This lesson changed. Refresh the calendar before trying again.` |
| C58 / Verified empty recovery list | `No unresolved calendar requests.` |

C19 относится только к complete conflicts и ready calendar. C42 требует доказанного not-applied результата; текст не обещает сохранённую форму после reload. C38 не заменяется C42 по timeout. C39/C41 используют active copy только при фактической проверке; при `nextAction=resume_recovery` используют awaiting-resume copy и C48. C29 допустим только после завершённого disconnect/clear; operator_confirmed обязательно сопровождается C46. C44–C46 не называют user confirmation provider success. C40 не закрывает Save до локальной подтверждённой проекции. Внешние event labels: `Busy`, `Available`, `All day`, `Google Calendar event`, `Read-only`, `Close`; legacy record label — `Local history`.

### OAuth error boundary

Provider text, auth codes, state, tokens, callback query и raw errors не попадают в copy, DOM, toast, public pages или browser logs. Safe reason mapping задан B1/B3 и RESEARCH §2; не добавлять значения `CalendarIssue` в web. После callback URL очищен; app sign-in остаётся отдельным. Callback и scopes остаются принятыми D-03; эта UI-ревизия их не меняет.

## Public Pages — SC6

Маршруты по умолчанию: `/welcome` — public homepage, `/privacy` — Privacy policy, `/terms` — Terms. Это инженерный выбор, потому что `/` уже занят приватным Today; переносить Today или менять redirect после login не требуется. Будущий Branding homepage URL должен указывать именно на реально опубликованный `/welcome`; никакого утверждения о текущей публикации.

Маршруты `/welcome`, `/privacy`, `/terms` и приватный Today на `/` сохраняют принятое решение подготовки. Проверка SC6 и будущий Branding используют эти пути. Новая UI-ревизия не подтверждает готовность source или deployment.

Три страницы лежат вне protected `(app)` layout, используют общий root layout/fonts/theme. Точный allowlist public paths в proxy не открывает произвольные префиксы, `/settings`, `/schedule`, `/students`, `/chat` или `/`. App/API teacher checks сохраняются. Без cookies, с просроченной cookie, при недоступном session API публичный статический текст остаётся доступен; персональные сведения и integration status на эти страницы не попадают.

Композиция: page background `surface-1`, одна область max-width 720px, 16px narrow / 32px desktop gutters, обычный `PageHeader` без eyebrow, sections gap 24px, h2 16px и body 13/20. Никаких dashboard shell, mock stats, testimonials, account menu или иллюстраций. Public nav `dv-lab` → `/welcome`, `Sign in` → `/login`; footer на всех трёх страницах содержит `Home`, `Privacy policy`, `Terms`. Links доступны клавиатурой и переносятся на narrow. Primary CTA homepage — `Sign in`, без Google consent до app login.

### Homepage copy

| Element | English copy |
| --- | --- |
| Title | `dv-lab` |
| Intro | `A private workspace for managing lessons, student records and lesson payments.` |
| Schedule | `View your Google Calendar, plan lessons and recurring schedules, and keep local lesson records and payment balances.` |
| Calendar heading | `Google Calendar` |
| Calendar paragraph | `Connect your primary Google Calendar to use the calendar in dv-lab. Calendar changes are saved only after Google confirms them. If Google is unavailable, the last checked calendar view stays available for reading.` |
| History | `Existing local lesson history is kept. Connecting does not automatically send those records to Google.` |
| Access / CTA | `Sign in with your dv-lab account to use the workspace.` / `Sign in` |
| Footer | `Privacy policy` / `Terms` |

### Privacy policy copy and data-flow binding

Title `Privacy policy`. B6 привязан к фактическому предписанному storage из RESEARCH §8. Это контракт будущей реализации; перед publication сверить actual implementation, logging и backups. Служебные пояснения binding не публиковать как policy copy.

| Section | English copy | Binding |
| --- | --- | --- |
| Introduction | `This page explains how dv-lab uses Google Calendar data when a teacher connects their primary calendar.` | D-02, D-11, SC6 |
| Calendar access | `dv-lab requests access to read your calendar list and to view and edit calendar events. It uses the list to find your primary calendar. Calendar views, lesson changes and overlap checks use that connected calendar.` | Fixed scopes; без identity/profile scope |
| Information sent to Google | `dv-lab sends the student's display name as the event title, lesson start and end times, the lesson time zone, recurrence details for weekly lessons and cancellation status to Google Calendar. It also sends internal identifiers to keep updates linked to the right lesson. Student notes, payment amounts, balances, passwords and lesson marks are not included in these events. Changing a student's name in dv-lab does not automatically update Google Calendar.` | Summary captured at command; owned timing/recurrence/status/private markers; marks/rates/notes/credentials не отправляются |
| Calendar information read and stored | `To display the last checked calendar and find upcoming lessons, the server stores event identifiers and update markers, permitted titles, recurrence identifiers and original occurrence times, start and end dates or times, time zones, event status, availability and event type. It also stores links to existing lessons, students and calendar requests. Event descriptions, attendee details, locations, meeting links and attachments are not stored or shown by this feature.` | Normalized mirror fields перечислены ниже; no full provider object |
| Calendar view metadata | `The server records which account, connection and calendar a view belongs to, its date range and time zones, when it was fetched, its version and whether the range was fully checked. For next-lesson results, it records the result, the next lesson time when known, when it was checked and how much of the search was completed.` | Window coverage/generation/revision; shared next/index proof |
| Last checked view and retention | `The last checked calendar view remains stored after a server restart and after Disconnect. A successful read of the same date range replaces that view. This feature does not automatically delete the cache or history after a fixed period. Previously stored data may remain in database backups under the service's operating policy. Clearing live connection credentials does not immediately remove data from backups.` | Persist after restart/Disconnect, same-window replacement; no invented TTL/deletion guarantee |
| Connection and request records | `The server stores connected calendar details, encrypted refresh credentials and temporary encrypted authorization-flow data. It keeps calendar request records, including the requested operation and input, reserved identifiers, expected event versions, event data sent to Google, confirmation and recovery steps, timestamps and safe error categories. These records support confirmation and recovery after an interrupted request. Access tokens stay in server memory. Access and refresh tokens are not sent to the browser.` | Journal = validated operation/input, reserved IDs, expected ETags, owned payload/digest, ack/stages, timestamps/errors; queue only command ID |
| Local teaching records | `Lesson marks, student notes, payments and balances remain local teaching records. Connecting Google Calendar does not automatically publish existing local lesson history.` | History/cutover eligibility и accounting сохраняются локально |
| Form recovery | `Unsaved form inputs stay only in the memory of the open tab. Keep that tab open while you reconnect in another tab. Reloading or closing it does not restore unsaved inputs. Browser session storage may keep only opaque request and command identifiers to recover a request's status; it does not store event titles, times or form inputs. Accepted requests are recorded on the server and are not automatically replayed as new changes.` | In-memory draft; sessionStorage requestId/commandId only; private journal не отдаётся browser |
| Authorization | `Google handles calendar authorization. dv-lab processes the result on the server to maintain the connection. Calendar authorization does not replace your dv-lab sign-in.` | Existing server OAuth boundary |
| Data recipients | `Google processes authorization requests and calendar reads and writes. The dv-lab server, database and backups hold the records described here. The signed-in teacher's browser receives calendar views and request status. This feature does not add advertising or analytics recipients.` | Safe teacher DTO; no tokens/keys/full provider payload/private journal |
| Operational records | `Operational logs contain request identifiers, operation types, timing, status and sanitized error categories. They do not include authorization parameters, tokens, student names, calendar event titles or full event responses. Stored server records may also be included in backups and handled through server operations.` | Actual deployed logging/backups — execution check; raw provider responses и conflict bodies не архивируются |
| Disconnecting | `Disconnecting stops calendar changes and attempts to revoke Google access. After Google confirms revocation, live connection credentials are cleared. If revocation cannot be confirmed, Settings offers the allowed recovery actions. After you remove dv-lab's access in your Google Account, you can explicitly confirm that action in Settings; this records your confirmation and clears live credentials. Your local history, existing Google events, last checked view, links and request records are kept. Reconnecting the same calendar checks earlier requests before new changes are allowed.` | provider_confirmed и operator_confirmed раздельны; confirm-revoked после quiescence, preserved cache/history/journal |
| Refreshing the view | `Opening or refreshing a calendar view reads Google Calendar. This version does not provide automatic background delivery of changes made in Google. External events that are not linked to a lesson remain read-only calendar entries.` | Window reads в 24; watch/syncToken/nightly/matching в 25 |

Exact field ownership из RESEARCH §8, для planner/static proof; это не новая backend schema:

- Window metadata: `accountId`, `connectionId`, `calendarId`, `generation`, `snapshotRevision`, `windowStart`, `windowEnd`, `displayTimeZone`, `calendarTimeZone`, `fetchedAt`, `coverageState`.
- Event fields: `eventId`, `etag`, `recurringEventId?`, `originalStartTime?`, `summary|null`, `start(date|dateTime,timeZone)`, `end(date|dateTime,timeZone)`, `status`, `transparency`, `eventType`.
- Mapping: `localRef|null`, `studentId|null`, `representationGeneration`, `commandId?`; opaque keys/versions производны от этих facts.
- Next proof: `asOf`, `revision`, `result`, `startsAt|null`, `checkedAt`, `completePrefix/endOfList`.

Не обещать отсутствие event cache, автоматическое удаление preserved history, fixed TTL, немедленное удаление backups, certification или legal guarantee. Не выдумывать public contact. Provider fields могут оставаться в реальных DB backups; production policy сверяется до publication. D7 закрыт для planning, deployment evidence не подменяется этой copy.

### Terms copy

Title `Terms`. Product copy без выдуманных юридических положений.

| Section | English copy |
| --- | --- |
| Access | `dv-lab is a private teaching workspace. Use the account provided to you and keep your sign-in details private.` |
| Records | `Use the workspace to manage teaching records you are authorized to access. Check lesson dates, times and payment entries before saving changes.` |
| Google Calendar | `A working connection to your primary Google Calendar is required to change the calendar. A change is saved only after Google confirms it and dv-lab updates the confirmed view. A pending or unknown result is not a saved change.` |
| Availability | `When Google is unavailable, you can read the last checked calendar view. New offline calendar changes are not accepted. Check unresolved request status before trying another change.` |
| Limits of this version | `Refresh the calendar to read changes made in Google. Review overlap warnings before saving. External events are read-only unless they are already linked to a lesson.` |
| Data information | `Read the Privacy policy for information about Google Calendar data.` |

Terms использует `/privacy`. Не добавлять pricing/subscription, arbitration, jurisdiction, blanket liability waiver или promises of continuous availability. Это не утверждение о юридической достаточности или одобрении Google.

## UI Considerations

`covered` означает наличие UI-контракта, не выполненный runtime test. B1–B6 связаны со stable RESEARCH §1/§2/§7/§8; изменённые bindings имеют scoped static proof.

| Category | Element | Status | Resolution |
| --- | --- | --- | --- |
| empty/loading/error | Connection | covered | Skeleton/ReadError отличны от verified disconnected; безопасные consent errors |
| populated/partial | Connection/Sync | covered | Actual primary label; count неизвестен ≠ ноль; отдельный unresolved request status |
| loading/partial/error | Google window | covered | Все pages; previous complete snapshot с верными датами/freshness; no snapshot ≠ empty |
| disconnected/outage | Calendar actions | covered | Read-only gate включая grid gestures и прямые forms; нет offline queue |
| populated/unknown/none | Today/nextLessonAt | covered | Общий projection; NextLessonRead known/none/unknown + CalendarReadStatus; null не означает no next; historical/Pays soon сохранены |
| pending/unknown/error | Save | covered | C11/C38/C40/C41/C42; success только после ACK+projection; stable identity |
| recovery | Reconnect/Disconnect | covered | Wrong target rejected; unresolved list/resume; operator_confirmed отличается от provider_confirmed; dispatched resolution до writes |
| loading/error/zero-one-many | Conflicts | covered | Complete current range; stale result ignored; full warning сам по себе не блокирует Save |
| populated/long-text | External event | covered | Read-only details, Busy/private fallback, All day/exclusive end, нет marks/matching |
| draft/navigation | Forms | covered | In-memory inputs, reconnect в новой вкладке; только opaque IDs в sessionStorage; server unresolved list после reload, без replay inputs |
| keyboard/overflow/themes | Existing components | covered | Keep connected focus, Enter/touch details, 320/375 wrap, light/dark tokens |
| populated/privacy | Public pages | covered / B6 bound | Точные mirror/journal fields и retention из §8; actual implementation/logging/backups сверяются до publication |

Media states не применяются: новых media нет. Public static pages не требуют data loading/empty skeleton. Общая ErrorPage остаётся для ошибки рендера.

## Integrated Decisions and Execution Gates

| ID | Status / owner | Bound contract or remaining evidence |
| --- | --- | --- |
| D1 | RESOLVED / CONTEXT D-11 | Primary-only; actual label; no selector; same target reconnect |
| D2 | RESOLVED / CONTEXT D-12 | Stop dispatch/revoke/clear; сохранённые history/events/mappings/intents; resolve dispatched, no offline draft replay |
| D3 | RESOLVED product / CONTEXT D-13/D-14 | Google read source и ACK до success; stale read-only; общий confirmed projection для Schedule/Today/nextLessonAt |
| D4 | RESOLVED UI / SC5 | Явный конечный Check through; complete pages/union; overlaps не блокируют ready Save, incomplete state не открывает Save |
| D5 | IMPLEMENTATION PREREQUISITE / 21.1 | Принятый zone contract; actual source/signatures ещё не реализованы |
| D6 | EXTERNAL UNVERIFIED / owner/deployment | Branding/publication/Production и реальная датированная проверка ≥8 суток; не локальный PASS |
| D7 | RESOLVED / stable RESEARCH §1/§2/§7/§8 | B1–B6 exact DTO/endpoints, states/capabilities, shared next projection, persisted fields/retention и memory-only draft привязаны |
| D8 | SCOPED STATIC SIGN-OFF / UI owner | Проверены только changed bindings/copy/links/fingerprints; unchanged design/geometry подтверждаются section hashes; independent/runtime review не заявлен |

Открытых product/design approvals или technical handoff dependencies нет. D7/D8 закрыты для planning; D5/D6 и actual implementation остаются execution gates. Это не implementation ready. Installed inventory UNKNOWN не блокирует подготовку. Прежний checker sign-off покрывает неизменённые tokens/layout, но не новый продуктовый контракт.

## Acceptance and Future Durable E2E Matrix

| Requirement | UI acceptance |
| --- | --- |
| GCAL-01 | Primary connection, Google event source, disconnected gate, safe consent |
| GCAL-02 | Stable request/representation identity, one confirmed event, preserved history |
| GCAL-03 | Serialized command, ACK before saved, unknown recovery, no offline edits |
| GCAL-09 | Reconnect/actionable reason, same target and dispatched recovery |
| GCAL-10 | Full finite range/all pages, complete conflict list and stale input rejection |

Failure modes заданы до реализации. Расширять существующие `e2e/` journeys через public UI/API и настоящий application/persistence path. `e2e/today.spec.ts` — Today/Settings, `e2e/move.spec.ts` — move/cut, `e2e/no-show.spec.ts` — cancel/restore, `e2e/marks.spec.ts` — marks. Новый сценарий, если нужен, живёт в существующем harness и пишется до поведения. Это не разрешение создавать suite/environment, писать реальные Google events или запускать tests сейчас.

| Scenario / SC / requirement | Failure mode/setup | Expected observable outcome | Future owner/evidence |
| --- | --- | --- | --- |
| E01 / SC1,4 / GCAL-01,09 | No connection, direct form route, consent double click, primary among several calendars | C01/C33; нет calendar writes/gestures; один consent; actual primary label; selector отсутствует | Settings/schedule journey, real persistence |
| E02 / SC1,4 / GCAL-01,09 | Denied/missing scope/replayed callback, app session absent, wrong account/access lost | Safe errors, не чужая связь; Reconnect/Sign in; tokens/raw callback отсутствуют в browser evidence | Public auth handlers; real provider proof отдельно разрешается |
| E03 / SC1,2,4 / GCAL-01,02,09 | First connection with legacy local future/history and >1 Google page | Google window только после всех pages; no auto-export; history/marks сохранены; legacy future не объявлен confirmed в Today/nextLessonAt | Today/schedule + разрешённые synthetic fixtures |
| E04 / SC2,3 / GCAL-02,03 | Create/move/cancel/restore single/series/occurrence; delayed Google ACK | Pending без success/optimistic confirmed block; после ACK+projection один toast и одна representation | Move/no-show; проверка count через разрешённый provider evidence |
| E05 / SC2,3 / GCAL-02,03 | Lost POST/provider response, restart, ACK before DB projection, delayed old result, rapid edits | C38/C40; same request lookup, no duplicate; old result не закрывает new form; один confirmed projection | Existing calendar journey; fault seam owner — RESEARCH |
| E06 / SC3,4 / GCAL-03,09 | Outage/late page; last-known next already passed; deadline vs end-of-list | Fresh/last_known/unavailable и ready/blocked не смешиваются; unknown ≠ none; общий next/read projection, no hidden horizon; Pays soon/balances доступны | Today/schedule; real persistence |
| E07 / SC2,3,4 / GCAL-02,03,09 | Disconnect with dispatched unknown, revoke lost reply → retry 400, manual grant removal, same-target reconnect, partial cut/reload | C09/C31/C32/C39/C40/C41; unresolved list/resume сохраняет commandId; confirm-revoked только after quiescence; C46 operator evidence не provider success; recovery до edits; no draft replay | Connection/move durable journey |
| E08 / SC5 / GCAL-10 | Conflict on page 2+ and later occurrence; gap event between weekly lessons | Полный count/list/checkedRange; gap не overlap; собственный event не self-overlap | Existing planning journey |
| E09 / SC5 / GCAL-10 | Late page fails, inputs rapidly change, empty/changed Check through | C20/C25; Save disabled; stale result rejected; end check date не завершает серию | То же journey |
| E10 / SC5 / GCAL-10 | Complete zero/one/many, private title, all-day exclusive end, duplicate page item | C16/17/18, полный disclosure, Busy fallback; корректные границы; complete overlap warning разрешает ready Save | То же journey |
| E11 / SC1,2,4 / GCAL-01,02,03,09 | Unmapped external timed/all-day/transparent event; existing local marks during outage | Read-only details без Assign/Ignore/marks; Available не conflict; локальные marks/accounting доступны по прежним правам | Schedule/marks journey |
| E12 / SC1,3,4,5 / GCAL-01,03,09,10 | Filled form → new-tab OAuth → return; reload с opaque IDs или без них; unknown command/lookup404; keyboard/narrow/theme | Inputs остаются в исходной вкладке; storage содержит только IDs; reload восстанавливает status/list, не inputs; 404 не success; focus/wrap 320/375, themes и 21.1 без изменений | Existing Settings/move journeys, обе themes |
| E13 / SC6 / GCAL-01 | Anonymous/expired cookie/session API outage, public pages; private paths/student role | Public texts/links доступны, private auth сохранён; privacy совпадает с persisted fields/retention; нет external metadata у student | Existing auth/Settings harness |
| E14 / SC1,6 / GCAL-01 | Published Branding/Production и use спустя ≥8 суток без reconnect | Датированное external evidence, actual public URLs; сейчас UNVERIFIED | Владелец после разрешённого deployment |

SC1 ↔ E01/E02/E03/E12/E14; SC2 ↔ E03/E04/E05/E07/E11; SC3 ↔ E04/E05/E06/E07/E12; SC4 ↔ E01/E02/E06/E07/E12; SC5 ↔ E08/E09/E10/E12; SC6 ↔ E13/E14. Каждый будущий run сохраняет fingerprint, scenario/fixture refs, expected/observed, exit status и exact rerun command без secrets/user data. Использовать existing `playwright.config.ts` themes и `STATE_DIR` вне repository; точная будущая public-path command/environment заданы в RESEARCH §P1; здесь они не запускались. Default local harness нельзя объявлять real Google public callback evidence.

## Registry Safety

| Registry               | Blocks Used | Safety Gate                                                   |
| ---------------------- | ----------- | ------------------------------------------------------------- |
| shadcn official        | None        | Not applicable — существующий manual design, без init/install |
| Third-party registries | None        | Not applicable — новые blocks не предложены и не включены     |

Нет утверждения о проверке registry source через `shadcn view`: команда не запускалась, registry code не добавлен.

## Preparation Evidence

Локальные статьи Events: list и Pagination прочитаны полностью после READING. Discovery проверен по используемым fields; design прочитан без рендера. Source не менялся. Static proof не заменяет browser/provider evidence. Отдельный EventBlock README в v40 отсутствует; block geometry принадлежит WeekGrid, details — EventTooltip.

Source baseline: SHA-256 compact JSON упорядоченного списка `[relativePath, fileSha256]` для следующих 11 файлов: `apps/web/package.json`, `apps/web/app/globals.css`, `apps/web/lib/font-weight.ts`, `apps/web/proxy.ts`, `apps/web/app/(app)/page.tsx`, `apps/web/app/(app)/layout.tsx`, `apps/web/app/(app)/settings/_components/settings-screen.tsx`, `apps/web/components/app/layout-parts.tsx`, `apps/web/app/(app)/schedule/_components/new-lesson-content.tsx`, `apps/web/components/app/confirm-dialog.tsx`, `playwright.config.ts`.

Baseline aggregate: `31ebce4d0f802fce2bc21b57ec55753d2cca9a7a9464ffdbcdcc23256499899d`.

### Read input fingerprints

| Input | SHA-256 |
| --- | --- |
| `docs/google-calendar/READING.md` | `3d8d9ce8a7efc33c7cfa9fb5762e68d2b978eeb8f0a14673cd80aaf63dba5d6f` |
| `docs/google-calendar/articles/guides/pagination.md` | `a727b2120e1f15d3808d86be3d9eeef801abc5ccb2bfb185fd1b6a34946b0890` |
| `docs/google-calendar/articles/v3/reference/events/list.md` | `12f04274c628c8b50afa1eeae6ea97d6a4a9f30e1f86fc1046bc6afa230f5e23` |
| `docs/google-calendar/calendar-v3.discovery.json` | `664963309b45f751a05c851b774a795f007653200ab3e5684076619ca9c56c1d` |
| `/Users/kdvornichenko/dv-lab-design/VERSION` | `bf022ec33f714d073548153e496277fee35e01749059b7139c34f35294f208cf` |
| `/Users/kdvornichenko/dv-lab-design/project/components/SettingsCalendar/README.md` | `300ce9a357dce2a6c4effc90ec1932a0a5bbb537fde8170652445aff7dadd2f8` |
| `/Users/kdvornichenko/dv-lab-design/project/components/WeekGrid/README.md` | `9e9c2ac5d0b7f00e17c2a998e6bc3b206c09f923a49d7584ff3f6d6fb3d968d0` |
| `/Users/kdvornichenko/dv-lab-design/project/components/EventTooltip/README.md` | `af87d3c0ec4692c601b0920baf177d98b3e9f942aaae67387362e51a58ffd842` |
| `/Users/kdvornichenko/dv-lab-design/project/components/ScheduleAgenda/README.md` | `5b4d5bf6adfa62a45cddab478d4759c1d17fbeb621d95dc4f5e8bf3c41b0fb7f` |

### Stable handoff fingerprints

| Input | SHA-256 |
| --- | --- |
| `.planning/phases/24-google-calendar-connection-and-outbound-sync/24-RESEARCH.md` | `431e89eb6d21f9a7d96a0ca58200e32d4b868363cb3582e9787c14ff07746876` |
| `.planning/phases/21.1-default-time-zone/21.1-RESEARCH.md` | `3db87f2370abb6cbfd6b94e563b8bc7d67eb42b23a4e09bf09647f7efeded657` |
| `.planning/phases/21.1-default-time-zone/21.1-PLAN-INDEX.md` | `a95caaa4ac5015c5979dc7bac32e807b2e9a67b996dce8982954d8eefbd9e8e5` |

Прочитаны целиком RESEARCH §2 и §8, общий projection/next/history §1 C2; §6 и §7 задают confirm-revoked и conflicts. Cross-worktree ссылки 21.1 заменены repo-local. Provider source inputs не изменены.

Предыдущий static proof этого документа: PASS, exit 0, UI SHA-256 `e6edb676ba7dc4cb2561137a07cb0bde21680f2585bf33ecdf882b8dbca3bca3`. Из него переиспользованы успешные проверки 11 source files, 9 Google/design inputs и отсутствующего inventory. После stable handoff изменялся только этот UI-SPEC. Неизменность design/layout/geometry при привязке отдельно проверена по четырём section hashes, перечисленным в check ниже; это не повторный design audit.

Runtime/build/browser/CUA/DB/provider/Production/day-8: **NOT RUN**. Installed inventory: **UNKNOWN**. Actual DTO implementation, 21.1 source и deployed logging/backups: **UNVERIFIED**. B1–B6/D7 закрыты как planning bindings; D8 — только scoped static sign-off UI owner.

### Reproducible static proof

Из ROOT выполнить точную команду ниже. Она проверяет owned document, изменённые signatures/links и stable handoff; ничего не записывает. Предыдущая source/provider verification переиспользуется и не выдаётся за новый runtime run.

```sh
python3 -c 'from pathlib import Path; s=Path(".planning/phases/24-google-calendar-connection-and-outbound-sync/24-UI-SPEC.md").read_text(); exec(s.split("```python\n",1)[1].split("\n```",1)[0])'
```

```python
from pathlib import Path
import hashlib, json, re
p = Path('.planning/phases/24-google-calendar-connection-and-outbound-sync/24-UI-SPEC.md')
s = p.read_text()
body = s.split('## Preparation Evidence')[0]
rp = p.with_name('24-RESEARCH.md')
r = rp.read_text()
section2 = r.split('### 2. Public gates и DTO для UI/planner')[1].split('### 3.')[0]
section8 = r.split('### 8. Минимальный persisted snapshot и privacy')[1].split('## Planned write set')[0]
routes = re.findall(r'^\| ((?:GET|POST) /[^|]+)\|', section2, re.M)
routes = [x.strip() for x in routes]
links = re.findall(r'\]\(([^)]+)\)', body)
types = ['CalendarIssue', 'GoogleConnectionSnapshot', 'CalendarReadStatus', 'CalendarEventView', 'CalendarRange', 'CalendarSeriesContext', 'GoogleScheduleWindow', 'NextLessonRead', 'CalendarCommandReceipt', 'CalendarCommandSnapshot', 'CalendarCommandMeta', 'GoogleConflictEvent', 'GoogleConflictResult']
wire_values = set(re.findall(r"'([a-z_]+)'", section2.split('```ts')[1].split('```')[0]))
stored = re.findall(r'`([^`]+)`', body.split('Exact field ownership из RESEARCH §8')[1].split('Не обещать')[0])
handoff_rows = re.findall(r'^\| `([^`]+)` \| `([a-f0-9]{64})` \|$', s.split('### Stable handoff fingerprints')[1].split('Прочитаны целиком')[0], re.M)
spans = [
    ('## Design System', '## Surface and Interaction Contract', 'e987586fb096fdbc1beb2c8884e0ac7eee0678c7fd88f9de81bbbafbfdeade75'),
    ('### Google events in the existing schedule', '### Save, pending and unknown outcome', 'b2e54fb68e8e53f9b9701d6f3d24282bae564c88462db2d63ff82a9d276ade6e'),
    ('### Time-zone dependency (Phase 21.1)', '### Focus, drafts and narrow layouts', '1181b1d62b78d0f43a474df828283ed6848b363daf5deb42d658375d64f7881a'),
    ('## Public Pages — SC6', '### Homepage copy', '114f63e38a82e5acdde0dacbe4466c32ba894086ad09f4317ca1077bd204e5e7'),
]
checks = {
    'bindings_closed': all('| B'+str(i) in body for i in range(1,7)) and body.count('| BOUND /') == 6 and '| D7 | RESOLVED' in body and '| D8 | SCOPED STATIC SIGN-OFF' in body,
    'exact_endpoints': len(routes) == 15 and all(x in body for x in routes),
    'dto_types_and_wire_values': all('type '+x+' =' in r and x in body for x in types) and all(re.search(r'\b'+re.escape(x)+r'\b',body) for x in wire_values),
    'read_next_gates': all(x in body for x in ['requestedRange', 'snapshotRange', 'calendarRead', 'calendarWrite', 'nextLesson.startsAt', 'none/unknown', 'historyCutoverAt', 'Pays soon']),
    'three_recovery_states': all(x in body for x in ['C40 projection_pending', 'C41 partial_recovery', 'отдельный recovery_required', 'resume_recovery', '404 означает только']),
    'operator_not_provider': all(x in body for x in ['confirm-revoked', 'operator_confirmed', 'provider_confirmed', 'old revoke attempts', 'C46']) and 'operator evidence' in body,
    'privacy_fields': len(stored) == 31 and all(x in section8 for x in stored) and all(x in body for x in ['after a server restart and after Disconnect', 'same date range replaces', 'does not automatically delete', 'opaque request and command identifiers']),
    'memory_draft': 'inputs только в памяти вкладки' in body and 'SessionStorage содержит только opaque requestId/commandId' in body and 'новой вкладке с noopener' in body and 'Browser session storage may keep only opaque' in body,
    'copy_and_scenarios': all('| C'+str(i).zfill(2)+' /' in body for i in range(1,59)) and all('| E'+str(i).zfill(2)+' /' in body for i in range(1,15)),
    'sc_requirements': all(x in body for x in ['GCAL-01','GCAL-02','GCAL-03','GCAL-09','GCAL-10']+['SC'+str(i) for i in range(1,7)]),
    'links': bool(links) and all((p.parent / x.split('#')[0]).is_file() for x in links) and '/worktrees/phase-21-1-default-time-zone/' not in body,
    'current_handoff': len(handoff_rows) == 3 and all(hashlib.sha256(Path(n).read_bytes()).hexdigest() == h for n,h in handoff_rows),
    'unchanged_design_geometry': all(hashlib.sha256(s[s.index(a):s.index(b)].encode()).hexdigest() == h for a,b,h in spans),
    'no_stale_binding': not any(x in body for x in ['PENDING STABLE TECHNICAL HANDOFF', 'GoogleConflictInterval', 'Your lessons are saved in dv-lab', 'do not update the schedule', 'versioned draft на текущий tab']),
    'format': len(re.findall(r'^```',s,re.M)) % 2 == 0 and all(l == l.rstrip() for l in s.splitlines()),
    'honest_signoff': 'Scoped changed-binding static review' in s and '**NOT RUN**' in s and '**UNVERIFIED**' in s,
}
print(json.dumps({'status':'PASS' if all(checks.values()) else 'FAIL','checks':checks,'endpoints':len(routes),'dto_types':len(types),'wire_values':len(wire_values),'privacy_fields':len(stored),'links':len(links),'handoff_inputs':len(handoff_rows),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'research_sha256':hashlib.sha256(rp.read_bytes()).hexdigest(),'reused_evidence':'11 source + 9 provider/design inputs, prior PASS exit 0; runtime NOT RUN'}))
raise SystemExit(0 if all(checks.values()) else 1)
```

## Checker Sign-Off

**Scoped changed-binding static review — UI owner:** B1–B6 и D7 закрыты по stable RESEARCH §1/§2/§7/§8. D8 ограничен изменёнными API/DTO/copy/privacy/draft bindings, локальными ссылками и fingerprints. Exact command выше — воспроизводимая проверка. Это не независимый checker verdict и не runtime evidence.

Прежний `gsd-ui-checker` от 2026-10-11T09:54:01Z проверил dimensions 1–6 прежнего дизайна; inventory FLAG. Его unchanged design/layout/geometry сохранены и подтверждены section hashes. Полный повтор dimensions не выполнялся.

- [x] B1–B6: exact endpoints/types/states, shared next projection, persisted fields/retention и memory-only draft связаны с RESEARCH.
- [x] D7/D8: technical handoff и scoped static binding review завершены.
- [x] Independent changed-binding checker: approved 2026-10-11T11:12:11Z; 0 BLOCKER, 0 MAJOR.
- [ ] Installed inventory: UNKNOWN, nonblocking preparation.

Независимый checker сверил freshness/write capability, общий Today/next read model, command recovery, operator confirmation и privacy с RESEARCH/ARCH/COVERAGE. Copy recommendations C39/C41/C42 учтены: ожидание действия не называется активной проверкой, наличие формы после reload не обещается. Необязательное уточнение подписей Back/Close не меняет binding. Визуальные dimensions 2–6 используют прежнее доказательство; inventory остаётся UNKNOWN.

**Status:** APPROVED для планирования; незакрытых product/technical bindings нет. Реализация, runtime, Production и day-8 остаются отдельными execution gates.
