# Phase 23 — Plan index

## Outcome

Деньги, новые ученики, удаления и массовые переносы делаются из чата после явного подтверждения учителя, а чат, оплаты и ученики доступны в один шаг откуда угодно, включая телефон (ROADMAP, Phase 23 goal). Требования CHAT-05, CHAT-06, CHAT-10, CHAT-12, SHELL-03, SHELL-04, CARD-05; критерии SC1–SC5; решения D-01…D-09 и UD-01…UD-03 (`23-CONTEXT.md`); принятые ARCH-A1…A3 (`23-ARCH-REVIEW.md`); дизайн — `23-UI-SPEC.md` поверх текущего варианта A (v88 в `~/dv-lab-design`).

14 планов, 9 волн, 39 задач. Планы написаны 2026-10-14 заново по итоговому коду фазы 22 (ветка `gsd/phase-22-chat-replan`, HEAD `83cfb86`). Первый план — трассер: одна оплата проходит от инструмента модели до строки в `payments` и обратно в блок чата.

Оценки: `estimate-calibration` — factor 1, 0 samples, confidence low; `raw_tokens = tokens`.

## Исполнение

Внешних ожиданий нет: фаза 22 исполнена и в ветке (`chat_actions`, `CalendarCommands`, `runs.ts`, `tools.ts`, блоки чата), фазы 24 и 25.1 слиты. Человеческих checkpoint в планах нет. Живые проверки с ключом модели, Google на тестовом аккаунте и настоящим телефоном — сессия владельца после выполнения (раздел «Живые проверки владельца»), в планах они помечены NOT RUN.

## Волны

| Wave | Plan | Что строит | Слой | Model | Depends on |
| --- | --- | --- | --- | --- | --- |
| 1 | [23-01](23-01-PLAN.md) | Трассер: `propose_payment` → предложение в `chat_actions` → Record payment / Don't record → `insertPayment`; блок ChangeProposal; decline | db + contracts + api + web | opus | — |
| 2 | [23-02](23-02-PLAN.md) | Ревизии карточки и оплаты (ARCH-A1/A2), `PATCH /payments/:id` той же строкой, предложение держит ревизию | db + contracts + api | opus | 01 |
| 2 | [23-04](23-04-PLAN.md) | Палитра Actions → Students → Screens, New chat, Add payment через Today, Ask in chat | web | sonnet | 01 |
| 3 | [23-03](23-03-PLAN.md) | `inputTimeZone` команды `move_series` отдельно от пояса учителя (ARCH-A3) | contracts + db zod + api | opus | 02 (очередь) |
| 3 | [23-06](23-06-PLAN.md) | Обычные формы с ревизией, Edit payment, прибытие `payment=` | web | sonnet | 02, 04 |
| 4 | [23-05](23-05-PLAN.md) | Предложения: новый ученик, ставка, архив (и вместо удаления) | contracts + api | opus | 02, 03 |
| 4 | [23-08](23-08-PLAN.md) | Вкладка Lessons в профиле поверх чтения недели | web | sonnet | 06 |
| 5 | [23-07](23-07-PLAN.md) | Удаления: оплата, заметка или комментарий, конец серии; сохранённый Keep | contracts + api | opus | 05 |
| 6 | [23-09](23-09-PLAN.md) | Массовый перенос CHAT-06: пояс ввода, запечатанные цели, дочерние команды по одной | contracts + api | opus | 03, 07 |
| 6 | [23-10](23-10-PLAN.md) | Блоки всех локальных предложений, ссылки результата, конец серии и Keep в web | web | sonnet | 07, 08 |
| 7 | [23-11](23-11-PLAN.md) | Отзыв на эссе: `essay_feedback`, `/essay`, ход только для чтения | contracts + api | opus | 09 |
| 7 | [23-12](23-12-PLAN.md) | Телефонная ширина: измерение и точечные правки | web | sonnet | 10 |
| 8 | [23-13](23-13-PLAN.md) | Блоки массового переноса и эссе, команда `/essay` | web | sonnet | 09, 11, 12 |
| 9 | [23-14](23-14-PLAN.md) | Документы, `chat-final.mjs`, полный прогон качества, браузер, e2e | docs + gate | sonnet | 13 |

