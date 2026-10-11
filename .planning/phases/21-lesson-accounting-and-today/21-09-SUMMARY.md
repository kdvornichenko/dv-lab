---
phase: 21-lesson-accounting-and-today
plan: 09
subsystem: web, core
status: complete
tags: [students, balance, status-dot, switch, no-show, settings, pays-soon, schedule-today, design-v40]
requires: [21-02, 21-05, 21-06, 21-07, 21-08, 21-15]
provides:
  - "web: StudentBalance (слова и точка состояния из core) и balanceTone для DueList (21-10)"
  - "web: колонка «Balance» списка учеников, сводка профиля и «Balance now» по одному правилу core"
  - "web: Switch (копия design-lab) и переключатель «No-show deducts a lesson» в форме ученика, строка No-show в Details"
  - "web: карточка «Payments» с порогом Pays soon в Settings → General"
  - "core: localIsoDate удалена; формы берут «сегодня» через scheduleToday"
affects: [21-10, 21-11, 21-13]
key-files:
  created:
    - apps/web/components/app/student-balance.tsx
    - apps/web/components/ui/switch.tsx
    - apps/web/app/(app)/settings/_components/payments-card.tsx
  modified:
    - apps/web/app/(app)/students/_components/students-screen.tsx
    - apps/web/app/(app)/students/_components/student-form-dialog.tsx
    - apps/web/app/(app)/students/[id]/_components/student-profile.tsx
    - apps/web/app/(app)/students/[id]/_components/opening-balance-panel.tsx
    - apps/web/app/(app)/students/[id]/_components/record-payment-dialog.tsx
    - apps/web/app/(app)/students/[id]/_components/overview-tab.tsx
    - apps/web/app/(app)/settings/_components/settings-screen.tsx
    - apps/web/components/app/ledger-text.tsx
    - packages/core/src/lessons.ts
    - scripts/dev-checks/ledger-web.mjs
    - scripts/dev-checks/schedule-web.mjs
decisions:
  - "StudentBalance с точкой — flex-строка: точка (цель 24 px, -m-2 из 21-08) и gap-2 дают текст на 16 px правее начала точки, пустой слот Not set — w-2 с тем же gap; так выровнено по v40"
  - "balanceTone(state) возвращает null для not_set: 21-10 получает тон и метку только для четырёх состояний"
  - "LessonsText удалён целиком: после перевода списка, профиля и панели у него не осталось вызовов"
  - "Строка Switch в форме: Switch design-lab кладёт переключатель слева от подписи, в v36 подпись слева, переключатель справа; разворот сделан className на месте использования (flex-row-reverse justify-between px-0 py-0), сам файл копии не менялся, кроме комментариев, форматирования и импортов"
  - "Порог читается в ReadState экранов списка и профиля вместе с основным запросом; сбой любого из двух запросов даёт один ReadError"
metrics:
  duration: "~95 мин"
  completed: 2026-10-11
  tasks: 3
  files: 14
estimate:
  tokens: 115000
  raw_tokens: 115000
  tasks: 3
  confidence: low
actuals:
  tokens: 10600
  tasks: 3
  commits: 3
plan_head_before: 79b96672c16fac34f4ee535d6fe530f9c9be2279
plan_head_after: dfdd4a84ef52a9d637647423dfd359918529c9d9
commits: 3
requirements-completed: [LEDG-04, LEDG-06, LEDG-07, LEDG-08]
---

# Фаза 21, план 09: остаток, флаг неявки и порог Pays soon в интерфейсе учеников и настроек

Остаток и долг показываются словами и точкой состояния по одному правилу core в списке, сводке профиля и «Balance now». Форма ученика получила переключатель «No-show deducts a lesson», Details строку «No-show», а Settings карточку «Payments» с порогом Pays soon, проверяемым той же схемой, что и api. `localIsoDate` удалена, формы оплаты и открывающего остатка берут «сегодня» по Вьетнаму.

Дизайн: план спланирован по v36, при чтении копия была v40 (`cat ~/dv-lab-design/VERSION`). README StudentBalance, StatusDot, StudentForm, Switch, SettingsGeneral, Table и их preview.html прочитаны по v40.

## Задачи

