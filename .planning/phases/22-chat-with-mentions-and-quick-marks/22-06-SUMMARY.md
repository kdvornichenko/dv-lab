---
phase: 22-chat-with-mentions-and-quick-marks
plan: '06'
status: complete
verification: blocked
subsystem: db-api-web
tags: [chat, notes, entries, revision, retract, migration, student-profile]

requires:
  - phase: 22-05
    provides: 'chat-schema.ts и drizzle.config.ts со списком схем, паттерн ревизии и tombstone, chat-api.mjs с send() и chat-web.mjs с объектом разделов'
provides:
  - 'db: entry-schema.ts с student_notes и lesson_comments (одна форма записи: id, ревизия, retracted_at), REVOKE DELETE, TRUNCATE у dvlab_app на обеих'
  - 'contracts/students.ts: NOTE_MAX_LENGTH, appendStudentNoteRequest, retractNoteRequest, типы StudentNote, StudentNotesResponse, StudentNoteResponse'
  - 'api cards/notes.ts: appendStudentNote, listStudentNotes, retractStudentNote (первый параметр DbExecutor, второй accountId)'
  - 'api routes/students.ts: GET /students/:id/notes, POST /students/:id/notes/:noteId/retract'
  - 'web: note-entries.tsx (список записей под разделом, Remove с подтверждением), notes-tab.tsx читает записи отдельно от разделов'
  - 'scripts/dev-checks: chat-api.mjs notes (CHAT_NOTES_OK), chat-web.mjs notes (CHAT_WEB_NOTES_OK, не исполнялся)'
affects: [22-07, 22-09, 22-13, 22-16]

actuals:
  tokens: 13000
  tasks: 3
  commits: 4
plan_head_before: 2bb7939965b874caa2deb60aa698b9ed959ee12c
plan_head_after: cb471ff

tech-stack:
  added: []
  patterns:
    - 'Запись заметки - отдельная строка с id и ревизией; отзыв ставит retracted_at и растит ревизию, строка не удаляется'
    - 'Отзыв: транзакция, select for update, сверка expectedRevision, повторный отзыв и устаревшая ревизия дают 409 precondition_failed без изменений'
    - 'Функции владельца принимают executor, чтобы чат писал запись и квитанцию одной транзакцией'

key-files:
  created:
    - packages/db/src/entry-schema.ts
    - packages/db/drizzle/20261013124933_chat_entries/migration.sql
    - packages/db/drizzle/20261013124933_chat_entries/snapshot.json
    - packages/db/drizzle/20261013124936_chat_entries_revoke_delete/migration.sql
    - packages/db/drizzle/20261013124936_chat_entries_revoke_delete/snapshot.json
    - apps/api/src/cards/notes.ts
    - apps/web/app/(app)/students/[id]/_components/note-entries.tsx
  modified:
    - packages/db/src/index.ts
    - packages/db/drizzle.config.ts
    - packages/contracts/src/students.ts
    - apps/api/src/routes/students.ts
    - apps/web/app/(app)/students/[id]/_components/notes-tab.tsx
    - apps/web/app/(app)/students/[id]/_components/student-profile.tsx
    - scripts/dev-checks/chat-api.mjs
    - scripts/dev-checks/chat-web.mjs

key-decisions:
  - 'Порядок записей: api отдаёт старые первыми (created_at, id, как в плане), web разворачивает: README NoteEntries требует новейшую первой'
  - 'Происхождение записи (origin из README) не хранится и не передаётся: в этой фазе заметки создаёт только чат, подпись «Added in chat» жёстко в note-entries.tsx'
  - 'Текст записи без NUL (Postgres text его не хранит) и без обрезки: длиннее 2000 символов (code points) или пустой после trim - 400'
  - 'Отзыв заметки по чужому URL карточки - 404: retractStudentNote принимает необязательный studentId, маршрут его передаёт, чат 22-09 может не передавать'

requirements-completed: [CHAT-04, CHAT-07]

duration: ~1h20
completed: 2026-10-13
---

# Phase 22 Plan 06: Заметки как отдельные записи Summary

Заметка, записанная чатом, теперь отдельная строка `student_notes` со своим id и ревизией, а не правка текста раздела: схема с REVOKE, владелец `cards/notes.ts`, два маршрута профиля и список «Added notes» под каждым разделом на вкладке Notes. Таблица `lesson_comments` создана той же миграцией для 22-07.