Правила волн:

- В волне не больше одного плана, который правит `apps/api`, и одного web-плана (общий typecheck, `dvlab_test`, `.next` и dev-сервер; EXECUTOR-RULES 7). Файлы планов одной волны не пересекаются (проверено скриптом). Зависимость 23-03 от 23-02 — только очередь api.
- Миграции: 23-01 (`chat_changes`, расширение `chat_actions_kind_ck`), 23-02 (`card_payment_revision`, колонки `revision`). Обе только через `yarn db:generate`, SQL не правится, применяются к `dvlab_test` и `dvlab_dev`. Других изменений схемы нет: 23-03 меняет только zod-схему плана команды.
- `yarn test` и `yarn build` запускает только 23-14; `yarn knip` до 23-14 может быть красным.
- Сборка web между волнами: планы api добавляют операции, состояния и имена инструментов в контракт раньше, чем web их рисует. Поэтому 23-01 делает ветки по умолчанию в `change-proposal.tsx` и `stepWords`; после 23-07 сборка web может быть красной из-за `end_series` в контракте календаря — первая задача 23-10 её восстанавливает (в волне 5 web-плана нет).
- У каждой задачи не больше пяти файлов, кроме трассера 23-01 Task 1 (девять: он проходит все слои; правки `messages.ts`, `tools.ts` и `runs.ts` в нём — тип действия, регистрация инструмента и ветка `blockNote`).

## Владельцы и контракты

| Что | Владелец | План |
| --- | --- | --- |
| Хранилище предложений поверх `chat_actions` (kind `change`, операция в `target`), общий порядок propose/confirm/decline/check | `apps/api/src/chat/changes.ts` | 23-01; диспетчер — 23-05, 23-07, 23-09 |
| Оплата: вставка исполнителем и исправление той же строкой | `apps/api/src/cards/payments.ts` (`insertPayment`, `updatePayment`) | 23-01, 23-02 |
| Ревизия карточки, узкая правка ставки | `apps/api/src/cards/cards.ts` (`setCardRate`, CAS) | 23-02 |
| Новый ученик, ставка, архив | `apps/api/src/chat/change-cards.ts` | 23-05 |
| Удаление оплаты, отзыв заметки и комментария, чтение оплат | `apps/api/src/chat/change-deletions.ts` | 23-07 |
| Конец серии из чата, сохранённый Keep | `apps/api/src/chat/calendar.ts` | 23-07 |
| Пояс ввода переноса серии | `packages/contracts/src/schedule.ts`, `apps/api/src/schedule/series.ts` | 23-03 |
| Разбор пояса из текста учителя (без названия — Вьетнам) | `apps/api/src/chat/command-zone.ts` | 23-09 |
| Массовый перенос и дочерние команды | `apps/api/src/chat/bulk-move.ts` | 23-09 |
| Отзыв на эссе, ход только для чтения | `apps/api/src/chat/essay.ts`, `tools.ts`, `runs.ts`, `publish-gate.ts` (`scores`) | 23-11 |
| `packages/contracts/src/chat.ts`: блок `change_proposal` и `chatActionResponse` | — | 23-01; варианты — 23-05, 23-07, 23-09; `end_series`, `declined` календаря — 23-07; блок `essay` — 23-11 |
| `packages/contracts/src/students.ts`: ревизии, `updateStudentRequest`, `updatePaymentRequest` | — | 23-02 |
| Блоки в web | `change-proposal.tsx` (23-01, 23-10), `calendar-proposal.tsx` (23-10), `bulk-move-proposal.tsx`, `essay-feedback.tsx` (23-13) | |
| Точки входа | `command-palette.tsx`, прибытия `/?dialog=payment`, `/chat?new=1&student=`, `/students/<id>?tab=lessons|payments&payment=` | 23-04, 23-06, 23-08 |

