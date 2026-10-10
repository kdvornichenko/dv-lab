---
phase: 21-lesson-accounting-and-today
plan: 14
subsystem: ui
tags: [schedule, series-dialogs, form-fields, time-picker, scroll-fade, design-v36, playwright]
requires:
  - phase: 21-lesson-accounting-and-today
    provides: гаттер и тулбар по v36 (21-03), раздел grid и очистка lesson_marks в schedule-web.mjs
provides:
  - тексты серии по v36 (подсказки End series, время серии в двух зонах, блок Whole series столбиком, Repeats, описание Move series)
  - строка второй зоны под New start time в Move series, токены text-body и text-caption в диалогах серии
  - значения полей без обрезки (TimePicker, DateField, Select), рамка destructive у невалидного TimePicker
  - форма переноса уроков двумя строками (VN и вторая зона), баннеры пересечения и тосты только в VN
  - компактный фэйд 24 px у коротких выпадающих списков, 48 px у длинных
  - раздел forms в scripts/dev-checks/schedule-web.mjs
affects: [21-06, 21-15, 21-16]
status: complete
commits: 2
plan_head_before: 9c1f23dc9704c82b0d423b91c50a2dd42658c149
plan_head_after: ea01f7b4edc7c516b8d135200d2ae5012b2640cf
actuals:
  tokens: 22000
  tasks: 2
  commits: 2
tech-stack:
  added: []
  patterns:
    - "Время серии строит одна пара функций в lib/schedule-format.ts (seriesWhen, seriesSecondLine) по ближайшему уроку серии и SCHEDULE_TIME_ZONE"
    - "Компактный фэйд списка выбирает хук useCompactFade (lib/popup.ts) по высоте содержимого меньше 200 px"
key-files:
  created: []
  modified:
    - apps/web/lib/schedule-format.ts
    - apps/web/lib/popup.ts
    - apps/web/app/(app)/schedule/_components/end-series-dialog.tsx
    - apps/web/app/(app)/schedule/_components/move-series-dialog.tsx
    - apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx
    - apps/web/app/(app)/schedule/_components/lesson-dialog.tsx
    - apps/web/app/(app)/schedule/_components/lesson-move-form.tsx
    - apps/web/components/ui/time-picker.tsx
    - apps/web/components/ui/select.tsx
    - apps/web/components/ui/combobox.tsx
    - apps/web/components/ui/dropdown.tsx
    - apps/web/components/app/date-field.tsx
    - scripts/dev-checks/schedule-web.mjs
key-decisions:
  - "Вторая зона в End series и Move series берётся хуком useSecondZone внутри диалогов: schedule-screen.tsx не правился (его нет в files_modified)"
  - "Компактный фэйд списка выбирается по высоте содержимого (меньше 200 px) через ResizeObserver, а не по числу пунктов"
  - "Баннеры пересечения (новый урок и перенос) и тосты нового урока и переноса называют только VN"
requirements-completed: [SCHED-01, SCHED-02, SCHED-03]
---

# Фаза 21, план 14: тексты серии и поля по дизайну v36

Диалоги серии, блок «Whole series», форма нового урока и форма переноса говорят время в VN и второй зоне по v36, значения полей не обрезаются, невалидное время подсвечено, выпадающие списки затухают на 24 или 48 px по высоте. Всё проверено скриптом в обеих темах.

Дизайн: v36 (`~/dv-lab-design/VERSION`), README и превью EndSeriesDialog, MoveSeriesDialog, NewLessonDialog, LessonDialog, TimePair, FormFields, ScrollFade, `21-UI-SPEC.md` разделы A1-A4, A8-A10.

## Что сделано

