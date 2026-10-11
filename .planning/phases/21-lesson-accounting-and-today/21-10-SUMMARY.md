---
phase: 21-lesson-accounting-and-today
plan: 10
subsystem: web
status: complete
tags: [today, counters, lesson-rows, due-list, stat, empty-state, minute-clock, design-v40]
requires: [21-07, 21-08, 21-09, 21-15, 21-17]
provides:
  - "web: экран Today (TodayScreen) из GET /today: дата по Вьетнаму, итоговая строка, четыре счётчика из todayCounts, панели Lessons today, Earlier, not marked и Pays soon, состояния загрузки, ошибки, тихого дня и «некому платить»"
  - "web: Stat (display и title), EmptyState, DueList, LessonRows и MoreRow"
  - "web: useMinuteNow — единственная подписка на минуту для Today и расписания"
  - "dev-checks: раздел today в ledger-web.mjs (части 1-3, итог LEDGER_WEB_TODAY_OK)"
affects: [21-11, 21-12, 21-13]
key-files:
  created:
    - apps/web/app/(app)/_components/today-screen.tsx
    - apps/web/app/(app)/_components/today-lessons.tsx
    - apps/web/app/(app)/_components/due-list.tsx
    - apps/web/app/(app)/_components/use-minute-now.ts
    - apps/web/components/app/stat.tsx
    - apps/web/components/app/empty-state.tsx
  modified:
    - apps/web/app/(app)/page.tsx
    - apps/web/app/(app)/schedule/_components/schedule-screen.tsx
    - scripts/dev-checks/ledger-web.mjs
key-decisions:
  - "Строки Today пока не интерактивны: в конце строки пометка статуса (statusWord) для needs_mark, done, no_show, cancelled, moved; у planned пометки нет. 21-11 заменит пометки needs_mark, done и no_show элементами отметки"
  - "Таблица вида строки — Record<StatusKey, …> по statusKey из lesson-mark-text; сравнений исхода со строками в today-lessons.tsx нет; следующий урок — nextKey из todayCounts и слот 'to' из occurrenceSlot (призрак с тем же ключом не подсвечивается)"
  - "Перечитывание по смене дня: эффект зависит от минутного now, даты ответа и даты «сегодня»; при неверной дате часов клиента запрос уходит не чаще раза в минуту"
  - "Имя ученика в строках — block.studentName как есть: в репозитории нет помощника короткого имени, список учеников тоже показывает displayName"
  - "Подсказки плиток: у тихого дня (0 уроков) у Today и Done подсказки нет (так в превью v40); Pays soon подсказку сохраняет всегда"
metrics:
  duration: "~110 мин"
  completed: 2026-10-11
  tasks: 3
  files: 9
estimate:
  tokens: 105000
  raw_tokens: 105000
  tasks: 3
  confidence: low
actuals:
  tokens: 11900
  tasks: 3
  commits: 3
plan_head_before: 90f279da462a33fb0c363592a7ce73ed9bb2f2a1
plan_head_after: c7ee845059e846648c823a64308f905433b7aba7
commits: 3
requirements-completed: [SHELL-05, LEDG-07, LEDG-08]
---

# Фаза 21, план 10: Today, чтение

Учитель открывает `/` и видит день по Вьетнаму: заголовок с полной датой, итоговую строку, четыре счётчика из `todayCounts`, уроки дня со всеми состояниями, прошлые неотмеченные уроки и тех, кто скоро платит. Все числа и тексты состояний берёт core (`todayCounts`, `scheduleToday`, `balancePhrase`, `balanceState`) и общие таблицы из `lesson-mark-text.ts` и `student-balance.tsx`; web ничего не считает сам.

Дизайн: план спланирован по v36, при чтении копия была v40 (`cat ~/dv-lab-design/VERSION`). README и preview TodayPage, DueList, Stat, EmptyState, LessonList прочитаны по v40.

## Задачи

