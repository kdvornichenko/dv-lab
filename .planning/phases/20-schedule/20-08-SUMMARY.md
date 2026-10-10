---
phase: 20-schedule
plan: 08
subsystem: ui
status: complete
tags: [schedule, lesson-dialog, mutations, series, base-ui, playwright]

requires:
  - phase: 20-02
    provides: cutSeries, endSeriesAt, hasOccurrences, nextSeriesDate, overlaps, коды lesson_changed и series_ends_before_new_day
  - phase: 20-06
    provides: POST мутаций урока, вхождения и серии, формы ответов, 409/404 для устаревшего состояния
  - phase: 20-07
    provides: LessonDialog, reload() экрана, blocksOn, data-key и data-slot у блоков, раздел read
provides:
  - schedule-mutations.ts: mutate(target, action, body) → ok | stale | failed и строки устаревших данных
  - футер действий LessonDialog: Move lesson, Cancel lesson с вопросом в футере, Return to schedule
  - LessonMoveForm: перенос одиночного урока и одного вхождения серии внутри диалога
  - блок «Whole series», MoveSeriesDialog, EndSeriesDialog
  - titleRef у PageHeader (возврат фокуса на h1)
  - раздел changes в scripts/dev-checks/schedule-web.mjs
affects: [20-09, 20-10, 21, 24, 25]

requirements-completed: [SCHED-02, SCHED-03, SCHED-05]

actuals:
  tokens: 22000
  tasks: 3
  commits: 4

plan_head_before: 1c44459cce688736a00ab9497662cb3d991becd6
plan_head_after: 8355cd1689e621ec80fc83804aea0648ec931e37

key-files:
  created:
    - apps/web/app/(app)/schedule/_components/schedule-mutations.ts
    - apps/web/app/(app)/schedule/_components/lesson-move-form.tsx
    - apps/web/app/(app)/schedule/_components/move-series-dialog.tsx
    - apps/web/app/(app)/schedule/_components/end-series-dialog.tsx
  modified:
    - apps/web/app/(app)/schedule/_components/lesson-dialog.tsx
    - apps/web/app/(app)/schedule/_components/schedule-screen.tsx
    - apps/web/components/app/layout-parts.tsx
    - scripts/dev-checks/schedule-web.mjs

key-decisions:
  - "Отмена и возврат вызываются экраном (mutate, уведомление, reload), диалог держит только режим, pending и баннер; перенос урока вызывает mutate сама форма и отдаёт экрану момент назначения"
  - "LessonDialog не перемонтируется после мутаций (ключ key:slot тот же), поэтому баннер устаревших данных переживает перечитывание недели, а режим формы и вопрос сбрасываются явно"
  - "После переноса урока экран идёт через openPair со slot to: при переносе в другую неделю меняется и смещение недели"
  - "Диалог серии открывается после закрытия LessonDialog с задержкой exitFallbackMs(spring.slow): иначе Base UI возвращает фокус на блок поверх нового диалога"
  - "Правило серии для диалогов берётся из свежей недели, а если его там нет, из снимка на момент открытия"
  - "После успешного переноса или окончания серии экран перечитывает неделю, дожидается ответа и только потом ставит фокус: на блок, если он остался, иначе на h1"

patterns-established:
  - "Все мутации расписания в web идут через mutate; литерал 'POST' в _components есть только у schedule-mutations.ts и new-lesson-dialog.tsx"
  - "Строки устаревших данных живут только в schedule-mutations.ts, диалоги импортируют константы"

duration: "около 2 часов"
completed: 2026-10-10
---

# Phase 20 Plan 08: изменения расписания из диалога урока Summary

**Учитель отменяет, возвращает и переносит один урок или одно вхождение серии прямо в LessonDialog, переносит и заканчивает всю серию из блока «Whole series»; все запросы идут через один помощник mutate с expectedStartsAt, а устаревшие данные показываются баннером и свежей неделей.**

## Задачи

| Задача | Название | Коммит |
| ------ | -------- | ------ |
| 1 (tracer) | Помощник mutate, Cancel lesson с вопросом в футере, Return to schedule, устаревшие данные, titleRef | 2bf596b |
| 2 | Форма переноса в LessonDialog: одиночный урок и вхождение серии | 2355abf |
| 3 | Блок «Whole series», MoveSeriesDialog, EndSeriesDialog, прошлые недели без изменений | 8355cd1 |