**Задача 1 (tracer), коммит bd9d1f5.**
- `lib/schedule-format.ts`: `seriesWhen(rule, zone, now)` («Wednesday at 18:00 VN (14:00 MSK)», при сдвиге дня «(Tue 22:00 MSK)») и `seriesSecondLine` («Every Tuesday at 22:00 MSK»). Цифра второй зоны считается для ближайшего урока серии (`nextSeriesDate`, иначе первая дата серии) через `zonedInstant` и `SCHEDULE_TIME_ZONE`, не постоянным сдвигом.
- `end-series-dialog.tsx`: описание «{name}, every Wednesday at 18:00 VN (14:00 MSK).»; подсказки и пустой вариант были по v36, текст вынесен в константу `KEPT_HINT`.
- `move-series-dialog.tsx`: описание «{name}. Now every Wednesday at 18:00 VN (14:00 MSK).», строка «First lesson» и её значение text-body, под New start time живая строка второй зоны text-caption (`data-slot="move-series-zone"`).
- `lesson-dialog.tsx`: блок «Whole series» столбиком (заголовок, caption, micro-строка второй зоны, ряд кнопок Move series и End series под текстом).
- `new-lesson-dialog.tsx`: Repeats «Every Wednesday at 18:00 VN until you end the series.», тост «Lesson added» только VN.
- `students-screen.tsx` не правился: ячейка Next lesson уже «None» muted (проверено скриптом на карточке без уроков).
- `schedule-web.mjs`: раздел `forms`, часть 1 (`FORMS_PART1_OK`), фикстуры `Alex Example 2131 A..D` (серии по средам в 18:00, 02:00 и 22:00 VN).

**Задача 2 (auto), коммит ea01f7b.**
- `time-picker.tsx`: значение `block overflow-x-clip text-ellipsis whitespace-nowrap leading-5` вместо `truncate`; у триггера снят `text-box-trim` обёртки кнопки; рамка `destructive` при `data-invalid`; подвал `p-2`, заголовок колонки `pb-1`.
- `select.tsx`: значение триггера `leading-5` без `-my-1 py-1 [text-box:trim-both_cap_alphabetic]`. `date-field.tsx`: значение `leading-5`.
- `lesson-move-form.tsx`: две строки «было → стало» (VN: «Wed 14 Oct, 18:00 → Wed 14 Oct, 19:15–20:15 VN»; вторая зона `text-micro text-muted-foreground`), строка пересечения и тост «Lesson moved» только VN.
- `new-lesson-dialog.tsx`: баннер пересечения только VN.
- `lib/popup.ts` (`useCompactFade`, `popupCompactFadeClass`), `select.tsx`, `combobox.tsx`, `dropdown.tsx`: список с содержимым ниже 200 px получает `[--scroll-fade-size:var(--scroll-fade-size-compact)]`, иначе остаётся 48 px.
- `schedule-web.mjs`: раздел `forms`, часть 2 (`FORMS_PART2_OK`, итог `SCHEDULE_WEB_FORMS_OK`).

## Причина обрезки «09:15» (пункт 10, A10)

Замеры в браузере (Chromium из playwright, 100 %, масштаб устройства 1, светлая тема), до правки, New lesson, Start time 09:15:

| Элемент | line-height | overflow | height | clientHeight | scrollHeight | text-box |
|---------|-------------|----------|--------|--------------|--------------|----------|
| триггер TimePicker | 20px | visible | 36 | 36 | 36 | normal |
| обёртка метки Button | 20px | visible | 20 | 20 | 20 | cap alphabetic (trim-both) |
| `data-slot="time-picker-value"` (`truncate`) | 20px | hidden | 20 | 20 | 20 | none |
| значение DateField (`truncate`) | 20px | hidden | 20 | 20 | 20 | normal |
| значение Select (`-my-1 py-1`, trim-both) | 20px | hidden | 17.45 | 17 | 24 | cap alphabetic |

Скриншот поля `09:15` в Chromium: цифры целиком. Итог:
- Гипотеза Design dude (тугой line-height у значения TimePicker) не подтверждена: строка 20 px (её даёт `Button` size default), `scrollHeight` равен `clientHeight`.
- Дефект владельца в Chromium не воспроизведён. Подтверждено другое: значение Select было 17.45 px высотой при `scrollHeight` 24 (обрезка текстовым боксом, правило v36 «значение на строке 20 px» нарушено).
- Для TimePicker вероятная причина в браузере владельца: обёртка метки у `Button` несёт `text-box: trim-both cap alphabetic`, а значение лежит в `overflow:hidden`; движок, который протягивает trim через вложенный блок, сдвинул бы строку вверх и срезал бы цифры. В Chromium trim туда не доходит. Поэтому правка превентивная: `leading-5`, `overflow-x-clip` (по вертикали ничего не обрезается), `text-box: normal` у обёртки в триггере TimePicker. Проверить на «09:15» в браузере владельца (вероятно Safari) должна ведущая сессия.

