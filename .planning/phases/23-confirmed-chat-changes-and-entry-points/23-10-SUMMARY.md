---
phase: 23-confirmed-chat-changes-and-entry-points
plan: '10'
subsystem: web
status: complete
tags: [chat, web, proposals, change-card, receipt-links, keep, end-series]

requires:
  - phase: 23-confirmed-chat-changes-and-entry-points
    provides: 'блок change_proposal и ChangeProposal для оплаты (23-01); create_card, set_rate, archive_card (23-05); delete_payment, remove_note, remove_comment, end_series, declined (23-07); ссылка payment= на Edit payment (23-06)'
provides:
  - 'ChangeProposal для create_card, set_rate, archive_card (в том числе requestedDeletion), delete_payment, remove_note, remove_comment с точным превью, конкретными кнопками, ссылкой результата'
  - 'changeReceiptHref(block) в apps/web/lib/schedule-links.ts: адрес результата из receipt и полей блока'
  - 'вариант end_series и сохранённый Keep (declined) в calendar-proposal.tsx, declineAction в use-chat.ts'
  - 'подписи шагов новых инструментов в chat-progress.tsx'
  - 'раздел proposals в scripts/dev-checks/changes-web.mjs и маркеры фейка модели'
affects: [23-13, 23-14]

actuals:
  tokens: 18700
  tasks: 3
  commits: 4
plan_head_before: 3951fc662d5c8481094b6517a5889865bb508704
plan_head_after: 7040945cb43a3fbc9d2c7404dc021e6588eee875

tech-stack:
  added: []
  patterns:
    - 'Операция чата в web: wordsOf, Rows, Notes, appliedTitle, receiptLabel и changeReceiptHref — по одному switch на операцию, новая операция добавляется во все шесть'
    - 'Браузерная проверка на стеке владельца: свой api с фейком модели на отдельном порту получает от браузера только /api/chat/*, остальное идёт в api владельца'

key-files:
  created: []
  modified:
    - 'apps/web/app/(app)/chat/_components/change-proposal.tsx'
    - 'apps/web/app/(app)/chat/_components/calendar-proposal.tsx'
    - 'apps/web/app/(app)/chat/_components/chat-progress.tsx'
    - 'apps/web/app/(app)/chat/_components/use-chat.ts'
    - 'apps/web/app/(app)/chat/_components/messages.tsx'
    - 'apps/web/app/(app)/chat/_components/chat-screen.tsx'
    - apps/web/lib/schedule-links.ts
    - scripts/dev-checks/changes-web.mjs
    - scripts/dev-checks/chat-fake-anthropic.mjs
    - scripts/dev-checks/chat-web.mjs
    - scripts/dev-checks/README.md

key-decisions:
  - 'Тексты блоков по дизайну v90 (ChangeCard, ChangeCardKinds, ChatCalendarChange), а не по наброску плана: вопрос «Create a student card?» с рядом Name, «Delete {name}'s payment?», «Remove this note?», «No lessons from {date}» у конца серии'
  - 'Блок bulk_move в ChangeProposal не рисуется (return null) до плана 23-13: кнопок решения без превью нет'
  - 'Edit payment остаётся ссылкой на форму (так построено в 23-01 и 23-06); дизайн рисует кнопку с диалогом поверх чата'

requirements-completed: [CHAT-05, CHAT-12]

duration: около 50 минут
completed: 2026-10-14
---

# Фаза 23, план 10: блоки предложений для всех операций, ссылки результата, Keep — итоги

**Чат показывает новый ученик, ставку, архив (и вместо удаления), удаление оплаты, удаление заметки или комментария и конец серии точным превью с конкретными кнопками; после применения даёт ссылку в обычную форму из полей receipt; Keep у календаря отправляет decline на сервер и переживает перезагрузку.**

## Производительность

- Начало около 2026-10-14T05:50Z, конец около 2026-10-14T06:35Z.
- Задачи: 3 из 3, плюс одно исправление сборки (коммит `8b0ba07`).
- `commits: 4` — `git rev-list --count --grep="(23-10)" 3951fc6..HEAD`; в диапазоне есть чужие коммиты 23-09, счёт отфильтрован по плану.
- `tokens` — символы диффа файлов плана / 4 (74768 / 4).

## Что сделано