| Задача | Что сделано | Коммит |
|--------|-------------|--------|
| 1 (tracer) | `student-balance.tsx` (StudentBalance, balanceTone); колонка «Balance» в списке: GET /students и GET /settings вместе, сбой любого даёт один ReadError, заголовок слева, ячейка со StatusDot и словами core, «Not set» muted без точки; раздел students часть 1 в ledger-web.mjs; в schedule-web.mjs students заголовок и ячейка Not set | 21e8c11 |
| 2 | Сводка профиля со StudentBalance и порогом из GET /settings; «Balance now» без точки; даты «сегодня» в форме оплаты и панели через `scheduleToday`; подпись формы оплаты через `countsAfterOpening`; `LessonsText` и `localIsoDate` удалены | 3407360 |
| 3 | `switch.tsx` (копия design-lab без комментариев); переключатель в форме (POST и PATCH шлют `noShowDeducts` всегда); строка «No-show» в Details; `payments-card.tsx` и подключение в settings-screen; ledger-web.mjs: части 2 и раздел settings | dfdd4a8 |

Гейт tracer после задачи 1: автоматическая проверка (web typecheck, `ledger-web.mjs students`) прошла, расширение продолжено без остановки.

## Проверки

| Команда | Результат |
|---------|-----------|
| `yarn workspace @dv-lab/core typecheck`, `@dv-lab/api typecheck`, `@dv-lab/web typecheck` | код 0 (api: вызовов удалённой `localIsoDate` нет) |
| `yarn workspace @dv-lab/web lint` | код 0 |
| `yarn workspace @dv-lab/web build` (после остановки next dev) | собрался, маршруты `/settings`, `/students`, `/students/[id]` в списке |
| `ledger-web.mjs students` (светлая и тёмная) | STUDENTS_WEB_PART1_OK, STUDENTS_WEB_PART2_OK, LEDGER_WEB_STUDENTS_OK, ни одного FAIL |
| `ledger-web.mjs settings` (светлая и тёмная) | LEDGER_WEB_SETTINGS_OK, ни одного FAIL |
| `schedule-web.mjs students` | SCHEDULE_WEB_STUDENTS_OK (части 1-3) |
| `npx prettier --check` по файлам плана | чисто |
| `yarn knip` | замечаний по файлам плана нет |

Критерии приёмки: `balanceMinutes` с делением или сравнением в `apps/web/app`, `apps/web/components` — нет (код 1); `git grep localIsoDate -- apps packages` — нет; `paidOn <=` и `<= openingBalance` в ledger-text.tsx — нет; `@radix-ui`, `radix-ui`, `cmdk` в apps/web — нет (код 1); в payments-card.tsx `updateSettingsRequest` 2 раза, `PAYS_SOON_LESSONS_MAX` 2 раза, сравнений с литералами 0 и 20 нет (код 1).

Что проверяет ledger-web.mjs:
- students часть 1: заголовок «Balance» и выравнивание влево; ячейки «10 lessons left», «1 lesson left», «0 lessons left», «owes 1.5 lessons» с точками green «Plenty left», blue «Pays soon», amber «No lessons left», red «Owes lessons» (токены `bg-success`, `bg-info`, `bg-warning`, `bg-destructive`), «Not set» muted без точки; в ячейках нет знака минус; цвет текста ячейки совпадает с цветом имени, не destructive; цель точки 24 px; видимая точка начинается там, где начинается текст заголовка (v40), текст на 16 px правее, колонка текста одна; подсказка точки читается.
- students часть 2: профиль долговой фикстуры (сводка «owes 1.5 lessons» с точкой «Owes lessons», «Balance now» без точки, нет кнопки «Set opening balance»), профиль без остатка (Not set и кнопка), Details с «No-show» между «Lesson length» и «Parent» (метка 128 px); форма Edit details: переключатель включён, строка под «Lesson length», текст пояснения как в спецификации, переключатель у правого края, клик по подписи переключает, диалог остаётся открытым, само переключение ничего не сохраняет; «Save changes» шлёт `"noShowDeducts":false`, Details «Deducts nothing» muted, остаток фикстуры с no_show вырос с «owes 1 lesson» до «0 lessons left» в профиле и в таблице; Space включает обратно, сохранение шлёт `true`, остаток вернулся; форма «New student»: переключатель включён.
- settings: карточка «Payments» следом за «Time zones»; поле 96 px, вправо, `tabular-nums`; описание, подсказка и «Saved to your account.»; порог 2 → фикстура с 3 уроками «Plenty left»; ввод 3 и blur → тост «Saved» / «Pays soon threshold: 3 lessons.», GET /settings 3, один PATCH, на /students точка «Pays soon»; ввод 2.5, 21, пустое, пробелы, -1: ошибка «Use a whole number from 0 to 20.», aria-invalid, запрос не ушёл, значение видно, через 2 с возвращается 3, на сервере 3; Enter с 2 сохраняет, последующий blur не шлёт второй запрос; 1 даёт «1 lesson»; сбой PATCH (500) возвращает значение и показывает баннер «Could not save the setting. Try again.», на сервере прежнее значение.

