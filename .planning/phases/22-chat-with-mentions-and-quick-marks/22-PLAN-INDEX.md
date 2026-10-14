# Phase 22 — Plan index

## Outcome

Учитель записывает итог урока одной строкой в чате и получает ответы о любом ученике из сохранённых данных в пределах месячного бюджета (ROADMAP Phase 22 goal). Требования CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-07, CHAT-08, CHAT-09, CHAT-11; критерии SC1-SC5; решения D-01..D-09 и решения владельца В1-В9 (`22-CONTEXT.md`, раздел `replan_decisions`).

18 планов, 17 волн, 65 задач. Планы написаны под код 25.1 и ответы владельца 2026-10-13 и сверены с итоговым кодом 25.1 после слияния master (PR 35) (`22-REPLAN-NOTES.md`, итог — `22-REPLAN-RESULT.md`, решения — `22-CONTEXT.md`, раздел `replan_decisions`). Номер плана не совпадает с порядком: 22-18 (серии) исполняется во второй волне.

Режим: `TRACER_MODE=false`, как в 25.1. Сквозные пути (браузер → api → Postgres, api → журнал команд → Google) доказаны фазами 20-25.1; первый путь чата — 22-04 (факты карточки через все слои). Каждый план кончается проверкой своего среза: скрипт `scripts/dev-checks` и браузерный скрипт в обеих темах.

Оценки: `estimate-calibration` factor 1, 0 samples, confidence low; `raw_tokens = tokens`.

## Gate исполнения

- Итоговый код 25.1 в ветке фазы: `git merge-base --is-ancestor e238906 HEAD` (master с PR 35 слит в `gsd/phase-22-chat-replan` 2026-10-13, merge-коммит 94f3c8f). Планы сверены с этим кодом: диалога Move series и файлов `move-series-*` нет, `move_series` несёт `newStartsOn`, снимок команды — `retryAfterSeconds`, записи календаря в web оптимистичные (`optimistic-writes.ts`), блок урока носит цвет события Google.
- Исполнение разрешено владельцем 2026-10-13 (В8): 25.1 принята после живой проверки, PR 35.
- Запросы дизайна DR-22-01..05 отправляет ведущая сессия Design dude до волны, в которой их ждут (precondition задач); DR-22-01 — до запуска волны 2, чтобы ответ был готов к 22-02 в волне 3.

## Waves