## Задачи и коммиты

| # | Задача | Коммит |
|---|--------|--------|
| 1 | Таблицы `student_notes` и `lesson_comments`, миграция, отзыв DELETE/TRUNCATE | e2caaa5 |
| 2 | Контракт, владелец заметок, маршруты, `chat-api.mjs notes` | 3ebe6d8 |
| 3 | Список записей под разделами, `notes-tab.tsx`, `chat-web.mjs notes` | cb471ff |

Каталоги миграций: `packages/db/drizzle/20261013124933_chat_entries` (`yarn db:generate --name chat_entries`) и `packages/db/drizzle/20261013124936_chat_entries_revoke_delete` (`drizzle-kit generate --custom`, одна инструкция `REVOKE DELETE, TRUNCATE ON "student_notes", "lesson_comments" FROM "dvlab_app";`). Сгенерированный SQL руками не правился. Второй `yarn db:generate` печатает «No schema changes».

`commits: 4` измерено `git rev-list --count 2bb7939..cb471ff`: три коммита плана и `0817c53` ведущей сессии (правка `chat-api.mjs` по pino, не относится к плану).

## Дизайн

Версия `~/dv-lab-design` на исполнении: v67; precondition DR-22-03 выполнен (`NoteEntries/README.md` и `preview.html` есть). Построено по README: заголовок `caption muted` «Added notes» только у разделов с записями; строка с колонкой 112px (дата `caption muted tabular-nums` через `formatDay` из `schedule-format.ts`, год только не текущий, под ней `micro muted` «Added in chat»), текст через `MarkdownView` (`skipHtml`), Remove ghost compact с иконкой корзины, скрыт (`opacity-0`, место занято) до hover и фокуса на pointer-экране, виден на touch и ниже `md`; разделитель `border`; новейшая первой. Remove открывает общий `ConfirmDialog` (тексты README дословно, Keep note в фокусе, «Removing…», сбой строкой над кнопками); во время запроса строка 50% с «Removing…» и уходит только после ответа сервера; 409 или 404 перечитывают список и показывают строку с иконкой info «This note changed after it was added. The list is updated.», диалог закрывается; после успеха фокус на следующей записи или на кнопке Edit раздела. Загрузка: две `Skeleton`-строки под текстом; сбой чтения: строка «Could not load the added notes.» и Refresh (secondary compact) под текстом раздела, вкладка не падает. Редактор: подпись «Notes added later are listed under the section. They are not part of this text.», записи остаются под редактором, в черновик и в PUT не попадают. Телефон: дата и «· Added in chat» одной строкой над текстом, Remove под текстом слева.

## Проверки

Выполнено:

- `yarn db:generate` после обеих миграций: «No schema changes». `git status --porcelain packages/db/drizzle`: только два новых каталога.
- Миграции применены к `dvlab_test` и `dvlab_dev` способом 22-05 (`env -u DATABASE_URL -u MIGRATOR_DATABASE_URL node --env-file=<.env.test|.env> apps/api/src/migrate.ts`): «migrations applied» на обеих.
- `node scripts/dev-checks/sql.mjs <.env.test|.env> app "select has_table_privilege(...)"`: DELETE и TRUNCATE у `dvlab_app` на `student_notes` и `lesson_comments` `false`, INSERT на `student_notes` и UPDATE на `lesson_comments` `true` на обеих базах.
- `yarn workspace @dv-lab/db|contracts|api|web typecheck` и `yarn workspace @dv-lab/web lint`: код выхода 0. `prettier --check` по файлам плана: чисто.
- `node scripts/dev-checks/chat-api.mjs notes` (dvlab_test, порт 4224): `CHAT_NOTES_OK`, 33 PASS, 0 FAIL, повторный прогон тоже. Покрыто: две заметки с одинаковым текстом - два id с ревизией 1; запись на архивную и несуществующую карточку - `null` и ничего не пишет; список несуществующей карточки `null`, архивной пуст; контракт: trim, 2000 символов кириллицы и эмодзи принимаются, 2001, пусто, NUL, неизвестный раздел и лишний ключ - отказ; `GET /students/:id/notes`: 200, `no-store`, старые первыми, без `studentId`; записи не смешиваются между карточками; архивная карточка читается пустой; неизвестная и битая карточка - 404; PUT раздела не меняет записи, запись не меняет текст раздела; отзыв: 400 при нулевой ревизии, без ревизии и с лишним ключом, 409 `precondition_failed` при устаревшей ревизии без изменений, 404 при отзыве через URL другой карточки, неизвестной заметки, битых id; отзыв с верной ревизией - 200, ревизия +1, `retracted_at`, строка и текст на месте; повторный отзыв со старой и с текущей ревизией - 409; отозванная заметка ушла из списка, парная осталась; два одновременных отзыва - ровно один 200 и один 409, ревизия выросла один раз; отзыв внутри транзакции вызывающего (executor); ученик 403 и без сессии 401 на обоих маршрутах без текста заметки; роль приложения при `DELETE` и `TRUNCATE` на обеих таблицах получает 42501; в логе api нет текста заметок. Фикстуры удалены (в `student_notes` 0 строк, карточек `Alex Example 22%` 0).
- `chat-api.mjs records` (`CHAT_RECORDS_OK`) и `chat-api.mjs conversations` (`CHAT_CONVERSATIONS_OK`) после правок общих частей скрипта остаются зелёными.
- Критерии приёмки: `notes.ts` экспортирует три функции с первым параметром `DbExecutor`; `drizzle.config.ts` перечисляет `./src/entry-schema.ts`.