Скриншоты проверены глазами в обеих темах (колонка Balance, профиль долга, форма с выключенным переключателем, Settings: Payments, ошибка, сбой с баннером и тостами).

Не запускалось: сборка api, `yarn test`, `yarn install` (правила плана).

## Данные

- Фикстуры только `Alex Example 2160 A..E`, `2161 A`, `2166 A`; уборка в начале и в `finally` (lesson_marks первыми), после каждого прогона «fixture cards removed 6» и «1».
- Состояние `teacher_settings` настоящего учителя на dvlab_dev: до прогонов строки не было, после последнего прогона `select count(*) from teacher_settings` даёт 0 (скрипт в `finally` удаляет строку, если её не было, и возвращает значение, если была). Карточек в dvlab_dev по-прежнему 25, фикстур 0.
- Реальные данные dvlab_dev не менялись.

## Расхождения с дизайном v40 и решения по умолчанию

1. **Выравнивание StatusDot и StudentBalance (v40).** README: 24 px зона точки выступает на 8 px в левый отступ, видимая точка стоит там, где начинается текст соседних строк, текст идёт на 16 px правее; у «Not set» остаются те же 16 px пустыми. StatusDot из 21-08 уже имеет `-m-2` (зона 24 px занимает в потоке 8 px), поэтому `StudentBalance` ставит между точкой и текстом `gap-2`; у «Not set» вместо точки `w-2` и тот же `gap-2`. StatusDot не менялся. Проверено скриптом: точка в одну линию с текстом заголовка, текст на 16 px правее.
2. **Строка Switch.** Копия design-lab кладёт переключатель слева от подписи; README StudentForm и превью v36 ставят подпись слева, переключатель справа, пояснение под подписью. Разворот сделан в форме через `className="w-full flex-row-reverse justify-between px-0 py-0"`, пояснение отдельным `<p>` под строкой с отступом справа `pr-13`. Подпись и переключатель — одна цель (клик по подписи переключает, проверено). Из-за 2-колоночной сетки формы строка стоит полной шириной под рядом «Lesson length» и «Time zone», а не прямо под полем «Lesson length»: в превью поле зоны идёт после строки Switch, в коде фазы 20 оно рядом с длиной урока. Подпись поля в коде «Lesson length (min)», как в фазе 20.
3. **Цвет дорожки Switch.** Копия design-lab красит включённую дорожку жёстким `#6B97FF` (при наведении `#5C89F2`), выключенную `var(--accent)`; превью v36 — `--primary` и `--selected`. Оставлено как в design-lab (план: без перерисовки). В тёмной теме выключенная дорожка на поверхности диалога почти сливается с фоном (виден только белый бегунок). Для Design dude.
4. **Размеры и comments.** Из копии удалены все комментарии (правило проекта), импорты и типы приведены к стилю репозитория; логика не менялась. Файл не 373 строки, как в UI-SPEC, а короче из-за комментариев.
5. **Карточка Payments, ошибка чтения значения.** В v36 нет текста на случай, когда GET /settings не прочитался в Settings: карточка оставляет поле недоступным и показывает `Banner status="error"` «Could not load the setting. Refresh the page.». Для Design dude.
6. **Одна проверка порога (D6).** Пустая строка и пробелы отклоняются до `Number()`; остальное решает `updateSettingsRequest.safeParse` из contracts. «-1», «2.5», «21» отклоняются схемой, «1e1» и «0x5» схема принимает как числа (Number их разбирает): отдельной web-проверки поверх схемы нет по плану.
7. Остальные умолчания UI-SPEC (возврат неверного значения через 2 с, текст баннера записи, тост «Saved» с описанием) выполнены как записано.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] schedule-web.mjs students зависел от прежнего вида колонки**
- **Found during:** задача 1
- **Issue:** проверка ждала заголовок «Lessons left» и ячейку «Set opening balance».
- **Fix:** ожидания переведены на заголовок «Balance» и ячейку «Not set» (по тексту плана, «обновить минимально»); файл вошёл в коммит задачи 1. Других ожиданий не менялось.
- **Files modified:** scripts/dev-checks/schedule-web.mjs
- **Commit:** 21e8c11

