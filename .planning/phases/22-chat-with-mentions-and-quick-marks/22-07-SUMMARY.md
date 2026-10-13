---
phase: 22-chat-with-mentions-and-quick-marks
plan: '07'
status: complete
verification: blocked
subsystem: api-web
tags: [chat, lesson-comments, revision, retract, series-cut, held-dates, schedule, today]

requires:
  - phase: 22-06
    provides: 'таблица lesson_comments (ключ урока как у lesson_marks, ревизия, retracted_at, REVOKE DELETE/TRUNCATE), образец cards/notes.ts'
  - phase: 22-18
    provides: 'heldSeriesDates, seriesAnchor, allFrom: удерживаемые даты разреза'
  - phase: 22-02
    provides: 'диалоги начавшегося урока в Schedule и Today'
provides:
  - 'api schedule/comments.ts: appendLessonComment, listLessonComments, retractLessonComment (первый параметр DbExecutor, второй accountId)'
  - 'api routes/schedule.ts: GET /schedule/lessons/:id/comments, GET /schedule/series/:id/occurrences/:originalOn/comments, POST /schedule/comments/:commentId/retract'
  - 'contracts/schedule.ts: COMMENT_MAX_LENGTH, appendLessonCommentRequest, retractCommentRequest, типы LessonComment, LessonCommentsResponse, LessonCommentResponse'
  - 'rows.ts heldSeriesDates удерживает даты неотозванных комментариев; cut-apply.ts insertDomain переносит комментарии вхождения на новый одиночный урок'
  - 'web: lesson-comments.tsx (LessonComments v65), показ в lesson-details.tsx для Schedule и Today'
  - 'scripts/dev-checks: chat-api.mjs comments (CHAT_COMMENTS_OK), schedule-comments-series.mjs (SCHEDULE_COMMENTS_SERIES_OK), chat-web.mjs comments (CHAT_WEB_COMMENTS_OK, не исполнялся)'
affects: [22-09, 22-10, 22-13, 22-16]

actuals:
  tokens: 26595
  tasks: 3
  commits: 4
plan_head_before: fac3f77
plan_head_after: 974d8b8

tech-stack:
  added: []
  patterns:
    - 'Комментарий - отдельная строка со своим id и ревизией; отзыв ставит retracted_at и растит ревизию, строка не удаляется'
    - 'Порт принимает executor: чат пишет комментарий и квитанцию одной транзакцией'
    - 'Удерживаемые даты разреза читает один загрузчик heldSeriesDates: отметки done/no_show и неотозванные комментарии'

key-files:
  created:
    - apps/api/src/schedule/comments.ts
    - apps/web/app/(app)/schedule/_components/lesson-comments.tsx
    - scripts/dev-checks/schedule-comments-series.mjs
  modified:
    - packages/contracts/src/schedule.ts
    - apps/api/src/routes/schedule.ts
    - apps/api/src/schedule/rows.ts
    - apps/api/src/schedule/cut-apply.ts
    - apps/web/app/(app)/schedule/_components/lesson-details.tsx
    - apps/web/app/(app)/schedule/_components/calendar-lesson-dialog.tsx
    - apps/web/app/(app)/schedule/_components/lesson-dialog.tsx
    - scripts/dev-checks/chat-api.mjs
    - scripts/dev-checks/chat-web.mjs
    - scripts/dev-checks/README.md
    - AGENTS.md

key-decisions:
  - 'Порт отдаёт вид результата {kind: ok | not_found | not_started} (не T | null, как заметки): not_started отличается от not_found, чату нужны разные квитанции'
  - 'Отменённый начавшийся урок принимает комментарий (README LessonComments: секция остаётся у отменённого начавшегося урока)'
  - 'Статус карточки (архив) комментарию не мешает: проверка карточки в плане не названа, ключ урока и lockOccurrence/lockLesson достаточны'
  - 'Новейший комментарий первым: api отдаёт старые первыми (created_at, id), web разворачивает, как в заметках 22-06'

requirements-completed: [CHAT-04, CHAT-07]

duration: ~1h45
completed: 2026-10-13
---

# Phase 22 Plan 07: Комментарии урока Summary