| Задача | Что сделано | Коммит |
|--------|-------------|--------|
| 1 (tracer) | `useMinuteNow` вынесен из schedule-screen.tsx; `Stat`; `TodayScreen` с шапкой, итоговой строкой, четырьмя счётчиками, загрузкой, ReadError и перечитыванием по смене дня; page.tsx отдаёт учителю TodayScreen; раздел today, часть 1 | 907e9da |
| 2 | `EmptyState`; `LessonRows` (строки 40 px со всеми состояниями) и `MoreRow`; панели Lessons today (кнопка Week, пустой день с Open schedule) и Earlier, not marked (дата 72 px, старые выше, до 8 и «+N more»); часть 2 | af3ea30 |
| 3 | `DueList` (строка 32 px, колонка имени 112 px, StatusDot из `balanceTone`); панель Pays soon с подписью по N, пустое состояние, скелетоны; часть 3 | c7ee845 |

Гейт tracer после задачи 1: все `<verify>` автоматические (typecheck, `ledger-web.mjs today`), прогон зелёный, расширение продолжено без остановки.

## Что построено

- **Шапка.** `h1` — «Sunday, 11 October» через `formatFullDate` в зоне Вьетнама (запятая как в README, год не пишется); до ответа дата считается от `scheduleToday(now)`, после ответа берётся `date` ответа. До появления минутного `now` (серверный снимок) `h1` называется «Today», как у экрана расписания. Итоговая строка: «{n} lessons · next: {имя} at 16:30 VN (12:30 MSK)», «{n} lessons» без урока впереди, «No lessons today»; вторая зона из `useSecondZone`, без неё без скобки; «1 lesson» в единственном числе.
- **Счётчики.** Today («{toCome} still to come» или «All started»), Done («of {started} started»), To mark («{today} today, {earlier} earlier», при нуле без подсказки), Pays soon («{N} lessons or fewer left», при N = 1 «1 lesson or fewer left», при N = 0 «0 lessons or fewer left»). Контейнерный запрос: `@container` и `@min-[40rem]:grid-cols-4`, иначе 2 на 2, зазор 12 px.
- **Lessons today.** Время VN и под ним вторая зона `text-micro` (колонка не уже 88 px), короткое имя, пометка статуса в конце. Видов строки шесть по таблице `StatusKey`: planned — обычная; следующий — `bg-active` и 600; needs_mark — полный цвет и «Needs a mark»; done и no_show — приглушены; cancelled — приглушена, имя зачёркнуто, «Cancelled»; moved — приглушена, «Moved to 12 Oct». React-ключ — ключ вхождения и `occurrenceSlot`.
- **Earlier, not marked.** Подпись «Lessons that took place and still need a mark.», колонка даты («Sat 10 Oct», не уже 72 px), старые выше, не больше 8, затем «+N more» на `/schedule`; панель исчезает, когда в ответе нет прошлых неотмеченных.
- **Pays soon.** Подпись «{N} lessons or fewer left, or owing»; строка DueList: имя ссылкой на профиль в колонке 112 px с многоточием, «owes 1.5 lessons» / «0 lessons left» / «1 lesson left» (`balancePhrase`), точка red Owes lessons, amber No lessons left, blue Pays soon (`balanceTone(balanceState(…))`); строка целиком открывает профиль, точка — отдельный Tab-стоп (`after:absolute after:inset-0` у ссылки и `relative z-10` у точки); не больше 8 строк и «+N more» на `/students`.
- **Состояния.** Загрузка: настоящий `h1`, Skeleton вместо итоговой строки, плиток и строк (5 в Lessons today, 3 в Pays soon). Ошибка: один ReadError «Could not load Today», без плиток и списков. Тихий день: плитки 0, EmptyState «No lessons today» / «Add a lesson in the schedule.» и «Open schedule». Некому платить: EmptyState «Nobody needs to pay soon» с N в тексте, без действия.
- **Смена дня (R6).** Эффект зависит от `[now, дата ответа, дата «сегодня», load]`; во время перечитывания прежние данные остаются на экране, состояние `loading` не включается, поэтому при сбитых часах клиента запросов не больше одного в минуту.

## Проверки