**2. [Rule 3 - Blocking] ledger-web.mjs чистил только карточки `Alex Example 215%`**
- **Found during:** задача 1
- **Fix:** условие уборки расширено до `215%` и `216%`; общие помощники получили необязательные параметры (сотые доли открывающего остатка, длительность одиночного урока); добавлены общие помощники сохранения и возврата состояния `teacher_settings`. Раздел students тоже ставит порог 2 через api и возвращает исходное состояние в `finally`, иначе ожидания «Pays soon» зависели бы от настоящего порога учителя.
- **Files modified:** scripts/dev-checks/ledger-web.mjs
- **Commit:** 21e8c11, dfdd4a8

### Уточнения к плану

- `LessonsText` удалён, а не переведён на `balancePhrase`: вызовов не осталось (список, профиль и панель используют StudentBalance), оставлять мёртвый код незачем.
- Тост панели открывающего остатка собирается через `balancePhrase` («3 lessons left as of 5 Oct.»), вывод тот же, что давал `lessonsPhrase` + « left».
- Фикстура `Alex Example 2161 A` (no_show, 60 минут) добавлена к плановым 2160, чтобы проверить пересчёт при выключении флага.
- В приёмке раздела settings по плану порог выставляется «после сохранения исходного состояния» через api; возврат делается SQL под ролью migrator (update, если строка была; delete, если не было), а не PATCH, чтобы строка не появилась, когда её не было.

## Для следующих планов

- **21-10 (DueList):** `balanceTone(state)` и тип `BalanceTone` экспортируются из `apps/web/components/app/student-balance.tsx`. Для `not_set` функция возвращает `null`; DueList не показывает `not_set`, поэтому проверку `null` придётся обработать. Тоны и метки: green «Plenty left», blue «Pays soon», amber «No lessons left», red «Owes lessons». Для слов остатка бери `balancePhrase`, для самой ячейки — `StudentBalance` (`dot` и `threshold`, либо без точки).
- Порог на экранах читается в `ReadState` экранов списка и профиля одним `Promise.all` с основным запросом; формат ответа `{ settings: { paysSoonLessons } }`.
- Тост описания порога собирается через `lessonsPhrase(n, 1)` из core («1 lesson», «2 lessons»).
- `Switch` (`@/components/ui/switch`) принимает `label`, `checked`, `onToggle`; `className` позволяет развернуть строку.
- Раздел `ledger-web.mjs settings` меняет порог настоящего учителя на dvlab_dev на время прогона; запускать не параллельно с другими проверками порога.
- Порт 4000 занимает dev-api из этого же worktree (`yarn workspace @dv-lab/api dev`, `--watch`), запущенный не этим планом (скорее всего соседом 21-16); этот план его не останавливал. Web dev остановлен, порт 3000 свободен, `apps/web/AGENTS.md` удалён.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности. T-21-19 закрыт: раздел settings и students возвращают состояние `teacher_settings` в `finally`, итог выше. T-21-32 закрыт: только фикстуры `Alex Example 216x`, скриншоты вне репозитория.

## Self-Check: PASSED

- Файлы на месте: `apps/web/components/app/student-balance.tsx`, `apps/web/components/ui/switch.tsx`, `apps/web/app/(app)/settings/_components/payments-card.tsx`.
- Коммиты 21e8c11, 3407360, dfdd4a8 есть в `git log`.
