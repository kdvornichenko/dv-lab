---
phase: 21-lesson-accounting-and-today
plan: 08
subsystem: web
tags: [schedule, lesson-marks, status-dot, week-grid, event-tooltip, lesson-dialog, design-v40]
requires:
  - phase: 21-lesson-accounting-and-today
    provides: контракт и api отметок (21-04), зоны и Settings (21-06), тексты серии (21-14), перенос в любое время и действие series (21-17)
provides:
  - StatusDot с проп tone и label (цель 24 px, фокус, подсказка без задержки), DotShape и passive-режим для тултипа и блока
  - lib/lesson-mark-text.ts: слова, тон, aria-слово и слот по исходу (statusWord, statusLabel, statusTone, occurrenceSlot), строки по markEffect (markHelp, tooltipDeduction), подписи пилюль (markLabel, PILL_ORDER), blockEffect
  - знаки отметки на блоке сетки, строка вычета в тултипе, строка Mark в LessonDialog
  - markLesson(block, kind) в schedule-mutations.ts, единственный путь отметки для диалога и Today
  - scripts/dev-checks/ledger-web.mjs, раздел marks
affects: [21-09, 21-10, 21-11, 21-15, 21-16]
status: complete
commits: 2
plan_head_before: 555cbe4af40e2820491185ebb07e679473c7e866
plan_head_after: 08ff1fca52536a4507e6952bdc6706879691ad04
actuals:
  tokens: 23000
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns:
    - "Слова и тон исхода живут в одной таблице Record по StatusKey (исход плюс needs_mark); needs_mark выбирает awaitsMark из core, сравнений исхода со строками нет"
    - "Строки по markEffect выбираются switch по effect.kind, арифметика только в core (lessonsPhrase)"
key-files:
  created:
    - apps/web/lib/lesson-mark-text.ts
    - apps/web/app/(app)/schedule/_components/lesson-mark-row.tsx
    - scripts/dev-checks/ledger-web.mjs
  modified:
    - apps/web/components/app/status-dot.tsx
    - apps/web/app/(app)/schedule/_components/lesson-block.tsx
    - apps/web/app/(app)/schedule/_components/event-tooltip.tsx
    - apps/web/app/(app)/schedule/_components/lesson-dialog.tsx
    - apps/web/app/(app)/schedule/_components/schedule-mutations.ts
    - apps/web/app/(app)/schedule/_components/schedule-screen.tsx
    - apps/web/app/(app)/schedule/_components/week-grid.tsx
    - scripts/dev-checks/schedule-web.mjs
key-decisions:
  - "Знак и приглушение блока следуют за исходом (done, no_show), а не за датой: отмеченный урок, перенесённый в будущее, выглядит так же, как отмеченный прошедший (README v40)"
  - "Радиогруппа пилюль на Base UI RadioGroup и Radio, доступность всех трёх пилюль только из block.actions.mark"
  - "После успешной отметки экран перечитывает неделю и только потом отпускает пилюли, выбор не мигает прежним значением"
requirements-completed: [LEDG-03, LEDG-04, LEDG-05, LEDG-06, LEDG-08]
---

# Фаза 21, план 08: отметки уроков в расписании

Учитель отмечает, исправляет и снимает отметку прямо в диалоге урока; сетка показывает, какой урок ждёт отметки, какой проведён, пропущен или отменён; тултип говорит, что отметка сделала с остатком. Блок, тултип и диалог берут исход, действия и отметку из контракта и core, слова и тона лежат в одном модуле.

Дизайн: копия `~/dv-lab-design/` была v39 при чтении, в ходе работы стала v40 (README LessonMark, LessonDialog, WeekGrid, EventTooltip, StatusDot прочитаны по v40). План спланирован по v36, v38 учтён в 21-17.

## Что сделано

