---
phase: 22-chat-with-mentions-and-quick-marks
plan: '04'
status: complete
verification: blocked
subsystem: api-web
tags: [chat, records, student-facts, contracts, read-model, teacher-only]

requires:
  - phase: 22-01
    provides: 'settleMarkAfterMove и правило начавшегося урока (precondition плана)'
  - phase: 22-02
    provides: 'экран Today и Schedule с начавшимся уроком (числа Today для сверки)'
  - phase: 22-03
    provides: 'ревизия отметки; остаток считается теми же владельцами'
  - phase: 22-18
    provides: 'allFrom серии; не используется напрямую'
provides:
  - 'contracts/chat.ts: chatRecordsQuery (strictObject, studentId uuid) и chatStudentFacts (student, balanceMinutes, nextLesson, paysSoon, paysSoonLessons, asOf, defaultTimeZone) с выводимыми типами'
  - 'api chat/facts.ts: readChatFacts(executor, context, studentId, paysSoonLessons) поверх getCard и paysSoonList, без арифметики остатка'
  - 'api routes/chat.ts: chatRoutes({ db }) с одним use(noStore, requireSession, requireRole teacher) и GET /chat/records; смонтирован в app.ts как /chat'
  - 'web /chat?student=<uuid>: ChatScreen и StudentFacts (блок фактов ChatFacts), загрузка, ошибка чтения с Refresh records, студент недоступен'
  - 'scripts/dev-checks/chat-api.mjs records (CHAT_RECORDS_OK) и chat-web.mjs records (CHAT_WEB_RECORDS_OK, не запускался)'
affects: [22-05, 22-06, 22-07, 22-08, 22-13, 22-17]

actuals:
  tokens: 11000
  tasks: 3
  commits: 4
plan_head_before: e439cbf
plan_head_after: 10dde97

tech-stack:
  added: []
  patterns:
    - 'Все маршруты чата живут в routes/chat.ts под одним use(*) с ролью teacher; своих проверок роли в маршрутах нет'
    - 'Wire-схемы чата принадлежит packages/contracts/src/chat.ts; последующие планы дополняют его'
    - 'Факты карточки в чате берутся тем же getCard, что профиль Students; число не пересчитывается в чате'

key-files:
  created:
    - packages/contracts/src/chat.ts
    - apps/api/src/chat/facts.ts
    - apps/api/src/routes/chat.ts
    - apps/web/app/(app)/chat/_components/chat-screen.tsx
    - apps/web/app/(app)/chat/_components/student-facts.tsx
    - scripts/dev-checks/chat-api.mjs
    - scripts/dev-checks/chat-web.mjs
  modified:
    - packages/contracts/src/index.ts
    - apps/api/src/app.ts
    - apps/web/app/(app)/chat/page.tsx
    - scripts/dev-checks/README.md

key-decisions:
  - 'readChatFacts вызывает только getCard и paysSoonList([card], порог); listCards не нужен: фильтр paysSoonList поэлементный, принадлежность одной карточки совпадает с /today, что проверено chat-api records'
  - 'В chatStudentFacts.student добавлен defaultLessonMinutes: StudentBalance и состояние Pays soon на экране требуют длину урока'
  - 'Выбранная карточка приходит параметром ?student=; неверный uuid в параметре трактуется как отсутствие выбора, 404 от api показывается как недоступный студент'
  - 'Ошибка чтения - Banner status error (role alert) с Refresh records; при обновлении кнопка Refreshing… и отключена, ошибка остаётся до успешного чтения'

requirements-completed: [CHAT-07, CHAT-08]

duration: ~1h
completed: 2026-10-13
---

# Phase 22 Plan 04: Чат читает факты одной карточки Summary

Первый путь чата без модели: `/chat?student=<uuid>` читает `GET /chat/records` (teacher-only, один `readSnapshot`, одно `now`), факты собирает `readChatFacts` поверх `getCard` и `paysSoonList`, экран показывает остаток, следующий урок и Pays soon теми же числами, что Students и Today.

## Задачи и коммиты