Владельцы фаз 22/24/25.1, которые планы используют без изменения поведения: `insertAction`, `replyOf`, `blocksOf`, `calendarView` (`chat/messages.ts`), `proposeCalendarChange` и `confirmCalendarChange` (`chat/calendar.ts`), `CalendarCommands.submitCalendarCommand` / `readCalendarCommand` (`calendar/commands.ts`), `findRequest` (`calendar/journal.ts`), `prepareSeriesChange`, `seriesAnchor` (`schedule/series.ts`), `cardFacts` (`cards/card-facts.ts`), `lockTeacherTimeContext` (`settings/settings.ts`), `retractStudentNote`, `retractLessonComment`, `createCard`, `archiveCard`, `readCalendarWindow` через `GET /schedule/week`, ход модели `createChat` и проверка публикации.

## Решения по своему усмотрению (обоснованы в планах)

- **Деньги и числа — только из текста учителя.** Инструменты получают `amount_text`, `lessons_text`, имя, пояс как они написаны; сервер проверяет, что текст есть в сообщении, и разбирает его кодом (`parseMoney`, `parseLessons`, `normalizeDisplayName`). Модель не передаёт минорные единицы (D-03, P2 RESEARCH).
- **Отказ без новой схемы состояний.** Decline — `state: refused` с `result.kind: declined`; новое значение CHECK только у `kind` (`change`). Keep предложений календаря фазы 22 теперь тоже сохраняется (23-07, 23-10).
- **Устаревшее предложение — «Ask again», без кнопки Refresh proposal**, как stale у ChatCalendarChange v69; остаток массового переноса — тоже новым сообщением. Отличие от P12/P19 23-UI-SPEC вынесено в DR-23-09.
- **Проверка публикации не меняется для денег:** сумма и уроки показываются только блоком (правило фазы 22), даты и имена из результата инструмента становятся данными хода через `learnWhen`/`learnNames`; единственная правка — признак `scores` для ходов эссе (23-11).
- **`expectedRevision` необязательна на проводе** для совместимости e2e-помощников и проверок фаз 19–22; формы web её посылают (23-06), чат проверяет всегда.
- **Что остаётся ссылкой `action_link`:** правка прочих полей профиля (`dialog=details`), словарь, настройки; `dialog=payment` — запасной путь, когда сумма написана не цифрами или учитель просит форму.
- **Add payment из палитры** открывает форму Today через `/?dialog=payment` (у Today есть свежий пояс), **New chat** — `/chat?new=1` без создания разговора до первой отправки (ChatPage: пустой New chat не сохраняется), **ученики палитры** — активные из `/students/options`.
- **Уроки профиля** читаются существующим `GET /schedule/week` с фильтром по ученику; строка ведёт в Schedule (`lessonHref`).
- **Массовый перенос** переносит серии ученика с совпадающим временем; одиночные уроки в это время не переносятся и показаны счётчиком (SC2 говорит о переносе серии).
- **Конец серии из чата:** `lastOn = max(from − 1, сегодня)`, потому что core `endSeriesAt` не принимает прошедший `lastOn`.
- **Удаление ученика навсегда не существует:** просьба удалить даёт предложение архива с P09; аккаунт не деактивируется (D-06).

## Запросы дизайна (Design dude; отправляет ведущая сессия; задачи не ждут)

UI строится по `23-UI-SPEC.md` и по форме ChatCalendarChange; пришедший ответ исполнитель применяет и записывает версию в SUMMARY.