**Задача 1 (tracer), коммит 895641f.**
- `status-dot.tsx`: `StatusDot` принимает либо `status` ученика (active green, остальные gray, метки прежние), либо `tone` и `label`. Интерактивный вид: цель 24 px с `tabIndex 0`, `role="img"`, hover-кругом, focus-ring и подсказкой без задержки; цель выведена за поток через `-m-2`, поэтому раскладка таблицы учеников и профиля не изменилась. `passive` даёт точку без фокуса и подсказки (для тултипа). `DotShape` — голая точка 8 px (знак на блоке).
- `lib/lesson-mark-text.ts`: таблица слов, тона и aria-слова по `StatusKey` (исход плюс `needs_mark`), `statusKey` выбирает `needs_mark` через `awaitsMark` из core; `occurrenceSlot(outcome)` — единственная функция слота (`data-slot` блока, ключи, `OpenLesson`); `markHelp` и `tooltipDeduction` — switch по `MarkEffect['kind']`; `blockEffect` собирает вход `markEffect` из блока.
- `lesson-block.tsx`: свои `DOT`, `STATUS_CLASS`, `LessonStatus`, `blockSlot` удалены; вид блока — таблица по `StatusKey`. Needs a mark — полный цвет и точка 8 px warning с кольцом 1 px, Done и No-show — 60 % и Check или UserX 12 px, Cancelled — контур и зачёркнутое имя без знака, Moved — пунктир без знака. Справа от названия при знаке 16 px (OQ-3). `aria-label` добавляет «needs a mark», «done», «no-show» к словам фазы 20. Знаки не `<span>`, чтобы проверки фазы 20 по первому span и списку span не сдвинулись.
- `event-tooltip.tsx`: пассивная точка, слово статуса и строка `caption muted` («Deducts 1 lesson», «Deducts nothing», «Click to mark it.»); у cancelled, moved и не начавшегося неотмеченного строки нет. Тултип по-прежнему без фокусируемых элементов.
- `ledger-web.mjs`, раздел marks, часть 1 (`MARKS_WEB_PART1_OK`).

**Задача 2, коммит 08ff1fc.**
- `schedule-mutations.ts`: `markLesson(block, kind)` — `POST …/mark` с `{ kind, expectedStartsAt }`; общий `post<T>` под `mutate`.
- `lesson-mark-row.tsx`: подпись Mark, `RadioGroup` Base UI с именем Mark, три пилюли Scheduled, Done, No-show по 32 px, выбор сохраняется сразу, во время сохранения пилюли недоступны и строка читает «Saving…», ниже строка по `markHelp`. Группа недоступна (50 %) при `!block.actions.mark`; своих условий по исходу и времени нет.
- `lesson-dialog.tsx`: строка Mark сразу под строкой статуса, слово статуса из lesson-mark-text, Banner «Could not save the mark. Try again.» над строкой, stale 409 и 404 — существующий баннер и перечитывание; проп `onMark`.
- `schedule-screen.tsx`: `markBlock` — ok: перечитать неделю и отпустить пилюли, без тоста и оптимистичных обновлений; stale: `reload()`; failed: баннер.
- `ledger-web.mjs`, часть 2 (`MARKS_WEB_PART2_OK`, итог `LEDGER_WEB_MARKS_OK`). `schedule-web.mjs`: в проверки прошлого урока добавлена «dialog: a past lesson has the Mark row».

## Состояние «отмеченный урок, перенесённый в будущее» (по README v40)

В v38 не было нарисовано, в v40 нарисовано; сделано по v40 и проверено скриптом (карточка `Alex Example 2151 G`): блок сохраняет галочку и 60 % при будущей дате; тултип «Done» и «Deducts 1 lesson»; диалог — слово Done, пилюли доступны, выбрана Done, строка «Deducts 1 lesson (60 min).»; очистка метки возвращает пилюли в недоступные и строку «You can mark a lesson once it has started.»; для даты на или до даты открытия остатка `markEffect` из core отдаёт `before_opening` («Not counted: it falls on or before the opening balance date (5 Oct).»). Вариант «как у отмеченного прошедшего» из задания совпал с v40, отдельной ветки не понадобилось.