| Команда | Результат |
|---------|-----------|
| `yarn workspace @dv-lab/web typecheck` | код 0 (после каждой задачи и в конце) |
| `yarn workspace @dv-lab/web lint` | код 0 |
| `yarn workspace @dv-lab/web build` (dev-серверы остановлены) | код 0, маршрут `/` в списке |
| `node scripts/dev-checks/ledger-web.mjs today` (светлая) | TODAY_WEB_PART1_OK, TODAY_WEB_PART2_OK, TODAY_WEB_PART3_OK, LEDGER_WEB_TODAY_OK, ни одного FAIL |
| `node scripts/dev-checks/ledger-web.mjs today dark` | то же, ни одного FAIL |
| `node scripts/dev-checks/schedule-web.mjs read` | SCHEDULE_WEB_READ_OK (общий хук минуты расписание не сломал) |
| `node scripts/dev-checks/wait-dev.mjs down` | DEV_DOWN_OK; порты 3000 и 4000 свободны (lsof), процессы этого worktree остановлены, `apps/web/AGENTS.md` удалён |
| `npx prettier --check` по файлам плана | чисто |

Критерии приёмки: `git grep -F "function subscribeMinute"` в `apps/web/app/(app)` находит только `use-minute-now.ts`; `grep -c todayCounts` в today-screen.tsx — 2; `grep -nE "(status|outcome) *(===|!==) *'"` в today-lessons.tsx — нет (код 1); `occurrenceSlot` в today-lessons.tsx — 3, `statusWord` — 2; `balanceMinutes *(/|<=|<)` и `defaultLessonMinutes *\*` в due-list.tsx — нет (код 1).

Что проверяет `ledger-web.mjs today` (в обеих темах; ищет строки только по `data-student-id` фикстур `Alex Example 2170 …` и `2171 …`):
- часть 1 (браузер America/New_York, 1280 px): `h1` равен полной дате по Вьетнаму; четыре плитки по порядку и значения с подсказками равны `todayCounts` от ответа GET /today; итоговая строка нужной формы и с «next» ровно тогда, когда у `todayCounts` есть следующий урок; плитки в один ряд при 1280 и 2 на 2 при 600, зазор 12 px; принудительный 500 даёт один ReadError, ни одной плитки, `h1` на месте, Refresh перечитывает; смена дня через `page.clock` (см. ниже).
- часть 2: строки Lessons today в порядке времени и по списку ответа; вид и пометка каждой из фикстур (needs_mark, done, cancelled, moved — «Moved to 12 Oct»); зачёркнута только cancelled; строки 40 px; подсвечен ровно `nextKey` из `todayCounts`, вес 600 и фон только у него; колонка времени не уже 88 px, время VN совпадает с `zonedParts`, вторая зона MSK; Earlier: ключи строк равны первым 8 из ответа по возрастанию начала, подпись, «+N more» к `/schedule` при больше 8, дата фикстуры «Sat 10 Oct» и не уже 72 px; после отметки через api и перечитывания строка и панель уходят (панель исчезает ровно тогда, когда в ответе не осталось прошлых); тихий день через подмену ответа (плитки 0, у Today, Done, To mark нет подсказки, у Pays soon есть, EmptyState, Open schedule и Week ведут на `/schedule`, Earlier не рисуется); 320 px без бокового скролла страницы и без переполнения панелей.
- часть 3: порядок фикстур в ответе долг, 0, 1 урок; 10 уроков и «не задан» нет ни в ответе, ни на странице; строки Pays soon совпадают с первыми 8 из ответа, «+N more» к `/students` при больше 8; подпись содержит текущий N и «or owing»; тексты остатков — только числа уроков (ни дат, ни срочности, ни сумм); на подменённом ответе из трёх фикстур: тексты «owes 1.5 lessons», «0 lessons left», «1 lesson left», точки red, amber, blue с метками «Owes lessons», «No lessons left», «Pays soon», строка 32 px и колонка имени 112 px, подпись `caption muted`, точка — цель 24 px с фокусом и на 12 px внутри строки, порядок долг, 0, 1; клик по точке профиль не открывает, точка берёт фокус отдельно, клик по строке открывает профиль фикстуры; пустое состояние при N = 1 («1 lesson left or fewer», «1 lesson or fewer left, or owing») без действия.

Скриншоты проверены глазами в обеих темах (общий вид с плитками и панелями, Earlier, Pays soon, тихий день, ошибка чтения, 600 и 320 px). Во встроенном браузере ведущей сессии стоит посмотреть Today ещё раз.

### Смена дня (R6) и `page.clock`