Комментарий к начавшемуся уроку пишется портом `appendLessonComment`, читается и отзывается по ревизии, переживает перенос и разрез серии, а учитель видит его и убирает в диалогах Schedule и Today. Браузерная проверка не выполнялась (порты заняты стендом владельца).

## Задачи и коммиты

| # | Задача | Коммит |
|---|--------|--------|
| 1 | Порт комментариев, контракт, три маршрута, `heldSeriesDates`, перенос в `insertDomain` | 722c117 (код), 41196d5 (исправление, см. отклонение 1) |
| 2 | `LessonComments` и показ в `LessonDetails` обоих диалогов | 95732c4 |
| 3 | `chat-api.mjs comments`, `schedule-comments-series.mjs`, `chat-web.mjs comments`, README, AGENTS.md | 974d8b8 |

`commits: 4` измерено `git log --grep "(22-07)"`: три коммита плана и исправление; коммит `docs(22-07)` с этим SUMMARY в счёт не входит. `git rev-list --count fac3f77..HEAD` даёт больше, потому что на той же ветке параллельно легли коммиты 22-11 (`069ca7b`, `384fcb5`, `e12e3fd`, `dd9a7dc`).

## Что построено

- `schedule/comments.ts`: `appendLessonComment(executor, accountId, ref, body, now)` блокирует урок (`lockOccurrence` / `lockLesson`), возвращает `not_found` (нет урока, нет серии или дата не на серии) и `not_started` (`canChange(startsAt, now)`), пишет строку со `student_id` урока. `listLessonComments(executor, accountId, ref)` отдаёт неотозванные по `created_at, id`, для несуществующего урока или серии `null`. `retractLessonComment(executor, accountId, commentId, expectedRevision)` - `select for update`, сверка ревизии, повтор и устаревшая ревизия дают `changed`.
- Маршруты: чтение двух ключей, отзыв `POST /schedule/comments/:commentId/retract` (`409 precondition_failed`, `404 not_found`). Маршрута создания нет (его проверка: `POST /schedule/lessons/:id/comments` отвечает 404).
- `heldSeriesDates` теперь объединяет даты `done` и `no_show` с датами неотозванных комментариев серии. `seriesAnchor`, приём `move_series` и входящий путь Google берут их из этого же загрузчика без правок.
- `insertDomain` при окончании серии: рядом с копированием отметки обновляет `lesson_comments` вхождения (`lesson_id` нового урока, `series_id` и `original_on` пустые, ревизия +1).
- web: `lesson-comments.tsx` по `LessonComments` v65; `LessonDetails` получил необязательные `commentRef`, `started`, `now` и рисует секцию после блока деталей (не внутри `dl`) только для начавшегося урока; `calendar-lesson-dialog.tsx` (ключ `event.binding.ref`, признак `startedLesson`) и `lesson-dialog.tsx` (ключ `block.ref`, `canChange` по `block.startsAt`) передают ключ.

## Дизайн

Версия `~/dv-lab-design` на исполнении: v67; precondition DR-22-03 выполнен (`LessonComments/README.md` и `preview.html` есть). Построено по README: заголовок «Comments» (`body`, вес 600); строка: время главной зоны с подписью (`caption muted`, `tabular-nums`, «Wed 7 Oct, 14:05 VN», год только не текущий) над текстом (`MarkdownView`, `skipHtml`), справа Remove (ghost compact, корзина, `aria-label="Remove comment from 7 Oct, 14:05"`); новейший первым, разделитель `border`. Пусто: «No comments yet. Ask in the chat to add one.». Загрузка: две `Skeleton`-строки. Сбой чтения: иконка, «Could not load the comments.», Refresh (secondary compact), не пустой список. Remove через общий `ConfirmDialog` (тексты README дословно, Keep comment в фокусе, «Removing…», сбой строкой над кнопками); во время запроса строка 50% с «Removing…»; 409 или 404 перечитывают список и показывают строку с иконкой info «This comment changed after it was added. The list is updated.» (P11), диалог закрывается. Телефон: Remove под текстом слева (`-ml-2`). `role="list"`, строки состояния `role="status"`. Remove, в отличие от заметок профиля, виден всегда: README про скрытие до hover для комментариев не говорит.

## Проверки

Выполнено:

