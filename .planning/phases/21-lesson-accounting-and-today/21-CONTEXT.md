# Phase 21: Lesson Accounting and Today - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Учитель отмечает прошедшие уроки («проведён», «неявка») и исправляет отметки; остаток каждого ученика пересчитывается по одним правилам в `packages/core`; экран Today показывает счётчики, уроки дня и список «скоро платить». Требования: LEDG-03, LEDG-04, LEDG-05, LEDG-06, LEDG-07, LEDG-08, SHELL-05. В фазу также входят два UI-плана с правками дизайна фазы 20 (D-12) и четыре архитектурных решения (D-13..D-16).

Все 16 решений страницы `21-DISCUSS.html` приняты владельцем как предложено (рекомендованные варианты подтверждены явно ответом «kept as proposed»). Репозиторий публичный: данные учеников в git и документы не попадают.

</domain>

<decisions>
## Implementation Decisions

### Отметки уроков
- **D-01:** Отметка хранится отдельной таблицей `lesson_marks`: ключ вхождения = `series_id + original_on` либо `lesson_id` одиночного урока, `kind` = `done` | `no_show` | `none`, `updated_at`. Отмена и перенос остаются в расписании (`lesson_exceptions`, `lessons.status`), их схема не меняется. Исправление отметки меняет `kind` (в том числе на `none`), строки не удаляются (D-16 фазы 20). — **Reversibility:** one-way — таблица и ключ вхождения лягут в миграцию, их читают чат (фаза 22) и Google Calendar (фазы 24-25).
- **D-02:** Вычет считается при чтении по длительности вхождения (`occurrenceAt`), снимка минут нет: 60 минут = 1 урок, 90 = 1.5 (LEDG-03). Правка длительности и исправление отметки сразу меняют остаток на всех экранах (LEDG-06).
- **D-03:** Флаг `students.no_show_deducts boolean not null default true` — один на ученика (LEDG-04). Его выключение действует на все неявки ученика, прошлые тоже; остаток всегда функция текущих данных.
- **D-04:** Отметку можно ставить, когда урок уже начался (`starts_at <= now`); исправлять можно в любое время. Будущие уроки отметить нельзя.

### Что считается остатком
- **D-05:** Урок вычитается, если его дата по Вьетнаму (`SCHEDULE_TIME_ZONE`) строго позже `opening_balance_on` ученика — та же граница, что у оплат (D-09 фазы 19). Уроки в день открытия остатка и раньше не считаются; до ввода открывающего остатка остаток «не задан».
- **D-06:** Остаток может уйти ниже нуля; он показывается как долг («-1.5», «owes 1.5 lessons»), не обрезается нулём.
- **D-07:** Отмена или перенос отмеченного урока: отметка остаётся в `lesson_marks`, вычет за этот момент не считается (LEDG-05); при Restore вычет возвращается вместе с уроком. Отмена не блокируется отметкой.

### Today и «скоро платить»
- **D-08:** В «скоро платить» попадают активные ученики с остатком не больше N уроков, включая долг. Ученики с остатком «не задан» в список не входят (не равно нулю, D-09 фазы 19). Остаток в уроках = минуты / `default_lesson_minutes` ученика.
- **D-09:** Порог N хранится в базе на аккаунте учителя, меняется в Settings → General, по умолчанию 2 (LEDG-07). Чат фазы 22 читает те же данные. Таблицы настроек сегодня нет; место (колонка аккаунта или маленькая таблица) выбирает исследование.
- **D-10:** Счётчики Today: уроков сегодня, проведено, ждут отметки (прошедшие уроки без отметки), скоро платить.
- **D-11:** Отметки ставятся и исправляются в двух местах: быстрые кнопки в списке уроков Today и диалог урока в расписании; одна логика, два входа. Профиль ученика получит их в фазе 23.

### Дизайн фазы 20 и дизайн-запросы
- **D-12:** Правки дизайна фазы 20 (пункты 1-18 из памяти `phase21-design-followups`, артефакт v35) идут двумя UI-планами до работы с отметками: (1) пункты 1-11 — подсказки, None, TimePair, токены текста, гаттер, тулбар, баг обрезки времени, фэйды; (2) пункты 12-18 — протяжка создания урока, метки зон, TimeZonePicker, избранные зоны. Диалог урока получает кнопки отметок после этих планов. Исходник пунктов: `phase21-design-followups`, `~/dv-lab-design/` (версию брать из `VERSION`).
- **D-12a:** Дизайн-системе v35 нужны от Design dude: экран Today dv-lab (счётчики, уроки дня с быстрыми Done / No-show, «скоро платить»), кнопки отметок в LessonDialog и EventTooltip, настройка N, флаг «неявка вычитает» в карточке ученика, DueList без срока и суммы (LEDG-07 считает уроки). Запросы уходят сессии «Design dude» сразу; UI-планы ждут ответа.

### Архитектура (решения 21-ARCH-REVIEW.md)
- **D-13:** Находка 1 (в этой фазе): правило «что входит в остаток» переезжает в `packages/core`; SQL в `apps/api` отдаёт сырые строки (оплаты, отметки с длительностью), core решает; подпись формы `ledger-text.tsx` берёт правило из core. Отдельным планом до планов, которые трогают остаток.
- **D-14:** Находка 2 (в этой фазе): исход вхождения (запланирован, проведён, неявка, отменён, перенесён) определяет один владелец в core (на базе `occurrenceAt`); `rows.ts`, `changes.ts`, контракты и ветки web читают его, а не повторяют словарь.
- **D-15:** Находка 3 (в этой фазе): одна функция «сегодня» и границы даты в зоне Вьетнама вместо `localIsoDate` (зона браузера), `latestPaymentDate` (UTC) и `todayOf`.
- **D-16:** Находка 4 (в этой фазе, вместе с D-13): перевод минут в уроки и проверка порога N — функции core; клиент их не дублирует; `null` («не задан») отличается от нуля.
- Находка 5 (две одинаковые формулы минут): отложена, остаётся в 21-ARCH-REVIEW.md.