- Задача 1: `calendar-proposal.tsx` — локальное `kept` убрано, Keep вызывает `onDecline(actionId)`, состояние `declined` с сервера показывает «Kept as it was. Nothing changed.»; вариант `end_series` (вопрос, Was — правило серии с вторым поясом, Now — «No lessons from {date}», строка про историю, **End series** / **Keep series**, «Ending series…», дальше общие состояния ожидания Google, Check status, Saved без Undo, ссылка на неделю последнего оставшегося урока). `use-chat.ts` получил `declineAction`, `messages.tsx` и `chat-screen.tsx` передают его. `chat-progress.tsx` подписывает шаги `student_payments`, `propose_payment_delete`, `propose_student`, `propose_rate`, `propose_archive`, `propose_entry_removal`.
- Задача 2: `change-proposal.tsx` переписан на один switch на операцию. Превью и тексты: `create_card` (Name, Rate, Lesson length, No-show, Time zone, Gender только если назван, строка про отсутствие входа, предупреждение о дубликате), `set_rate` (Current rate, New rate на заливке active, «No rate set»), `archive_card` (Status Active → Archived, первая строка про недоступное удаление при `requestedDeletion`, строка про вход при `accountActive`), `delete_payment` (дата, сумма, кредит, комментарий, остаток до и после; кнопка Delete payment красным), `remove_note` и `remove_comment` (ученик, дата, текст до трёх строк, полный в `title`). `changeReceiptHref` строит адрес только для `applied` с `receipt` через `studentHref` и `lessonHref`; ссылки Edit payment, Open student, Edit details, View payments, View notes, View lesson (при `lessonDate: null` — View schedule на `/schedule`). У ссылки `aria-label` «{действие}: {имя}».
- Задача 3: `chat-fake-anthropic.mjs` — маркеры `[fake:card]`, `[fake:rate]`, `[fake:archive]`, `[fake:delete-student]`, `[fake:payments]` (двухшаговый: student_payments, затем propose_payment_delete по первому payment_id), `[fake:remove-note]`, `[fake:end]`. `changes-web.mjs proposals` — около сорока проверок: решение, отказ, перезагрузка, подтверждение, ссылки, переходы, SQL-счётчики, ширина 390 px, синтетические блоки календаря (Keep у move, End series и Keep series с перехватом `/decline`).

## Коммиты задач

1. Задача 1 (конец серии, Keep, шаги) — `2c26417` (feat)
2. Задача 2 (варианты блока и ссылки результата) — `ab274d0` (feat)
3. Исправление сборки под `bulk_move` из контракта 23-09 — `8b0ba07` (fix)
4. Задача 3 (раздел `proposals`, маркеры фейка) — `7040945` (feat)

## Проверки

- `yarn workspace @dv-lab/web typecheck` — код 0 (после каждой задачи и в конце).
- `yarn workspace @dv-lab/web lint` — код 0.
- `npx prettier --check` по файлам плана — чисто.
- `node scripts/dev-checks/changes-web.mjs proposals light` и `dark` — `CHANGES_WEB_PROPOSALS_OK` в обеих темах (повтор после последнего коммита тоже зелёный). Скриншоты просмотрены: архив с P09, удаление оплаты, конец серии на 390 px (тёмная), удаление ученика (светлая).
- После прогонов карточек `Alex Example 239_` в базе 0, порт 4252 свободен, процессов не осталось.
- Сквозная проверка ловила настоящие эффекты: до решения оплат, карточек, ставки и заметок нет изменений; отказ не пишет ничего и держится после перезагрузки; подтверждение пишет одну запись, архив оставляет карточку со статусом archived; последовательность решений в сети `decline, confirm, confirm, decline, confirm, decline, confirm, decline, confirm`, повторное чтение треда решений не шлёт.

## Не запускалось

- `node scripts/dev-checks/wait-dev.mjs down` возвращает 1: на 3000 и 4000 слушает dev-стек владельца, его по заданию не останавливали. Свой порт 4252 свободен.
- `chat-web.mjs calendar`: нужен свободный порт 4000 (скрипт входит учителем в api на 4000 с origin web), на стеке владельца не запускается. Правка плана в этом файле — перехват `/decline` и ожидание `declined` вместо `kept` — не прогонялась.
- Живое подтверждение end_series и запись в Google: в `dvlab_dev` нет подключения Google; `[fake:end]` даёт отказ инструмента, блока решения и записи в расписание нет (проверено), блок конца серии проверен на синтетическом ответе.
- `yarn test`, `yarn build`, `yarn knip` — по заданию.

## Отклонения от плана

### Автоисправления

**1. [Правило 3] `declineAction` в `use-chat.ts` (файла нет в плане)**
- План ссылается на `chat.declineAction` «из 23-01», но 23-01 добавил только `decideChange` для блоков `change_proposal`; для календаря метода не было. Добавлен `declineAction` (POST `/chat/actions/:id/decline`, ответ с блоком календаря подставляется в тред, при неудаче тред перечитывается). Коммит `2c26417`.