| Wave | Plan | Builds | Kind | Model | Depends on | Ports / databases |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | [22-01](22-01-PLAN.md) | перенос и отмена начавшегося урока без done, no_show → none при новом начале позже текущего момента, запись отметки закрыта при незавершённой команде ключа, создание урока в прошлом, Google по тому же правилу, отметка в binding недели, `insideSyncWindow`, AGENTS.md | core + contracts + api | opus | — | dvlab_test, без портов dev |
| 2 | [22-18](22-18-PLAN.md) | серия: «all» и «this and following» с allFrom (начавшиеся неотмеченные после последней отметки переносятся), правка серии из Google по тому же правилу, allFrom в неделе, AGENTS.md | core + contracts + api | opus | 01 | dvlab_test, без портов dev |
| 3 | [22-02](22-02-PLAN.md) | начавшийся урок в Schedule и Today: перенос (в том числе в прошлое), отмена, перетаскивание, области серии по allFrom, тексты отказов | web | sonnet | 01, 18 | 3000/4000, dvlab_dev |
| 3 | [22-03](22-03-PLAN.md) | ревизия отметки, `writeMark` для всех писателей, `restoreMark` обратного переноса в журнале команд | db + contracts + api | opus | 01, 18 | dvlab_test, порт 4203; мигрирует dev и test |
| 4 | [22-04](22-04-PLAN.md) | факты карточки в /chat без модели (`/chat/records`) | contracts + api + web | sonnet | 02, 03 | dvlab_test 4224; 3000/4000 |
| 5 | [22-05](22-05-PLAN.md) | разговоры: создать, список, переименовать, удалить | db + api + web | sonnet | 04 | мигрирует; 3000/4000 |
| 6 | [22-06](22-06-PLAN.md) | заметки отдельными записями; таблица комментариев | db + api + web | sonnet | 05 | мигрирует; 3000/4000 |
| 7 | [22-07](22-07-PLAN.md) | комментарии начавшегося урока; вхождение с комментарием держит разрез серии | api + web | sonnet | 06 | 3000/4000 |
| 8 | [22-08](22-08-PLAN.md) | упоминания, быстрые формы, `readLessonDay` (день Today и чата), точный урок, цель серии с allFrom | api + web | opus | 07 | 3000/4000 |
| 9 | [22-09](22-09-PLAN.md) | сообщения и действия, отметки/заметки/комментарии с Undo, обновление экранов между вкладками | db + api + web | opus | 08 | мигрирует; 3000/4000 |
| 10 | [22-10](22-10-PLAN.md) | перенос и отмена урока и перенос серии из чата через журнал команд, Undo одиночных | api + web | opus | 09 | 3000/4000 |
| 11 | [22-11](22-11-PLAN.md) | SDK (checkpoint владельца), настройки ассистента в teacher_settings со значениями по умолчанию, выбор модели, `/settings/assistant` | db + contracts + api + deploy | sonnet | 10 | общий node_modules, один в волне; мигрирует |
| 12 | [22-12](22-12-PLAN.md) | резерв и расход по пределу из настроек, Settings → Budget | db + api + web | opus | 11 | мигрирует; 3000/4000 |
| 13 | [22-13](22-13-PLAN.md) | цикл Messages, поток, Stop, проверка публикации | db + api + web | opus | 12 | мигрирует; 3000/4000 |
| 14 | [22-14](22-14-PLAN.md) | ответы из сохранённых данных, блоки фактов, команды чтения | api + web | sonnet | 13 | 3000/4000 |
| 15 | [22-15](22-15-PLAN.md) | выбор модели и effort, уведомление бюджета, карточки Chat model и Models and limits | api + web | sonnet | 14 | 3000/4000 |
| 16 | [22-16](22-16-PLAN.md) | удаление разговора с обязательствами, privacy (чат и разделы Google после 25.1) | api + web | sonnet | 15 | 3000/4000 |
| 17 | [22-17](22-17-PLAN.md) | итоговый прогон, документы, поток хода без сжатия в Caddy, build, test, knip, существующие e2e | gate + docs + deploy | sonnet | 16 | всё; единственные `yarn build` и полный `yarn test` |

Правила волн: не больше одного плана, который правит `apps/api`, и одного web-плана в волне; файлы планов одной волны не пересекаются (проверено скриптом); у каждой задачи не больше пяти файлов, все внутри `files_modified`. Единственная параллельная пара — волна 3: 22-02 (только web и браузерные проверки, dev-стек на dvlab_dev) и 22-03 (api и миграция, проверки на dvlab_test). 22-18 web не правит: вид `today_passed` в web не используется; web-плана в волне 2 нет. `depends_on` кроме реальных зависимостей несёт последовательность api- и web-планов. `yarn build` — только 22-17; тесты api (`yarn workspace @dv-lab/api test`, чистит dvlab_test) — 22-11, один в волне; полный `yarn test` — 22-17.

Промежуточные состояния внутри ветки (выпуска посреди фазы нет): до 22-10 календарные быстрые формы отвечают P12; до 22-13 свободный текст отвечает «Model settings are unavailable» (P20) — так же, как в выпуске без ключа API.

## Contract ownership

