# Calendar UX, Privacy Mode, Theme Settings, Billing Plans

Дата handoff: 2026-05-02  
Статус: основная реализация выполнена в текущем worktree. Перед продолжением сделать ручную browser/Google Calendar проверку и при необходимости довести UX-детали.

## Checkpoint 2026-05-02

Реализовано:

- Backend/API: добавлены `CalendarBlock`, `lesson_occurrence_exceptions`, новые student поля `birthday` и `packageLessonPriceOverride`, calendar block CRUD, current-only weekly update/delete через локальные exceptions, расширенные `/lessons` и `/calendar` responses.
- DB: добавлена migration `0012_calendar_blocks_privacy_plans.sql`, schema/repository слой обновлен под новые таблицы и поля.
- Billing: custom package lesson price override учитывается в package/monthly расчетах и default amount оплаты; обычная `defaultLessonPrice` не меняется.
- Calendar UI: delete lesson из edit modal, personal block dialog, availability mode 10:00-21:00, free slot rendering, overlap layout, add-hotspot в занятых ячейках, drag/drop с выбором current/all future.
- Student UI: birthday через DatePicker, billing mode перенесен внутрь package block, добавлен `+ custom`, monthly preview и custom plan badge.
- Theme/privacy: reset возвращает текущий saved draft, shuffle рандомизирует больше параметров, добавлены font sizes/card/surfaceMuted, глобальный privacy mode по `Ctrl+H`.

Проверки:

- `yarn typecheck` прошел.
- `yarn test` прошел.
- `yarn lint` прошел.
- `gitnexus detect_changes --scope all` через MCP выполнен: scope широкий и ожидаемый, risk `critical` из-за 40 измененных файлов и затронутых calendar/billing/theme/student flows.

Осталось проверить вручную:

- Реальный Google Calendar sync для recurring current-only move/delete и personal blocks.
- Browser QA страницы `/lessons`: drag/drop hit targets, overlap columns, availability mode animation, free-slot action dialog.
- Browser QA student/payment/theme/privacy flows: custom package, monthly total, reset/shuffle theme, `Ctrl+H` blur across inputs and totals.

## Цель

Закрыть набор задач по календарю, приватности, темам, студентам и биллингу:

- удаление урока из модалки редактирования с корректным удалением из базы, расписания, биллинга и Google Calendar;
- корректная поддержка weekly lessons: current-only изменения через локальные exceptions, series изменения через master event;
- личные занятые слоты как отдельная сущность `CalendarBlock`, синхронизируемая в Google Calendar;
- availability mode на странице lessons;
- overlap layout для нескольких событий в одной ячейке календаря;
- drag/drop уроков с шагом 15 минут и выбором `current` / `all future`;
- birthday и custom package pricing у студента;
- корректный default amount в оплатах на основе текущего плана;
- расширенные настройки темы: font sizes, card/surface colors, корректный reset и реальный shuffle;
- глобальный privacy mode по `Ctrl+H`, который блюрит личные данные по всему сайту.

## Правила выполнения

- Перед изменением существующего symbol/function/class/method запускать:

```bash
gitnexus impact --target "<symbol>" --direction upstream
```

- Если GitNexus показывает `HIGH` или `CRITICAL`, остановиться и явно подтвердить риск с пользователем.
- После каждой волны запускать:

```bash
gitnexus detect_changes --scope all
yarn typecheck
yarn test
yarn lint
```

- Использовать `gitnexus`, не `npx gitnexus`.
- Не ротировать env secrets. Реальные значения остаются только в ignored `.env.local`.
- Не внедрять RLS в этой итерации.
- Не ломать публичный barrel export `packages/api-types/src/index.ts`.

## Уже подтвержденные impact-анализы

- `studentSchema`: symbol не найден.
- `calculatePackageLessonPriceRub`: `CRITICAL`, пользователь подтвердил продолжение.
- `calculatePackageTotalPriceRub`: `CRITICAL`, покрыто тем же подтверждением.
- `createLessonWorkflowService`: `LOW`.
- `calendarService`: symbol не найден.
- `syncLessonToCalendar`: `LOW`, но GitNexus нашел memory-store method, не API service.
- `LessonsCalendarPanel`: `LOW`.
- `CalendarWeekView`: `LOW`.
- `StudentFormDialog`: `LOW`.
- `PaymentFormDialog`: `LOW`.
- `ThemeSettingsClient`: `LOW`.
- `themeCssVariables`: `LOW`.
- `useTeacherCrmCommands`: `LOW`.
- `loadTeacherCrm`: `LOW`.
- `normalizeThemeSettings`: `LOW`.
- `lessonToCalendarEvent`: `LOW`.
- `listLessonRows`: `HIGH`; не менять этот symbol. Вместо этого добавлять новые repository methods.
- `mapStudentRow`: `LOW`.
- `toInsertValues`: `LOW`.
- `toUpdateValues`: `LOW`.
- `createStoreState`: `LOW`.
- `studentPackageLessonPrice`: `LOW`.
- `studentPackageTotal`: `LOW`.
- `createStudent`: GitNexus попал в student-service method, `LOW`.