| # | Задача | Коммит |
|---|--------|--------|
| 1 | Контракт `chatRecordsQuery`/`chatStudentFacts`, `chat/facts.ts`, `routes/chat.ts`, монтирование `/chat` | 9d7d989 |
| 2 | Экран `/chat`: `ChatScreen`, `StudentFacts`, состояния загрузки, ошибки и недоступного студента | f5afcdf |
| 3 | `chat-api.mjs records`, `chat-web.mjs records`, раздел README | eff94c3 |
| - | Форматирование типа состояния в `chat-screen.tsx` (Prettier) | 10dde97 |

## Дизайн

Версия `~/dv-lab-design` на исполнении: v67 (VERSION: «Skeleton to content crossfade»). UI-SPEC писалась под v40, план под v64. Что построено по v67: колонка 720px по центру (UD5), блок `ChatFacts` по README (шапка: аватар 24px, имя-ссылка на профиль, «Checked …» в основной зоне; сетка Balance и Next lesson, на телефоне одна колонка; `role="group"` с именем «Facts: <имя>»), «Not set» с «No opening balance yet.», «Unavailable» с «The calendar view is not current.», «No lesson ahead» только при свежем чтении, блок ошибки «Could not read the student's records.» с Refresh records. Отличий от UI-SPEC по этим блокам нет. Не построено (за рамками плана): шапка колонки с All chats и New chat, список разговоров, сообщения, composer, предупреждение о частичном охвате. `SkeletonSwap` (кроссфейд, v67) в репозитории пока нигде не применён, здесь тоже не применялся.

## Проверки

Выполнено:

- `node scripts/dev-checks/chat-api.mjs records` (dvlab_test, порт 4224): `CHAT_RECORDS_OK`, 0 FAIL, дважды. Покрыто: шесть вымышленных карточек `Alex Example 2201`-`2206` (запас, без начального баланса, долг по отметке done, у порога, с отметкой, архивная); для каждой `GET /chat/records` равен `GET /students` и `GET /students/:id` по `balanceMinutes` и ожидаемому значению (300, null, -60, 120, 120, 60), `paysSoon` равен членству в `/today.paysSoon`, результат и `startsAt` следующего урока равны профилю, заголовок `cache-control: no-store`; null не превращается в ноль; 400 `invalid_request` для отсутствующего, пустого, неверного `studentId` и лишнего ключа запроса; 404 `not_found` без данных карточки для неизвестного uuid; 403 для сессии ученика, 401 без сессии и с поддельной сессией, без имени карточки и баланса в теле; обход всех маршрутов `/chat` из `app.routes` приложения `createApp` (сейчас один: `GET /chat/records`): ученику 403, без сессии 401; счётчики строк всех таблиц `public` до и после чтений совпадают; в логе api нет имени фикстуры. Фикстуры удалены.
- `yarn workspace @dv-lab/contracts typecheck`, `@dv-lab/api typecheck`, `@dv-lab/web typecheck`: код выхода 0.
- `yarn workspace @dv-lab/web lint`: код выхода 0.
- `prettier --check` по файлам плана: чисто (после коммита 10dde97).
- Критерии приёмки: `chat/facts.ts` импортирует `getCard`, поиск `studentBalance|Minutes *[-+]` пуст; `routes/chat.ts` ставит `requireRole('teacher')` один раз в `use('*')`; `chat-screen.tsx` вызывает `apiRequest`, `fetch(` нет; без `?student=` страница не рендерит `StudentRecords`, значит запросов к `/chat/records` нет (проверка в браузере не выполнялась).

Не выполнено, по распоряжению ведущей сессии (порты 3000 и 4000 заняты стендом владельца из этого же worktree, его не останавливали):

- `node scripts/dev-checks/chat-web.mjs records light` и `dark`. Скрипт написан, проходит `node` до разбора аргументов (usage, код 2), но ни разу не исполнялся: при первом запуске в нём могут найтись ошибки. Запуск владельцем вместе с ведущей сессией: `node scripts/dev-checks/chat-web.mjs records light`, затем `dark`, на поднятом стенде (`node scripts/dev-checks/wait-dev.mjs up`). Скрипт входит dev-учителем из `.env`, создаёт и удаляет карточки `Alex Example 2211` и `2212` в `dvlab_dev`, пишет скриншоты в `STATE_DIR`, печатает `CHAT_WEB_RECORDS_OK`. Ожидаемо проверит: нет запроса без `?student=`, остаток и Pays soon как в Students, «Not set» не нулём, «Unavailable» при неизвестном следующем уроке, сбой чтения с Refresh records и повтором, «This student is no longer available.», одну колонку на 390px.
- `node scripts/dev-checks/wait-dev.mjs down` (стенд владельца не трогали).
- Ручная проверка вида `/chat` в обеих темах: не выполнялась, экран в браузере не открывался.
- `yarn build` и `yarn test` не запускались по распоряжению.

