# Фаза 22: браузерные проверки волн 3-10

Дата: 2026-10-13. Ветка `gsd/phase-22-chat-replan`. Сценарии запускались строго по одному.

## Стенд

- `schedule-started-web.mjs` поднимает api и web сам, база `dvlab_test` (аргумент `test`).
- `chat-web.mjs` идёт на общем dev-стеке (`yarn workspace @dv-lab/api dev` и `yarn workspace @dv-lab/web dev`, база `dvlab_dev`). В локальном `.env` `APP_ORIGIN` указывает на туннель, поэтому вход с `http://localhost:3000` api отклонял (403 на `/auth/sign-in`). api запускался с `APP_ORIGIN=http://localhost:3000` из окружения процесса; `.env` не менялся.
- В `dvlab_dev` порог Pays soon равен 0 (`teacher_settings.pays_soon_lessons`), у учителя подключён Google. Настройки и подключение не менялись.
- После всех запусков `wait-dev.mjs down` печатает `DEV_DOWN_OK`. Вымышленные карточки сценариев убраны; разговоры, оставшиеся от упавших запусков `calendar`, удалены по id (3 строки).

## Результаты

| Сценарий | Тема | Результат |
|---|---|---|
| `schedule-started-web.mjs test` | light | FAIL: Schedule 26 проверок PASS; Today падает на диалоге начавшегося урока прошлой недели (дефект 1) |
| `schedule-started-web.mjs test` | dark | FAIL: то же, Schedule 26 PASS, Today FAIL (дефект 1) |
| `chat-web.mjs records` | light | PASS, `CHAT_WEB_RECORDS_OK` (после исправления сценария) |
| `chat-web.mjs records` | dark | PASS, `CHAT_WEB_RECORDS_OK` |
| `chat-web.mjs conversations` | light | FAIL: адрес теряет `?c=` после первого сообщения (дефект 2), остаток раздела не выполнялся |
| `chat-web.mjs conversations` | dark | FAIL: то же (дефект 2) |
| `chat-web.mjs notes` | light | PASS, `CHAT_WEB_NOTES_OK` (после исправления сценария) |
| `chat-web.mjs notes` | dark | PASS, `CHAT_WEB_NOTES_OK` |
| `chat-web.mjs comments` | light | НЕ ЗАПУСКАЕТСЯ на dev: урок фикстуры не попадает в Today (см. «Не удалось запустить») |
| `chat-web.mjs comments` | dark | НЕ ЗАПУСКАЕТСЯ на dev, причина та же |
| `chat-web.mjs composer` | light | PASS, `CHAT_WEB_COMPOSER_OK` |
| `chat-web.mjs composer` | dark | PASS, `CHAT_WEB_COMPOSER_OK` |
| `chat-web.mjs actions` | light | НЕ ЗАПУСКАЕТСЯ на dev, причина как у `comments` |
| `chat-web.mjs actions` | dark | НЕ ЗАПУСКАЕТСЯ на dev, причина та же |
| `chat-web.mjs calendar` | light | PASS, `CHAT_WEB_CALENDAR_OK` (после исправления сценария) |
| `chat-web.mjs calendar` | dark | PASS, `CHAT_WEB_CALENDAR_OK` |
| `calendar-web-drag.mjs` | light | НЕ ЗАПУСКАЕТСЯ: `calendar-seed up dev` отказывает, у учителя несинтетическое подключение Google |
| `calendar-web-editor.mjs` | light | НЕ ЗАПУСКАЕТСЯ: та же причина |

## Дефекты приложения

### 1. Диалог Today для начавшегося урока прошлой недели не даёт перенести и отменить урок

- Файл: `apps/web/app/(app)/schedule/_components/lesson-dialogs.tsx`, строка 75. `calendarEventFor` возвращает `undefined` (это `Array.find`), а `needsWeek` сравнивает `lookup === null`. Когда у Today есть окно текущей недели, а урока в нём нет, `needsWeek` всегда `false`, `useStartedWeek` не читает неделю урока, и `writeIssueFor(null, window)` даёт `history_only`. В строках 41 и 89 стоит `?? null`, в строке 75 его нет.
- Воспроизведение: Today, блок «Earlier, not marked», строка урока из прошлой недели, открыть диалог.
- Ожидается (план 22-02): строка отметки и активные Move lesson и Cancel lesson.
- Фактически: Move lesson и Cancel lesson неактивны, строка «This record is local history. Calendar changes are unavailable.». Запрос `GET /schedule/week?start=<понедельник урока>` не уходит (видно в журнале запросов).
- Следствие: проверка урока за пределами окна синхронизации (84 дня назад) получит ту же строку `history_only` вместо `outside_sync_window`. Если до неё дойти, она пройдёт по неправильной причине.
- В Schedule дефекта нет: там окно недели содержит урок.

### 2. После первого сообщения адрес чата теряет `?c=`, перезагрузка теряет разговор

