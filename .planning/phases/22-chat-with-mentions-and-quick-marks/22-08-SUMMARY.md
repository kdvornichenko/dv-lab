---
phase: 22-chat-with-mentions-and-quick-marks
plan: '08'
status: complete
verification: blocked
subsystem: api-web
tags: [chat, mentions, quick-command, lesson-target, today, composer]

requires:
  - phase: 22-01
    provides: 'lessonActions.move/cancel без done, insideSyncWindow, binding.mark'
  - phase: 22-05
    provides: 'use-chat.ts, ChatScreen с шапкой и списком разговоров'
  - phase: 22-07
    provides: 'heldSeriesDates с комментариями, правило комментария к начавшемуся уроку'
  - phase: 22-18
    provides: 'seriesAnchor (allFrom)'
provides:
  - 'today.ts: readLessonDay(executor, context, date) — день учителя для Today и чата; readToday зовёт её с сегодняшней датой'
  - 'contracts/chat.ts: mentionBinding, splitsSurrogatePair, chatLessonIntent, CHAT_LESSON_INTENT_KINDS, LESSON_TARGET_REFUSALS, lessonTargetResult (lesson | series | student | clarify | refused)'
  - 'chat/mentions.ts: validateMentions(executor, accountId, text, bindings) -> ok | stale'
  - 'chat/quick-command.ts: parseQuickCommand(text, bindings, now, timeZone) -> ChatLessonIntent | null'
  - 'chat/lesson-target.ts: resolveLessonTarget(executor, context, intent) -> LessonTargetResult, только чтение'
  - 'web: Composer (поле с подсветкой привязки, @-список, / команды, быстрые кнопки, P06, P08), MentionPopup, useComposerDraft, useMentionStudents'
  - 'scripts/dev-checks: chat-api.mjs target -> chat-target.mjs (CHAT_TARGET_OK), chat-web.mjs composer (CHAT_WEB_COMPOSER_OK, не исполнялся)'
affects: [22-09, 22-10, 22-13, 22-14, 22-16]

actuals:
  tokens: 26347
  tasks: 3
  commits: 4
plan_head_before: 6c6a506
plan_head_after: 49d5132

tech-stack:
  added: []
  patterns:
    - 'Резолвер берёт уроки только из readLessonDay; действия урока считает lessonActions от одного now (будущие блоки календаря приходят с выключенными actions)'
    - 'Для переноса и отмены сначала состояние записи недели (calendarWrite), потом кандидаты: без подключения пустой день не превращается в вопрос'
    - 'Привязка упоминания: смещения UTF-16 имени без @; токен в поле — диапазон [@, конец имени)'
    - 'Подсветка токена — зеркальный слой под прозрачным textarea с той же типографикой и scrollbar-gutter'

key-files:
  created:
    - apps/api/src/chat/mentions.ts
    - apps/api/src/chat/quick-command.ts
    - apps/api/src/chat/lesson-target.ts
    - apps/web/app/(app)/chat/_components/composer.tsx
    - apps/web/app/(app)/chat/_components/mention-popup.tsx
    - scripts/dev-checks/chat-target.mjs
  modified:
    - packages/contracts/src/chat.ts
    - apps/api/src/today/today.ts
    - apps/web/app/(app)/chat/_components/use-chat.ts
    - apps/web/app/(app)/chat/_components/chat-screen.tsx
    - scripts/dev-checks/chat-api.mjs
    - scripts/dev-checks/chat-web.mjs
    - scripts/dev-checks/README.md

key-decisions:
  - 'Пустой разговор создаётся при первом сообщении (README ChatPage v67), но поведение New chat в 22-08 не менялось: Send появляется в 22-09, переключение делает 22-09'
  - 'Парсер принимает и формы плана, и тексты быстрых кнопок: was / was at the lesson [дата], no-show / no show / didn''t come, didn''t happen / didnt happen, moved [from <дата>] to <дата> [время]'
  - '«moved to» без даты даёт намерение переноса без цели, резолвер отвечает вопросом date_time (P09), а не уходит модели'
  - 'Источник переноса по дню недели или D Mon — ближайший не раньше сегодня; отметки и отмены — последний не позже сегодня; цель — после сегодня (день недели) или не раньше сегодня (D Mon)'
  - 'Отказ calendar_unavailable добавлен для прочих причин блокировки записи недели (provider_unavailable, external_change и т.п.); reconnect_required, permission_required и disconnect_failed дают connection_required'
  - 'Вторая строка одинаковых имён в списке — «Usual lesson N min» из /students/options вместо «Next lesson …» дизайна (данных о следующем уроке в /students/options нет)'