- `yarn workspace @dv-lab/contracts|api|web typecheck` и `yarn workspace @dv-lab/web lint`: код выхода 0 (после последнего коммита тоже). `yarn prettier --check` по файлам плана: чисто.
- `node scripts/dev-checks/chat-api.mjs comments` (`dvlab_test`, порт 4224): `CHAT_COMMENTS_OK`, 37 PASS, 0 FAIL, дважды подряд. Покрыто: комментарий к будущему уроку и к будущему вхождению - `not_started` без записи; неизвестный урок, серия и дата не на серии - `not_found`; два комментария с одним текстом - два id, ревизия 1; отменённый начавшийся урок принимает; вхождение серии хранится по `series_id` и `original_on`; контракт: trim, 2000 символов кириллицы и эмодзи принимаются, 2001, пусто, NUL и лишний ключ - отказ; `GET` по уроку и вхождению: 200, `no-store`, старые первыми, без `studentId`; пустой список, неизвестный и битый id, битая дата - 404; маршрута создания нет; отзыв: 400 при нулевой ревизии, без неё и с лишним ключом, 409 при устаревшей ревизии, 404 для неизвестного и битого id, верный отзыв - 200, ревизия +1, строка на месте, повтор со старой и текущей ревизией - 409, парный комментарий остался в списке, два одновременных отзыва - один 200 и один 409; отзыв внутри транзакции вызывающего; `seriesAnchor` без комментария - первая дата серии, с неотозванным комментарием начавшегося неотмеченного вхождения - следующая дата, после отзыва - снова первая; `prepareSeriesChange` (`move_series`) с даты комментария и раньше - `precondition_failed` без новых строк `google_commands`, с якоря - принят; перенос одиночного урока (SQL) и вхождения (исключение `moved`, SQL) оставляет комментарии на том же ключе; остаток и число строк `lesson_marks` не изменились; строки `lesson_comments` не уменьшились (4); ученик 403 и без сессии 401 на трёх маршрутах; роль приложения при `DELETE` и `TRUNCATE` получает 42501; в логе api нет текста комментариев. Фикстуры удалены (после прогона карточек `Alex Example 22%` и строк `lesson_comments` в `dvlab_test` 0).
- `node scripts/dev-checks/schedule-comments-series.mjs` (офлайн-шлюз-заглушка, `calendar-seed.mjs up/down test`): `SCHEDULE_COMMENTS_SERIES_OK`. Случай 1: комментарий к начавшемуся неотмеченному вхождению, `allFrom` в контексте серии недели = следующая дата серии; `move_series` с даты комментария - `precondition_failed`, число команд не выросло; «All lessons» с `allFrom` применена: новая серия с `allFrom`, старая кончается днём раньше, комментарий остался на `series_id` и `original_on` старой серии, ревизия 1. Случай 2: будущее вхождение перенесено в прошлое командой `move`, к нему два комментария и `no_show`, затем `end_series` с `lastOn` сегодня: оба комментария на новом одиночном уроке (`lesson_id` нового урока, `series_id` и `original_on` пустые, ревизия 2), список через порт содержит оба в порядке записи, у урока отметка `no_show`, число строк `lesson_comments` карточки то же (3 -> 3), старая серия кончается раньше даты хвоста. Случай 3: комментарий, вставленный SQL после плана `end_series` на дату хвоста без записи в `lineage`, останавливает окончание (команда `recovery_required`, причина `external_change`), комментарий остался на серии, серия открыта.
- Критерии приёмки: `comments.ts` экспортирует три функции с первым параметром `DbExecutor`, `appendLessonComment` вызывает `canChange`; `cut-apply.ts` обновляет `lessonComments` рядом с копированием отметки; `heldSeriesDates` читает `lessonComments`; `LessonComments` используется только через `lesson-details.tsx`; `grep -n "schedule/comments.ts" AGENTS.md` находит строку 87, строка о разрезе называет комментарии.

Не выполнено, по распоряжению ведущей сессии (порты 3000 и 4000 заняты стендом владельца из этого же worktree, его не останавливали):