1. **DR-23-01 (23-01).** ChangeCard в стиле ChatCalendarChange для оплаты: строки Amount, Payment date, Lesson credit, Balance сейчас → после, Comment; состояния proposed, applying, applied со ссылкой Edit payment, declined, stale, failed.
2. **DR-23-02 (23-10).** Варианты для нового ученика, ставки, архива (с P09 при просьбе удалить), удаления оплаты, удаления заметки и комментария; тексты ссылок «View notes», «View lesson»; подписи шагов новых инструментов.
3. **DR-23-03 (23-10).** Вариант конца серии в ChatCalendarChange (End series / Keep series).
4. **DR-23-04 (23-06).** Режим Edit payment у PaymentDialog, кнопка Edit в строке оплаты, баннер конфликта P22 в PaymentDialog и StudentForm.
5. **DR-23-05 (23-04).** Строки учеников палитры без `@handle`, порядок групп с действиями темы и Sign out, место кнопки Ask in chat в шапке профиля.
6. **DR-23-06 (23-08).** Вкладка Lessons: LessonList с переходом по неделям, Upcoming и History, строка неполного чтения; порядок вкладок UD4.
7. **DR-23-07 (23-13).** Многосерийный перенос: цели, строки поясов (P17), частичный итог (P16), раскрытие списка.
8. **DR-23-08 (23-13).** Блок отзыва на эссе без полос (WritingGradeCard и CriteriaCard числовые и для фазы 26) и строка `/essay` в списке команд (семь строк).
9. **DR-23-09 (23-01, 23-10, 23-13).** Устаревшее предложение и остаток переноса — «Ask again» без кнопок Refresh proposal и Review remaining lessons.

## Проверки (без Google и Anthropic, только локально)

| Скрипт | Разделы | Строки успеха | Где |
| --- | --- | --- | --- |
| `scripts/dev-checks/chat-changes.mjs` (новый) | `payment`, `cards`, `deletions`, `essay` | `CHAT_CHANGES_*_OK` | `dvlab_test`, api в процессе на 4241, заглушка провайдера со сценариями |
| `scripts/dev-checks/cards-revision.mjs` (новый) | — | `CARDS_REVISION_OK` | `dvlab_test`, 4242 |
| `scripts/dev-checks/chat-bulk.mjs` (новый) | `zone`, `proposal`, `children` | `CHAT_BULK_*_OK` | `dvlab_test`, под `calendar-offline.mjs`, заглушка шлюза Google |
| `scripts/dev-checks/chat-calendar.mjs` (через `chat-api.mjs calendar`) | конец серии, Keep | `CHAT_CALENDAR_OK` | `dvlab_test` |
| `scripts/dev-checks/changes-web.mjs` (новый) | `payment`, `proposals`, `bulk`, `essay` (свой api с фейком модели на свободном 4000 и `next dev` на 3000); `forms` (обычный dev-стек) | `CHANGES_WEB_*_OK` | `dvlab_dev`, обе темы |
| `scripts/dev-checks/entry-web.mjs` (новый) | `palette`, `ask`, `lessons` | `ENTRY_WEB_*_OK` | dev-стек, `dvlab_dev`, обе темы |
| `scripts/dev-checks/phone-web.mjs` (новый) | `today`, `schedule`, `chat`, `profile`, `palette` | `PHONE_WEB_*_OK` | dev-стек, 375 и 320 px, обе темы |
| `scripts/dev-checks/chat-final.mjs` | всё api фаз 22 и 23 | `CHAT_FINAL_OK` | 23-14 |

- Dev-стек: `yarn workspace @dv-lab/api dev` и `yarn workspace @dv-lab/web dev` в фоне, затем `node scripts/dev-checks/wait-dev.mjs up`; после — остановить и `wait-dev.mjs down`. Разделы с фейком модели поднимают свой api, поэтому для них запускается только web.
- Фикстуры — вымышленные карточки `Alex Example 23NN` (диапазоны по планам: 01 — 2301–2306, 02 — 2310–2315, 04 — 2330–2333, 05 — 2340–2347, 06 — 2360, 07 — 2350–2356, 08 — 2370–2371, 09 — 2380–2385, 10 — 2390–2394, 11 — 2395, 12 — 2396–2399, 13 — 2388); скрипты их удаляют. Реальные данные учеников не используются.
- Маркеры фейка модели `[fake:payment]`, `[fake:card]`, `[fake:rate]`, `[fake:archive]`, `[fake:delete-student]`, `[fake:payments]`, `[fake:remove-note]`, `[fake:end]`, `[fake:bulk]`, `[fake:essay]` добавляются в `chat-fake-anthropic.mjs` теми планами, которым нужны.
- Новых юнит-, интеграционных и e2e-тестов нет; существующие e2e прогоняет 23-14.

