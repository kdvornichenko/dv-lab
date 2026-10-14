---
phase: 23-confirmed-chat-changes-and-entry-points
plan: '13'
subsystem: web
status: complete
tags: [chat, web, bulk-move, essay, check-status, approximate-label]

requires:
  - phase: 23-confirmed-chat-changes-and-entry-points
    provides: 'операция bulk_move, состояния pending и partial, POST /chat/actions/:id/check (23-09); ChangeProposal с bulk_move = null и подписи шагов (23-10); блок essay и команда /essay (23-11); hit-slop и проверка узкого экрана (23-12)'
provides:
  - 'BulkMoveProposal: блок массового переноса со всеми целями, поясами, состояниями целей, автопроверкой статуса и честным частичным итогом'
  - 'EssayFeedback: заголовок «Essay feedback» и фиксированная подпись приблизительной оценки над текстом отзыва, исходы streaming, complete, incomplete, unavailable'
  - 'checkAction в use-chat.ts: проверка статуса для календаря и для change_proposal (bulk_move), обновление расписания при applied и partial'
  - 'команда /essay в списке команд и подсказке «/»; строка «too long» под полем композера'
  - 'разделы bulk и essay в scripts/dev-checks/changes-web.mjs, маркер [fake:bulk]'
affects: [23-14]

tech-stack:
  added: []
  patterns:
    - 'Блок change_proposal с операцией bulk_move выбирается type guard isBulkMove в messages.tsx; остальные операции идут в ChangeProposal'
    - 'Общие части блоков календаря (Spinner, Header, Caption, Place, useAutoCheck, ISSUE_LINES) экспортированы из calendar-proposal.tsx и используются блоком массового переноса'

key-files:
  created:
    - 'apps/web/app/(app)/chat/_components/bulk-move-proposal.tsx'
    - 'apps/web/app/(app)/chat/_components/essay-feedback.tsx'
  modified:
    - 'apps/web/app/(app)/chat/_components/messages.tsx'
    - 'apps/web/app/(app)/chat/_components/use-chat.ts'
    - 'apps/web/app/(app)/chat/_components/chat-progress.tsx'
    - 'apps/web/app/(app)/chat/_components/composer.tsx'
    - 'apps/web/app/(app)/chat/_components/calendar-proposal.tsx'
    - 'apps/web/app/(app)/chat/_components/chat-screen.tsx'
    - scripts/dev-checks/chat-fake-anthropic.mjs
    - scripts/dev-checks/changes-web.mjs

key-decisions:
  - 'Тексты и раскладка блока по дизайну v90 (ChatBulkMove, ChatEssayFeedback), а не по наброску плана: строки Input time zone, Display time zone, From, Moves, у каждой цели «Series zone … · New rule zone …» и «And future occurrences»; кнопка раскрытия показывает первые три цели; busy-текст «Moving lessons…»'
  - 'Часть Moves считает только то, что есть в контракте: «{n} planned changes: {n} weekly series»; одиночных уроков как целей в контракте нет, singlesLeft показывается предложением «{n} single lessons at this time are not moved.»'
  - 'P16 считает по targets: подтверждено = applied, неподтверждено = pending + failed, не начато = not_started; «Lessons moved.» только при state applied; частичный итог только при state partial или failed с подтверждённым префиксом'
  - 'Отзыв на эссе рисуется внутри Panel вместе с текстом ответа (текст — дочерний элемент EssayFeedback), подпись выше текста по DOM; блок essay исключён из общего списка блоков'
  - 'Исход эссе: stopped или interrupted — incomplete; refused или withheld без текста — unavailable, с текстом — incomplete; пустой ответ без блоков отказа — unavailable; пока ответ идёт — без строки исхода'
  - 'Строка P25 «This essay is too long…» стоит под полем (по дизайну и как остальные заметки композера), а не над; длина считается кодовыми точками как chatMessageText (Array.from), порог CHAT_MESSAGE_MAX'

requirements-completed: [CHAT-06, CHAT-10]