## Уже внесено в worktree

### Smoke-тесты

Файл: `apps/api/src/app.test.ts`

- Добавлены проверки новых полей темы: `colors.card`, `fontSizes.body`.
- Добавлены проверки `birthday` и `packageLessonPriceOverride` у студента.
- Добавлен сценарий custom package:
  - `packageMonths: 4`;
  - `packageLessonsPerWeek: 1`;
  - `birthday: "2012-04-13"`;
  - `packageLessonPriceOverride: 2000`;
  - ожидается `packageLessonCount: 16`, `packageTotalPrice: 32000`.
- В update student добавлены:
  - `birthday: "2010-05-20"`;
  - `packageLessonPriceOverride: 1800`;
  - ожидается `defaultLessonPrice: 2400`;
  - ожидается `packageTotalPrice: 108000`.
- Weekly lesson test расширен current-only move:
  - master lesson остается weekly;
  - PATCH с `occurrenceStartsAt` создает detached one-off lesson;
  - `/lessons?status=all` должен вернуть `occurrenceExceptions`.
- Добавлен smoke для `/calendar/blocks`:
  - create;
  - list;
  - patch;
  - delete;
  - в memory path при connected calendar ожидается `syncStatus: "synced"`.

Эти тесты сейчас могут падать, пока backend не дописан.

### API types

Файл: `packages/api-types/src/index.ts`

Сделано:

- `calculatePackageLessonCount` теперь допускает любой positive integer `packageMonths`, если используется custom package.
- `calculateMonthlyTotalPrice` принимает optional `packageLessonPriceOverride`.
- `calculatePackageLessonPriceRub` принимает optional `packageLessonPriceOverride`; при override скидки 3/5 месяцев не применяются.
- `calculatePackageTotalPriceRub` принимает optional `packageLessonPriceOverride`.
- В theme schema добавлены:
  - `colors.card`;
  - `colors.surfaceMuted`;
  - `fontSizes.body`;
  - `fontSizes.heading`;
  - `fontSizes.small`.
- `DEFAULT_CRM_THEME_SETTINGS` расширен новыми theme fields.
- Добавлен `nullableIsoDateSchema`.
- `studentSchema` расширен:
  - `birthday: string | null`;
  - `packageLessonPriceOverride: number | null`.
- `createStudentSchema` и `updateStudentSchema` расширены этими полями.
- Create/update validation допускает custom `packageMonths`, если указан `packageLessonPriceOverride`.
- Добавлены:
  - `lessonOccurrenceExceptionSchema`;
  - `deleteLessonQuerySchema`;
  - `calendarBlockSchema`;
  - `createCalendarBlockSchema`;
  - `updateCalendarBlockSchema`;
  - response schemas/types для calendar blocks.
- `/lessons` response расширен `occurrenceExceptions`.
- `/calendar` response расширен `blocks`.

Проверить позже typecheck: особенно refine для `updateStudentSchema`, чтобы PATCH без birthday не затирал поле в `null`.

### DB schema и migration

Файлы:

- `packages/db/src/schema.ts`
- `packages/db/drizzle/0012_calendar_blocks_privacy_plans.sql`
- `packages/db/drizzle/meta/_journal.json`

Сделано:

- `students`:
  - `birthday date`;
  - `package_lesson_price_override numeric(12,2)`.
- `lesson_occurrence_exceptions`:
  - `id`;
  - `teacher_id`;
  - `lesson_id`;
  - `occurrence_starts_at`;
  - `replacement_lesson_id`;
  - `reason`;
  - `created_at`;
  - unique `(teacher_id, lesson_id, occurrence_starts_at)`.
- `calendar_blocks`:
  - `id`;
  - `teacher_id`;
  - `title`;
  - `starts_at`;
  - `duration_minutes`;
  - `external_event_id`;
  - `external_calendar_id`;
  - `sync_status`;
  - `last_error`;
  - `created_at`;
  - `updated_at`.