- `packages/contracts/src/calendar.ts`: `binding.mark` урока — 22-01; `CalendarSeriesContext.allFrom` — 22-18; `restoreMark` варианта `move` в `validatedCalendarCommand` (только сервер, маршруты schedule его не собирают) — 22-03.
- `packages/db/src/calendar-values.ts` `lineage`: `clearMark` — 22-01; `restoreMark` — 22-03.
- `packages/contracts/src/auth.ts`: `lesson_done` — 22-01 (единственный новый HTTP-код фазы; коды чата — не `errorCodes`; `series_today_passed` остаётся в списке, api его не отдаёт).
- `packages/contracts/src/schedule.ts`: `expectedRevision`, `markRevision`, `revision` — 22-03; комментарии — 22-07.
- `packages/contracts/src/chat.ts`: создаёт 22-04 (факты); разговоры — 22-05; упоминания, намерение и цель урока (включая `series_marked`) — 22-08; сообщения, блоки и `chatRefusalCode` (все коды отказа чата, включая бюджет и провайдер) — 22-09; блок предложения календаря — 22-10; ход и поток — 22-13; блоки фактов и цитат — 22-14; модель разговора — 22-15.
- `packages/contracts/src/chat-settings.ts`: `chatEffort`, `chatModelEntry`, `chatModels`, `assistantSettings`, `saveAssistantSettingsRequest`, `modelCapability`, `CHAT_SETTINGS_DEFAULT` — 22-11; `budgetSnapshot`, `conversationUsage` — 22-12.
- `packages/db/src/schema.ts` `teacher_settings`: колонки настроек ассистента — 22-11 (предел — `chat_monthly_cap_usd numeric(10, 2)`, перевод в нано-доллары только в `chat/budget.ts`, 22-12).
- `packages/contracts/src/students.ts`: заметки — 22-06.

## Shared owners across plans

| Owner (plan) | Used by |
| --- | --- |
| `lessonActions` (core) и приём команд урока, `settleMarkAfterMove` (22-01) | 22-02, 22-03, 22-08, 22-10 |
| `insideSyncWindow` (`calendar/projection.ts`, 22-01) — граница окна синхронизации | 22-18 (`prepareSeriesChange`), 22-08 (цель переноса), 22-10 (предложение) |
| `historyEligibility` в режиме записи (22-01): запись отметки закрыта при незавершённой команде ключа | 22-03 (`writeMark`), 22-09, 22-10, 22-13 |
| `seriesAllFrom` (core), `seriesAnchor` (`schedule/series.ts`), `heldSeriesDates` (`schedule/rows.ts`) (22-18); нижняя граница `from` — `prepareSeriesChange` и `inbound-apply.ts` через `seriesAnchor` | 22-02 (через `allFrom` недели), 22-07 (даты с комментариями), 22-08, 22-10 |
| `writeMark(executor, …)` с ревизией (22-03) | 22-09, 22-13 |
| `restoreMark` в журнале команд, `checkMarkRestore`, `restoreMarkAfterMove` (22-03) | 22-10 (Undo переноса, снявшего no_show) |
| `readLessonDay` (`today/today.ts`, 22-08) — день учителя по правилам Today | `readToday`, 22-08 (`resolveLessonTarget`), 22-14 (`readChatDay`) |
| `readAssistantSettings` / `saveAssistantSettings`, `resolveModelChoice`, `modelCapabilities` — единственный проверяющий выбор модели (22-11) | 22-12, 22-13, 22-15 |
| `usdToNano`, `nanoToUsd`, `reserveNano`, `costNano` (`chat/budget.ts`, 22-12) | 22-13, `GET /settings/assistant` |
| `readChatFacts`, `readChatDay` (22-04, 22-14) | 22-13 (`student_facts`), 22-14 |
| `appendStudentNote` / `retractStudentNote` (22-06), `appendLessonComment` / `retractLessonComment` (22-07) | 22-09, 22-13 |
| `resolveLessonTarget`, `parseQuickCommand`, `validateMentions` (22-08) | 22-09, 22-10, 22-13 |
| `executeIntent` (22-09, выделен в 22-13) | быстрые формы, инструменты модели, календарь |
| `chat/calendar.ts` поверх `CalendarCommands` (22-10) | 22-13 (`propose_lesson_change`), 22-16 |
| `reserveAttempt` / `settleAttempt` / `release` (22-12) | 22-13 (цикл и `sweepInterrupted`) |
| `requireRole('teacher')` один раз на роутер `/chat` (22-04) | маршруты чата 22-05…22-16 |
| `refreshReaders` и канал `dvlab:data-changed` (22-09) | Today, Schedule, Students, чат |
| `apiEventStream` (22-13) | поток хода в /chat |