- `node scripts/dev-checks/chat-web.mjs comments light` и `dark`. Раздел написан, проходит `node --check`, без аргументов печатает usage, ни разу не исполнялся: при первом запуске вероятны ошибки селекторов (`[data-slot="today-row-open"]` с фильтром по имени, `section[aria-labelledby="lesson-comments-title"]`, `getByRole('dialog', { name: 'Remove this comment?' })`, ожидание `detached`, ответ недели в Schedule подменяется через `page.route` по первому прошедшему событию недели - если в текущей неделе владельца нет прошедшего события со временем, шаг Schedule упадёт). Запуск владельцем с ведущей сессией на поднятом стенде: `node scripts/dev-checks/chat-web.mjs comments light`, затем `dark`. Скрипт входит dev-учителем из `.env`, создаёт в `dvlab_dev` карточку `Alex Example 2215`, начавшийся (20 минут назад) и будущий (через 2 часа, если местное время раньше 21:00) уроки и комментарии SQL, в конце удаляет комментарии, отметки, уроки и карточку. Ожидаемо проверит: сбой чтения (500) даёт строку с Refresh, два комментария новейшим первым и без отозванного, подпись Remove с датой и временем, нет поля ввода, подтверждение с Keep comment в фокусе, тост «Comment removed», «No comments yet…», у будущего урока блока нет, диалог Schedule показывает те же комментарии, телефон 390px без горизонтальной прокрутки; печатает `CHAT_WEB_COMMENTS_OK`.
- `node scripts/dev-checks/wait-dev.mjs down` (стенд владельца не трогали).
- Ручная проверка диалогов в браузере в обеих темах не выполнялась: экран в браузере не открывался. Вид секции, подтверждения и состояний не сверен со скриншотами; для UI это значит «не проверено». Нужна запись `unrun-verify` в `.planning/WINDOWS.md` ведущей сессией (файл не моего плана, не трогал).
- `yarn build`, `yarn test`, `yarn install` не запускались по распоряжению.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Правка `insertDomain` не попала в первый коммит**
- **Found during:** Task 3, первый прогон `schedule-comments-series.mjs` (случай 2: комментарии остались на серии)
- **Issue:** строка с обновлением `lesson_comments` в `insertDomain` не вставилась из-за неверного числа табуляций в шаблоне замены; `typecheck` этого не показал, коммит 722c117 содержал сигнатуру `insertDomain(tx, command, oldSeriesId, marks)` и защиту, но не само обновление.
- **Fix:** обновление добавлено, прогон проверки зелёный.
- **Commit:** 41196d5

**2. [Rule 2 - Correctness] Защита `external_change` в `currentTail` (`cut-apply.ts`)**
- Плана нет, но T-22-15 (mitigate) требует не терять комментарии при разрезе. `heldSeriesDates` не даёт ни `move_series`, ни входящему пути начаться до комментария, а комментарий пишется только к начавшемуся уроку, поэтому в хвосте без записи в `lineage` он может оказаться лишь в промежутке между планом команды и её применением (комментарий появился после `submit`). `applyConfirmedCut` теперь выбирает неотозванные комментарии серии с `original_on` не раньше `cutoff` (`for update`) и при отсутствии записи в `lineage.from` для даты бросает `CommandFault('external_change')`. Законный случай (перенесённое начавшееся вхождение хвоста есть в `lineage`) проходит; случай 2 и 3 проверки это показывают.
- **Commit:** 722c117

**3. Дополнительный файл проверки `scripts/dev-checks/schedule-comments-series.mjs`**
- План помещал сценарий `end_series` в `chat-api.mjs comments`, но он выполняется только через конвейер команд календаря с шлюзом-заглушкой и preload `calendar-offline.mjs` (как `schedule-started-series.mjs`), а `chat-api.mjs` ходит в api по HTTP без шлюза. Сценарий вынесен в отдельный скрипт по образцу `schedule-started-series.mjs` (заглушка и вспомогательные функции скопированы, как принято между `schedule-started.mjs` и `mark-revision.mjs`). `chat-api.mjs comments` проверяет всё остальное, включая `allFrom` и отказ `move_series` вызовом `seriesAnchor` и `prepareSeriesChange` напрямую.
- **Commit:** 974d8b8