## Deviations from Plan

**1. [Упрощение] `readChatFacts` без `listCards`.** План называл `getCard` и `listCards` плюс `paysSoonList`. Принадлежность к Pays soon считается `paysSoonList([card], порог)`: фильтр поэлементный, порядок не нужен, результат равен `/today` (проверено на шести карточках, включая архивную). Чтение всех карточек ради одной не делалось.

**2. [Rule 2] В `chatStudentFacts.student` добавлен `defaultLessonMinutes`.** Без него экран не может отрисовать остаток в уроках и состояние Pays soon.

**3. Строгая схема запроса.** `chatRecordsQuery` - `strictObject` на весь query string: любой лишний параметр даёт 400 `invalid_request`. Планам 22-05...22-16 при добавлении параметра в `/chat/records` расширять схему; служебные параметры в запрос не добавлять.

**4. Четыре коммита вместо трёх.** Четвёртый (`style`, 10dde97) - форматирование Prettier после проверки `prettier --check`. `commits: 4` измерено `git rev-list --count e439cbf..HEAD`.

**5. Последнее известное следующее занятие.** Если результат `known`, но статус чтения `last_known`, экран показывает время и под ним «The calendar view is not current.». Это моя трактовка README ChatFacts («Unavailable», когда вид календаря не текущий): в дизайне для `known` со старым чтением отдельного состояния нет. Открытый вопрос Design dude (EXECUTOR-RULES 8): нужно ли такое состояние рисовать иначе или показывать «Unavailable». Также `none` не при свежем чтении показывается как «Unavailable», не «No lesson ahead».

**6. Аватар 24px.** Общий `Avatar` фиксирован на 28px, в плане его файла нет; размер 24px по README получен обёрткой `[&>span]:size-6` без правки `avatar.tsx`.

## Known Stubs

- P06 (пустое состояние без `?student=`, «What do you want to ask?») и P08 (недоступный студент) выведены общим `EmptyLine` как временные строки: приветствие с подсказками, composer и разговоры появятся в планах композера и сообщений (22-05...22-08).
- Заголовок страницы - обычный `PageHeader` «Chat» без All chats и New chat: действия шапки колонки добавят следующие планы.

## Для следующих планов

- Все маршруты чата добавляются в `apps/api/src/routes/chat.ts` в тот же роутер; роль `teacher` ставит `use('*')`, в маршрутах её не дублировать.
- Wire-схемы чата - `packages/contracts/src/chat.ts`; новые типы туда же.
- `chat-api.mjs` строит список маршрутов `/chat` из `createApp` сам: новые маршруты попадают в обход (403 ученику, 401 без сессии, тело `{}`, случайные uuid) без правки раздела; разделы добавлять в объект `SECTIONS`. Раздел `records` падает, если обход нашёл новый маршрут, который не отвечает 403/401, - так и задумано. Порт 4224, вымышленные карточки `Alex Example 2201`-`2206`.
- `?student=<uuid>` читает `page.tsx` и передаёт в `ChatScreen`; упоминание 22-08 может ставить тот же параметр. `StudentFacts` принимает `ChatStudentFacts` целиком; охват и источник (coverage, excerpt) добавляются в тот же блок.
- `chat-web.mjs` не исполнялся: прогнать вместе с владельцем до опоры на него в 22-13 и 22-17.

## Self-Check: PASSED

Файлы плана найдены, коммиты 9d7d989, f5afcdf, eff94c3, 10dde97 есть в ветке, `git rev-list --count e439cbf..HEAD` = 4, рабочее дерево чисто по файлам плана (остался только `apps/web/next.config.ts` владельца).