После правки (все три поля): line-height 20px, height 20, clientHeight 20, scrollHeight 20; `text-box-trim` обёртки TimePicker: none. Combobox: полей-значений вне popup нет, в приложении Combobox только зоны в тулбаре; значение (поле поиска) измерено: 36 px, scrollHeight равен clientHeight.

## Проверки

| Команда | Результат |
|---------|-----------|
| `yarn workspace @dv-lab/web typecheck` | код 0 |
| `yarn workspace @dv-lab/web lint` | код 0 |
| `yarn workspace @dv-lab/web build` | код 0 (после остановки dev-серверов) |
| `node scripts/dev-checks/schedule-web.mjs forms` (светлая) | `FORMS_PART1_OK`, `FORMS_PART2_OK`, `SCHEDULE_WEB_FORMS_OK`, 0 FAIL |
| `node scripts/dev-checks/schedule-web.mjs forms dark` | то же, 0 FAIL |
| `schedule-web.mjs grid` | `SCHEDULE_WEB_GRID_OK` |
| `schedule-web.mjs read` | `SCHEDULE_WEB_READ_OK` |
| `schedule-web.mjs changes` | `SCHEDULE_WEB_CHANGES_OK` |
| `schedule-web.mjs frame` | `SCHEDULE_WEB_FRAME_OK` |
| `schedule-web.mjs fade` (светлая и тёмная) | `SCHEDULE_WEB_FADE_OK`, 0 FAIL |
| `schedule-web.mjs students` | `SCHEDULE_WEB_STUDENTS_OK` |
| `node scripts/dev-checks/wait-dev.mjs down` | `DEV_DOWN_OK`, порты 3000 и 4000 свободны |
| `grep -E "@radix-ui|radix-ui|cmdk"` по `apps/web` | код 1 (пусто) |
| `grep ">none<\|'none'</"` по `app/(app)` | код 1 (пусто) |
| `grep -c "Later lessons are removed from the schedule"` в end-series-dialog.tsx | 1 |
| `grep -c "until you end the series"` в new-lesson-dialog.tsx | 1 |

Строки PASS раздела forms (в обеих темах): блок «Whole series» колонкой (top кнопок 579 больше bottom строки второй зоны 563), caption и micro 11 px; описания End series и Move series с «(14:00 MSK)», со сдвигом дня «(Tue 22:00 MSK)» (серия 02:00 VN) и «(Thu …)» при Pacific/Auckland (серия 22:00 VN); подсказка End series text-caption, muted, пустой вариант text-caption text-foreground; «First lesson» text-body 13 px; подпись под Start time text-caption 12 px в New lesson и Move series; Repeats «Every … at 18:00 VN until you end the series.»; «None» muted в ячейке Next lesson карточки без уроков и нет строчного «none»; значения «09:15», дата, Select не обрезаны; триггер TimePicker 36 px без заливки, подвал 8 px, заголовок колонки 4 px; список Repeats (80 px) с фэйдом 24 px, список Student (300 px) 48 px; невалидный TimePicker в Move series с `aria-invalid` и кольцом `destructive`, как у дня; форма переноса «Wed 14 Oct, 18:00 → Wed 14 Oct, 19:15–20:15 VN» и вторая строка micro «… 15:15–16:15 MSK».

Фикстуры только `Alex Example 2131 A..F` (в разделе fade прежняя `2031`), уборка в `finally` («fixture cards removed 6»); скриншоты в STATE_DIR (`sched-forms-*`), в репозиторий не попали. Реальные данные dvlab_dev не менялись.