**4. Проверка переноса урока в `chat-api.mjs` - SQL, а не команда**
- Перенос одиночного урока и вхождения (исключение `moved`) сделан SQL: команда переноса идёт только через Google-конвейер. Ключ комментария при переносе по команде проверяет случай 2 `schedule-comments-series.mjs` (вхождение перенесено командой `move` и сохранено как одиночное окончанием серии).

**5. [Rule 3] Правки вне `files_modified`**
- `scripts/dev-checks/README.md`: строки про новые разделы и скрипт (по образцу прошлых планов). `scripts/dev-checks/chat-web.mjs` `removeFixtures` удаляет также `lesson_marks` и `lessons` карточек префикса (иначе внешние ключи `restrict` не дали бы удалить карточку с уроком).

**6. Самодельные строки интерфейса (EXECUTOR-RULES 8)**
- README LessonComments не даёт описание тоста, а `toast.show` требует заголовок и описание: «Comment removed» + «The lesson and its mark did not change.» (из текста подтверждения). `aria-label="Loading comments"` у скелетона. Заголовок «Comments» получил `tabIndex={-1}` как место фокуса после удаления последнего комментария. Remove виден всегда, без скрытия до hover (README не требует скрытия). Подтверждение использует общий `ConfirmDialog` (cancel - secondary), а не ghost Keep comment из `preview.html`, как и в 22-06 - вопрос к Design dude.

**7. Показ времени комментария**
- Год во времени комментария опускается для текущего года в главной зоне через `formatWhen` и `zoneLabel`; README пример «Wed 7 Oct, 14:05 VN» этому соответствует.

## Known Stubs

Нет.

## Threat Flags

Нет: три маршрута (два чтения и отзыв) и таблица `lesson_comments` покрыты T-22-14 и T-22-15 из реестра плана; создания комментария по HTTP нет.

## Для следующих планов

- 22-09 (чат): `appendLessonComment(executor, accountId, ref, body, now)` возвращает `{ kind: 'ok', comment } | { kind: 'not_found' } | { kind: 'not_started' }` (не `T | null`, как у заметок); `body` нужно предварительно прогнать через `appendLessonCommentRequest` (trim, 1..2000, без NUL). `ref` - `OccurrenceRef` из core (`{ kind: 'single', lessonId }` или `{ kind: 'series', seriesId, originalOn }`). Undo: `retractLessonComment(tx, accountId, commentId, expectedRevision)` вернёт `{ kind: 'retracted' | 'changed' | 'not_found' }`; ревизия после создания 1, после отзыва 2; в отличие от `retractStudentNote`, параметра `studentId` для проверки владельца по URL нет (маршрут отзыва от карточки не зависит). Квитанцию и комментарий писать в одной транзакции через общий executor. `not_started` соответствует `400 lesson_not_started` (причина отказа в ответе чата).
- Ключ комментария меняется только в `insertDomain` при окончании серии или разрезе, где вхождение хвоста становится одиночным уроком; ревизия при этом растёт. Устаревшая ревизия у Undo после такого переноса даст `changed`: чат должен перечитать комментарий, а не повторять отзыв.
- 22-13, 22-16: `LessonComments` в окне урока читает комментарии по ключу сам; чату обновлять его не нужно, он перечитывает список при открытии.
- Фикстуры карточек с комментариями: удалять `lesson_comments` до `removeCards` (`removeEntries` в `chat-api.mjs`, `removeFixtures` в `chat-web.mjs`, `purgeCard` в `schedule-comments-series.mjs`); приложение удалять строки не может.
- `schedule-comments-series.mjs` меняет данные синтетического подключения в `dvlab_test` (`calendar-seed up/down test week`): не запускать при параллельных исполнителях, которым нужен тот же сид.

## Self-Check: PASSED

Файлы найдены: `apps/api/src/schedule/comments.ts`, `apps/web/app/(app)/schedule/_components/lesson-comments.tsx`, `scripts/dev-checks/schedule-comments-series.mjs`. Коммиты 722c117, 95732c4, 41196d5, 974d8b8 есть в ветке (`git log --grep "(22-07)"` = 4). `actuals.tokens` - символы `git log --grep "(22-07)" -p` / 4 (106381 / 4). Рабочее дерево чисто по файлам плана (остался только `apps/web/next.config.ts` владельца), процессов не оставлено.
