---
phase: 22
fixed_at: 2026-10-14
review_path: .planning/phases/22-chat-with-mentions-and-quick-marks/22-REVIEW-VERIFIED.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Фаза 22: исправления по ревью

Источник: `22-REVIEW-VERIFIED.md` (выжившие находки `22-REVIEW.md` и `22-SECURITY.md`). INFO и опровергнутое не трогались. Номера строк отчётов относились к ревизии 83cfb86, места найдены по символам в текущем коде ветки `gsd/phase-22-chat-replan`.

Проверки шли в worktree `.claude/worktrees/gsd+phase-22-chat-replan` (основное дерево этой ветки) на `dvlab_test`, своими портами api.

## Исправлено

### CR-02: Undo «didn't happen» возвращал перенесённое вхождение на время серии

Коммит: 4504efa. Файл: `apps/api/src/chat/calendar.ts`.

В `prepareUndo` для отмены вхождения серии читается вхождение через `lockOccurrence`. Если естественное время вхождения не равно `before.startsAt` или длительность правила не равна `before.durationMinutes`, Undo отвечает `stale` без команды: `restore` вернул бы урок не туда, где он был. Для неперенесённого вхождения и одиночного урока Undo работает как раньше.

Вторая половина предложения ревью (проверка в `settleUndo`) не добавлена: условие проверяется до отправки команды, а смену правила между подготовкой и применением уже ловит сверка `capturedRule` в `applyOccurrenceChange` (`precondition_failed`).

Требует проверки владельцем: сценарий «перенёс вхождение, отменил в чате, Undo» теперь даёт `stale`, а не возврат на время серии.

### CR-01: `no_show` оставался на возвращённом уроке в будущем

Коммит: 73189c2. Файл: `apps/api/src/schedule/changes.ts`.

`clearsMark` снимает `no_show` при `move` и при `restore`, если итоговое время урока позже текущего момента. Правило совпало с путём из Google.

### WR-04: инструмент `lessons` читал уроки мимо проекции календаря и фильтра истории

Коммит: d87c698. Файлы: `apps/api/src/today/today.ts`, `apps/api/src/chat/tools.ts`.

В `today.ts` добавлена `readLessonRange(executor, context, from, to)`: прошлое диапазона — `readWindow` и `filterHistoryBlocks`, будущее — `calendarLessons` из `readCalendarWindow` по каждой неделе диапазона, те же выражения, что в `readLessonDay`. `lessons` берёт уроки из неё; фильтры `movedTo === null` и `student_id` и порядок прежние. `readLessonDay` не менялся. `calendarRead` в блоке остался `null`: на это есть проверка в `chat-runs.mjs`.

Следствие: будущие уроки инструмент `lessons` теперь показывает только из проекции Google, без подключения календаря будущее пусто, как в Today.

`readChatLessonDates` (инструмент `lesson_dates`) не менялся: в проверенном списке его нет, а `chat-runs.mjs` считает будущие даты по локальным правилам без подключения Google.

### F-01: русские слова учёта проходили фильтр публикации

Коммит: eaf8e1c. Файл: `apps/api/src/chat/publish-gate.ts`.

В `LEDGER_PREFIXES` добавлены основы `остал`, `занят`, `баланс`, `оплач`, `сумм`, `стоим`. Список один, в `publish-gate.ts`. Проверка разовым скриптом через `checkSentence`: четыре фразы из F-01 и «Осталось три урока.» — `withhold`; фразы без учёта («Занятие прошло хорошо.», «по 7 страниц») — `publish`.

### F-02: protocol-relative ссылки в ответе чата рисовались внешними

Коммит: ee8ee85. Файл: `apps/web/components/app/markdown-view.tsx`.

В компонентах ответа чата ссылкой рисуется только href, который начинается с `/` и после разбора `new URL(href, 'https://dv.invalid')` остаётся на том же origin. Остальное (`//host`, `/\host`, `https:/host`, внешние адреса) показывается текстом. Вид ссылки вынесен в компонент `Link`, вне чата `MarkdownView` рисует ссылки как раньше.

### T-22-40: политика описывала объём отправки уже, чем код

Коммит: b38b11f. Файл: `apps/web/app/privacy/page.tsx`.

В разделе Chat assistant перечислены: пол ученика, записи учеников, которых модель находит по ходу ответа, имена до шести активных учеников при поиске по имени и уроки всех учеников с именами при вопросе об уроках за период без ученика.

## Проверки

| Проверка | Итог |
|----------|------|
| `yarn workspace @dv-lab/api typecheck` | зелёный после каждой правки api |
| `tsc --noEmit` в `apps/web` | зелёный после F-02 |
| `eslint` и `prettier --check` по `markdown-view.tsx` и `privacy/page.tsx` | зелёные |
| `prettier --check` по изменённым файлам api | зелёный |
| `chat-calendar.mjs` | `CHAT_CALENDAR_OK` |
| `schedule-started.mjs`, `schedule-started-series.mjs`, `mark-revision.mjs`, `schedule-core.mjs` | `SCHEDULE_STARTED_OK`, `SCHEDULE_STARTED_SERIES_OK`, `MARK_REVISION_OK`, `CORE_OK` |
| `chat-runs.mjs` (после WR-04 и после F-01) | `CHAT_RUNS_OK` |
| `chat-api.mjs answers` (после WR-04 и после F-01), `chat-api.mjs records` | `CHAT_ANSWERS_OK`, `CHAT_RECORDS_OK` |
| `chat-changes.mjs payment` (после F-01) | `CHAT_CHANGES_PAYMENT_OK` |
| разовый скрипт `checkSentence` (вне репозитория) | фразы F-01 удерживаются |

NOT RUN: браузерные проверки (`chat-web.mjs`, `schedule-web.mjs`, `schedule-started-web.mjs`, `changes-web.mjs`) — порты 3000 и 4000 заняты dev-серверами владельца. Вид ссылок в ответе чата и текст политики в браузере не проверены. Полный `chat-final.mjs`, `yarn test` и `yarn build` не запускались.

Новых тестов нет. Комментариев в коде нет.
