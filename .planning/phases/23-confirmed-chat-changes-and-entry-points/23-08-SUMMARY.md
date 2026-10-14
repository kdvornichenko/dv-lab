---
phase: 23-confirmed-chat-changes-and-entry-points
plan: '08'
subsystem: ui
tags: [web, profile, lessons, schedule, entry-points]

requires:
  - phase: 23-confirmed-chat-changes-and-entry-points
    provides: 'Ask in chat и Edit payment в профиле (23-04, 23-06), ссылка lessonHref и прибытие ScheduleArrival (23-01), контракт googleScheduleWindow'
provides:
  - 'вкладка Lessons профиля ученика: неделя учителя, Upcoming lessons и History, переход по неделям, строка ведёт в Schedule'
  - 'порядок вкладок профиля Overview, Lessons, Payments, Notes, Vocabulary и прибытие ?tab=lessons'
  - 'раздел lessons в scripts/dev-checks/entry-web.mjs и определение origin dev-api в entry-web.mjs'
affects: [23-14]

actuals:
  tokens: 21000
  tasks: 2
  commits: 2
plan_head_before: ee8ee85e59bc43738a2649452698fe274cd5046d
plan_head_after: 8e6ca24e0403bc6d4bcbb905fe8ab4830ea8a8ef

tech-stack:
  added: []
  patterns:
    - 'Профиль читает неделю тем же GET /schedule/week?start=, что Schedule, разбирает googleScheduleWindow и фильтрует calendarLesson по binding.studentId и дню в основном поясе'
    - 'Неделя и перечитывание независимы: версия чтения растёт от refreshKey и кнопки Refresh records, выбранная неделя и данные остаются'

key-files:
  created:
    - apps/web/app/(app)/students/[id]/_components/lessons-tab.tsx
  modified:
    - apps/web/app/(app)/students/[id]/_components/student-profile.tsx
    - apps/web/app/(app)/students/[id]/_components/profile-arrival.ts
    - apps/web/app/(app)/students/[id]/_components/profile-loading.tsx
    - scripts/dev-checks/entry-web.mjs

key-decisions:
  - 'Панель недели — готовый ScheduleBar Schedule (Today, Previous week, выбор недели, Next week) без клавиатурных сокращений, а не новая пара кнопок «This week» и «Week of …»: так требует README StudentProfile v90'
  - 'Строка урока — ссылка lessonHref на Schedule: правка и перенос идут обычными диалогами Schedule, второго диалога урока в профиле нет'

requirements-completed: [CARD-05]

status: complete
---

# Фаза 23, план 08: уроки в профиле ученика — итоги

**Профиль показывает уроки ученика за неделю учителя тем же чтением, что Schedule: Upcoming lessons и History, честное состояние чтения вместо пустоты, строка открывает урок в Schedule.**

## Что сделано

- `lessons-tab.tsx`: чтение `GET /schedule/week?start=<понедельник>` с разбором `googleScheduleWindow` (устаревший ответ отбрасывается очисткой эффекта), фильтр `calendarLesson` по `binding.studentId` и дню недели в основном поясе; внешние события и уроки других учеников не попадают в список. Upcoming (по возрастанию, ближайший не отменённый выделен) и History (новые сверху) стоят двумя панелями рядом от 1024 px и столбцом ниже. Строка: дата, `TimePair` (основной пояс и второй мелко), слово Done, No-show или Cancelled; Done и No-show приглушены, у отменённого перечёркнуто время; accessible name содержит дату, время обоих поясов и состояние. Состояния: загрузка — скелетон строк при настоящей панели недели и заголовках; ошибка — `ReadError` с Refresh внутри вкладки; чтение не `fresh` — предупреждение «The full lesson range has not been checked. Refresh before making changes.» с кнопкой Refresh records над строками, которые есть (пустые панели при неполном чтении не рисуются, «No lessons» не показывается); свежее пустое — «No lessons in this range» и «Choose another week to view lessons.».
- `student-profile.tsx`: порядок Overview, Lessons, Payments, Notes, Vocabulary; `LessonsTab` получает `refreshKey`, который растёт после каждого успешного перечитывания профиля, при событии `API_CACHE_INVALIDATED` (изменение этой вкладки, чат) и при сообщении `DATA_CHANGED_CHANNEL` (другая вкладка браузера). Выбранные неделя и вкладка и черновики заметок не сбрасываются.
- `profile-arrival.ts` и `profile-loading.tsx`: `lessons` в `PROFILE_TABS`, подписи вкладок скелетона в том же порядке.
- `entry-web.mjs`: раздел `lessons` и `detectApiOrigin` (см. отклонения).

## Коммиты

1. `cf22eef` — вкладка Lessons поверх чтения недели
2. `8e6ca24` — подключение в профиль, порядок вкладок, прибытие, раздел `lessons`

## Проверки