Не выполнено, по распоряжению ведущей сессии (порты 3000 и 4000 заняты стендом владельца из этого же worktree, его не останавливали):

- `node scripts/dev-checks/chat-web.mjs notes light` и `dark`. Раздел написан, проходит `node --check`, без аргументов печатает usage (код 2), ни разу не исполнялся: при первом запуске вероятны ошибки селекторов (`section[aria-labelledby="section-<kind>"]`, вкладка `getByRole('tab', { name: 'Notes' })`, `opacity` кнопки Remove при hover, ожидание `detached` у диалога, `getByRole('status', { name: 'Loading added notes' })`). Запуск владельцем с ведущей сессией на поднятом стенде: `node scripts/dev-checks/chat-web.mjs notes light`, затем `dark`. Скрипт входит dev-учителем из `.env`, создаёт в `dvlab_dev` карточку `Alex Example 2214` и три записи SQL, в конце удаляет записи, текст разделов и карточку. Ожидаемо проверит: порядок и разметку списка, Remove скрыт до hover, редактор с чистым текстом и подписью, PUT только с текстом раздела, Keep note, сбой 500 (диалог остаётся), «Removing…» при задержанном запросе, успешный отзыв (строка в базе осталась, ревизия 2), перенос фокуса, 409 с строкой «This note changed...», загрузку со скелетоном, сбой чтения с Refresh, телефон 390px без горизонтальной прокрутки; печатает `CHAT_WEB_NOTES_OK`.
- `node scripts/dev-checks/wait-dev.mjs down` (стенд владельца не трогали).
- Ручная проверка вкладки Notes в обеих темах в браузере не выполнялась: экран в браузере не открывался. Вид списка, подтверждения и состояний не сверен со скриншотами; для UI это значит «не проверено».
- `yarn build` и `yarn test` не запускались по распоряжению.

## Deviations from Plan

**1. Применение миграций.** Вместо `node scripts/dev-checks/schedule-db.mjs migrate` использован `node --env-file=<.env.test|.env> apps/api/src/migrate.ts` без `DATABASE_URL` и `MIGRATOR_DATABASE_URL` в окружении (распоряжение ведущей сессии).

**2. [Rule 3] `student-profile.tsx` вне списка `files_modified`.** `NotesTab` теперь получает `timeZone` (основной пояс `defaultTimeZone` из ответа карточки) и `asOf`: даты записей показываются через `Intl` в явной зоне (AGENTS.md), а не в зоне браузера. Правка - два пропса в одном месте вызова.

**3. [Rule 3] Очистка фикстур.** `removeCards` из `ledger-api/context.ts` (общий, не моего плана) не знает про `student_notes`, `lesson_comments` и `student_sections`, а их внешние ключи `restrict` не дали бы удалить карточку. Локальный `removeEntries` в `chat-api.mjs` вызывается до обоих `removeCards` (в начале и в `finally`); в `chat-web.mjs` те же три `delete` добавлены в `removeFixtures`. Следующим планам, создающим записи или тексты разделов для вымышленных карточек, делать так же.