Владельцы 25.1, которые планы используют без изменения сигнатур: `readCalendarWindow(executor, context, selection, students?)` (`calendar/read-model.ts:254`), `readNextLessons` (`read-model.ts:312`), `CalendarCommands.submitCalendarCommand` / `readCalendarCommand` / `resumeCalendarCommand` (`calendar/commands.ts:35,124,127`), `rowForLocal` (`calendar/event-mapping.ts`), `historyEligibility` (`calendar/history.ts:104`), `cardFacts` (`cards/card-facts.ts:50`), `readToday` (`today/today.ts:39`), `readWindow` (`schedule/schedule.ts`), `lockTeacherTimeContext` и `readTeacherSettings` (`settings/settings.ts`), `lifecycle.manage({ server, wss, resources })` (`server.ts`).

## Проверки без Google и Anthropic (В2, 25.1 D-11)

- `calendar-offline.mjs` закрывает хосты Google в каждом процессе проверок; `chat-fake-anthropic.mjs` (22-13) подменяет `fetch` только для `api.anthropic.com` сценарными ответами.
- `calendar-seed.mjs` даёт синтетическое подключение и проекцию (`Alex Example NNNN`); команды календаря отправляются в процессе с заглушкой шлюза (`dispatchCommand`), как в `calendar-event-commands.mjs`.
- Проверки api — `schedule-started.mjs` (22-01), `schedule-started-series.mjs` (22-18), `chat-config.mjs` (22-11) и `chat-api.mjs <раздел>` на dvlab_test; браузерные — `chat-web.mjs <раздел> light|dark` и `schedule-started-web.mjs` на localhost, записи перехватываются `page.route`, где нужен синтетический ответ.
- Существующие проверки, ожидания которых меняют 22-01, 22-18 и 22-02 (`calendar-inbound.mjs`, `schedule-core.mjs`, `schedule-api.mjs changes`, `calendar-web-drag.mjs`, `calendar-web-editor.mjs`, e2e `move.spec.ts`, `marks.spec.ts`), правятся минимально в этих планах. e2e-помощники диалога Move series (`changeSeries`, `cutSeriesToWednesday` в `e2e/support/ui.ts`, `e2e/support/calendar-series-ui.ts`) сломаны удалением диалога в 25.1; 22-02 и 22-17 их не переписывают, а перечисляют падения в SUMMARY.
- Новых юнит- и e2e-тестов нет; существующие e2e (`yarn test:e2e`, localhost) прогоняет 22-17.

Сессия владельца (не задача плана; локальный стек): вопрос модели с его ключом и сверка расхода по `usage`; перенос и отмена урока и перенос серии из чата с записью в Google на тестовом аккаунте; на сервере — Server guy ставит `ANTHROPIC_API_KEY` в `api.env`, перезагружает Caddy (поток хода исключён из `encode`, 22-17) и проверяет, что поток приходит событиями. Модели, тарифы, лимиты и предел меняются в Settings, на сервере их нет.

## Запросы дизайна (Design dude, отправляет ведущая сессия)

Дизайн: `~/dv-lab-design`, VERSION **v65** (2026-10-13). Планы спланированы под v63 (ответ DR-22-01: 22-02), v64 (ответ DR-22-02: 22-04, 22-05, 22-08, 22-09, 22-10, 22-13, 22-14) и v65 (ответы DR-22-03..05: 22-06, 22-07, 22-12, 22-15); v61 (код 25.1) — одна форма переноса урока без диалога Move series, вопрос области после Save или броска, `OptimisticWrite`, цвет блока из Google. 22-UI-SPEC писалась под v40. Каждый UI-план начинает с записи версии и отличий в SUMMARY и без ответа останавливается (EXECUTOR-RULES 8).

