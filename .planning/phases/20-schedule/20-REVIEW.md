---
phase: 20-schedule
reviewed: 2026-10-10T10:18:25Z
depth: deep
files_reviewed: 58
files_reviewed_list:
  - apps/api/src/app.ts
  - apps/api/src/cards/card-facts.ts
  - apps/api/src/cards/card-rows.ts
  - apps/api/src/cards/cards.ts
  - apps/api/src/routes/schedule.ts
  - apps/api/src/schedule/changes.ts
  - apps/api/src/schedule/rows.ts
  - apps/api/src/schedule/schedule.ts
  - apps/api/src/schedule/series.ts
  - apps/web/app/(app)/schedule/_components/end-series-dialog.tsx
  - apps/web/app/(app)/schedule/_components/event-tooltip.tsx
  - apps/web/app/(app)/schedule/_components/lesson-block.tsx
  - apps/web/app/(app)/schedule/_components/lesson-dialog.tsx
  - apps/web/app/(app)/schedule/_components/lesson-move-form.tsx
  - apps/web/app/(app)/schedule/_components/move-series-dialog.tsx
  - apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx
  - apps/web/app/(app)/schedule/_components/schedule-mutations.ts
  - apps/web/app/(app)/schedule/_components/schedule-screen.tsx
  - apps/web/app/(app)/schedule/_components/schedule-toolbar.tsx
  - apps/web/app/(app)/schedule/_components/second-zone-select.tsx
  - apps/web/app/(app)/schedule/_components/week-grid.tsx
  - apps/web/app/(app)/schedule/page.tsx
  - apps/web/app/(app)/students/_components/student-form-dialog.tsx
  - apps/web/app/(app)/students/_components/students-screen.tsx
  - apps/web/app/globals.css
  - apps/web/components/app/date-field.tsx
  - apps/web/components/app/empty-line.tsx
  - apps/web/components/app/layout-parts.tsx
  - apps/web/components/app/time-pair.tsx
  - apps/web/components/ui/input-group.tsx
  - apps/web/components/ui/table.tsx
  - apps/web/components/ui/time-picker.tsx
  - apps/web/lib/popup.ts
  - apps/web/lib/schedule-format.ts
  - apps/web/lib/time-zones.ts
  - packages/contracts/src/auth.ts
  - packages/contracts/src/index.ts
  - packages/contracts/src/schedule.ts
  - packages/contracts/src/students.ts
  - packages/contracts/test/auth.test.ts
  - packages/core/src/index.ts
  - packages/core/src/schedule.ts
  - packages/core/src/zoned.ts
  - packages/db/drizzle/20261010075813_schedule/migration.sql
  - packages/db/src/schema.ts
  - scripts/dev-checks/README.md
  - scripts/dev-checks/api.mjs
  - scripts/dev-checks/paths.mjs
  - scripts/dev-checks/schedule-api.mjs
  - scripts/dev-checks/schedule-core.mjs
  - scripts/dev-checks/schedule-db.mjs
  - scripts/dev-checks/schedule-web.mjs
  - scripts/dev-checks/sql.mjs
  - scripts/dev-checks/wait-dev.mjs
  - scripts/dev-checks/web.mjs
  - scripts/gsd/dispatch.sh
  - scripts/gsd/root-pin.sh
  - scripts/privacy-check.mjs
findings:
  critical: 1
  warning: 11
  info: 10
  total: 22
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-10-10T10:18:25Z
**Depth:** deep
**Files Reviewed:** 58
**Status:** issues_found

## Summary

