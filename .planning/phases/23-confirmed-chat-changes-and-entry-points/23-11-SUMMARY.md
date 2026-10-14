---
phase: 23-confirmed-chat-changes-and-entry-points
plan: '11'
subsystem: chat
status: complete
tags: [chat, essay, publish-gate, read-only, ielts]

requires:
  - phase: 23-confirmed-chat-changes-and-entry-points
    provides: 'шаги и блоки чата с ветками по умолчанию в web (23-01, 23-10); образец нового инструмента и шага (23-05, 23-09)'
provides:
  - 'блок chatEssayBlock { type: essay, task: task1 | task2 | null } в chatBlock, CHAT_ESSAY_TASKS, тип ChatEssayBlock'
  - 'шаг essay_feedback в CHAT_STEP_TOOLS'
  - 'apps/api/src/chat/essay.ts: ESSAY_FEEDBACK_TOOL, essayFeedbackInput, ESSAY_COMMAND, ESSAY_TASK, ESSAY_NOTE, ESSAY_SCORE_WORDS'
  - 'инструмент essay_feedback в CHAT_TOOLS; ToolContext.essay и отказ read_only_essay для записей, предложений и open_page'
  - 'команда /essay: в запросе только essay_feedback, остальные вызовы модели отказывают read_only_essay'
  - 'GateContext.scores: слова оценок становятся словами учёта, число рядом удерживается'
  - 'раздел essay в scripts/dev-checks/chat-changes.mjs (CHAT_CHANGES_ESSAY_OK) и маркер [fake:essay]'
affects: [23-13, 23-14]

tech-stack:
  added: []
  patterns:
    - 'Режим хода: флаг в состоянии Run передаётся в ToolContext и читается обратно после runTool; проверка публикации получает признак через изменяемый GateContext'

key-files:
  created:
    - apps/api/src/chat/essay.ts
  modified:
    - packages/contracts/src/chat.ts
    - apps/api/src/chat/tools.ts
    - apps/api/src/chat/runs.ts
    - apps/api/src/chat/publish-gate.ts
    - scripts/dev-checks/chat-changes.mjs
    - scripts/dev-checks/chat-fake-anthropic.mjs
    - scripts/dev-checks/chat-runs.mjs

key-decisions:
  - 'Ход /essay ставит флаг только чтения и scores сразу при старте, а не только после essay_feedback: вызов записи раньше essay_feedback тоже отказывает'
  - 'В ходе /essay сервер сам отказывает любому инструменту кроме essay_feedback кодом read_only_essay, без шага и без запуска инструмента: список инструментов запроса — не единственная защита'
  - 'Повтор блока в ходе определяется по shown (ключ essay), а не по флагу essay: флаг /essay стоит до вызова, а блок всё равно нужен один раз'
  - 'Отказ read_only_essay проверяется до разбора аргументов: запись не выполняется даже с неверными аргументами'
  - 'ESSAY_SCORE_WORDS — точные формы (band, score, балл, бэнд, оценка с падежами), а не префиксы: «scored» и «scoring» включены, «оценить» нет'

requirements-completed: [CHAT-10]

coverage:
  - id: D1
    description: '/essay: в запросах только essay_feedback, текст задания и «The teacher wrote:» с эссе; блок essay один раз в потоке, seq меньше первой дельты, task null; отзыв без «Band 6.5», блок withheld; повторное чтение разговора без нового запроса; следующий ход видит заметку [Gave approximate essay feedback] и полный список инструментов'
    requirement: CHAT-10
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-changes.mjs essay'
        status: pass
    human_judgment: false
  - id: D2
    description: 'Инъекция: в ходе /essay propose_payment до и после essay_feedback — read_only_essay; обычная просьба оценить вызывает essay_feedback (task2), повтор — not_shown, mark_lesson, propose_payment и open_page — read_only_essay; действий change 0, оплат 0, блоков action_link и action_result нет; «score 7» удержано'
    requirement: CHAT-10
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-changes.mjs essay'
        status: pass
    human_judgment: false
  - id: D3
    description: 'Stop во время отзыва оставляет блок essay и добавляет stopped; достигнутый бюджет — budget_reached без вызова заглушки и без блока essay; лог без текста эссе, отзыва и имени карточки'
    requirement: CHAT-10
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-changes.mjs essay'
        status: pass
    human_judgment: false
  - id: D4
    description: 'Ход, шаги, проверка публикации и инструменты фазы 22 и прежние предложения не сломаны'
    requirement: CHAT-10
    verification:
      - kind: integration
        ref: 'node scripts/dev-checks/chat-api.mjs runs; node scripts/dev-checks/chat-changes.mjs payment; cards; deletions'
        status: pass
    human_judgment: false