Tracer-гейт: после коммита задачи 1 повторены lint, `wait-dev.mjs up` и раздел changes, всё зелёное, лог `Tracer verified end-to-end — expanding`.

## Что сделано

- **mutate.** `mutate(target, action, body?)`: target это ref урока (`single` или `series`) или `{ kind: 'rule', seriesId }`; тело всегда JSON (по умолчанию `{}`), expectedStartsAt передаёт вызывающий; 409 и 404 дают `stale`, остальные сбои `failed` с кодом ошибки или null. `changedStart` достаёт новое начало из ответа урока или вхождения.
- **Футер LessonDialog.** Будущий planned (одиночный, вхождение, место назначения): Move lesson (secondary, CalendarClock) и Cancel lesson (ghost, CalendarX2). Cancel lesson заменяет кнопки вопросом `role="alert"` «Cancel the lesson on {d MMM} at {HH:MM}?» с Keep и Yes, cancel (pending «Cancelling…»). Будущий cancelled: Return to schedule (secondary, CalendarCheck2). Исходное место переноса и прошлые уроки без футера. Во время запроса Esc и крестик не закрывают диалог.
- **Уведомления и ошибки.** «Lesson cancelled», «Lesson restored», «Lesson moved», «Series moved», «Series ended» с текстами Amendments. Баннеры ошибок «Could not … Try again.», баннер устаревших данных (warning) и перечитывание недели.
- **Форма переноса.** Группа «Move lesson» в `rounded-xl bg-hover p-4`: New date (DateField с `min` = сегодня по Вьетнаму), «Time, VN» (TimePicker, 15 минут, 24 часа, без выключения занятых слотов), строка «было → стало» с обеими зонами (aria-live), строка «A lesson is already at this time: …» по `overlaps` из core без самого урока, ошибки «Choose a start time.» и «Choose a different date or time.». После переноса диалог открывается на месте назначения (data-slot to), в том числе в другой неделе; после Esc фокус на блоке назначения.
- **Whole series.** Второй `hover`-блок у будущих уроков серии (не у исходного места и не у прошлых): «Whole series», «Every Wednesday at 18:00 VN · from Wed 23 Sep», кнопки Move series и End series (secondary, compact).
- **MoveSeriesDialog (lg).** From (DateField, без прошлого, по умолчанию `nextSeriesDate`), New day (Select Monday..Sunday) и «New start time, VN»; превью «First lesson» по `cutSeries(...).newRule.startsOn`; всегда видимая подпись D-03/D-04; ошибки под строкой день-время с красной рамкой: «Choose a different day or time.» и «This series ends on …; no … falls between From and that date.» (из `cutSeries` и из кода api `series_ends_before_new_day`); при ошибке запрос не уходит.
- **EndSeriesDialog (sm).** «Last lesson on» (без прошлого, max = endsOn серии), по умолчанию дата открытого урока; подсказка по `endSeriesAt` и `hasOccurrences`; Keep series (secondary, начальный фокус) первой, End series (tertiary, красная подпись), pending «Ending…».
- **Фокус.** После закрытия любого диалога фокус на блоке по data-key и data-slot, если блока нет, на h1 через новый `titleRef` у PageHeader (`tabIndex={-1}`).

## Проверки

| Команда | Результат |
| ------- | --------- |
| `yarn workspace @dv-lab/web typecheck` (после каждой задачи и после prettier) | код 0 |
| `yarn workspace @dv-lab/web lint` (после каждой задачи) | код 0 |
| `yarn workspace @dv-lab/web build` | успешно, маршрут /schedule собран |
| `node scripts/dev-checks/schedule-web.mjs changes` светлая тема | 96 PASS, 0 FAIL, CHANGES_PART1_OK, CHANGES_PART2_OK, CHANGES_PART3_OK, SCHEDULE_WEB_CHANGES_OK |
| то же, `changes dark` | 96 PASS, 0 FAIL, те же маркеры, SCHEDULE_WEB_CHANGES_OK |
| `node scripts/dev-checks/schedule-web.mjs read` (регрессия 20-07, светлая) | все PASS, SCHEDULE_WEB_READ_OK |
| `node scripts/dev-checks/wait-dev.mjs up` / `down` | DEV_UP_OK / DEV_DOWN_OK |
| `lsof -iTCP:3000 -iTCP:4000 -sTCP:LISTEN` после остановки | пусто, код 1 |
| grep-ворота: «This lesson was changed elsewhere» только в schedule-mutations.ts; `'POST'` только в schedule-mutations.ts и new-lesson-dialog.tsx; ConfirmDialog в lesson-dialog и schedule-screen нет | выполнены |
| grep-ворота: `min=` в lesson-move-form 1; isTimeDisabled и disabled по overlap/clash нет; «A lesson is already at this time» 1 | выполнены |
| grep-ворота: cutSeries в move-series-dialog 2, endSeriesAt в end-series-dialog 2; firstOnOrAfter и lastSeriesDateOnOrBefore нет; series_ends_before_new_day 1; старого текста ошибки нет | выполнены |