requirements-completed: [CHAT-02, CHAT-03]

duration: ~2h
completed: 2026-10-13
---

# Phase 22 Plan 08: Упоминания и точный урок Summary

Сообщение привязывается к карточке точным `studentId`, быстрая форма разбирается кодом без модели, а резолвер выдаёт точный урок, серию от `allFrom`, вопрос с вариантами или понятный отказ; на `/chat` появился композер с @-списком, командами и быстрыми кнопками. Браузерная проверка не выполнялась (порты заняты стендом владельца).

## Задачи и коммиты

| # | Задача | Коммит |
|---|--------|--------|
| 1 | `readLessonDay`, контракт привязки, намерения и результата, `validateMentions`, `parseQuickCommand`, `resolveLessonTarget` | 434879b |
| 3a | `chat-api.mjs target` -> `chat-target.mjs`, строка README | d26894a |
| 2 | Композер, `MentionPopup`, черновик и список учеников в `use-chat.ts`, раскладка `chat-screen.tsx` | 22cc5c2 |
| 3b | `chat-web.mjs composer`, строка README | 49d5132 |

`commits: 4` измерено `git log --oneline --grep "(22-08)"`; коммит `docs(22-08)` с этим SUMMARY в счёт не входит. `actuals.tokens` — символы `git log --grep "(22-08)" -p` / 4 (105387 / 4).

## Что построено