## Изменённые ожидания прежних проверок

Все правки следуют намеренным изменениям v36 этого плана:
- `read` (new lesson): `repeatNote` теперь «Every Monday at 09:00 VN until you end the series.»; тост «Lesson added» «…, 14:00 VN.» без второй зоны; баннер пересечения без «(14:00–15:00 MSK)» и «(14:30–15:30 MSK)».
- `changes`: описание Move series «…Now every Wednesday at 18:00 VN (14:00 MSK).»; описание End series «…every Thursday at 17:00 VN (13:00 MSK).»; блок строки изменения формы переноса переписан на строки `move-lesson-vn` и `move-lesson-second` (прежние проверки пар `time-pair` удалены); строка «A lesson is already at this time» без второй зоны; тост «Lesson moved» без второй зоны.
- `fade`: «Select list fade size is 48px» заменено на «24px ниже 200 px, 48 px от 200 px» (список валюты 186 px теперь компактный по A9).

## Отклонения от плана

**1. [Rule 3 - блокер] Файлы вне `files_modified`.** `apps/web/lib/popup.ts` (хук `useCompactFade` для A9 нужен всем трём спискам, одного места в `files_modified` у них нет). `schedule-screen.tsx` не правился: вторую зону End и Move series читают через `useSecondZone()` внутри диалогов.

**2. [Rule 2 - критичное] Рамка невалидного TimePicker.** До правки `invalid` ставил только `aria-invalid`, красной рамки не было (кольцо рисует внутренний span кнопки). Добавлен `data-invalid:[&>span:first-child]:shadow-[…destructive]`.

**3. Короткий список по высоте, а не по пунктам.** Спецификация говорит «ниже примерно 200 px»; реализован `ResizeObserver` по высоте содержимого списка (порог 200 px). Всплывающий список зон в тулбаре остаётся компактным по собственному классу (B3).

Иначе план выполнен как написан.

## Расхождения с дизайном для Design dude

- README MoveSeriesDialog не называет живую строку второй зоны под New start time, плану она нужна (A4); дата для расчёта взята как дата первого урока при наличии превью, иначе From (умолчание).
- Тосты отмены и возврата урока («Lesson cancelled», «Lesson restored») по-прежнему называют вторую зону: они собираются в `schedule-screen.tsx`, вне файлов плана. README NewLessonDialog и пункт 3 памяти требуют тосты только в VN; перевод остаётся за следующим web-планом.
- В коде `zoneCaption` у зоны Pacific/Auckland пока пишет «UTC+13» (метки-сокращения придут с 21-06); проверки раздела forms сознательно не читают метку.
- Дефект «09:15» не воспроизводится в Chromium (раздел «Причина обрезки»): нужен его воспроизводящий браузер и версия.

## Что важно следующим планам

- 21-06: `seriesWhen`, `seriesSecondLine`, `secondWhen` и новая строка формы переноса печатают `zoneCaption(zone, instant, 'toolbar')`; при замене метки сокращением они подхватят её сами, текстовые проверки forms на метку не опираются.
- 21-15 и далее: `useCompactFade` и `popupCompactFadeClass` в `lib/popup.ts` применяются ко всем трём popup-спискам; новые popup-списки должны брать их же.
- Фикстуры раздела forms: `Alex Example 2131%` (`FORMS_LIKE`), раздел расширяемый.
- Осмотр во встроенном браузере не проводился (у исполнителя его нет); вместо него просмотрены скриншоты playwright в обеих темах (диалоги серии, форма переноса, невалидное время). Ведущей сессии стоит посмотреть поле «09:15», диалоги серии и форму переноса в обеих темах.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности. T-21-35: фикстуры только `Alex Example 2131*`, уборка в `finally` (lesson_marks первыми, под `to_regclass`), скриншоты вне репозитория, в SUMMARY только счётчики.

## Self-Check: PASSED

- Изменённые файлы существуют; коммиты bd9d1f5 и ea01f7b присутствуют в `git log`.
- `apps/web/AGENTS.md` (создаёт `next dev`) удалён, не закоммичен.