## Живые проверки владельца (NOT RUN в планах)

- Настоящая модель с ключом владельца: оплата, новый ученик, ставка, удаление и массовый перенос из живого текста (русский и английский), отзыв на эссе; сверка расхода по `usage`.
- Запись в Google на тестовом аккаунте владельца: конец серии и массовый перенос с MSK и без пояса, частичный итог при изменении события в Google.
- Экранная клавиатура настоящего телефона в чате (Send и кнопки решения видны).
- Выкатка — Server guy: миграции `chat_changes` и `card_payment_revision`, новых переменных окружения нет.

## Source coverage audit

### GOAL

| Item | Plans | Status |
| --- | --- | --- |
| Деньги, ученики, удаления и массовые переносы из чата после подтверждения | 01, 02, 05, 07, 09, 10, 13 | COVERED |
| Чат, оплаты и ученики в один шаг, включая телефон | 04, 06, 08, 12 | COVERED |

### REQ

| ID | Plans | Status |
| --- | --- | --- |
| CHAT-05 оплаты, новый ученик, удаления, ставки — с подтверждением | 01, 02, 05, 07, 10, 14 | COVERED |
| CHAT-06 массовый перенос, Вьетнам без пояса, подтверждение | 03, 09, 13, 14 | COVERED |
| CHAT-10 эссе с пометкой приблизительной оценки | 11, 13, 14 | COVERED |
| CHAT-12 исправление теми же формами и функциями | 01, 02, 06, 10, 14 | COVERED |
| SHELL-03 Today, Schedule, Chat на телефоне | 12, 14 | COVERED |
| SHELL-04 палитра: ученики, New chat, Add payment | 04, 14 | COVERED |
| CARD-05 профиль: оплаты, уроки, Ask in chat | 04, 08, 14 | COVERED |

### ROADMAP success criteria

| SC | Plans |
| --- | --- |
| 1 оплата, новый ученик, удаление, ставка — превью и подтверждение, отказ без изменений | 01, 02, 05, 07, 10 |
| 2 перенос серий в MSK и во вьетнамском времени без пояса, после подтверждения | 03, 09, 13 |
| 3 изменение из чата открывается и исправляется формами, один остаток и расписание | 01, 02, 06, 10 |
| 4 эссе с пометкой приблизительной оценки | 11, 13 |
| 5 палитра, профиль, телефон | 04, 06, 08, 12 |

### CONTEXT

| ID | Plans | Status |
| --- | --- | --- |
| D-01 порядок 24 → 25 → 22 → 23 → 26, привязка к итоговому коду | 01 (и весь набор) | COVERED |
| D-02 предложение не изменение, решение по текущему предложению, отказ без изменений | 01, 05, 07, 09, 10, 11 | COVERED |
| D-03 те же владельцы домена, деньги считает код | 01, 02, 04, 05, 06, 08, 10 | COVERED |
| D-04 Вьетнам без пояса, названный пояс управляет | 03, 09, 13 | COVERED |
| D-05 Google только через журнал команд, Saved после подтверждения | 03, 07, 09, 13 | COVERED |
| D-06 история, отметки, id сохраняются; удаления только поддержанные | 01, 02, 05, 06, 07, 09 | COVERED |
| D-07 эссе — приблизительная оценка тем же провайдером и бюджетом, без фазы 26 | 11, 13 | COVERED |
| D-08 Base UI, вариант A, английский текст, проверка в браузере | 04, 06, 08, 10, 12, 13 | COVERED |
| D-09 автономная работа, недоступное — NOT RUN | 14, раздел живых проверок | COVERED |
| UD-01 хранилище фазы 22, повтор без эффекта | 01, 09 | COVERED |
| UD-02 изменившаяся цель — новое предложение | 05, 06, 10 | COVERED |
| UD-03 существующие формы и палитра | 04, 08 | COVERED |