`page.clock` в playwright 1.63 есть, раздел проверен целиком. В dev-режиме React Strict Mode монтирует эффект чтения дважды, поэтому при открытии `/` уходят два запроса подряд (в режиме production был бы один). Проверка устроена так, чтобы счёт не зависел от этого: ответы, начатые до первого отданного ответа, получают вчерашнюю дату.
- Вчерашняя дата в первом ответе: экран делает ещё запрос (всего 2-3 запроса в dev) и `h1` показывает сегодняшнюю дату.
- Вчерашняя дата в каждом ответе: экран перечитывает ровно один раз и затем замолкает (счёт запросов не растёт за 3 секунды); `page.clock.runFor(61000)` даёт 1-2 новых запроса, то есть не чаще раза в минуту и без цикла.

## Данные и приватность

- Фикстуры только `Alex Example 2170 A..F` и `2171 A..E`; уборка в начале, перед частью 3 и в `finally` (после каждого прогона «fixture cards removed 6» и «5»). Скрипт расширен: `fixtureWhere` теперь охватывает `215%`, `216%` и `217%`.
- Строки Today, Earlier и Pays soon настоящих данных в выводе не печатаются: сверки идут по `data-student-id` фикстур и по ключам ответа, расхождения плиток называют только метку плитки. В `dvlab_dev` настоящих уроков на Today и учеников в Pays soon в момент прогонов не было; печатаются только счётчики «today shows N lesson blocks, N earlier, N pays soon rows» (в них вместе с фикстурами).
- Порог Pays soon на время прогона ставится в 2 и возвращается (`withTeacherSettings`): строка `teacher_settings` до и после — отсутствует; `select count(*) from teacher_settings` даёт 0, `Alex Example 21%` — 0.
- Скриншоты только в STATE_DIR.

## Расхождения с дизайном и умолчания (для Design dude, не блокируют)

1. **v36 → v40.** DueList в v40: имя в фиксированной колонке 112 px с многоточием (план писал просто «имя»); сделано так. В v40 `TodayPage` в шапке есть «Add payment» и четыре плитки в тех же формах; кнопку по плану добавит 21-11, у экрана сейчас в шапке только заголовок и итоговая строка. `StatusDot` и `StudentBalance` уже на v40 (21-08, 21-09), DueList пользуется ими.
2. **Отступ EmptyState.** README компонента: `space-12` (48 px) сверху и снизу, превью TodayPage рисует 32 px. Взято 48 px из README (и плана); если нужно 32 px, правка в `empty-state.tsx` одна строка.
3. **«+N more» в Earlier** открывает `/schedule` без номера недели (README v36 говорит «that week»), как в умолчаниях UI-SPEC.
4. **Подписи Pays soon при N = 0 и N = 1:** «0 lessons or fewer left», «1 lesson or fewer left»; пустое: «1 lesson left or fewer».
5. **Значок ReadError.** В превью v40 у ошибки чтения треугольник, в репозитории (общий `read-error.tsx`, не этот план) круг; не менялось.
6. **Строки без элементов отметки.** Пометка «Needs a mark» у неотмеченного начавшегося урока временная: на её месте 21-11 поставит кнопки Done и No-show; у отмеченных пометки Done и No-show заменит меню отметки.
7. **Короткое имя.** В строках `block.studentName`; помощника «Anna K.» в репозитории нет (список учеников и блоки сетки тоже печатают имя карточки как есть).

## Отклонения от плана

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Серия для фикстуры «Moved to» создаётся SQL, а не api**
- **Found during:** задача 1 (первый прогон)
- **Issue:** серия, созданная через POST /schedule/lessons со временем, которое сегодня уже прошло, не давала вхождения на сегодня, и перенос вхождения отвечал 409.
- **Fix:** серия вставляется строкой `lesson_series` с началом на 14 дней раньше, как в `pastSeries` из ledger-api.mjs; вхождение переносится api (200), призрак строится настоящим кодом.
- **Files modified:** scripts/dev-checks/ledger-web.mjs
- **Commit:** 907e9da

**2. [Rule 1 - Bug скрипта] Счёт запросов в части R6 зависел от Strict Mode**
- **Found during:** задача 1
- **Issue:** вариант «подменить первый ответ» в dev давал второй запрос из-за двойного монтирования, а не из-за смены дня, и проверка проходила бы без механизма; вариант «ровно 2 запроса» падал.
- **Fix:** подмена вчерашней датой всех ответов до первого отданного ответа; проверка «замолкает» сравнивает счёт в два момента; в конце `unrouteAll({ behavior: 'ignoreErrors' })` (без него закрытие браузера роняло скрипт необработанным отказом).
- **Commit:** 907e9da