coverage:
  - id: D1
    description: 'Предложение массового переноса: вопрос, строка пояса ввода (MSK) или «No time zone was named. These times use Vietnam time (VN).», строка пояса показа, дата начала, число изменений, три цели из четырёх, Show all selected changes и Show fewer selected changes, строка про отметки и одиночные уроки, кнопки Move lessons и Keep lesson times'
    requirement: CHAT-06
    verification:
      - kind: browser
        ref: 'node scripts/dev-checks/changes-web.mjs bulk light; node scripts/dev-checks/changes-web.mjs bulk dark'
        status: pass
    human_judgment: false
  - id: D2
    description: 'После подтверждения: aria-busy, состояния целей (Confirmed, Waiting for Google Calendar…, Not started), автопроверка раз в 2 с и Check status, «Lessons moved.» и View schedule только при applied; частичный итог P16 с числами из блока, «Ask again to move the remaining lessons.», без Saved; decline, stale и failed'
    requirement: CHAT-06
    verification:
      - kind: browser
        ref: 'node scripts/dev-checks/changes-web.mjs bulk light|dark (синтетические ответы page.route на confirm, decline, check)'
        status: pass
    human_judgment: false
  - id: D3
    description: 'Без подключения Google реальный запрос [fake:bulk] даёт отказ инструмента: текст «I could not prepare that change.», блока решения нет, записей в google_commands нет; браузер не шлёт записи на /api/google'
    requirement: CHAT-06
    verification:
      - kind: browser
        ref: 'node scripts/dev-checks/changes-web.mjs bulk light|dark'
        status: pass
    human_judgment: false
  - id: D4
    description: 'Отзыв на эссе: заголовок и подпись приблизительной оценки над текстом, «Task criterion not assessed» при task null, подпись переживает перезагрузку и видна, пока ответ ещё идёт; Stop даёт Feedback incomplete; отказ даёт Feedback unavailable; Ask another question только ставит фокус; /essay в списке команд и в подсказке «/»; длинный текст — строка P25 и выключенный Send'
    requirement: CHAT-10
    verification:
      - kind: browser
        ref: 'node scripts/dev-checks/changes-web.mjs essay light; node scripts/dev-checks/changes-web.mjs essay dark'
        status: pass
    human_judgment: false
  - id: D5
    description: 'Ширины 390, 375 и 320: ни одна кнопка, ссылка и строка блоков массового переноса и эссе не выходит за экран, горизонтальной прокрутки нет'
    requirement: CHAT-06
    verification:
      - kind: browser
        ref: 'changes-web.mjs bulk и essay, light и dark, ширины 390, 375, 320'
        status: pass
    human_judgment: false
  - id: D6
    description: 'Блоки предложений фазы 22 и 23-10 не сломаны'
    requirement: CHAT-06
    verification:
      - kind: browser
        ref: 'node scripts/dev-checks/changes-web.mjs proposals light'
        status: pass
    human_judgment: false

actuals:
  tokens: 19500
  tasks: 3
  commits: 4
plan_head_before: d1455c8340b94731ae9e829dc63ec5dcebc80616
plan_head_after: 0742965d3608f7f712f2d77b9adb53e2f51f70e4

duration: около 90 минут
completed: 2026-10-14
---

# Фаза 23, план 13: блоки массового переноса и отзыва на эссе в чате — итоги

**Массовый перенос видно в чате целиком: пояс ввода (или честная строка про Вьетнам), каждая серия было → стало, состояния целей, автопроверка статуса и частичный итог по P16 без «Saved»; отзыв на эссе всегда открывается подписью «Approximate estimate — not an official IELTS score.», команда /essay есть в списке.**

## Производительность

- Задачи: 3 из 3 плюс одна правка вида (стрелка раскрытия).
- `commits: 4` — `git rev-list --count --grep="(23-13)" d1455c8..HEAD`; ветка общая с соседним api-исполнителем, его коммиты в диапазон не входят.
- `tokens` — строки диффа файлов плана (1419 вставок) по символам / 4, приблизительно.

## Что сделано