Deferred (CONTEXT): экзамены IELTS фазы 26, оценка качества модели, новые календари и инфраструктура, физическое удаление расписания и истории, несвязанный редизайн — ни в одном плане.

### ARCH

| ID | Plans |
| --- | --- |
| ARCH-A1 исправление той же оплаты, вставка исполнителем в общей транзакции | 01, 02, 06, 07 |
| ARCH-A2 числовая ревизия карточки, узкая ставка, CAS полной формы | 02, 05, 06 |
| ARCH-A3 пояс ввода отдельно от проверки пояса учителя | 03, 09 |

### RESEARCH и UI-SPEC

| Item | Plans | Status |
| --- | --- | --- |
| F01 жизненный цикл предложения | 01, 07, 09 | COVERED |
| F02 точность денег и ставок | 01, 02, 05 | COVERED |
| F03 граница архива и удаления | 05, 07 | COVERED |
| F04 пояс и цели массового переноса, частичный итог Google | 03, 09, 13 | COVERED |
| F05 исправление формами и параллельные правки | 02, 06, 10 | COVERED |
| F06 эссе и бюджет | 11, 13 | COVERED |
| F07 палитра, профиль, телефон | 04, 08, 12 | COVERED |
| F08 полномочия учителя, недоверенный текст | 01, 05, 07, 09, 11 | COVERED |
| F09 точные сигнатуры и записи | все планы (пути и функции привязаны к коду) | COVERED |
| F10 публичная проверка | ЗАМЕНЕНО решением владельца: скрипты `scripts/dev-checks` и браузер, существующие e2e в 23-14 | COVERED |
| P1–P7 RESEARCH | 01–13 | COVERED |
| 23-UI-SPEC §5–§12, P01–P32 | 01, 04, 06, 08, 10, 12, 13; отличия — DR-23-09 | COVERED |

### Перенесённые предикаты: 47 краевых и 69 UI

Каждый предикат — отдельная строка `must_haves.truths` с меткой; тексты переписаны под текущий код.

| Plan | Краевые | UI |
| --- | --- | --- |
| 23-01 | CHAT-05/boundary, empty, encoding, ordering, idempotency | PROPOSAL/empty, loading, error, populated, zero-one-many |
| 23-02 | CHAT-05/concurrency; CHAT-12/idempotency, concurrency | — |
| 23-03 | CHAT-06/encoding, precision | — |
| 23-04 | SHELL-04/adjacency, empty, encoding, ordering, idempotency, concurrency; CARD-05/encoding, idempotency | PALETTE (все 8) |
| 23-05 | CHAT-05/precision | — |
| 23-06 | CHAT-12/adjacency, ordering | FORMS (все 5) |
| 23-07 | CHAT-05/adjacency | — |
| 23-08 | CARD-05/adjacency, empty, ordering, concurrency | PROFILE (все 8) |
| 23-09 | CHAT-06/boundary, adjacency, empty, ordering, idempotency, concurrency | — |
| 23-10 | CHAT-12/empty, encoding | PREVIEWS (все 8), RECEIPT (все 8), PROPOSAL/overflow, long-text |
| 23-11 | CHAT-10 (все 6) | — |
| 23-12 | SHELL-03 (все 7) | PHONE (все 8) |
| 23-13 | — | BULK (все 8), ESSAY (все 8), PROPOSAL/partial |

Итого: краевые 8 + 8 + 6 + 6 + 7 + 6 + 6 = 47; UI 8 + 8 + 8 + 5 + 8 + 8 + 8 + 8 + 8 = 69.

## Что изменилось по сравнению с версией 12 октября