- `yarn workspace @dv-lab/web typecheck` — 0, `yarn workspace @dv-lab/web lint` — 0, `prettier --check` по файлам плана — чисто.
- `node scripts/dev-checks/entry-web.mjs lessons light` и `lessons dark` — `ENTRY_WEB_LESSONS_OK` (25 проверок в каждой теме): порядок вкладок, `?tab=lessons`, настоящее чтение dev-стека, неполное чтение (unavailable и last_known) даёт предупреждение без «No lessons» и без строк, свежее чтение с синтетическим окном (уроки двух карточек, внешнее событие, прошедший Done, будущий и отменённый): три строки только этой карточки, Upcoming по порядку, History с Done, Cancelled со словом и перечёркнутым временем, accessible name, параметр `start` у Next, Previous и Today, подпись недели меняется, свежий пустой ответ даёт «No lessons in this range» и «Choose another week to view lessons.», клик по строке даёт `/schedule?week=…&lesson=single:…`, 500 даёт ReadError с шапкой и вкладками на месте и Refresh перечитывает, ширина 390 без горизонтальной прокрутки страницы, консоль без неожиданных ошибок. Скриншоты `entry-lessons-*` в `STATE_DIR` просмотрены: populated (светлая), partial (тёмная), phone (тёмная).
- `node scripts/dev-checks/entry-web.mjs ask light` — `ENTRY_WEB_ASK_OK` (после правки `startApi`).
- `git diff --stat apps/api` пуст; новых маршрутов api нет.
- Проверки шли против dev-стека владельца на 3000 и 4000, процессы не запускались и не останавливались. Фикстуры `Alex Example 2370` и `2371` скрипт убирает сам.

## Не запускалось

- `node scripts/dev-checks/wait-dev.mjs down`: acceptance-пункт не применим, задание запрещает останавливать dev-серверы владельца.
- Настоящее чтение недели с уроками (не синтетическое) в браузере: в `dvlab_dev` у карточки-фикстуры уроков нет, чтение недели вернуло `fresh` без событий; данные недели с уроками, отметками и отменой проверены ответом `page.route`, форма ответа проходит строгую схему `googleScheduleWindow`.
- Слово «Moved from / Moved to» из README StudentProfile: окно недели не содержит исхода «перенесён», у события есть только `status` и `mark`, поэтому слова нет. Решение за дизайном и api.
- Выбор недели из календаря (Popover) в браузере не нажимался: он идёт из готового `ScheduleBar`, проверены Today, Previous и Next.
- `yarn test`, `yarn build`, `yarn knip`, `db:*` — запрещены заданием.

## Отклонения от плана

**1. [Правило 3] Панель недели из дизайна и Schedule вместо кнопок плана**
- План называл «Previous week, This week, Next week и подпись Week of {date}». README StudentProfile (v90) и 23-UI-SPEC требуют собственные элементы недели Schedule: Today, Previous week, кнопка недели с выбором, Next week. Взят экспортированный `ScheduleBar` с `heading={false}`, `summary={null}`; клавиатурные сокращения Schedule (`useScheduleKeys`) не подключены, чтобы клавиши `j`, `k`, `t` не перехватывались на профиле.

**2. [Правило 3] Настоящее чтение dev-стека не `unavailable`**
- План исходил из того, что в `dvlab_dev` нет подключения Google и чтение недели всегда `unavailable`. Реально api вернул `fresh` без событий. Проверка настоящего пути принимает оба исхода (fresh и пусто — «No lessons», иное — предупреждение); путь «не прочитано» проверяется синтетическими ответами `unavailable` и `last_known`.

**3. [Правило 3] `entry-web.mjs`: определение origin dev-api**
- 23-06 отметил, что `entry-web.mjs` всегда берёт `APP_ORIGIN` из `.env` и получает 403, если api владельца перезапущен с `APP_ORIGIN`, равным адресу web. В `startApi` теперь `detectApiOrigin` (безобидный вход с заведомо неверным логином, берётся адрес без `forbidden_origin`), как в разделе `forms` из 23-06. Разделы `palette` и `ask` работают с любым вариантом.

**4. [Правило 1] Обновление профиля поднимает версию чтения в обёртке, а не в `reload`**
- Вызов `setLessonsVersion` внутри `reload` вызывал ошибку `react-hooks/set-state-in-effect` в эффекте первого чтения. Добавлена обёртка `refresh` (читает профиль и поднимает версию вкладки) для всех вызовов, кроме эффекта первого чтения.

**5. [Правило 3] Мелкое: пустые панели при неполном чтении не рисуются**
- Дизайн не задаёт вид пустой панели при неполном чтении; чтобы не писать «No lessons in this range» о непроверенном диапазоне, при чтении не `fresh` показываются только панели со строками.

## Для следующих планов

- 23-14: в `scripts/dev-checks/README.md` строка `entry-web.mjs` не знает раздела `lessons`: `entry-web.mjs lessons light|dark`, нужен dev-стек на 3000 и 4000, карточки `Alex Example 2370` и `2371`, печатает `ENTRY_WEB_LESSONS_OK`; origin dev-api определяется пробой, как в `changes-web.mjs forms`.
- `LessonsTab` принимает `student`, `mainTimeZone`, `asOf`, `refreshKey`; `ScheduleBar` из `schedule/_components/schedule-toolbar.tsx` теперь используется и вне Schedule (профиль), его пропсы менять с учётом этого.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности: вкладка читает уже существующий `GET /schedule/week` под ролью учителя; ссылка строится `lessonHref` из `binding.ref` ответа (T-23-28), строки только этого ученика по id (T-23-27); ничего не устанавливалось (T-23-SC).

## Self-Check: PASSED

- Файлы: `lessons-tab.tsx`, `student-profile.tsx`, `profile-arrival.ts`, `profile-loading.tsx`, `scripts/dev-checks/entry-web.mjs` на месте.
- Коммиты `cf22eef`, `8e6ca24` — в истории ветки.