### Claude's Discretion
- Решения D-01..D-16 подтверждены владельцем явно, пунктов «по умолчанию, не просмотрено» нет.
- Имена колонок и таблицы настроек, формы API, раскладка Today и порядок планов выбирают исследование и планировщик в рамках решений выше; недостающий элемент дизайна запрашивается у «Design dude».

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Фаза и требования
- `.planning/ROADMAP.md` §Phase 21 — цель и пять критериев успеха.
- `.planning/REQUIREMENTS.md` — LEDG-03..08, SHELL-05.
- `.planning/STATE.md` — позиция и открытые пункты.
- `.planning/phases/21-lesson-accounting-and-today/21-DISCUSS.html` — страница вопросов (для людей).
- `.planning/phases/21-lesson-accounting-and-today/21-ARCH-REVIEW.md` — архитектурные находки (решения см. D-13..D-16).

### Прошлые решения
- `.planning/phases/19-student-cards-and-vault-import/19-CONTEXT.md` — D-01 (поля `students`), D-06, D-09 (остаток), D-10.
- `.planning/phases/20-schedule/20-CONTEXT.md` — D-01 (ключ вхождения), D-05, D-15, D-16 (ничего не удаляется), D-17 (`occurrenceAt`), D-19 (двойное время).
- `.planning/phases/19-student-cards-and-vault-import/19-ARCH-REVIEW.md`, `.planning/phases/20-schedule/20-ARCH-REVIEW.md` — отложенные находки, вернувшиеся сюда (19-#4, 20-#3).
- `.planning/phases/20-schedule/20-UI-SPEC.md`, `20-SUMMARY`-файлы — что собрано в расписании и где расходится с дизайном.

### Дизайн
- `~/dv-lab-design/VERSION` (сейчас v35), `~/dv-lab-design/project/principles.md`, `project/components/<Name>/README.md` и `preview.html`: WeekGrid, ScheduleToolbar, EventTooltip, LessonDialog, TimePair, TimeZonePicker, DueList, Stat, StudentHome/TeacherHome (Today), EmptyState, ReadError. Версию записать в план.
- Память `phase21-design-followups` — полный список правок дизайна фазы 20 (пункты 1-18), память `design-system-everywhere`, `scroll-fade-everywhere`.
- Нужного компонента или состояния нет в дизайн-системе: не придумывать, запрашивать у «Design dude» (D-12a).

### Код
- `packages/core/src/balance.ts`, `lessons.ts`, `schedule.ts` — правила остатка и вхождений.
- `packages/db/src/schema.ts` — `students`, `payments`, `lesson_series`, `lesson_exceptions`, `lessons`.
- `apps/api/src/cards/card-facts.ts`, `apps/api/src/schedule/{rows,changes}.ts`, `apps/api/src/routes/{students,payments,schedule}.ts`, `packages/contracts`.
- `apps/web/app/(app)/page.tsx` (Today-заглушка), `students/_components/students-screen.tsx`, `schedule/_components/{lesson-block,lesson-dialog}.tsx`, `components/app/ledger-text.tsx`.
- `AGENTS.md` — модули-владельцы и правило публичного репозитория.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `card-facts.ts::cardFacts` — единственный владелец производных фактов карточки (остаток, следующий урок); фаза расширяет его, а не создаёт новый.
- `core/schedule.ts::occurrenceAt`, `scheduleWindow`, `nextLessons`, `todayOf` — вхождения и «сегодня» по зоне Вьетнама.
- `core/lessons.ts` — `formatLessons`, `lessonsPhrase`, `creditedMinutes`; `core/balance.ts::balanceMinutes` (сегодня только сумма).
- `components/app` (PageHeader, EmptyLine, ReadError, StatusDot, ConfirmDialog), `components/ui` (Tabs, Table, Dialog, Popover, Select).

### Established Patterns
- Роли Postgres: приложение `dvlab_app` (без DELETE на данных расписания, см. миграцию `schedule_revoke_delete`), миграции `dvlab_migrator`; миграции только добавляют; код без комментариев; интерфейс на английском.
- Без новых юнит/интеграционных/e2e тестов (ограничение владельца с фазы 18): проверка скриптами, логами, SQL и браузером в обеих темах.
- Ошибка чтения экрана = один экран с ReadError.

### Integration Points
- `apps/web/app/(app)/page.tsx` — Today; sidebar и палитра уже есть.
- Фаза 22 читает остаток, порог N и отметки из тех же функций core; фазы 24-25 берут ключ вхождения для событий Google.

</code_context>

<specifics>
## Specific Ideas

- Today: четыре счётчика, под ними уроки дня с кнопками Done и No-show, ниже «скоро платить» с остатком в уроках («0.5 lessons left», «owes 1»).
- Отметка не заменяет отмену: «отменён» остаётся статусом расписания.

</specifics>

<deferred>
## Deferred Ideas

- Быстрые отметки и отмена из чата, ответы из данных — фаза 22.
- Профиль ученика с уроками и «Ask in chat», Today и расписание на телефоне — фаза 23.
- Синхронизация отметок с Google Calendar — фазы 24-25.
- Две одинаковые формулы минут (`creditedMinutes` и `lessonsToMinutes`) — находка 5, отложена.
- Начальные балансы владелец вводит сам после выката; импорт их не заполняет.

</deferred>

---

*Phase: 21-Lesson Accounting and Today*
*Context gathered: 2026-10-10*