- Планы привязаны к итоговому коду фазы 22. Вместо предложенных тогда таблиц `chat_proposals`, `chat_proposal_targets`, `chat_proposal_commands` и модулей `proposals.ts`, `decisions.ts`, `proposal-store.ts`, `money-intents.ts`, `card-intents.ts`, `bulk-plan.ts`, `bulk-commands.ts` — существующие `chat_actions` (kind `change`) и модули `changes.ts`, `change-cards.ts`, `change-deletions.ts`, `bulk-move.ts`, `command-zone.ts`, `essay.ts`.
- Нет ожиданий «final22/24/25 rebind» и человеческих checkpoint: всё, что можно, проверяется локально; живые проверки перечислены отдельно.
- Новых e2e-тестов нет (вместо предложенного тогда e2e-файла чата и сценариев E01–E11 — разделы скриптов `scripts/dev-checks`), по директиве владельца.
- Диалога `move-series-dialog.tsx` больше нет (25.1); перенос серии из чата и массовый перенос идут через журнал команд, пояс ввода — полем `inputTimeZone`.
- Список дней Schedule на телефоне уже есть (`CalendarAgenda` в `week-grid.tsx`); `schedule-agenda.tsx` не создаётся, SHELL-03 — измерение и правки.
- Keep у предложений календаря фазы 22 был только состоянием браузера; теперь сохраняется.
- Действия без инструмента по-прежнему дают `action_link`; оплата, новый ученик, ставка, архив и удаления стали предложениями, ссылка — запасной путь.
- Тексты планов — обычным языком, без кодовых сокращений; 15 планов и 15 волн заменены 14 планами и 9 волнами.
- Идентификаторы угроз начинаются заново: T-23-01…T-23-47 (старые id удалены вместе с прежними планами); `T-23-SC` в каждом плане.
- `23-PATTERNS.md`, `23-PLAN-CHECK.md` и `23-SQUAD-REVIEW.md` относятся к версии 12 октября и будут заменены новой проверкой планов.

## Artifacts this phase produces

- Миграции `<timestamp>_chat_changes` и `<timestamp>_card_payment_revision`.
- api: `chat/changes.ts`, `chat/change-cards.ts`, `chat/change-deletions.ts`, `chat/command-zone.ts`, `chat/bulk-move.ts`, `chat/essay.ts`; `insertPayment`, `updatePayment`, `setCardRate`; `PATCH /payments/:id`; `POST /chat/actions/:id/decline`; диспетчеры confirm и check; инструменты `propose_payment`, `propose_student`, `propose_rate`, `propose_archive`, `student_payments`, `propose_payment_delete`, `propose_entry_removal`, `propose_bulk_move`, `essay_feedback`; команда `/essay`.
- contracts: блоки `change_proposal` и `essay`, `chatActionResponse`, ревизии и запросы правки, `inputTimeZone`, `end_series` и `declined` календаря.
- web: `change-proposal.tsx`, `bulk-move-proposal.tsx`, `essay-feedback.tsx`, `lessons-tab.tsx`; палитра, Edit payment, ревизии в формах, Ask in chat, прибытия по адресу, правки телефонной ширины.
- Проверки: `chat-changes.mjs`, `cards-revision.mjs`, `chat-bulk.mjs`, `changes-web.mjs`, `entry-web.mjs`, `phone-web.mjs`; `chat-final.mjs` с фазой 23.
- Документы: строки AGENTS.md, README проверок, privacy, RUNBOOK.

## Verification of this planning set

- `node ~/.claude/gsd-core/bin/gsd-tools.cjs query frontmatter.validate <PLAN> --schema plan` — 14/14 valid.
- `node ~/.claude/gsd-core/bin/gsd-tools.cjs query verify.plan-structure <PLAN>` — 14/14 valid, без ошибок и предупреждений, 39 задач.
- Скрипт сверки (вне репозитория): волна = 1 + max(волн зависимостей); пересечений файлов в волне нет; в волне не больше одного плана api и одного web; файлы задач входят в `files_modified` и наоборот; все пути есть в `git ls-files` или помечены новыми и создаются раньше, чем используются; у каждого `<automated>` есть `<fails_when>`; угрозы T-23-01…T-23-47 уникальны, `T-23-SC` в каждом плане; меток краевых предикатов 47, UI — 69, дублей нет.

## Handoff

Список планов фазы 23 в ROADMAP обновлён планировщиком; коммит и STATE — ведущая сессия; сквад ревью и html-страница плана — по рецепту фазы. Исходный код не менялся.