Раздел changes по частям (одинаково в обеих темах; карточки `Alex Example 2008 A..D`, серия A и серия D заведены через sql, B и C через api):

- Подготовка: 2 блока A в двух прошлых неделях в снимке.
- Часть 1: вопрос в футере с датой и временем, Keep возвращает кнопки, Yes, cancel даёт уведомление и зачёркнутый блок без заливки, Return to schedule возвращает заливку; то же для одиночного B; устаревшие данные: вхождение перенесено через api за открытым диалогом, Cancel lesson уходит с прежним expectedStartsAt, баннер, сетка и диалог показывают 19:00; у прошедшей среды нет действий.
- Часть 2: форма в теле, фокус в форму, Discard changes возвращает футер и фокус, вчерашний день в календаре выключен, то же время даёт ошибку и не шлёт запрос, занятый час в списке не выключен, строка пересечения не выключает Move lesson, перенос на пятницу 10:00, пунктирное исходное место «→ 16 Oct», фокус после Esc на блоке назначения; B переносится без исходного места; поздняя среда не тронута.
- Часть 3: блок «Whole series» есть у будущей среды и нет у прошедшей и у одиночного урока; Move series: From по умолчанию ближайшая среда, фокус в диалоге, подпись D-03/D-04, ошибка того же дня и времени без запроса, превью «First lesson Thu 15 Oct, 17:00–18:00», уведомление, четверг 17:00 вместо среды, фокус на h1, урок из части 2 на месте; серия D: ошибка конца серии из core без запроса и та же ошибка по коду api (ответ подменён в Playwright), фокус возвращается на блок; End series новой серии: начальный фокус на Keep series, подсказка с последней датой, красная подпись кнопки, после окончания позже блоков нет; серия C: «No lessons will remain. Earlier lessons stay.» цветом text-foreground, уведомление «…series was removed from the schedule.», блоков C нет; снимок прошлых недель совпадает после каждой части.
- Очистка: в начале `Alex Example 20%` (0 карточек), в конце `Alex Example 2008%` (4 карточки).

Скриншоты только в `STATE_DIR` (`tmpdir()/dvlab-dev-checks`), префикс `sched-changes-*`; вопрос отмены, форму переноса с пересечением, блок «Whole series», оба диалога серии, ошибку конца серии и баннер устаревших данных просмотрел глазами в обеих темах.

## Dev-стек

Порты 3000 и 4000 перед стартом свободны. Подняты `env -u DATABASE_URL -u MIGRATOR_DATABASE_URL yarn workspace @dv-lab/api dev` (dvlab_dev) и `yarn workspace @dv-lab/web dev`. Остановлена вся цепочка: две yarn-обёртки, `node --watch src/server.ts`, `src/server.ts`, `next dev`, `next-server`. В системе остался чужой `node --watch src/server.ts` из worktree фазы 19 (запущен раньше, порты 3000 и 4000 не слушает), его не трогал. `apps/web/AGENTS.md`, созданный `next dev`, удалён и не закоммичен.

## Не запускалось

- Артефакт дизайна v23: инструмента Artifact в сессии нет, работал по выдержке «Amendments» в `20-UI-SPEC.md` и лабораторному `lesson-dialog.tsx`.
- Осмотр во встроенном браузере не проведён: инструмента нет. Заменён проверками Playwright и просмотром скриншотов в обеих темах.
- Новых юнит и e2e тестов нет (директива владельца), `yarn install`, сборка api и `yarn test` не запускались. Раздел `frame` не перезапускался: из общих с ним файлов изменился только h1 в PageHeader (ref, tabIndex, outline-none).