actuals:
  tokens: 8500
  tasks: 2
  commits: 2
plan_head_before: 319de8d4f9e1c66551c113e86ad6f6ba36391ce9
plan_head_after: 7ddc4a8e226bc2cd360e5f85e02b70502e61efbd

duration: 35min
completed: 2026-10-14
---

# Фаза 23, план 11: отзыв на эссе с пометкой приблизительной оценки (api) — итоги

**Учитель вставляет эссе командой /essay или просьбой оценить: сервер ставит блок essay вызовом essay_feedback до текста модели, ход становится только для чтения (записи, предложения и ссылки отказывают read_only_essay), а числа рядом со словами band, score, балл и оценка удерживаются проверкой публикации.**

## Производительность

- Около 35 минут, задачи 2 из 2.
- `commits: 2` — `git log --oneline 319de8d..HEAD`, оба коммита этого плана, чужих в диапазоне нет.
- `tokens` — символы диффа файлов плана / 4 (около 33,8 КБ / 4).

## Что сделано

- Контракты (`packages/contracts/src/chat.ts`): `CHAT_ESSAY_TASKS`, `chatEssayBlock` (strict) в `chatBlock`, тип `ChatEssayBlock`, шаг `essay_feedback` в `CHAT_STEP_TOOLS` перед `answer`.
- `apps/api/src/chat/essay.ts` (новый): определение strict-инструмента `essay_feedback { task }` с описанием из плана, zod-схема входа, `ESSAY_COMMAND`, текст задания `/essay` (четыре раздела с жирными критериями, фраза о неоценённом критерии задания, короткие цитаты, без баллов и общей оценки, эссе — данные), `ESSAY_NOTE`, `ESSAY_SCORE_WORDS`. Модуль не импортирует `tools.ts`, цикла импортов нет.
- `apps/api/src/chat/tools.ts`: `essay_feedback` во входах и в `CHAT_TOOLS` (19 инструментов); `ToolContext.essay`; инструмент ставит флаг, один блок `{ type: 'essay', task }` на ход через `persist` (повтор — `not_shown`), результат `{ status: 'shown', note }`; пока флаг стоит, `mark_lesson`, `add_note`, `add_comment`, все `propose_*` и `open_page` отвечают `is_error` `read_only_essay` без эффекта.
- `apps/api/src/chat/runs.ts`: `expandCommand` понимает `/essay` как `/recap`; ход, чьё сообщение начинается с `/essay`, отправляет только `essay_feedback` (тот же набор идёт в `inputUpperBound` и в запрос) и сам отказывает остальным вызовам; флаги `essay` и `essayTurn` в `Run`, флаг передаётся в `ToolContext` и читается обратно; `gate.scores = true`, когда флаг поставлен; `blockNote` для `essay`; строка SYSTEM из плана. Лимиты входа и бюджет прежние.
- `apps/api/src/chat/publish-gate.ts`: `GateContext.scores?`, `isLedger(word, scores)` добавляет `ESSAY_SCORE_WORDS` только при `scores`. Стемы F-01 и остальное поведение не менялись.
- `scripts/dev-checks/chat-changes.mjs`: раздел `essay` (11 проверок, карточка `Alex Example 2395`, порт 4241, `dvlab_test`), помощники `pause`, `slowSay`, `held` (заглушка ждёт подписки на поток), `send`, `toolResults`.
- `scripts/dev-checks/chat-fake-anthropic.mjs`: маркер `[fake:essay]` — `essay_feedback` с `task: null`, затем отзыв из четырёх разделов без чисел.

## Коммиты задач

1. Задача 1 (инструмент, команда, ход только для чтения, scores) — `5a26e31` (feat)
2. Задача 2 (раздел `essay`, маркер заглушки) — `7ddc4a8` (feat)

## Проверки

