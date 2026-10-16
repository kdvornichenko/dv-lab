# Календарь Google: проекция, синхронизация, каналы, команды, привязка, подключение

## Подключение

- Подключения Google хранятся по истории: у аккаунта одна текущая строка `google_connections` (`retired_at is null`, частичный уникальный индекс), текущую строку выбирает `currentConnection` из `apps/api/src/calendar/google-access.ts`.
- Подключение другого аккаунта после отключения (`install` в `apps/api/src/calendar/connection.ts`) переводит старую строку в архив (`retired_at`), её привязки событий — в `retired` и создаёт новую строку; строки старого календаря не удаляются и не переносятся. При незавершённых командах смена отклоняется кодом `command_pending`.
- Действие снимка `switch` (только при сохранённом календаре) web выполняет сам: отключает текущий аккаунт, ждёт `not_connected` и уходит на согласие Google (`switchAccount` в `apps/web/components/app/google-calendar-state.tsx`).
- Выбор календаря внутри аккаунта — `listCalendars` и `chooseCalendar` в `apps/api/src/calendar/connection.ts` (`GET /google/calendars`, `POST /google/calendar`); смена отставляет текущую строку подключения и создаёт новую, привязки прежнего календаря не трогаются и скрыты из сетки (D-13). Поле Calendar в web — `apps/web/app/(app)/settings/_components/calendar-choice.tsx`.

## Проекция и чтение

- Таблицы: `google_calendar_events` (кэш событий окна синхронизации, строки без привязки к уроку очищаются по эпохе прохода), `google_sync_state` (по строке на текущее подключение: `sync_token`, окно, ревизия недели, захват, сроки проходов, каналы, палитра) и `google_event_ignores`. Таблицы `google_read_windows`, `google_read_events`, `google_next_lessons` код не пишет и не читает; их удаление — отдельным релизом.
- Чтение недели, Today и карточек из календаря — SQL по `google_calendar_events` и `google_sync_state` через `apps/api/src/calendar/projection.ts` и `read-model.ts`: Google и аренда аккаунта в чтении не участвуют (D-19). Binding урока в событии недели несёт `mark` (`done`, `no_show` или `null`).
- Аренда нужна только отправке команд (`dispatch.ts`, `worker.ts`) и подключению и отключению (`connection.ts`).
- Единственный писатель строк проекции и ревизии недели — `upsertEventFacts` в `projection.ts`: ревизия растёт только при изменении данных.
- Названия событий Google за диапазон дат для Count lessons читает напрямую из Google `apps/api/src/calendar/event-titles.ts` (маршрут `GET /schedule/event-titles`, только чтение, без записи в базу и без зеркала, диапазон до 400 дней). Тот же источник у инструмента чата `calendar_events`: без названия — все события периода, с названием — нечёткое совпадение `similarTitle`, группы по совпавшему написанию, `merge: true` — одна группа; ответ — блок `calendar_events` с Copy dates в формате Count lessons (`lessonCountText`).
- Описание события Google читает в блоки только `apps/api/src/calendar/event-description.ts` (`readDescription`, вызывается только из `readEventDetails`): абзацы, списки, разделители, безопасные ссылки (`http`, `https`, `mailto`, `tel`) и признак `descriptionFormatted`. Web разметку и ссылки не разбирает: отрисовка блоков, ссылок и места-адреса — `apps/web/app/(app)/schedule/_components/event-text.tsx`; `innerHTML` и `dangerouslySetInnerHTML` в web нет.

## Синхронизация

- Фоновая синхронизация — единственный читатель событий Google: `sync.ts` (один проход на подключение по захвату строки `google_sync_state`, без общей блокировки, ночной полный проход в 03:00 зоны учителя), `sync-store.ts` (захваты, `applyPass`, очистка по эпохе), `sync-provider.ts` и `gateway-sync.ts` (источник и вызовы Google, включая `calendars()` для списка календарей). Страницы Google разбирает только `provider-events.ts`.
- Окно синхронизации — 8 недель назад и 53 вперёд (`SYNC_WINDOW_WEEKS` в `packages/contracts/src/calendar.ts`, его читают `syncWindow` в api и текст `outside_sync_window` в web); строки привязанных уроков окном не очищаются, уроки до 366 дней назад можно отмечать. Неделя вне окна только читается.

## Каналы push Google

`watch.ts` (каналы `events.watch`, продление за сутки, `stop(pairs, token)`) и `apps/api/src/routes/google-notifications.ts` (вебхук, подключается до `sameOrigin`; токен канала хранится хешем, неизвестный канал — 404 без тела). Адрес вебхука — `APP_ORIGIN/api/google/notifications` только по HTTPS; Caddy вырезает заголовки канала из журналов.

## Команды и привязка

- Команды любого события (создание, правка, удаление, области this, this and following, all) — `apps/api/src/calendar/event-commands.ts` и журнал `google_commands`; операции `event_create`, `event_update`, `event_delete`, `assign`.
- Совпадение названия с именем ученика — `matching.ts` (только предложение, ничего не привязывается само), Assign и Ignore — `assign.ts` (Assign пишет в событие Google закрытый маркер с id урока, Ignore скрывает предложение и не отменяется).
- Привязан ли ряд проекции к уроку, решает только `event-mapping.ts` (`boundRowCondition`, `rowForLocal`, `bindEvent`).

## Применение изменений Google к урокам

Применение изменений Google к урокам — `apps/api/src/schedule/inbound-apply.ts`, вызывается из `sync.ts` после закоммиченного прохода. Google выигрывает при расхождении.

- Работает по состоянию через `inbound_applied_etag`.
- Одиночные уроки и вхождения с `done` заморожены; строка `none` или `no_show` не замораживает, начавшиеся без `done` применяются как будущие, перенос на начало позже текущего момента переводит `no_show` в `none` через `settleMarkAfterMove`.
- Правка серии из Google (правило мастера, UNTIL, удаление мастера, разделение) применяется с `allFrom` через `seriesAnchor`: заморожены только вхождения до `allFrom`: с `done` или `no_show`, неотмеченные раньше последней отметки и раньше окна синхронизации; строка `none` не замораживает.
- Смена правила того же мастера (`cutAt`) переносит отменённые вхождения хвоста на новую серию тем же по счёту вхождением от разреза; перенесённые вхождения хвоста не переносятся.
- EXDATE мастера применяется к вхождениям не раньше начала окна синхронизации (`exclusionFacts`).

## Приёмка

`scripts/dev-checks/`, порядок и живая сессия владельца — `README.md`.

- Без Google: `calendar-final.mjs` запускает по очереди `calendar-catalog`, `calendar-config`, `calendar-lease`, `calendar-reads`, `calendar-commands check`, `calendar-sync` (`pass`, `claim`, `loop`), `calendar-push`, `calendar-event-commands`, `calendar-inbound` (`resolver`, `assign`, `inbound`), `calendar-switch` и `calendar-env probe`.
- Браузер, отдельно: `calendar-web-grid`, `calendar-web-editor`, `calendar-web-drag`, `calendar-web-settings` (тема светлая или тёмная), `calendar-web-details.mjs` (`CALENDAR_WEB_DETAILS_OK`).
- Описание события: `event-description.mjs` (`EVENT_DESCRIPTION_OK`).
- Синтетический набор — `calendar-env.mjs`, `calendar-offline.mjs` (Google недоступен процессу), `calendar-seed.mjs` (`up|down|bump|state test|dev`), `calendar-dev-api.mjs` (api на порту 4000 для браузерных проверок).