- Файл: `apps/web/app/(app)/chat/_components/use-chat.ts`, строки 148-153 (`writeSelection`). Вызов `window.history.replaceState(window.history.state, ...)` передаёт служебное состояние Next (`__NA`, `__PRIVATE_NEXTJS_INTERNALS_TREE`). По стеку вызовов (патч `replaceState` в установленной версии Next не читался, при исправлении проверить) Next принимает такой вызов за свой и не обновляет канонический адрес роутера. Следующий коммит роутера (`HistoryUpdater`) пишет обратно `/chat`.
- Воспроизведение: /chat, New chat, ввести текст, Send.
- Ожидается: адрес `/chat?c=<id>` сохраняется, после перезагрузки открыт тот же разговор.
- Фактически: `?c=<id>` появляется и через доли секунды заменяется на `/chat`; это видно по `framenavigated` и по стеку `replaceState`. После перезагрузки открывается пустой экран чата.
- Остаток раздела `conversations` (список, переименование, удаление, телефон) не проверялся: раздел падает на перезагрузке.

## Наблюдение (решения нет)

- Enter в открытом, но ещё пустом списке упоминаний (строки учеников не догрузились) отправляет сообщение с непривязанным `@<имя>` вместо выбора ученика. Сценарий `calendar` это поймал: сообщение ушло без привязки. Нужно решить, считать ли это дефектом. В README `ChatComposer` поведение Enter при загрузке списка не описано.

## Исправленные ошибки сценариев

- `schedule-started-web.mjs`, коммит `def0d65`:
  - Сценарий не перехватывал `POST /api/google/conflicts`. Настоящий api получал выдуманную привязку и отвечал 409, форма оставалась в «Check failed. Retry», а Move lesson был неактивен. Теперь ответ подменяется результатом `complete` с ключом входа, который считается так же, как в `conflictInputKey`.
  - Селекторы `#today-earlier` и `#today-lessons` не находили строки: `id` у `Panel` стоит на `h2`. Теперь используется `section[aria-labelledby=...]`.
  - Сценарий сам отдаёт отказы 409 (`lesson_done`, `outside_sync_window`), а Chromium пишет их в консоль как ошибки. 409 добавлен в фильтр шума. Обратная сторона: настоящий 409 в этом сценарии тоже не попадёт в «console problems». Пункт для ревьюера.
- `chat-web.mjs`, коммит `0c1ded0`:
  - В шум добавлено предупреждение next dev «server caches disabled» (`schedule-started-web` уже его фильтровал).
  - `records`: при пороге 0 карточка с остатком 1 урок в Students получает «Plenty left». По README `ChatFacts` метка состояния в чате бывает только у Pays soon, No lessons left и Owes lessons, поэтому для «Plenty left» проверяется отсутствие метки. Состояние Pays soon на dev не проверено, потому что порог там 0.
  - `notes`: отложенный `route.continue()` падал «Route is already handled» после `reload` и ронял процесс до очистки. Теперь ошибка гасится.
  - `calendar`: Enter нажимался, пока список упоминаний был пуст. Теперь сценарий ждёт строку ученика. `getByText('Saved.')` совпадал с «Calendar change saved…», добавлен `exact`.

Повторные запуски после исправлений: `records`, `notes`, `calendar` и `composer` зелёные в обеих темах. Schedule-часть `schedule-started-web` зелёная в обеих темах.

## Не удалось запустить

- `chat-web.mjs comments` и `actions`: фикстура вставляет урок прямо в `lessons` SQL-запросом. На `dvlab_dev` у подключения учителя есть `history_cutover_at`, и `historyEligibility` (`apps/api/src/calendar/history.ts`) отбрасывает неотмеченный урок без подтверждения проекцией. Урок не появляется в Today, и сценарий ждёт строку 60 и 30 секунд. Чтобы сценарий заработал, нужен синтетический календарь, а `calendar-seed` на dev отказывает при подключении владельца. Защита не обходилась.
- `calendar-web-drag.mjs` и `calendar-web-editor.mjs`: `calendar-seed up dev week` печатает «dev teacher already has a current Google connection that is not synthetic». Стек не поднимался, данные не менялись.
- Today-часть `schedule-started-web` после первой неудачной проверки (перенос и отмена из Today, урок вне окна, диалог Done) не выполнялась из-за дефекта 1.

## Расхождения с дизайном (v67, `~/dv-lab-design`)

Просмотрены скриншоты обеих тем: Schedule (форма no-show, ScopeDialog серии, диалог Done), Today, факты чата, заметки, композер, блок календаря в чате.

- `ChatComposer`: вторая строка для одинаковых имён в списке упоминаний — «Usual lesson 60 min», а по дизайну «Next lesson Wed 14 Oct, 18:00 VN» или «No lesson ahead». Если у учеников одинаковая длина урока, строки ничем не различаются. Отклонение известно из 22-08-SUMMARY.
- `ChatComposer`: имя-токен в поле набрано обычным весом, по дизайну вес 600 (известно из 22-08).
- `ChatComposer`: в нижней строке нет чипов модели и усилия. На dev показано «Model settings are unavailable. Refresh before sending.», потому что настройки модели на dev не заданы. В таком состоянии расхождение с дизайном ожидаемо.
- Диалог урока в Schedule для вымышленной привязки показывает заголовок «Busy» и «Could not load the comments.». Это следствие подмены недели в сценарии (выдуманные id), а не дефект.
- `NoteEntries`, `ChatFacts`, `ChatCalendarChange` (Proposed, Saved, Refused), ScopeDialog и форма переноса с no-show совпадают с описанием компонентов в обеих темах.

## Прочее

- В `dvlab_dev` остались две вымышленные карточки из прошлых сессий (номера 2182 и 2183, созданы 11 и 12 октября). Эти сценарии их не создавали, и они не тронуты.