Расхождения с v40 в диалоге: у отмеченного урока, перенесённого серией, ссылка «moved from …» остаётся кнопкой фазы 20 (подчёркнутой, `foreground`), без точки-разделителя «·» и без `muted-foreground`, как в превью v40. Это отдельная правка вида ссылки, к плану не относится. Строку-пояснение формы переноса («The mark stays: …») не делал, по заданию.

## Проверки

| Команда | Результат |
|---------|-----------|
| `yarn workspace @dv-lab/web typecheck` | код 0 |
| `yarn workspace @dv-lab/web lint` | код 0 |
| `yarn workspace @dv-lab/web build` (после остановки dev-серверов) | код 0 |
| `node scripts/dev-checks/ledger-web.mjs marks` (светлая) | MARKS_WEB_PART1_OK, MARKS_WEB_PART2_OK, LEDGER_WEB_MARKS_OK, 0 FAIL |
| `node scripts/dev-checks/ledger-web.mjs marks dark` | то же, 0 FAIL |
| `schedule-web.mjs read` | SCHEDULE_WEB_READ_OK |
| `schedule-web.mjs changes` | SCHEDULE_WEB_CHANGES_OK (части 1-3 и move-past) |
| `schedule-web.mjs students`, `grid`, `forms` | SCHEDULE_WEB_STUDENTS_OK, SCHEDULE_WEB_GRID_OK, SCHEDULE_WEB_FORMS_OK (StatusDot и блок не сломали фазу 20) |
| `node scripts/dev-checks/wait-dev.mjs down` | DEV_DOWN_OK, порты 3000 и 4000 свободны |

Критерии приёмки: `const (DOT|STATUS_CLASS)` в lesson-block.tsx — нет; `occurrenceSlot` в lesson-block.tsx — 2; деления минут в lesson-mark-text.ts нет; сравнений `outcome ===` в lesson-mark-text.ts и lesson-mark-row.tsx нет; `'mark'` в каталоге расписания только в schedule-mutations.ts; «has already taken place» — нет; `actions.mark` в lesson-mark-row.tsx — 1; `canChange|awaitsMark|outcome ===` в lesson-mark-row.tsx — нет.

Что проверяет ledger-web.mjs marks (в обеих темах): точка warning 8 px и «needs a mark» у неотмеченного начавшегося урока, 0.6 с галочкой (12 px, aria-hidden) у Done, 0.6 с user-x у No-show, зачёркнутое имя без знака у отменённого с хранимой отметкой, 16 px справа от знака, тултипы (Done, No-show, Needs a mark, Cancelled, Planned у будущего, «Deducts nothing» при выключенном флаге), тултип без фокусируемых элементов; диалог: радиогруппа Mark, три пилюли 32 px, Scheduled выбрана и пояснение «Not marked yet…», Move lesson и Cancel lesson у начавшегося, подписи про невозможность изменения нет, отказ сохранения (500) возвращает выбор и показывает баннер и ничего не пишет, 409 даёт баннер об изменении, «Saving…» с недоступными пилюлями (запрос задержан), Done сохраняется (строка lesson_marks kind done, галочка на блоке), Scheduled пишет kind none, стрелка вправо переводит выбор, No-show при `no_show_deducts = false` даёт «Deducts nothing: …», отмена отмеченного урока оставляет Done выбранной при недоступных пилюлях и строку об отменённых, строка отметки на месте, «Return to schedule» возвращает Done; отменённый урок без отметки — Scheduled выбрана и недоступна; будущий неотмеченный — три недоступные пилюли и «You can mark a lesson once it has started.»; отмеченный урок, перенесённый api в будущее, — доступные пилюли, Done, «Deducts 1 lesson (60 min).», блок с галочкой и 60 %, очистка метки.