- `lessonsRelations` дополнен `occurrenceExceptions`.
- `_journal.json` дополнен миграцией `0012_calendar_blocks_privacy_plans`.

Проверить позже:

- FK constraints в миграции на реальной базе;
- drizzle typecheck;
- что nullable composite FK для `replacement_lesson_id` не конфликтует.

### Student service

Файл: `apps/api/src/services/student-service.ts`

Сделано:

- `calculateStudentPackageTotal` принимает override.
- `mapStudentRow` мапит `birthday` и `packageLessonPriceOverride`.
- `toInsertValues` пишет новые поля и считает package total с override.
- `toUpdateValues` пишет новые поля и пересчитывает package count/total при изменениях override.

Проверить позже:

- update semantics: если `packageMonths` меняется без явного override, сервис должен брать уже сохраненный override из existing student.

### Memory store

Файл: `apps/api/src/services/memory-store.ts`

Сделано:

- `TeacherStoreState` расширен:
  - `calendarBlocks`;
  - `occurrenceExceptions`.
- Создание state и demo seed обновлены под новые поля темы.
- Student create/update учитывают:
  - `birthday`;
  - `packageLessonPriceOverride`;
  - package/monthly totals через override.
- `deleteLesson` чистит related occurrence exceptions.
- Добавлены methods:
  - `listLessonOccurrenceExceptions`;
  - `upsertLessonOccurrenceException`;
  - `listCalendarBlocks`;
  - `createCalendarBlock`;
  - `updateCalendarBlock`;
  - `deleteCalendarBlock`.
- Memory calendar block sync выставляет `syncStatus: "synced"` при подключенном календаре, иначе `not_synced`.
- `getTheme` / `saveTheme` клонируют `fontSizes`.

Проверить позже:

- import order;
- exact method signatures против интерфейсов service layer;
- tests.

### Lesson repository

Файл: `packages/db/src/lesson-repository.ts`

Сделано:

- импортирован `lessonOccurrenceExceptions`;
- добавлены types:
  - `LessonOccurrenceExceptionRow`;
  - `LessonOccurrenceExceptionUpsertValues`;
- добавлены functions:
  - `listLessonOccurrenceExceptionRows`;
  - `upsertLessonOccurrenceExceptionRow`.

Не сделано:

- DB repo для `calendar_blocks`.

## План продолжения

### Волна 1. Завершить DB/API backend

Цель: все новые contracts должны компилироваться и проходить API smoke.

Сделать:

- В `packages/db/src/calendar-repository.ts` добавить:
  - `CalendarBlockRow`;
  - `CalendarBlockInsertValues`;
  - `CalendarBlockUpdateValues`;
  - `listCalendarBlockRows(db, teacherId)`;
  - `insertCalendarBlockRow(db, values)`;
  - `updateCalendarBlockRow(db, teacherId, blockId, values)`;
  - `deleteCalendarBlockRow(db, teacherId, blockId)`.
- В `apps/api/src/services/billing-service.ts`:
  - добавить новые поля в local student mapping;
  - передавать `packageLessonPriceOverride` в package/monthly price helpers.
- В `apps/api/src/services/settings-service.ts`:
  - нормализовать старые saved theme JSON через deep merge defaults;
  - не сбрасывать всю тему, если нет новых fields.
- В `apps/api/src/services/lesson-service.ts`:
  - добавить `listOccurrenceExceptions`;
  - добавить `upsertOccurrenceException`;
  - замапить DB rows в `LessonOccurrenceException`.
- В `apps/api/src/services/lesson-workflow-service.ts`:
  - current-only update для weekly:
    - master не менять;
    - создать detached one-off lesson;
    - создать exception `reason: "moved"`;
    - вернуть detached lesson;
  - current-only delete для weekly:
    - создать exception `reason: "deleted"`;
    - скрывать occurrence из CRM render;
    - синхронизировать Google occurrence delete/cancel, если получится;
  - one-off delete:
    - удалить lesson;
    - удалить attendance/charges/sync;
  - series delete:
    - удалить master/series.
- В `apps/api/src/services/calendar-service.ts`:
  - добавить CRUD для `CalendarBlock`;
  - DB path должен писать row и пытаться sync в Google;
  - failure сохранять в `syncStatus: "failed"` и `lastError`;
  - Google payload для personal block должен быть opaque: title only, без student data.
- В `apps/api/src/routes/lessons.ts`:
  - `/lessons` response вернуть `occurrenceExceptions`;
  - `PATCH /lessons/:id` принять `occurrenceStartsAt` и `applyToFuture`;
  - `DELETE /lessons/:id` принять `scope=current|series` и `occurrenceStartsAt`.