1. **DR-22-01 (для 22-02, третья волна) — ответ получен, дизайн v63 (2026-10-13): Done заморожен (в футере строка вместо Move/Cancel; Done возвращается в Scheduled отметкой), начавшийся без отметки и с No-show двигается и отменяется, строка о судьбе No-show в форме переноса, области серии по allFrom без вопроса, когда их нет, Today без своей кнопки переноса, причины недоступной недели из READ_ISSUES. Диалога Move series в коде 25.1 нет (v61): пункты запроса про поле From закрыты областями ScopeDialog по allFrom и строкой «This lesson moves alone».** LessonDialog и EventDrag под В1: урок с Done не показывает Move lesson и Cancel lesson и не перетаскивается (README сейчас говорит «The mark stays: Done, deducts…» — противоречит В1); урок бросается и в прошедший слот; подписи формы переноса для No-show: снимется, если новое начало позже текущего момента, останется, если не позже; текст отказа `lesson_done`; начавшееся вхождение серии отменяется без ScopeDialog; области переноса начавшегося вхождения: one, following и all, если оно не раньше allFrom (после последнего отмеченного вхождения), иначе только one; Move series: текст причины, когда From раньше allFrom («на эту дату или позже есть отмеченный урок»), и когда allFrom нет; Today: футер Move/Cancel/Return у начавшегося урока и строка причины, когда неделя недоступна.
2. **DR-22-02 — ответ получен, дизайн v64 (2026-10-13): ChatPage, ChatResult, ChatCalendarChange, ChatNotices, ChatFacts, переписаны ChatComposer и ChatMessage; ChangeCard в фазе 22 не используется. Тексты отказов и подписей придуманы Design dude, ждут подтверждения владельца (lesson_done, lesson_changed, «Google Calendar accepted the change. Updating the schedule…», подпись дублей имён, отказ Google, ошибка чтения чата, «Reply stopped.», тексты quick-кнопок).** Запрос: (для 22-04, 22-05, 22-08, 22-09, 22-10, 22-13, 22-14).** Страница /chat (UD5: одна колонка, шапка с New chat и All chats, список поверх); блок фактов ученика (остаток, следующий урок, Pays soon); вставка упоминания по имени (`displayName`) вместо `@handle` (колонки handle нет); блоки результата с Undo и состояния P10/P11 вместо ChangeCard («Record this line? · commit …» эпохи vault); блок предложения переноса и отмены урока и переноса серии (was → now, Confirm / Keep, pending / unknown / Saved, Check status; у переноса серии Undo нет); тексты отказов чата: `lesson_done`, `outside_sync_window`, `connection_required`, `lesson_not_started` (комментарий к будущему уроку), `series_marked` (серия с даты раньше отмеченного урока), `command_pending`; состояния ответа (thinking, streaming, Stop reply, interrupted, withheld), блоки excerpt и suggestions.
3. **DR-22-03, DR-22-04, DR-22-05 — ответы получены, дизайн v65 (2026-10-13): NoteEntries, LessonComments, ModelsAndLimits, SettingsAssistant из трёх карточек (Chat model, Models and limits, Budget; лимит всегда заполнен). Тарифы — четыре цены за 1M токенов: input, cache write, cache read, output. Тексты ошибок полей, подтверждений удаления и тосты «Note removed» / «Comment removed» придуманы Design dude, ждут подтверждения владельца.** Запрос: (для 22-06, 22-07). Записи заметок под разделом в профиле (дата, текст, Remove) и комментарии урока в деталях урока.
4. **DR-22-04 (для 22-12, 22-15).** SettingsAssistant в фазе 22: карточки Chat model, Models and limits (DR-22-05) и Budget; поле предела в Budget заполнено значением настройки ($10 по умолчанию), состояния «предел не задан» нет; строки разрешений и «Ask before writing» — фаза 23 (README помечает их предложением).
5. **DR-22-05 (для 22-15).** Карточка Models and limits в Settings → Assistant (В9): список моделей в порядке меню (имя, id, уровни effort, уровень по умолчанию и рекомендуемый, тарифы входа, записи кэша, чтения кэша и выхода за 1M токенов в USD), перемещение вверх и вниз, Add model, Remove (последнюю убрать нельзя), правка строки; поля Max input tokens и Max output tokens; подпись источника цен и даты; одна кнопка Save на карточку, ошибки у поля, модель без доступа у провайдера помечена.