Область сужена с `8b4a085..HEAD` до `d24da59..HEAD` (слияние фазы 19, PR #5): диапазон `8b4a085..d24da59` — фазы 17-19, они уже прошли своё ревью (`a471942`). Список файлов выше построен по суженному диффу без `snapshot.json`. `time-picker.tsx` и `input-group.tsx` — копии из лаборатории, их проверял только поиском опасных конструкций (`innerHTML`, `eval`), их нет.

Что подтверждено: в коде расписания нет удалений (D-16 соблюдён на уровне кода), все мутации идут в транзакции с `FOR UPDATE` на строке серии или урока, разрез серии и мутации вхождений сериализуются на одной строке `lesson_series`, создание серии сериализуется блокировкой карточки. Правило видимости вхождения живёт в одном месте (`core/schedule.ts::occurrenceAt`), загрузчик строк в `rows.ts` один. Комментариев в коде нет, интерфейс на английском, в скриптах проверки только вымышленные карточки `Alex Example NNNN`.

Главная проблема — отмена перенесённого вхождения, у которого исходная дата уже прошла (CR-01): урок пропадает с нового места, появляется отменённым в прошлом, вернуть его нельзя. Остальное: окончание серии прячет перенесённые раньше уроки без предупреждения (по букве D-16), DELETE у роли приложения не отозван, годы 0001-0099 превращаются в 1900-е, гонки состояния экрана расписания, сообщения 409 «changed elsewhere» там, где ничего не менялось, и однобуквенные глобальные сочетания клавиш.

Два случая проверил скриптом на `packages/core` (scratchpad, исходники не менял): `zonedInstant('0050-03-03', …)` даёт `1950-03-03`; `endSeriesAt` с `lastOn` = воскресенье при moved-исключении 19 Oct → 16 Oct даёт `endsOn = 2026-10-12`, после чего `scheduleWindow` не показывает урок 16 Oct.

## Critical Issues

### CR-01: BLOCKER. Отмена перенесённого вхождения с прошедшей исходной датой необратима и рисуется в прошлом

**File:** `apps/api/src/schedule/changes.ts:121-165`, `packages/core/src/schedule.ts:97-107`
**Issue:** `cancelOccurrence` проверяет `canChange(occurrence.startsAt, now)`, то есть время после переноса. `occurrenceAt` ставит вхождение с исключением `cancelled` на `naturalStart`, а `restoreOccurrence` проверяет `canChange(occurrence.naturalStart, now)`. Сценарий: в воскресенье урок понедельника перенесли на среду, во вторник учитель отменяет урок в среду. Итог:
- блок исчезает из среды и появляется в понедельнике (уже прошедшем) как `cancelled`;
- `changeable` = `canChange(naturalStart)` = false, поэтому кнопки Return to schedule нет, а диалог пишет «This lesson has already taken place and cannot be changed», хотя урок не проводился;
- `POST …/restore` даёт 409, отмену нельзя откатить ни через UI, ни через API;
- фаза 21 через `occurrenceAt` увидит прошедший отменённый урок понедельника, а не отменённый урок среды.

Данные для исправления в строке есть: `markException` при апсерте `cancelled` не обнуляет `starts_at`/`duration_minutes` (`changes.ts:68-76`), CHECK `lesson_exceptions_moved_ck` это разрешает.
**Fix:** Модель меняется (D-17), поэтому нужно решение владельца. Варианты:
1. Минимальная заглушка: запретить отмену, если исходное место уже прошло, а перенос — в будущем, либо считать возможность действия по одному правилу для cancel и restore:
```ts
const anchor = occurrence.status === 'moved' ? occurrence.naturalStart : occurrence.startsAt
if (!canChange(anchor, now)) return CHANGED
```
2. Полное исправление: `SeriesException` вида `cancelled` получает необязательные `startsAt`/`durationMinutes`, `occurrenceAt` ставит отменённое вхождение на перенесённое время, если оно есть; restore такого вхождения возвращает `moved`, а не `restored`; `changeable` и проверка restore идут по этому времени.

## Warnings

### WR-01: WARNING. End series прячет урок, перенесённый раньше даты окончания, а подсказка об этом молчит

**File:** `packages/core/src/schedule.ts:313-319`, `apps/web/app/(app)/schedule/_components/end-series-dialog.tsx:126-136`
**Issue:** Вхождение 19 Oct перенесено на 16 Oct. Учитель заканчивает серию с Last lesson on = 18 Oct, получает `endsOn = 12 Oct`, а `occurrenceAt(rule, '2026-10-19')` возвращает null. Урок 16 Oct, который стоит до выбранной даты, пропадает из сетки, из Next lesson и из будущих отметок фазы 21. Вернуть его нельзя: у DateField `max = endsOn`, продлить серию нельзя. По букве D-16 так и задумано (исключения с `original_on` позже `ends_on` не показываются), но перенос серии в том же случае по D-04 превращает такие вхождения в строки `lessons` (`cutSeries`, строки 286-295), а окончание серии — нет. Подсказка «Later lessons are removed from the schedule. Earlier lessons stay.» вводит в заблуждение.
**Fix:** Вынести асимметрию владельцу. Либо `endSeries` по образцу `cutSeries` переносит moved-исключения с `originalOn > endsOn` и `startsAt <= конец lastOn` в `lessons` (в той же транзакции, без удаления строк исключений), либо диалог перечисляет такие уроки («Also removed: Fri 16 Oct, 18:00 VN, moved from Mon 19 Oct»).

### WR-02: WARNING. D-16 держится только на коде: у `dvlab_app` есть DELETE на таблицах расписания

**File:** `packages/db/drizzle/20261010075813_schedule/migration.sql` (нет REVOKE); источник прав — `deploy/postgres/ensure-db.sql:33`; проверка закрепляет это в `scripts/dev-checks/schedule-db.mjs:11`
**Issue:** Default privileges выдают `dvlab_app` права `SELECT, INSERT, UPDATE, DELETE` на все новые таблицы. Правило «приложение ничего не удаляет из расписания» база не охраняет: будущий код фаз 21-25 может удалить исключение или серию, и это пройдёт молча. Без исключений неверно считаются отметки и id событий Google.
**Fix:** Аддитивной миграцией под migrator:
```sql
REVOKE DELETE, TRUNCATE ON lesson_series, lesson_exceptions, lessons FROM dvlab_app;
```
В `schedule-db.mjs` поменять ожидание на `delete: false`. Очистка фикстур в скриптах идёт под migrator, её это не ломает.

### WR-03: WARNING. Годы 0001-0099 проходят валидацию и сохраняются как 1900-е

**File:** `packages/core/src/zoned.ts:52-64,85-91`, `packages/contracts/src/students.ts:50-59`, `apps/api/src/schedule/schedule.ts:118-130`
**Issue:** `isIsoDate` пропускает год ≥ 1 и проверяет дату через `setUTCFullYear`, а `zoned.ts` использует `Date.UTC(year, …)`, который годы 0-99 отображает в 1900-1999. Проверено: `zonedInstant('0050-03-03','10:00',VN)` даёт `1950-03-03T02:00Z`, `addDays('0050-01-01',1)` даёт `1950-01-02`. Путь `POST /schedule/lessons` с `repeats: 'once'` дату не ограничивает и запишет урок не в тот век. Ветки weekly, move и week-start защищены сравнением с сегодняшним днём или границами `WEEK_START_MIN/MAX`. DateField такую дату не даст, проблема только у API.
**Fix:** В `zoned.ts` строить даты через `setUTCFullYear` (как в `isIsoDate`):
```ts
function utcMs(year: number, month: number, day: number, hour = 0, minute = 0): number {
	const date = new Date(0)
	date.setUTCFullYear(year, month - 1, day)
	date.setUTCHours(hour, minute, 0, 0)
	return date.getTime()
}
```
Либо добавить в `createLessonRequest`/`moveLessonRequest` нижнюю границу даты, например `'2000-01-01'`, как у недели.

### WR-04: WARNING. `reloadNow` и `refresh` пишут состояние без защиты от устаревшего ответа, экран может зависнуть на скелетоне

**File:** `apps/web/app/(app)/schedule/_components/schedule-screen.tsx:139-155,223-228`
**Issue:** `reloadNow` (после Move/End series) и `refresh` (ReadError) делают `setLoaded({ monday, state })` с `monday` из замыкания, без флага актуальности и без смены `version`. Последовательность: End series, ответ ещё в пути, учитель жмёт Next week, эффект загружает новую неделю, поздний ответ `reloadNow` перезаписывает `loaded` старым понедельником. После этого `loaded.monday !== monday`, `week` = loading, а зависимости эффекта не меняются, и экран навсегда остаётся на скелетоне.
**Fix:** Убрать собственные записи и вести все загрузки через эффект:
```ts
async function seriesChanged() {
	const closed = seriesDialog
	setSeriesDialog(null)
	reload()
	if (closed !== null) focusBlock(closed.returnTo)
}
```
`refresh` тоже свести к `reload()`. Если нужен await — счётчик запроса в ref и проверка перед `setLoaded`.

### WR-05: WARNING. Неделя на экране привязана к движущемуся якорю и прыгает в полночь понедельника

**File:** `apps/web/app/(app)/schedule/_components/schedule-screen.tsx:96,108-111`
**Issue:** В состоянии хранится `offset` относительно `currentMonday`, а `currentMonday` считается из `now`, который обновляется каждую минуту. В 00:00 понедельника по Вьетнаму `currentMonday` сдвигается на 7 дней, и вместе с ним `monday`. Открытая учителем неделя меняется сама собой, открытый LessonDialog или форма переноса исчезают, потому что `openBlock` не находится, введённые данные теряются.
**Fix:** Хранить в состоянии абсолютный `monday: string`, Today = `setMonday(currentMonday)`, стрелки = `addDays(monday, ±7)`, `openPair` = `setMonday(targetMonday)`.

### WR-06: WARNING. Чтение недели и Next lesson без согласованного снимка

**File:** `apps/api/src/schedule/rows.ts:145-208`, `apps/api/src/schedule/schedule.ts:96-108`, `apps/api/src/cards/card-facts.ts:46-53`
**Issue:** `loadScheduleRows` читает `lessons`, затем `lesson_series`, затем `lesson_exceptions` отдельными запросами вне транзакции (READ COMMITTED). Если между запросами закоммитится `moveSeries`, неделя может прийти с уроком из `lessons` (новым) и одновременно с moved-исключением старой серии (её `ends_on` прочитан до разреза). Один урок покажется дважды, либо пропадёт в обратном порядке. Ошибка временная, но клиент кладёт ответ в кэш `weeks` и строит по нему предупреждение о пересечении.
**Fix:** Обернуть чтение в транзакцию только для чтения со снимком:
```ts
return db.transaction((tx) => readWeek(tx, start, now), { isolationLevel: 'repeatable read', accessMode: 'read only' })
```
То же сделать для `cardFacts` в `listCards`.

### WR-07: WARNING. 409 «This lesson was changed elsewhere» и «Try again» там, где ничего не менялось и повтор не поможет

**File:** `apps/api/src/schedule/changes.ts:48-52,103-112`, `packages/core/src/schedule.ts:277-279`, `apps/api/src/routes/schedule.ts:49-58`, `apps/web/app/(app)/schedule/_components/lesson-move-form.tsx:109-116`, `apps/web/app/(app)/schedule/_components/move-series-dialog.tsx:117-126`
**Issue:**
- Перенос на сегодня на уже прошедшее время: `moveTarget` возвращает null, ответ 400, форма пишет «Could not move the lesson. Try again.». TimePicker такое время позволяет, `now` форма не получает, причину учитель не узнает.
- Move series с From = сегодня, когда сегодняшний урок серии уже прошёл: `cutSeries` возвращает `changed`, ответ 409, баннер «This lesson was changed elsewhere». Повтор с той же датой снова даёт 409.
- `changeable` считается сервером в момент чтения недели, а `now` на клиенте тикает. Урок начался, пока был открыт диалог: кнопки остаются, ответ 409 и тот же баннер.
**Fix:** Отдельные коды: `lesson_in_past` (400) для цели в прошлом и для уже начавшегося урока, `series_today_passed` для разреза. В клиенте проверять цель по `canChange(target, now)` до отправки (передать `now` в LessonMoveForm) и прятать действия по `canChange(new Date(block.startsAt), now)`, а не только по `block.changeable`.

### WR-08: WARNING. «This lesson has already taken place» у отменённых уроков и у исходного места переноса

**File:** `apps/web/app/(app)/schedule/_components/lesson-dialog.tsx:185-189`
**Issue:** Текст показывается при любом `!block.changeable`. У отменённого прошедшего урока (`status: 'cancelled'`) и у исходного места перенесённого (`status: 'moved'`, урок проведён в другое время или ещё впереди) это неправда. Вместе с CR-01 учитель видит «урок прошёл» у урока, который он только что отменил в будущем.
**Fix:**
```tsx
const pastNote =
	block.status === 'cancelled' ? 'This lesson was cancelled and its time has passed.'
	: block.status === 'moved' ? 'This lesson was moved; its original time has passed.'
	: 'This lesson has already taken place and cannot be changed.'
```

### WR-09: WARNING. Глобальные однобуквенные сочетания `t`/`j`/`k` и стрелки (WCAG 2.1.4)

**File:** `apps/web/app/(app)/schedule/_components/schedule-toolbar.tsx:35-50`
**Issue:** Обработчик висит на `document`, а не на фокусе компонента, и срабатывает на любой кнопке страницы (блок урока, сайдбар, кнопки тулбара). WCAG 2.1.4 (уровень A) требует, чтобы однобуквенные сочетания можно было отключить, переназначить или чтобы они работали только при фокусе на компоненте. Голосовой ввод и случайные нажатия листают недели. ArrowLeft/ArrowRight на фокусированном блоке уводят неделю и теряют фокус: блок размонтируется, фокус уходит в `body`.
**Fix:** Слушать `keydown` на обёртке расписания (сетка и тулбар) или требовать модификатор. Стрелки обрабатывать, только когда фокус на тулбаре. После смены недели переводить фокус на заголовок (`titleRef`).

### WR-10: WARNING. Одиночный урок в прошлом создаётся одним кликом и уже не исправляется

**File:** `apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx:118-119`, `apps/api/src/schedule/schedule.ts:118-130`, `apps/web/app/(app)/schedule/_components/week-grid.tsx:153-157`
**Issue:** UI-SPEC разрешает прошлую дату для `once` («for later marks»). Но клик по пустой клетке прошедшего дня открывает диалог с прошлой датой без предупреждения, и созданный по ошибке урок нельзя ни отменить, ни перенести (`canChange` false, D-05), ни удалить (D-16). Он навсегда остаётся в сетке и попадёт в отметки фазы 21.
**Fix:** Для прошедшего времени показывать в диалоге предупреждение «This lesson is in the past and cannot be changed after saving.» и подтверждение, либо не открывать диалог по клику на прошедшую клетку (кнопка New lesson для прошлого остаётся).

### WR-11: WARNING. Повтор создания серии игнорирует длительность и молча возвращает другую серию

**File:** `apps/api/src/schedule/schedule.ts:135-148`, `apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx:160-171`
**Issue:** Проверка «уже есть такая серия» сравнивает карточку, день, время и `starts_on`, но не `duration_minutes`. Запрос на 90 минут при открытой серии на 60 вернёт серию на 60 с кодом 200, а UI покажет «Series added». Учитель уверен, что серия на 90.
**Fix:** Добавить `eq(lessonSeries.durationMinutes, input.durationMinutes)` в условие (тогда создастся вторая серия, D-09 это разрешает), либо при отличии длительности вернуть 409 с отдельным кодом и текстом в диалоге. В UI для `existing` показывать «This series already exists».

## Info

### IN-01: INFO. Подписи второй зоны берутся на полдень понедельника для всей недели

**File:** `apps/web/lib/schedule-format.ts:82-87`, `apps/web/app/(app)/schedule/_components/week-grid.tsx:215`, `apps/web/app/(app)/schedule/_components/schedule-screen.tsx:114`
**Issue:** `gutterLabel(monday, hour, zone)` и `zoneCaption(zone, monday 12:00)` считаются один раз на неделю. Для зоны со сменой времени посреди недели (Europe/London, America/*) гаттер и подпись в углу после перехода неверны на час. Для MSK по умолчанию проблемы нет.
**Fix:** Писать в углу подпись на сегодня или на начало недели, а в гаттере указывать смену при её наличии; минимум — описать ограничение в SUMMARY.

### IN-02: INFO. Мелочи доступности новых диалогов и сетки

**File:** `apps/web/app/(app)/schedule/_components/lesson-dialog.tsx:266`, `apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx:249`, `apps/web/app/(app)/schedule/_components/week-grid.tsx:228`, `apps/web/app/(app)/schedule/_components/lesson-block.tsx:75-84`
**Issue:** У контейнера вопроса об отмене вместе с кнопками стоит `role="alert"`, и читалка зачитает кнопки как текст тревоги; лучше `role="group"` с `aria-live` только у текста вопроса. `aria-describedby="new-lesson-time-note"` стоит всегда, а элемент с этим id рендерится по условию, остаётся висячая ссылка. Пустая клетка создаёт урок только мышью (альтернатива — New lesson, приемлемо). `aria-label` блока исходного места переноса содержит только «moved to 16 Oct», без времени.
**Fix:** Поправить роли и условный `aria-describedby`; в `movedLabel` для aria-label добавить время (`vnDayTime`).

### IN-03: INFO. Тексты по D-19 и D-13

**File:** `apps/web/app/(app)/schedule/_components/new-lesson-dialog.tsx:166-169`, `apps/web/app/(app)/schedule/_components/move-series-dialog.tsx:128-131`, `apps/web/app/(app)/students/_components/students-screen.tsx:124`
**Issue:** Уведомления «Series added» и «Series moved» не содержат «VN (… MSK)», которое по D-19 (а) должно быть во всех текстах с временем урока. Уведомления одиночных уроков его содержат. D-13 требует «none», в ячейке «None».
**Fix:** Строить текст через `vnWhen(zonedInstant(series.startsOn, series.startTime, VN), zone, year)`; регистр сверить с Design dude.

### IN-04: INFO. Строки `cancelled`/`restored` хранят время старого переноса

**File:** `apps/api/src/schedule/changes.ts:67-77`, `packages/db/drizzle/20261010075813_schedule/migration.sql:11`
**Issue:** Апсерт не обнуляет `starts_at`/`duration_minutes` при смене вида на `cancelled` или `restored`, CHECK этого не запрещает. Сейчас `toSeriesException` эти поля игнорирует, но читатели фаз 21 и 24, взявшие `starts_at` напрямую, получат время, которого уже нет. Решение по CR-01 определит, нужно ли это поле у `cancelled`.
**Fix:** После CR-01 либо явно задать смысл поля (время отменённого перенесённого урока), либо обнулять его в `set` и ужесточить CHECK: `("kind" = 'moved') = ("starts_at" is not null)`.

### IN-05: INFO. `studentStatus` в контракте блока не используется, у архивных учеников серии идут бесконечно

**File:** `packages/contracts/src/schedule.ts:67`, `apps/api/src/schedule/schedule.ts:67-84`
**Issue:** UI-SPEC оставляет уроки архивных учеников в сетке. Но открытая серия архивной карточки рождает блоки и Next lesson без конца, а поле `studentStatus` уходит в web и нигде не читается.
**Fix:** Либо пометка блока архивного ученика в сетке, либо предложение закончить серии при архивировании (решение владельца); иначе убрать поле из контракта.

### IN-06: INFO. Убран `[--scroll-fade-size:32px]` у всех всплывающих списков

**File:** `apps/web/lib/popup.ts:10`
**Issue:** Изменение затрагивает все поповеры сайта, а не только новые экраны. По D-14 размер 48px или 24px, так что это, видимо, верно, но стоит сверить с компактным правилом (списки ниже ~200px — 24px).
**Fix:** Проверить высоты списков, где нужно — `[--scroll-fade-size:var(--scroll-fade-size-compact)]`.

### IN-07: INFO. `blocksOn` молча глотает ошибку чтения недели

**File:** `apps/web/app/(app)/schedule/_components/schedule-screen.tsx:157-173`
**Issue:** При ошибке возвращается `[]`, и предупреждение о пересечении в New lesson и Move lesson просто не появляется: учитель считает время свободным.
**Fix:** Возвращать признак ошибки и показывать в диалоге строку «Could not check for overlaps.»

### IN-08: INFO. Дата не из серии в маршруте вхождения даёт 409, а не 404

**File:** `apps/api/src/routes/schedule.ts:72-77`, `apps/api/src/schedule/changes.ts:100-110`
**Issue:** `originalOn` не того дня недели или вне диапазона серии даёт `occurrence === null`, ответ CHANGED (409), клиент показывает «changed elsewhere». Для URL, которого не существует, честнее 404.
**Fix:** В `lockOccurrence` различать «серия есть, а даты в ней нет и не было» (`!isSeriesDate` по исходным `weekday/startsOn`) и отдавать NOT_FOUND.

### IN-09: INFO. Список учеников импортирует хук из папки маршрута расписания

**File:** `apps/web/app/(app)/students/_components/students-screen.tsx:29`
**Issue:** `useSecondZone` лежит в `schedule/_components/second-zone-select.tsx`, и маршрут students зависит от внутренностей маршрута schedule.
**Fix:** Перенести `useSecondZone` и константы хранения в `apps/web/lib/second-zone.ts`.

### IN-10: INFO. privacy-check пропускает коммит без списка имён и перезаписывает чужой pre-commit

**File:** `scripts/privacy-check.mjs:47-48,24-36`
**Issue:** Если `~/.claude/private/student-names.txt` нет, хук молча пропускает коммит в публичный репозиторий. `--install` перезаписывает существующий `pre-commit` без проверки. Это инструмент, не продукт, но приватность учеников — правило проекта.
**Fix:** Без списка печатать предупреждение в stderr (или падать при `DVLAB_PRIVACY_STRICT=1`); при установке не перезаписывать чужой хук без флага.

---

_Reviewed: 2026-10-10T10:18:25Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