## Отклонения от плана

**1. [Rule 1 - Bug] Свой ломающий шаг в разделе read.** Проверка 20-07 «no actions in this plan for a future lesson» требовала отсутствия кнопок; заменена на «a future planned lesson offers Move lesson and Cancel lesson». Коммит 2bf596b.

**2. [Rule 3 - Blocking] Помощники pickDate и pickTime** получили параметр id (по умолчанию прежние `new-lesson-*`), цикл «предыдущий месяц» в pickDate расширен с 4 до 8 шагов: прежний не доходил до месяца раньше открытого. Коммиты 2bf596b, 8355cd1.

**3. [Rule 1 - Bug] Фокус и Base UI.** При открытии диалога серии сразу после закрытия LessonDialog Base UI возвращал фокус на блок поверх нового диалога (Keep series терял начальный фокус). Диалог серии открывается через `exitFallbackMs(spring.slow)` после закрытия LessonDialog. Перевод фокуса в форму переноса и обратно на Move lesson сделан через `setTimeout` 50 мс: `requestAnimationFrame` перебивался Base UI. Коммиты 2355abf, 8355cd1.

**4. h1 с `outline-none` всегда.** Условный класс по `titleRef` запрещён правилом React Compiler (чтение ref в рендере); `outline-none` на h1 без tabIndex ничего не меняет. Коммит 2bf596b.

## Known Stubs

Нет.

## Ограничение для следующих планов

Если после перечитывания недели открытого блока больше нет (например, одиночный урок перенесли в другую неделю из другой вкладки), LessonDialog закрывается без баннера и без явного перевода фокуса на h1. Сценарии плана этого не задевают: при устаревших данных у вхождения остаётся место назначения с тем же ключом и slot to. Нужного состояния нет ни в Amendments, ни в плане.

## Замечания для Design dude

1. Артефакт v23 не читал (инструмента нет): LessonDialog с футером и блоком «Whole series», MoveSeriesDialog и EndSeriesDialog собраны по Amendments и лаборатории; сверка с артефактом за Design dude.
2. D-09 главнее артефакта и лаборатории: занятые слоты в списке TimePicker не выключаются, пересечение не выключает Move lesson.
3. В блоке «Whole series» при ширине lg (540px) кнопки Move series и End series не помещаются справа от подписи и переносятся под неё.
4. У Return to schedule в спецификации нет текста ожидания; во время запроса кнопка показывает спиннер с той же подписью.
5. Триггер TimePicker не рисует красную рамку при `invalid` (компонент 20-03), поэтому при ошибке строки день-время в MoveSeriesDialog красная рамка видна только у Select; Amendments просит обе.
6. Строка «было → стало» в форме переноса при второй зоне переносит «· 08:00–09:00 MSK» на вторую строку.
7. Ошибка «Choose a different date or time.» стоит под полем «Time, VN»; превью «First lesson» нарисовано строкой `bg-hover rounded-xl px-4 py-3` с подписью слева и датой справа; подсказка EndSeriesDialog стоит под полем отдельной строкой (у DateField свой helper всегда приглушённый, а вариант «No lessons will remain» требует text-foreground).
8. Баннеры ошибок и устаревших данных стоят первой строкой тела диалога.

## Threat Flags

Нет новой поверхности: web вызывает только существующие маршруты мутаций 20-06. T-20-22 закрыт `if (pending) return`, кнопки loading и disabled, Esc выключен во время запроса; T-20-23 закрыт expectedStartsAt у урока и вхождения, 409 и 404 → баннер и перечитывание, действий у прошлого нет (changeable).

## Self-Check: PASSED

- Файлы на месте: schedule-mutations.ts, lesson-move-form.tsx, move-series-dialog.tsx, end-series-dialog.tsx, lesson-dialog.tsx, schedule-screen.tsx, layout-parts.tsx, schedule-web.mjs.
- Коммиты 2bf596b, 2355abf, 8355cd1 есть в `git log`.
- `commits: 4` = `git rev-list --count 1c44459..HEAD` (3 коммита задач) плюс этот коммит SUMMARY.