AssistantDock на Today есть в дизайне и в UD5, но не в требованиях 22 и не в планах: точки входа — фаза 23 (CHAT-12, SHELL-03/04). Это исключение, не пробел.

## Source coverage audit

### GOAL

| Item | Plans | Status |
| --- | --- | --- |
| Итог урока одной строкой; ответы из сохранённых данных; в пределах бюджета | 01-18 | COVERED |

### REQ

| ID | Plans | Status |
| --- | --- | --- |
| CHAT-01 разговоры | 05, 13, 15, 16, 17 | COVERED |
| CHAT-02 упоминание привязывает карточку | 08, 17 | COVERED |
| CHAT-03 was / didn't happen / no-show / moved to | 01, 02, 03, 08, 09, 10, 18 | COVERED |
| CHAT-04 отметки, комментарии, заметки сразу с Undo | 03, 06, 07, 09, 13, 16 | COVERED |
| CHAT-07 ответы из сохранённых данных | 04, 06, 07, 14 | COVERED |
| CHAT-08 числа считает код | 04, 14 | COVERED |
| CHAT-09 поток и обновление расписания | 09, 10, 13, 14 | COVERED |
| CHAT-11 расход по разговору и месячный предел (настройки учителя, В9) | 11, 12, 13, 15, 16 | COVERED |

### ROADMAP success criteria

| SC | Plans |
| --- | --- |
| 1 создать, список, переименовать, удалить; поток | 05, 13, 16 |
| 2 @ и быстрые действия для одного урока | 01, 02, 08, 09, 10, 18 |
| 3 отметки, комментарии, заметки с Undo; открытые Schedule и Today обновляются | 03, 06, 07, 09, 10 |
| 4 ответы из данных, числа как на Today и Students | 04, 14 |
| 5 расход по разговору; предел останавливает вызовы | 12, 13, 15 |

### CONTEXT decisions

| ID | Plans | Status |
| --- | --- | --- |
| D-01 ids, история, отметки, учёт сохраняются; календарь через журнал и проекцию 25.1 | 01, 03, 04, 06, 07, 10, 18 | COVERED |
| D-02 инструменты через владельцев; числа считает код; текст учеников — данные | 04, 09, 13, 14 | COVERED |
| D-03 Undo; Saved только после проверенной команды | 03, 09, 10 | COVERED |
| D-04 официальный SDK, ключ на сервере | 11, 13, 16 | COVERED |
| D-05 Haiku 5.5 по умолчанию (первая в списке настроек), выбор модели и effort | 11, 15 | COVERED |
| D-06 (редакция В6) Messages API со своим хранилищем; результат каждого инструмента; без повтора эффектов | 11, 13, 17 | COVERED |
| D-07 предел отдельно от кредитов, расход из usage | 11, 12, 13, 16 | COVERED |
| D-08 (дизайн v63, v64, v65) вариант A и UI-SPEC | 02, 04, 05, 08, 09, 12, 15 + запросы DR | COVERED |
| D-09 (редакция В2) автономная работа, проверки только локально | 17, все проверки | COVERED |
| В1 начавшийся урок; no_show снимается при новом начале позже текущего момента | 01, 02, 08, 10 | COVERED |
| В2 только локальные проверки | все планы | COVERED |
| В3 одно вхождение / серия | 08, 10, 18 | COVERED |
| В4 комментарии только к начавшимся | 07, 08 | COVERED |
| В5 без Google и вне окна | 01, 08, 10, 18 | COVERED |
| В6 без сравнения с Managed | 11, 13, 17 | COVERED |
| В7 BroadcastChannel через useCalendarRefresh | 09 | COVERED |
| В8 исполнение сейчас, 25.1 принята | gate исполнения | COVERED |
| В9 предел, модели, порядок, тарифы, лимиты — настройки учителя со значениями по умолчанию | 11, 12, 13, 15 | COVERED |
| Создание урока в прошлом | 01, 02 | COVERED |
| «All» с начавшимся вхождением; правка серии из Google для начавшихся без done (25.1 D-21) | 18, 02, 07, 08, 10 | COVERED |
| Серия из чата через подтверждение; массовые операции — CHAT-06 фазы 23 | 08, 10 | COVERED |
| Без Undo переноса серии из чата; «didn't happen» = отмена | 10, 08 | COVERED |
| Today: перенос из диалога урока | 02 | COVERED |
| Privacy: разделы Google после 25.1 | 16 | COVERED |