Скриншоты проверены глазами в обеих темах (сетка со знаками, тултипы, диалог в состояниях неотмеченного, ошибки, сохранения, отменённого, будущего и перенесённого отмеченного урока). Во встроенном браузере ведущей сессии стоит посмотреть диалог и сетку ещё раз.

Данные: фикстуры только `Alex Example 2150 A..D` и `Alex Example 2151 B, F, G`, уборка в начале и в `finally` (lesson_marks первыми); после каждого прогона «fixture cards removed 4» и «7». Реальные данные dvlab_dev не менялись. `no_show_deducts` меняется только у фикстуры.

Не запускалось: `yarn workspace @dv-lab/api build` и `yarn test` (правила плана).

## Изменённые ожидания проверок

- `schedule-web.mjs`, read: добавлена проверка «dialog: a past lesson has the Mark row». Прежние проверки не менялись; ожидания поля статуса блока и флага изменяемости переводит 21-15.

## Отклонения от плана

1. **[Rule 3] Файл вне `files_modified`: `week-grid.tsx`.** Он импортировал `blockSlot` из lesson-block (функция слота удалена по плану) и должен передавать `now` в `EventTooltip`. Замена на `occurrenceSlot(block.outcome)` и проп `now`. Коммит 895641f.
2. **[Rule 3] Диалог тронут в задаче 1.** `lesson-dialog.tsx` импортировал удалённые `LessonStatus` и `BlockSlot`; строка статуса переведена на `StatusDot` и слово из lesson-mark-text уже в первом коммите, чтобы он компилировался.
3. `LessonAction` и `LessonBody` в schedule-mutations.ts не расширялись: `markLesson` — отдельная функция с общим `post<T>`; `pathOf` уже принимал строку действия. Критерий «'mark' только в schedule-mutations.ts» выполнен.
4. Пилюли идут в порядке дизайна Scheduled, Done, No-show (`PILL_ORDER`), а не в порядке `MARK_KINDS` (done, no_show, none) из текста плана: v36 и v40 называют Scheduled первой.
5. Дата в строке «before opening» и «moved to» печатается как «5 Oct» (день и месяц без дня недели), как в README.
6. Из-за гонки после успешной отметки диалог остаётся в «Saving…», пока экран не перечитал неделю (`markBlock` ждёт ответ недели), иначе выбор мигал бы прежним значением.

## Для следующих планов

- **21-10 и 21-11 (Today):** `markLesson(block, kind)` из `schedule-mutations.ts`, `statusWord`, `statusTone`, `occurrenceSlot`, `markLabel`, `blockEffect`, `tooltipDeduction` из `lib/lesson-mark-text.ts`; `StatusDot tone label` для строк. Строки Today принимают `{ outcome, startsAt, movedTo }` и `now`.
- **21-09 (остаток):** `StatusDot` с `tone` готов; цель 24 px выведена через `-m-2`, для слота 24 px слева от текста у ячейки баланса `-m-2` надо учесть.
- **21-15:** `weekSummary`, `planned` и `blocksOn` в schedule-screen.tsx по-прежнему читают `block.status`; `Notice`, `ActionOutcome` и `OverlapBlock` не менялись.
- **Для Design dude (не блокирует):** ссылка «moved from …» в строке статуса диалога осталась кнопкой фазы 20, в v40 она `muted-foreground` с «·».

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности. T-21-18: пилюли недоступны во время сохранения, в запросе `expectedStartsAt`, 409 и 404 дают баннер и перечитывание. T-21-31: только фикстуры `Alex Example 215x`, скриншоты вне репозитория.

## Self-Check: PASSED

- Файлы `lesson-mark-text.ts`, `lesson-mark-row.tsx`, `ledger-web.mjs` существуют.
- Коммиты 895641f и 08ff1fc найдены в `git log`.
- `apps/web/AGENTS.md` от next dev удалён, на портах 3000 и 4000 никто не слушает.