**2. [Правило 3] Операция `bulk_move` в контракте (23-09 добавил её параллельно)**
- Typecheck упал на шести switch без ветки `bulk_move` (TS2366). Ветки добавлены; `ChangeProposal` для `bulk_move` возвращает `null` до плана 23-13, чтобы не показать кнопки решения без превью. Коммит `8b0ba07`.

**3. [Правило 1] `chat-web.mjs` (файла нет в плане)**
- Keep у предложения календаря теперь шлёт decline и ставит `data-state="declined"`; проверка ждала `kept` и «ничего не отправляется». Добавлен перехват `/decline`, ожидание `declined`. Коммит `7040945`.

### Прочие отклонения

- Тексты по дизайну v90 вместо набросков плана: «Create a student card?» с рядом Name (план: «…for {name}?»), «Delete {name}'s payment?», «Remove this note?» с рядом Student, у конца серии Now «No lessons from {date}» и строка «Lessons before {date}, and lessons with a mark or a comment, stay. An ended series cannot be undone from the chat.»; Gender показывается только если назван (план: «Not set»). Ответы DR-23-02, DR-23-03, DR-23-09 пришли в v90 (`ChangeCard`, `ChangeCardKinds`, `ChatCalendarChange`): stale без Refresh proposal («Ask again») уже было в 23-01.
- Edit payment по дизайну — кнопка с диалогом поверх чата; оставлена ссылкой на форму профиля (`?tab=payments&payment=<id>`), как строили 23-01 и 23-06 и как требует план. Решение о диалоге в чате — вопрос дизайн-сессии и владельца.
- У предложений календаря `move`, `cancel`, `restore`, `move_series` кнопки остались «Confirm» / «Keep»: дизайн v89 просит конкретные слова (Move lesson, Cancel lesson, Move series), но `chat-web.mjs` ищет кнопки «Confirm» и «Keep». По плану конкретные слова нужны только концу серии.
- Браузерная проверка построена иначе, чем в плане: порты 3000 и 4000 заняты владельцем, поэтому свой api с фейком модели слушает 4252, а `page.route` отправляет в него только `/api/chat/*`; вход и фикстуры идут через api владельца (сессии и данные общие в `dvlab_dev`).
- Дата заметки («Added») показана в поясе `SCHEDULE_TIME_ZONE`: в `remove_note` нет поля пояса.
- Раздел `proposals` описан в `scripts/dev-checks/README.md`.

## Проблемы

- Новый Next 16 держит предыдущий маршрут в DOM скрытым после клиентского перехода: `getByText` находит текст из чата, скрытый после перехода по ссылке результата. Проверка заметки использует `filter({ visible: true })`.
- Прогоны мерцали (таймаут входа, ожидания элементов), пока соседний 23-09 правил `apps/api` и api владельца перезапускался; повтор давал зелёный результат.

## Для следующих планов

- 23-13: блок `bulk_move` сейчас `null` в `ChangeProposal`; подписи Move lessons / Keep lesson times (P32), `changeReceiptHref` для `bulk_move` возвращает `null`, `receiptLabel` уже знает «View schedule». Шаги новых инструментов 23-09 и 23-11 попадают в ветку по умолчанию «Preparing a change».
- Пробел в контракте: у `delete_payment` нет `lessonMinutes`, остаток в превью форматируется с длиной урока, выведенной как `creditedMinutes * 100 / lessonsHundredths` (для оплаты без кредита — 60). Для карточки, у которой длина урока менялась после оплаты, фраза «N lessons left» может отличаться от профиля; чинится полем `lessonMinutes` в `chatDeletePaymentChange`.
- Конкретные слова кнопок у `move`, `cancel`, `restore`, `move_series` (дизайн v89) — отдельная правка вместе с `chat-web.mjs`.
- `chat-web.mjs` и `entry-web.mjs` входят в api на 4000 с origin web; на стеке владельца без свободного порта они не идут (раздел `proposals` и `forms` определяют origin api сами).

## Self-Check: PASSED

- Файлы: `apps/web/app/(app)/chat/_components/change-proposal.tsx`, `calendar-proposal.tsx`, `apps/web/lib/schedule-links.ts`, `scripts/dev-checks/changes-web.mjs` — на месте.
- Коммиты `2c26417`, `ab274d0`, `8b0ba07`, `7040945` — в истории ветки.