- В `apps/api/src/routes/calendar.ts`:
  - добавить `GET /calendar/blocks`;
  - добавить `POST /calendar/blocks`;
  - добавить `PATCH /calendar/blocks/:id`;
  - добавить `DELETE /calendar/blocks/:id`.

Проверка после волны:

```bash
gitnexus detect_changes --scope all
yarn workspace @teacher-crm/api test
yarn typecheck
```

### Волна 2. Frontend data layer

Цель: приложение умеет получать и изменять новые backend сущности.

Сделать:

- В `apps/web/lib/crm/types.ts` добавить:
  - `calendarBlocks`;
  - `lessonOccurrenceExceptions`;
  - metadata для calendar event.
- В `apps/web/lib/crm/api.ts`:
  - `loadTeacherCrm` должен читать `occurrenceExceptions` и `calendar.blocks`;
  - добавить client methods для calendar blocks CRUD;
  - `deleteLesson` должен уметь отправлять scope/current occurrence params.
- В `apps/web/hooks/useTeacherCrmData.ts`:
  - добавить initial/cache fields;
  - не показывать skeleton при page switch, если есть stale data;
  - background refresh не должен очищать экран.
- В `apps/web/hooks/useTeacherCrmCommands.ts`:
  - добавить optimistic create/update/delete для calendar blocks;
  - добавить optimistic lesson delete;
  - добавить update lesson с `occurrenceStartsAt` и `applyToFuture`;
  - rollback при API error.
- В `apps/web/hooks/useTeacherCrm.ts`:
  - пробросить `calendarBlocks`;
  - пробросить commands.

Проверка:

```bash
yarn typecheck
```

### Волна 3. Calendar UI

Цель: UX календаря должен закрыть delete, personal blocks, availability mode, overlap и drag/drop.

Сделать:

- `LessonFormDialog`:
  - в edit mode добавить dangerous delete button;
  - для recurring спрашивать scope:
    - current occurrence;
    - all future / series;
  - delete должен вызывать backend и закрывать модалку только после успеха.
- `CalendarEvent` metadata:
  - `kind: "lesson" | "block" | "free"`;
  - `lessonId`;
  - `occurrenceIndex`;
  - `occurrenceStartsAt`;
  - `blockId`.
- Weekly render:
  - master lesson должен генерировать occurrences;
  - `occurrenceExceptions.reason === "deleted"` скрывает occurrence;
  - `occurrenceExceptions.replacementLessonId` скрывает master occurrence, detached lesson рендерится отдельно.
- `CalendarWeekView`:
  - overlap layout: пересекающиеся items раскладываются колонками;
  - события не перекрывают друг друга визуально;
  - в occupied slot остается add-hotspot для клика;
  - hover ячейки показывает время начала в левом верхнем углу.
- Personal block dialog:
  - fields: title/date/time/duration;
  - create/update/delete;
  - block отображается как занятый слот.
- Busy warning:
  - при добавлении урока в занятый слот показывать предупреждение;
  - не блокировать сохранение.
- Availability mode:
  - кнопка в header `/lessons`;
  - отображать только 10:00-21:00;
  - вне этого диапазона строки скрывать через `motion`;
  - busy lessons и personal blocks серые, полупрозрачные, без персональных данных;
  - free intervals объединять в зеленые blocks;
  - cancelled lessons не блокируют free time.
- Drag/drop:
  - подключить `@dnd-kit/core`, если dependency уже есть; если нет, добавить в root package;
  - шаг 15 минут;
  - при drop показывать modal:
    - apply current;
    - apply all future;
  - до подтверждения показывать local preview;
  - после подтверждения вызвать update lesson.

Проверка:

```bash
yarn typecheck
yarn lint
```

### Волна 4. Student и Billing UI

Цель: студент и оплаты работают с monthly/custom планами.

Сделать:

- `StudentFormDialog`:
  - добавить birthday через shadcn DatePicker;
  - убрать отдельный billing mode select;
  - в package block первый select:
    - `Per lesson`;
    - `Monthly`;
    - `3 months`;
    - `5 months`;
    - `+ custom`;
  - для monthly показывать:
    - lessons/week;
    - рассчитанную месячную оплату;
  - для custom показывать:
    - custom months;
    - custom lesson price;
  - сохранять `packageLessonPriceOverride`.
- Student display:
  - добавить badge `custom plan`, если `packageLessonPriceOverride !== null`.