- Задача 1: `bulk-move-proposal.tsx` — Panel с `role="group"`, `data-slot="chat-change"`, `data-operation="bulk_move"`, `data-state`. Строки Input time zone, Display time zone (если отличается от пояса ввода, со вторым поясом), From, Moves; предложение «No time zone was named. These times use Vietnam time (VN).» при `zoneNamed: false`; цели с ключом `seriesId`: день недели серии, Was в поясе серии со вторым поясом, Now в поясе ввода, «Series zone … · New rule zone …», «And future occurrences» (с датой From, если даты целей разные); при больше трёх целях видны три и кнопка Show all selected changes и Show fewer selected changes (`aria-expanded`, `aria-controls`). Состояния: proposed (Move lessons и Keep lesson times), applying и pending («Moving lessons…», «Waiting for Google Calendar to confirm this change…», состояния целей точкой со словом, `useAutoCheck` и Check status), applied («Lessons moved.», «{n} planned changes confirmed in Google Calendar.», View schedule на первую новую дату в поясе ввода), partial и failed (P16, строка причины, «Ask again to move the remaining lessons.», Check status при неподтверждённых целях), declined, stale. `messages.tsx` выбирает блок через `isBulkMove`; `use-chat.ts` получил `checkAction` (бывший `checkCalendar`, разбирает оба вида блока) и обновляет расписание при переходе bulk_move в applied или partial; `chat-progress.tsx` подписывает шаги `propose_bulk_move` и `essay_feedback`.
- Задача 2: `essay-feedback.tsx` — заголовок «Essay feedback», подпись в плашке `hover` с иконкой info, «Task criterion not assessed» и «No task prompt or task type was supplied.» при `task: null`, исходы incomplete («Feedback incomplete» и Ask another question) и unavailable («Feedback unavailable», «Could not complete feedback for this essay.», Ask another question). `messages.tsx` выносит блок essay из общего списка и рисует `EssayFeedback` вокруг текста ответа. `composer.tsx`: `/essay` в `COMMANDS` (попадает в список команд нового чата и в подсказку «/»), строка P25 и выключенный Send выше `CHAT_MESSAGE_MAX`.
- Задача 3: маркер `[fake:bulk]` в `chat-fake-anthropic.mjs` (дни, время, пояс из частей `from:`, `to:`, `zone:`); разделы `bulk` и `essay` в `changes-web.mjs`.

## Коммиты задач

1. Задача 1 (блок массового переноса, `checkAction`, подписи шагов) — `8953146` (feat)
2. Задача 2 (подпись отзыва на эссе, `/essay`, строка длины) — `b366db8` (feat)
3. Правка вида: стрелка раскрытия справа от подписи — `67d665a` (fix)
4. Задача 3 (разделы bulk и essay, `[fake:bulk]`) — `0742965` (feat)

## Проверки

- `yarn workspace @dv-lab/web typecheck` — код 0 после каждой задачи и в конце; `yarn workspace @dv-lab/web lint` — код 0; `npx prettier --check` по файлам плана — чисто.
- `node scripts/dev-checks/changes-web.mjs bulk light` и `dark` — `CHANGES_WEB_BULK_OK`: реальный запрос с карточкой `Alex Example 2388` без подключения Google даёт отказ (0 блоков, `google_commands` 10 → 10, шаг «Preparing to move lessons»); синтетические ответы: четыре цели с MSK (3 видны, раскрытие до 4 и обратно), confirm → pending (первая цель pending, остальные not started), автопроверка → applied/pending/not started, Check status → «Lessons moved.» и ссылка `/schedule?week=…&day=…`; блок без названного пояса (строка про Вьетнам, второй пояс, одиночный урок остаётся), partial с P16 «1 planned change confirmed. 1 unconfirmed. 1 not started.», причина и «Ask again…»; Keep lesson times отправляет decline один раз и не шлёт confirm; stale и failed; в браузере нет записей на `/api/google` (только чтения); ширины 390, 375 и 320 — без выхода за экран и горизонтальной прокрутки.
- `node scripts/dev-checks/changes-web.mjs essay light` и `dark` — `CHANGES_WEB_ESSAY_OK`: `/essay` в списке команд нового чата и в подсказке «/»; подпись и «Task criterion not assessed» видны, пока ответ ещё идёт (перезагрузка посреди ответа); после ответа подпись выше текста; после перезагрузки то же; Stop — «Feedback incomplete»; Ask another question ставит фокус и ничего не отправляет; 20001 символ — строка P25, Send выключен, Enter не отправляет; ровно 20000 — строка исчезает; отказ — «Feedback unavailable»; известное задание — без «Task criterion not assessed»; по одной подписи на ответ; ширины 390, 375, 320; длинное слово в сообщении учителя переносится; в логе api нет текста эссе.
- `node scripts/dev-checks/changes-web.mjs proposals light` — `CHANGES_WEB_PROPOSALS_OK` (регрессия блоков 22 и 23-10 после экспорта общих частей).
- Скриншоты обеих тем просмотрены: предложение, ожидание, частичный итог, неудача, Stop, отказ эссе, телефон 320 и 375.
- Фикстуры `Alex Example 2388`, разговоры и бюджетный период после прогонов восстановлены; порт 4253 свободен; процессов не оставлено.

## Не запускалось