**4. Параллельный коммит ведущей сессии.** Между задачами 1 и 2 появился `0817c53` (правка `chat-api.mjs`: `createRequire` для pino). Мои правки того же файла наложены поверх него, импорты `readFileSync`, `parseEnv`, `ENV_TEST` добавлены к его импортам.

**5. Проверка api вызывает функции владельца напрямую.** Маршрута создания заметки нет (создаёт чат, 22-09), поэтому `chat-api.mjs notes` открывает `createDb` под ролью приложения на `dvlab_test` (URL из `.env.test`) и зовёт `appendStudentNote`, `listStudentNotes`, `retractStudentNote` из `cards/notes.ts`; остальное идёт HTTP. Фикстуры `chat-web.mjs notes` вставляются SQL под ролью миграций (общий `sql()` из `browser-context.ts`), а не под приложением.

**6. Параметр `accountId` в `cards/notes.ts` не используется** (`_accountId`). В таблице заметок нет владельца-аккаунта (план его не задаёт, карточки тоже без владельца, учитель один); параметр оставлен для единого вида портов чата с 22-09. Если появится несколько учителей, колонку и проверку добавлять в `student_notes`.

**7. `retractStudentNote` принимает необязательный пятый параметр `studentId`** (план: `executor, accountId, noteId, expectedRevision`). Маршрут передаёт id из URL: заметка чужой карточки по этому URL не отзывается (404). Чат 22-09 вызывает без него.

**8. Самодельные строки интерфейса (EXECUTOR-RULES 8).** В README NoteEntries нет текста описания тоста (README: только «Note removed», а `toast.show` требует заголовок и описание) - сделано «Note removed» + «`<Section>` on `<Name>`'s card.» по образцу тоста «Section saved»; `aria-label="Loading added notes"` у скелетона. Подтверждение использует общий `ConfirmDialog` (cancel - secondary), а не ghost-кнопку Keep note из `preview.html`: так же построены остальные подтверждения; расхождение с превью - вопрос к Design dude.

**9. Новейшая запись первой.** Plan: api отдаёт `created_at, id` по возрастанию; README: новейшая первой. Развернуто в web (`note-entries.tsx`), api не менялся.

## Known Stubs

Нет. `lesson_comments` пока без владельца и маршрутов - это не заглушка в UI, комментарии урока добавляет 22-07.

## Для следующих планов

- 22-07 (комментарии урока): таблица `lesson_comments` уже создана и мигрирована на `dvlab_test` и `dvlab_dev`; колонки: `id`, ссылка на урок формы `lesson_marks` (`series_id` + `original_on` либо `lesson_id`, CHECK `lesson_comments_ref_ck`), `student_id`, `body` (1..2000), `revision`, `created_at`, `updated_at`, `retracted_at`; индексы по ссылке и по `student_id` неуникальные; DELETE и TRUNCATE у приложения отозваны. Владельца и маршруты пишет 22-07 по образцу `cards/notes.ts`.
- 22-09 (чат): `appendStudentNote(executor, accountId, studentId, { sectionKind, body })` возвращает `StudentNote | null` (`null` - карточка не найдена или в архиве); текст нужно прогонять через `appendStudentNoteRequest` (trim, 1..2000, без NUL) до вызова. Undo: `retractStudentNote(tx, accountId, noteId, expectedRevision)` вернёт `{ kind: 'retracted' | 'changed' | 'not_found' }`; ревизия записи после создания всегда 1, после отзыва 2. Для квитанции чата запись и квитанция пишутся в одной транзакции через общий `executor`.
- Фикстуры для карточек с записями: удалять `lesson_comments`, `student_notes`, `student_sections` до `removeCards` (см. отклонение 3); приложение удалять строки записей не может.
- Из 22-05 остаётся открытым вопрос, создавать ли пустой разговор при New chat (README ChatPage) или на первый Send: решается в планах композера.

## Self-Check: PASSED

Файлы найдены: `entry-schema.ts`, оба каталога миграций (`migration.sql` и `snapshot.json`), `cards/notes.ts`, `note-entries.tsx`. Коммиты e2caaa5, 3ebe6d8 и cb471ff есть в ветке, `git rev-list --count 2bb7939..cb471ff` = 4 (с `0817c53` ведущей сессии). Рабочее дерево чисто по файлам плана (остался только `apps/web/next.config.ts` владельца), процессов не оставлено.