- `PaymentFormDialog`:
  - default amount брать в порядке:
    - `nextPayment.amount`;
    - package total;
    - monthly total;
    - one-lesson duration price.
- Billing calculations:
  - monthly total = `lessons/week * 4 * lesson price * durationUnits`;
  - custom package price не меняет обычную цену разового урока.

Проверка:

```bash
yarn workspace @teacher-crm/api test
yarn typecheck
```

### Волна 5. Theme и Privacy

Цель: настройки темы не ломают старые saved JSON, reset/shuffle работают ожидаемо, privacy mode закрывает личные данные.

Сделать:

- `ThemeSettingsClient`:
  - reset должен возвращать draft к текущей сохраненной теме, не к `DEFAULT_CRM_THEME_SETTINGS`;
  - shuffle должен рандомизировать:
    - palette;
    - radius;
    - heading/body/number fonts;
    - font sizes;
    - surface/card colors.
  - добавить controls для font sizes рядом с выбором шрифтов;
  - добавить controls для card/surfaceMuted colors.
- Theme normalization:
  - старые saved themes без новых fields должны merge-иться с defaults;
  - не сбрасывать всю тему.
- `themeCssVariables`:
  - добавить CSS variables для `card`, `surfaceMuted`, font sizes.
- `apps/web/app/layout.tsx`:
  - inline hydration script должен выставлять новые CSS variables до paint;
  - не должно быть flash/mismatch.
- Privacy mode:
  - global provider/state в `localStorage`;
  - `Ctrl+H` toggles privacy mode;
  - блюрить:
    - `data-private`;
    - money totals;
    - names;
    - lesson titles;
    - notes;
    - inputs;
    - textareas;
    - select values.
  - добавить CSS class на `document.documentElement`, например `privacy-mode`.

Проверка:

```bash
yarn typecheck
yarn lint
```

### Волна 6. Финальные gates и ручная проверка

Запустить:

```bash
gitnexus detect_changes --scope all
yarn typecheck
yarn test
yarn lint
```

Потом через сайт проверить:

- создание weekly lesson;
- current-only перенос weekly occurrence;
- series перенос weekly lesson;
- delete current occurrence;
- delete series;
- personal block create/update/delete;
- free slot mode;
- overlap lessons in same time slot;
- student create/update birthday;
- monthly/custom package calculations;
- payment default amount;
- theme reset/shuffle/font sizes/card colors;
- `Ctrl+H` privacy mode на основных страницах.

## Риски и решения

### Weekly current-only Google sync

Риск: текущий sync может патчить master lesson или detached CRM lesson, а Google occurrence живет внутри recurring event.

Решение:

- локально всегда создавать `lesson_occurrence_exceptions`;
- detached replacement lesson рендерить как обычный one-off lesson;
- original master occurrence скрывать по exception;
- Google sync current-only должен работать с original recurring event id и `occurrenceStartsAt`, а не с detached lesson id;
- если Google sync падает, CRM state все равно должен быть консистентен, а row получает sync failure status/error.

### Custom package pricing

Риск: override случайно изменит обычную цену урока.

Решение:

- `defaultLessonPrice` не менять;
- override использовать только в:
  - package lesson price;
  - package total;
  - monthly total;
  - payment default amount для package/monthly.

### Theme migrations

Риск: старые saved JSON темы без новых полей сбросятся целиком.

Решение:

- normalization только deep merge defaults + saved values;
- неизвестные saved values не трогать без необходимости.

### Privacy mode

Риск: данные останутся видимыми в input/select или money totals.

Решение:

- использовать комбинацию `data-private` на известных местах и global CSS selectors для form controls;
- для value-like fields блюрить visual layer, не изменяя actual values.

## Текущий `git status`

На момент handoff изменены:

- `apps/api/src/app.test.ts`;
- `apps/api/src/services/memory-store.ts`;
- `apps/api/src/services/student-service.ts`;
- `packages/api-types/src/index.ts`;
- `packages/db/drizzle/meta/_journal.json`;
- `packages/db/src/lesson-repository.ts`;
- `packages/db/src/schema.ts`;
- `packages/db/drizzle/0012_calendar_blocks_privacy_plans.sql`.

Не запускались финальные gates после остановки.

## Команда для продолжения

Начать с проверки состояния:

```bash
git status --short
yarn workspace @teacher-crm/api test
```

Ожидаемо тесты могут падать до завершения backend routes/services. После первого падения продолжать с `packages/db/src/calendar-repository.ts` и API calendar/lesson services.