- `readLessonDay(executor, context, date)`: неделя названной даты (`scheduleWeekRange(mondayOf(date))`), прошедшая часть `readWindow(dayStart, min(now + 1 мс, dayEnd))` (пропускается, если день ещё не начался), будущая `calendarLessons(events, max(now, dayStart - 1 мс), dayEnd)`, `earlier` и фильтр истории как в прежнем `readToday`. `readToday` = `readLessonDay(lessonDay(now))` + `asOf`, `paysSoon`, `paysSoonLessons`; ответ `GET /today` прежний, `todayWindow` остался.
- `mentionBinding`: `studentId`, `text` (имя без @), `start`, `end` (UTF-16, `end - start = text.length`, края не режут суррогатную пару). `validateMentions` проверяет место и подстроку, пересечения, активность и текущее имя (NFC, trim); иначе `{ kind: 'stale', studentId }`.
- `parseQuickCommand`: ровно одна привязка; текст без токена нормализуется (NFC, ’ -> ', регистр, пробелы, точка в конце); формы выше; даты `today`, `yesterday`, `tomorrow`, ISO, `D Mon`, `D.MM`, дни недели, необязательное время `H:MM`; слова серии (`whole series`, `all lessons`, `every week`, `всю серию`, `все уроки`) с необязательным `from <дата>` только у переноса; всё прочее — `null`.
- `resolveLessonTarget`: `note` -> `{ kind: 'student' }`; для переноса и отмены сначала `calendarWrite` недели источника; кандидаты: отметка без даты — `earlier` + начавшиеся неотмеченные `lessons`; отметка с датой и перенос/отмена — уроки дня ученика с исходом planned/done/no_show; комментарий — уроки дня без moved (без даты только начавшиеся); `time` сужает по местному времени; ноль — `clarify date_time`, больше одного — `clarify which_lesson` (до шести, по началу, только `startsAt`, `date`, `time`, `timeZone`). Проверки: отметка — `lessonActions().mark` (будущий -> `lesson_not_started`), комментарий — начался, перенос/отмена — `lessonActions().move/cancel` (done -> `lesson_done`); цель переноса — `localTimeCandidates` в зоне учителя (не ровно один кандидат -> `clarify date_time`), вне окна `insideSyncWindow` -> `outside_sync_window`; серия — `seriesAnchor`, `area: all` от `allFrom` или `following` от `from`, раньше `allFrom` или `allFrom = null` -> `series_marked`, одиночный урок -> `clarify`. Ничего не пишет.
- Композер (ChatComposer v67): поле растёт до пяти строк, Enter без списка ничего не делает (Send — 22-09), Shift+Enter — строка; @ после пробела или в начале открывает до шести активных учеников из одного `GET /students/options` на открытие экрана (фильтр NFC + `toLocaleLowerCase`, подстрока, порядок сервера); стрелки, Enter и Tab выбирают, Esc закрывает только список, фокус не уходит из поля, во время IME клавиши не обрабатываются; список — `listbox` над полем внутри композера, поле — `combobox` с `aria-activedescendant`; загрузка (три скелетона), сбой (P07 с Try again), «No students found» различны; токен подсвечен `bg-active` с `radius-sm`, удаляется одним Backspace (или Delete перед @), правка внутри снимает привязку и показывает P08; после привязки четыре кнопки (`secondary compact`) вставляют «was at the lesson today», «didn't happen», «didn't come», «moved to » после имени (заменяют прежнюю быструю форму, иначе дописывают в конец); `/` в начале — пять команд фазы 22, `/note` и `/recap` вставляют `/<команда> @` и открывают список учеников; подсказка P06; 16px на `pointer-coarse`; привязки на поле в атрибуте `data-mentions`.
- `chat-screen.tsx`: колонка 720px на всю высоту, шапка, под ней сообщения в `ScrollArea` со `scroll-fade` (`role="log"`), композер под ними вне fade, поля 12px на телефоне; композер выключен, пока открыт список разговоров; фокус в поле после смены разговора (закрыт стаб 22-05 «New chat focus -> textarea»).

## Решение по созданию разговора

Открытый вопрос 22-05 решён по README ChatPage v67: разговор создаётся при первом сообщении, пустой «New chat» сам по себе не сохраняется. В 22-08 поведение не менялось: отправки ещё нет, а раздел `chat-web.mjs conversations` ждёт `?c=` после New chat. Что сделать 22-09: New chat -> `select(null)`, приветствие и фокус в поле без `POST`; Send без `selectedId` -> `POST /chat/conversations`, затем `POST /chat/conversations/:id/messages` (повтор после сбоя с тем же `requestId` не создаёт второй разговор); поправить раздел `chat-web.mjs conversations` (разговоры создаются первым сообщением).

## Дизайн

Версия `~/dv-lab-design` на исполнении: v67 (ChatComposer, ChatPage, ScrollFade). Precondition задачи 2 (DR-22-02 отвечен) выполнен: PLAN-INDEX строка 97 и README ChatComposer.

## Проверки

Выполнено:

- `yarn workspace @dv-lab/contracts typecheck`, `@dv-lab/api typecheck`, `@dv-lab/web typecheck`, `yarn workspace @dv-lab/web lint`: код выхода 0. `yarn prettier --write` по файлам плана.
- `node scripts/dev-checks/calendar-reads.mjs` после `readLessonDay`: `CALENDAR_READS_OK` (Today 200).
- `node scripts/dev-checks/chat-api.mjs target` (`dvlab_test`, офлайн-шлюз, `calendar-seed up/down test week`): `CHAT_TARGET_OK`, 41 PASS, 0 FAIL, дважды подряд. Покрыто: два ученика с одним именем — привязка к выбранному id, второй не выбран (без уроков -> вопрос); переименованная, архивная, отредактированная и вышедшая за текст привязки — `stale`; привязка, режущая суррогатную пару, отвергается контрактом; имя без привязки не разбирается; 12 форм (включая тексты кнопок, ’, `Was.`, `moved to` без даты, слова серии) и 4 свободных текста -> `null`; два начавшихся урока сегодня -> `clarify` с двумя вариантами по началу без личных полей, дата и время сужают до одного; день без уроков -> `clarify date_time`; один начавшийся неотмеченный -> урок с ключом, исходом и `started`; перенос на завтра 18:00 и на ISO-дату в зоне учителя; `moved to` -> вопрос; цель через 400 дней -> `outside_sync_window`; урок позже сегодня: «was at the lesson today» -> `lesson_not_started`, голый `was` -> вопрос, перенос находит его из календаря, комментарий -> `lesson_not_started`; done -> отмена и перенос `lesson_done`; неделя 70 дней назад: перенос `outside_sync_window`, отметка той же недели — цель; урок следующей недели читается из окна своей недели; без подключения (контекст другого аккаунта) перенос и отмена `connection_required`, отметка — цель; 02:30 в дату перехода `Europe/Berlin` (2027-03-28) -> `clarify`; «all lessons» -> серия, `area all`, `from = allFrom = сегодня` (сегодняшнее начавшееся неотмеченное после `no_show` входит); «all lessons from <дата done>» -> `series_marked`; «every week from <сегодня>» -> `following`; слова серии у одиночного урока -> `clarify`; заметка -> `student`; `readToday` совпадает с `readLessonDay(сегодня)`; счётчики всех таблиц до и после вызовов резолвера равны. Фикстуры удалены (карточек `chat-target:` после прогона 0, сид снят).
- `node scripts/dev-checks/chat-api.mjs records`: `CHAT_RECORDS_OK` (обход маршрутов чата после правки контракта).
- Критерии приёмки: в `lesson-target.ts` нет `insert` и `update(`; `quick-command.ts` не импортирует SDK и не ходит в сеть; `grep -rn "radix\|cmdk" "apps/web/app/(app)/chat"` пусто.

Не выполнено, по распоряжению ведущей сессии (порты 3000 и 4000 заняты стендом владельца из этого же worktree, его не останавливали):

- `node scripts/dev-checks/chat-web.mjs composer light` и `dark`. Раздел написан, проходит `node --check`, без аргументов печатает usage, ни разу не исполнялся; при первом запуске вероятны ошибки селекторов и ожиданий (`[data-slot="mention-popup"]` с `waitFor detached` после exit-анимации, `allInnerTexts` кнопок, `setSelectionRange` внутри токена, клик по строке `/note`). Запуск владельцем с ведущей сессией на поднятом стенде: `node scripts/dev-checks/chat-web.mjs composer light`, затем `dark`. Скрипт входит dev-учителем из `.env`, создаёт в `dvlab_dev` карточки `Alex Example 2216` и две `Alex Example 2217`, в конце удаляет их.
- `node scripts/dev-checks/wait-dev.mjs down` (стенд владельца не трогали).
- Ручная проверка композера в браузере в обеих темах не выполнялась: вид токена (совпадение подсветки с текстом поля, особенно при переносе строк и прокрутке после пяти строк), список над полем, кнопки и раскладка колонки не сверены со скриншотами. Для UI это значит «не проверено». Нужна запись `unrun-verify` в `.planning/WINDOWS.md` ведущей сессией (файл не моего плана).
- `yarn build`, `yarn test`, `yarn install` не запускались по распоряжению.

## Deviations from Plan

**1. [Rule 3] Отдельный скрипт `scripts/dev-checks/chat-target.mjs`.** Будущие уроки дня приходят только из проекции календаря через привязки, а привязки создаёт только конвейер команд (внешний ключ на `google_commands`). Сценарий требует preload `calendar-offline.mjs` и шлюза-заглушки, как `schedule-started.mjs`; `chat-api.mjs target` запускает его дочерним процессом (прецедент 22-07). Заглушка и помощники конвейера скопированы из `schedule-started.mjs` (с задержкой ответа 300 мс из 22-18). «Сейчас» резолвера — 12:00 урочного дня в зоне учителя; `last_full_at` и `last_incremental_at` синтетического подключения выставляются на это время, чтобы неделя читалась свежей.

**2. Отказ `calendar_unavailable` и `command_pending` в `LESSON_TARGET_REFUSALS`.** План перечисляет шесть кодов; `command_pending` уже назван в 22-09, `calendar_unavailable` покрывает прочие причины блокировки записи. 22-09 включает оба в `chatRefusalCode`.

**3. Вторая строка одинаковых имён (EXECUTOR-RULES 8, вопрос Design dude).** Дизайн: «Next lesson Wed 14 Oct, 18:00 VN» / «No lesson ahead»; в `/students/options` следующего урока нет, у `LessonStudentField` второй строки тоже нет (вопреки ссылке плана). Показано «Usual lesson N min» только для совпадающих имён; при одинаковой длине урока строки не различаются. Чтобы показать строку дизайна, нужен следующий урок в ответе `/students/options` или отдельное чтение — решение планировщика.

**4. Токен в `textarea`.** Заливка `bg-active` и `radius-sm` нарисованы зеркальным слоем под прозрачным полем; вес 600 у имени невозможен без contenteditable (меняет метрики) и не сделан. Строки «Usual lesson N min», `aria-label` «Message», «Students», «Commands», «Loading students» — мои.

**5. Нижний ряд композера (чипы модели и Send) не построен.** Send — 22-09, чипы `ChatModelControls` — позже; Enter без списка не отправляет.

**6. Разметка `chat-screen.tsx`.** `PageScroll` заменён колонкой на всю высоту с `ScrollArea` для сообщений, чтобы композер стоял под ними вне fade (README ChatPage). Нижний отступ на телефоне 12px с `safe-area-inset-bottom` вместо прежних 64px `PageScroll`.

**7. Источник для «from» серии без даты.** Если указан только `from`, урок, по которому находится серия, ищется в дне `from`; без даты и без `from` — сегодня.

## Known Stubs

- Нижний ряд композера: нет Send и чипов модели — `composer.tsx`, Enter без списка ничего не делает. Send добавляет 22-09, чипы — план модели (22-12/22-14).
- Кнопка New chat всё ещё создаёт разговор сразу (`use-chat.ts` `create`), см. «Решение по созданию разговора»; переключает 22-09.

## Threat Flags

Нет: новых маршрутов нет; `validateMentions` и резолвер — серверные функции для 22-09 и 22-13 (T-22-16, T-22-17 из реестра плана).

## Для следующих планов

- 22-09: порядок в `sendMessage` — `mentionBinding` (zod) -> `validateMentions` (`stale` -> `refused mention_stale`, P08) -> `parseQuickCommand(text, bindings, now, defaultTimeZone)` -> `resolveLessonTarget(tx, { accountId, now, defaultTimeZone }, intent)` с тем же `now`. Результат `lesson` несёт `ref`, `startsAt` (для `expectedStartsAt`), `mark` и `markRevision` (для `expectedRevision` у `writeMark`), `started`; `move` — `startsAt`, `endsAt`, `date`, `time`, `timeZone`, `durationMinutes` цели. `clarify` — `question` (`which_lesson` -> «Which lesson do you mean?», `date_time` -> «What date and time do you mean?») и до шести вариантов. `series` — `seriesId`, `area`, `from`, `allFrom`, `lesson` (урок, по которому найдена серия), `move` (для `move_series` день недели берётся из `move.date`).
- 22-09, web: черновик — `useComposerDraft()` (`draft`, `setDraft`, `type`, `clear`), привязки уже в форме `mentionBinding`; Send берёт `draft.text` и `draft.bindings`, при `draft.stale` Send выключен (P08). Поле доступно как `inputRef` из `ChatScreen`.
- 22-13: модель может прислать `chatLessonIntent` с `target.timeZone` (IANA, `calendarTimeZone`) и `time` источника; резолвер их учитывает.
- `chat-target.mjs` меняет синтетическое подключение в `dvlab_test` (`calendar-seed up/down test week`): не запускать при параллельных исполнителях с тем же сидом.

## Self-Check: PASSED

Файлы найдены: `apps/api/src/chat/mentions.ts`, `quick-command.ts`, `lesson-target.ts`, `apps/web/app/(app)/chat/_components/composer.tsx`, `mention-popup.tsx`, `scripts/dev-checks/chat-target.mjs`. Коммиты 434879b, d26894a, 22cc5c2, 49d5132 есть в ветке (`git log --grep "(22-08)"` = 4). Рабочее дерево чисто по файлам плана (остался только `apps/web/next.config.ts` владельца), процессов не оставлено.