Deferred: фаза 23 (оплаты, новые ученики, удаление, ставки, массовые переносы по нескольким сериям и указание зоны в CHAT-06, эссе, палитра и точки входа), фаза 26 (IELTS) — ни в одном плане. Перенос одной серии по формулировке (В3) делает 22-10 через блок подтверждения (решение владельца 2026-10-13).

### RESEARCH и UI-SPEC

| Item | Plans | Status |
| --- | --- | --- |
| F01 модели и транспорт | 11, 13, 15 | COVERED (spike снят В6) |
| F02 ход, поток, восстановление | 13 | COVERED |
| F03 разговоры и упоминания | 05, 08 | COVERED |
| F04 точный урок | 08 | COVERED |
| F05 действия, Undo, календарь | 09, 10 | COVERED |
| F06 факты кода | 04, 14 | COVERED |
| F07 бюджет и тарифы (настройки учителя) | 11, 12, 15 | COVERED |
| F08 удаление и место данных | 05, 16 | COVERED |
| F09 маршрут /chat и состав | 04-16 | COVERED |
| F10 публичные e2e | — | ЗАМЕНЕНО В2: локальные скрипты в каждом плане, существующие e2e в 22-17 |
| ARCH-A1 транспорт в api-client и перечитывание зарегистрированных данных | 09 (`refreshReaders`), 13 (`apiEventStream`) | COVERED |
| ARCH-A2 записи отдельно от текста раздела | 06, 07 | COVERED |
| ARCH-A3 ревизия отметки у всех писателей | 03 | COVERED |
| P1-P9 research | 05, 08, 09, 10, 12, 13, 14, 16 | COVERED |

## Verification of this planning set

- `node ~/.claude/gsd-core/bin/gsd-tools.cjs query frontmatter.validate <PLAN> --schema plan`: 18/18 valid.
- `node ~/.claude/gsd-core/bin/gsd-tools.cjs query verify.plan-structure <PLAN>`: 18/18 valid, без ошибок и предупреждений; 65 задач (после сверки с кодом 25.1 у 22-02 пять задач).
- Пути `files_modified`, `<files>` и `read_first` всех планов существуют в коде после слияния master или создаются в фазе раньше по волнам; ссылок на удалённые файлы `move-series-*` нет.
- Разбор всех планов скриптом: wave = 1 + max(волн зависимостей); пересечений файлов в волне нет; у задач не больше пяти файлов, все в `files_modified`, каждый файл принадлежит задаче (кроме сгенерированных snapshot); CHAT-01/02/03/04/07/08/09/11 и D-01..D-09 процитированы; ссылок на прод, `E2E_TARGET_ORIGIN`, `tdd="true"`, «final24/25», `resolveProviderTarget`, `budget_not_set` нет; угрозы T-22-01..T-22-48 уникальны, `T-22-SC` в каждом плане.

## Handoff

ROADMAP, STATE, коммиты и сквад — ведущая сессия. При планировании ничего не закоммичено; исходный код не менялся.