**3. [Rule 1 - Bug скрипта] Часть 3 зависела от настоящих строк Pays soon**
- **Found during:** задача 3
- **Issue:** настоящие и фикстурные строки делят восемь мест, поэтому фикстура «1 урок» (синяя точка) могла оказаться за «+N more».
- **Fix:** порядок и отсутствие 10 уроков и «не задан» проверяются по настоящему ответу, а виды строк, точки и клик — на подменённом ответе из трёх строк фикстур (взяты из GET /students); фикстуры частей 1 и 2 убираются перед частью 3.
- **Commit:** c7ee845

**4. [Прочее] Строка `teacher_settings` после упавшего прогона**
- Прогон с необработанным отказом (до пункта 2) завершился без `finally` и оставил строку `teacher_settings` со значением 2; удалена вручную (`delete` под ролью migrator), до моих прогонов строки не было. Состояние после всех прогонов: 0 строк.

### Уточнения к плану

- Файл `empty-state.tsx` создан в задаче 2 (EmptyState нужен только панелям), как в `<files>` задачи 2; `stat.tsx` — в задаче 1.
- В today-screen.tsx добавлены `data-slot` у счётчиков и в строках (`today-row`, `due-row`, `more-row`), по которым скрипт находит элементы; на вид не влияют.

## Не запускалось

- `yarn workspace @dv-lab/api build` и `yarn test` (запрещены заданием), `yarn install`, `yarn knip` (план не называет; `TodayResponse` теперь используется, `Stat`, `EmptyState`, `DueList` используются экраном).
- `ledger-web.mjs settings` не запускался (меняет порог настоящего учителя; раздел today делает то же на время прогона, параллельных проверок порога не было).

## Для следующих планов

- **21-11:** точки вставки — `LessonRows` в `today-lessons.tsx` (в конце `li`: сейчас `style.note` и `statusWord`; элементы Done, No-show и меню заменяют пометку у needs_mark, done, no_show, остаются «Cancelled» и «Moved to …»); строка станет кнопкой открытия диалога (`after:absolute after:inset-0`, соседи `relative z-10`, как у `DueList`); у `li` уже есть `data-key`, `data-student-id`, `data-status` и `data-next`. Единственная мутация отметки — `markLesson` из `schedule-mutations.ts`; после неё `load` из `LoadedToday` в today-screen.tsx перечитывает `/today` без перехода в loading. Действие «Add payment» — слот `actions` у `PageHeader` в `Shell`, в загрузке и в ошибке оно должно оставаться. У прошедшего урока в диалоге есть Move lesson (D-17).
- Общий минутный хук — `useMinuteNow` из `apps/web/app/(app)/_components/use-minute-now.ts`; расписание и Today пользуются им, второй подписки нет.
- В `ledger-web.mjs` общие помощники today: `todayFixtures`, `openToday`, `readTodayApi`, `countsOf`, `expectedTiles`, `rowFacts`, `dueFixtures`; пусть 21-11 расширяет раздел today, а не заводит свой.
- В dev-режиме чтение `/today` при открытии идёт дважды (Strict Mode), в production один раз; скрипты не должны требовать точного числа запросов.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности. T-21-20 закрыт: одно состояние `error` с ReadError, без плиток и списков, проверено принудительным 500. T-21-29 закрыт: перечитывание по смене дня идёт не чаще раза в минуту, проверено `page.clock`. T-21-33 закрыт: только фикстуры 2170 и 2171, о настоящих строках только счётчики, скриншоты в STATE_DIR.

## Self-Check: PASSED

- Файлы на месте: `today-screen.tsx`, `today-lessons.tsx`, `due-list.tsx`, `use-minute-now.ts`, `stat.tsx`, `empty-state.tsx`, `ledger-web.mjs`.
- Коммиты 907e9da, af3ea30, c7ee845 есть в `git log`.
- `apps/web/AGENTS.md` удалён, на портах 3000 и 4000 никто не слушает.