- Реальная модель, реальный Google (подтверждение с записью в Google: `chat-bulk.mjs children` и сессия владельца на тестовом аккаунте), реальный телефон.
- `node scripts/dev-checks/wait-dev.mjs down` вернул бы 1: на 3000 и 4000 стек владельца по заданию не остановлен; свой порт 4253 свободен.
- `yarn test`, `yarn build`, `yarn knip`, `yarn db:*` — по заданию.
- Живой поток SSE в браузере: `page.route` с `route.fetch` буферизует поток целиком, поэтому состояние «streaming» эссе проверено перезагрузкой страницы посреди ответа (блок уже сохранён, ответ ещё идёт), а не наблюдением потока.

## Отклонения от плана

### Автоисправления

**1. [Правило 3] Файлы вне списка плана: `calendar-proposal.tsx` и `chat-screen.tsx`**
- `calendar-proposal.tsx`: экспорт `Spinner`, `Header`, `Caption`, `Place` (необязательный `className`), `useAutoCheck`, `ISSUE_LINES` вместо копирования в новый блок. `chat-screen.tsx`: `chat.checkCalendar` → `chat.checkAction`. Коммит `8953146`.

**2. [Правило 1] Стрелка раскрытия списка целей стояла под подписью кнопки**
- Иконка была дочерним элементом `Button`; заменена на `trailingIcon`. Коммит `67d665a`.

### Прочие отклонения

- Тексты и раскладка по дизайну v90 (ChatBulkMove, ChatEssayFeedback), как в 23-10: строка Input time zone вместо «Times in {zone}», Display time zone вместо «Your display time zone is {label}.», busy-текст кнопки «Moving lessons…».
- Показываются три цели (по плану), а не две (по дизайну); раскрытие — «в том же блоке» без внутренней прокрутки.
- «Moves» не говорит «single lesson» как цель: в контракте целей-одиночных уроков нет, `singlesLeft` — отдельное предложение.
- Единственное число в P16 («1 planned change confirmed»), как в дизайне; множественное — «N planned changes confirmed».
- `failed` без подтверждённых целей показывает заголовок «Google Calendar did not accept the change. Nothing was changed.», цели со словом Unconfirmed или Not started и «Ask again to move the remaining lessons.».
- Исход эссе `unavailable` и при `withheld` без текста, и при пустом завершённом ответе (иначе подпись без текста выглядела бы полным отзывом).
- Строка P25 под полем (по дизайну), а не над (по плану).
- В браузерных разделах `proposalsPrepare` не менялась; `startFakeModelApi` получила необязательный параметр задержки (для эссе 120 мс, чтобы успеть нажать Stop).
- Раздел `bulk`: подтверждение с записью в Google не выполняется в браузере (нет подключения в `dvlab_dev`); блоки в состояниях pending, partial, applied, declined, stale, failed — синтетические ответы, проверенные `chatChangeProposalBlock.parse` до отдачи.

## Проблемы

- Прогон `proposals light` один раз упал на входе (таймаут), повтор зелёный; тот же дребезг стека владельца, что отмечал 23-10.
- Остановленный ответ эссе не содержит частичного текста: проверка публикации держит текст `/essay` до конца (`gate.scores`), поэтому «Feedback incomplete» стоит под подписью без текста.

## Known Stubs

Нет.

## Важно следующим планам

- 23-14: `ChangeProposal` для `bulk_move` по-прежнему возвращает `null` в ветке после ошибок, но `messages.tsx` больше туда блок не отправляет; `changeReceiptHref` для bulk_move не используется (ссылка строится в `BulkMoveProposal` из `targets[].nowStartsAt`).
- Не сделано из дизайна ChatEssayFeedback: сообщение учителя с эссе в четыре строки со счётчиком слов и кнопкой Show full text; критерии как отдельные структурные блоки с двумя колонками (отзыв идёт обычным markdown ответа, как в плане).
- При `task: null` модель сама пишет предложение «The task criterion is not assessed…» (так в `ESSAY_TASK` 23-11), и рядом стоит фиксированная строка «Task criterion not assessed»: текст дублируется, убирается правкой промта в api.
- Кнопка Check status в блоке `partial` читает журнал; если сервер для терминального partial ничего нового не вернёт, состояние не изменится (проверено синтетическим ответом, не живым сервером).
- Фейк модели для `[fake:bulk]` в `dvlab_dev` даёт `connection_required`; живой перенос проверяется на тестовом аккаунте Google владельца.

## Self-Check: PASSED

- Файлы: `bulk-move-proposal.tsx`, `essay-feedback.tsx`, `changes-web.mjs`, `chat-fake-anthropic.mjs` — на месте.
- Коммиты `8953146`, `b366db8`, `67d665a`, `0742965` — в истории ветки.