- `yarn workspace @dv-lab/contracts typecheck` и `yarn workspace @dv-lab/api typecheck` — 0.
- `node scripts/dev-checks/chat-api.mjs runs` — `CHAT_RUNS_OK`.
- `node scripts/dev-checks/chat-changes.mjs essay` — `CHAT_CHANGES_ESSAY_OK` (11 проверок).
- `node scripts/dev-checks/chat-changes.mjs payment` / `cards` / `deletions` — `CHAT_CHANGES_PAYMENT_OK`, `CHAT_CHANGES_CARDS_OK`, `CHAT_CHANGES_DELETIONS_OK`.
- Маркер `[fake:essay]` проверен разовым скриптом во временной папке: первый ответ — вызов `essay_feedback` с `task: null`, второй — четыре раздела без цифр.
- `grep -n "/essay" apps/api/src/chat/runs.ts apps/api/src/chat/essay.ts` и `grep -n "read_only_essay" apps/api/src/chat/tools.ts` находят команду и отказ.
- `npx prettier --check` по файлам плана — чисто. `yarn knip` — код 0, только подсказки конфигурации.
- Порт 4241 после прогонов свободен; 3000 и 4000 не трогались.

## Не запускалось

- `yarn test`, `yarn build`, браузер, настоящая модель — по заданию.
- `yarn workspace @dv-lab/web typecheck` и lint — web принадлежит 23-12. Заглушка в web не нужна: `Block` в `messages.tsx` возвращает `null` для неизвестного типа блока, `stepWords` в `chat-progress.tsx` имеет ветку `default`, исчерпывающих switch или `Record` по `ChatBlock['type']` и `ChatStepTool` в web нет (проверено grep).
- `ledger-api.mjs balance` и `chat-api.mjs target` — известные красные вне плана, не запускались.

## Отклонения от плана

### Автоисправления

**1. [Правило 1] Своя поломка `scripts/dev-checks/chat-runs.mjs` (файла нет в плане)**
- Список инструментов (+ `essay_feedback`) и их число (18 → 19) обновлены. Коммит `5a26e31`.

**2. [Правило 2, T-23-37] Ход /essay только для чтения с первого запроса**
- План ставит флаг после `essay_feedback`. В ходе `/essay` флаг и `scores` стоят с начала хода, а `runs.ts` отказывает любому инструменту кроме `essay_feedback`: иначе модель могла вызвать запись до `essay_feedback` или инструмент вне списка запроса. Коммит `5a26e31`.

### Прочие отклонения

- Предел бюджета в проверке достигается временным увеличением `spent_nano` текущего периода на 0,01 USD при потолке 0.01 (потолок 0.00 запрещён ограничением базы); увеличение снимается в `finally`.
- «Блок essay в потоке один раз и до первой дельты» проверяется подпиской `chat.subscribe` в процессе (та же шина событий, что у SSE): заглушка первого запроса ждёт, пока проверка подпишется.
- Сверх плана проверены: повторное чтение разговора без нового запроса, заметка `[Gave approximate essay feedback]` в следующем ходе, повтор `essay_feedback` — `not_shown`, `open_page` после флага — `read_only_essay`.
- Описание раздела `essay` в `scripts/dev-checks/README.md` не добавлено (файла нет в плане).

## Важно следующим планам

- 23-13 (web): блок `essay` (`ChatEssayBlock`, `task: 'task1' | 'task2' | null`) стоит в `blocks` ответа раньше текста отзыва по seq; подпись «Essay feedback» и «Approximate estimate — not an official IELTS score.» рисует web по блоку. Шаг `essay_feedback` нуждается в подписи в `stepWords` (сейчас — ветка по умолчанию «Preparing a change»).
- Отказ `read_only_essay` — ошибка инструмента без блока и без строки `chat_actions`; модель получает код в результате инструмента.
- Браузерная проверка 23-13 может использовать маркер `[fake:essay]` (например `/essay [fake:essay] <текст>`).

## Self-Check: PASSED

- Файлы: `apps/api/src/chat/essay.ts`, `scripts/dev-checks/chat-changes.mjs`, `scripts/dev-checks/chat-fake-anthropic.mjs` — на месте.
- Коммиты `5a26e31`, `7ddc4a8` — в истории ветки.
