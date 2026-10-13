---
phase: 22-chat-with-mentions-and-quick-marks
plan: '14'
status: complete
verification: partial
subsystem: contracts-api-web
tags: [chat, facts, excerpts, suggestions, slash-commands, publish-gate, refresh-records]

requires:
  - phase: 22-04
    provides: 'readChatFacts, ChatStudentFacts, StudentFacts, GET /chat/records'
  - phase: 22-08
    provides: 'readLessonDay (today/today.ts)'
  - phase: 22-13
    provides: 'ходы модели, publish-gate (checkSentence, sentenceSplitter), инструменты, chat-runs.mjs'
provides:
  - 'contracts/chat.ts: блоки facts, lessons, pays_soon, excerpt, suggestions, read_failed; chatRecordsKey, chatRecordsRefreshRequest/Response, CHAT_DAYS, CHAT_SUGGESTIONS_MAX'
  - 'api chat/facts.ts: readChatDay, readChatPaysSoon, readChatRecords поверх getCard, listCards, readLessonDay'
  - 'api chat/actions.ts: команды чтения /today, /tomorrow, /payments без модели и без попытки бюджета'
  - 'api routes/chat.ts: POST /chat/records/refresh'
  - 'api chat/tools.ts: student_facts кладёт блок facts, student_notes отдаёт id и маркеры цитат, инструмент suggest'
  - 'api chat/publish-gate.ts: resolveCites, citeKey, Issued'
  - 'web chat/_components/fact-blocks.tsx: блоки в /chat, Refresh records, вставка идеи в черновик'
  - 'scripts/dev-checks: chat-api.mjs answers, сценарии в chat-runs.mjs, chat-web.mjs answers (не исполнялся)'
affects: [22-15, 22-16, 22-17]

actuals:
  tokens: 24018
  tasks: 3
  commits: 5
plan_head_before: 30a5e24f23a2fa875c67851e93655d1b63cbcb27
plan_head_after: 68c75a61f9cb612af574a2624c0baecca733acad

key-files:
  created:
    - apps/web/app/(app)/chat/_components/fact-blocks.tsx
  modified:
    - packages/contracts/src/chat.ts
    - apps/api/src/chat/facts.ts
    - apps/api/src/chat/actions.ts
    - apps/api/src/chat/tools.ts
    - apps/api/src/chat/publish-gate.ts
    - apps/api/src/chat/runs.ts
    - apps/api/src/routes/chat.ts
    - apps/web/app/(app)/_components/due-list.tsx
    - apps/web/app/(app)/chat/_components/messages.tsx
    - apps/web/app/(app)/chat/_components/chat-screen.tsx
    - scripts/dev-checks/chat-api.mjs
    - scripts/dev-checks/chat-runs.mjs
    - scripts/dev-checks/chat-web.mjs
    - scripts/dev-checks/README.md

key-decisions:
  - 'Числа в чате идут только блоками facts, lessons, pays_soon из тех же владельцев, что экраны; facts.ts не содержит арифметики денег и уроков, только addDays(день, 1) для «завтра»'
  - 'Цитата записи: маркер [[note:id]], [[comment:id]] или [[section:студент:раздел]] в предложении модели заменяется блоком excerpt, только если запись выдал инструмент student_notes в этом ходе (и она не отрезана лимитом 30 записей); текст блока берётся из базы при чтении инструмента, а не из ответа модели'
  - 'Идеи suggest проходят checkSentence: строка с числом учёта отбрасывается, ни одной разрешённой — ошибка инструмента ideas_not_allowed'
  - 'Ошибка чтения при команде чтения или student_facts даёт блок read_failed с ключом; Refresh records перечитывает по ключу без хода'

requirements-completed: [CHAT-07, CHAT-08, CHAT-09]

duration: ~3h
completed: 2026-10-14
---

# Phase 22 Plan 14: Ответы из сохранённых данных Summary

Числа о карточке, уроках дня и Pays soon приходят в чат блоками кода (те же функции, что Today и Students), команды `/today`, `/tomorrow`, `/payments` отвечают без модели и без расхода, а ответ модели ссылается на сохранённые записи маркерами, которые сервер заменяет блоком с текстом из базы; идеи показываются отдельным блоком и ничего не пишут. К `api.anthropic.com` из проверок не ушло ни одного запроса (только заглушка провайдера в `chat-runs.mjs`).

## Задачи и коммиты

| #   | Задача                                                                                       | Коммит  |
| --- | -------------------------------------------------------------------------------------------- | ------- |
| 1   | Блоки фактов, уроков дня, Pays soon, команды чтения, `POST /chat/records/refresh`, `answers` | 37ae82b |
| 2   | `student_facts` с блоком, цитаты записей, `suggest`, сценарии в `chat-runs.mjs`              | c51b131 |
| 3   | Блоки в /chat, Refresh records, вставка идеи в черновик, `chat-web.mjs answers`              | 4150778 |
| —   | Дата урока в `chat-runs.mjs` для окна с 00:00 до 02:00 (см. «Для следующих планов»)          | 78264c2 |
| —   | Лишние `,` и `:` после замены маркеров цитат (замечание владельца «Разделы профиля:,,»)      | 68c75a6 |

`commits: 5` — мои коммиты с `22-14` в сообщении; `git rev-list --count 30a5e24..HEAD` = 12, остальные 7 — коммиты параллельной сессии `ui-skeletons`. `actuals.tokens` — символы `git show` моих пяти коммитов / 4 (96071 / 4).

## Что построено

- **Контракт.** Блоки `facts` (`chatStudentFacts`; состояние чтения календаря — `facts.nextLesson.status.state`), `lessons` (день, дата, зона, `calendarRead`, строки: ключ, ученик, начало, длительность, исход, `movedTo`), `pays_soon` (`id`, имя, остаток, длина урока, порог), `excerpt` (`source`, `id`, `studentId`, `sectionKind?`, `body`, `createdAt`, `timeZone`), `suggestions` (до четырёх строк по 200 символов), `read_failed` (ключ). Ключ записей: ученик или день (`today`, `tomorrow`, `payments`).
- **Чтение без модели.** `facts.ts`: `readChatDay` (уроки дня через `readLessonDay` для `lessonDay(now)` или следующего дня; окно недели функция берёт от названной даты сама), `readChatPaysSoon`, `readChatRecords`. В `actions.ts` точное совпадение текста (без регистра и пробелов по краям) с `/today`, `/tomorrow`, `/payments` отвечает блоком и не доходит ни до `admit`, ни до хода; чтение идёт в savepoint, исключение даёт `read_failed`. `POST /chat/records/refresh` с `{ key }` отдаёт свежий блок, ничего не пишет (404 неизвестному ученику, 400 неверному ключу).
- **Ответы модели.** `student_facts` отдаёт модели данные карточки как есть и добавляет в ответ блок `facts` из того же чтения (один блок на ученика за ход; исключение чтения — `read_failed`). `student_notes` отдаёт `id` и маркер `cite` каждой записи и разделу профиля с датой, запоминает выданные записи в состоянии хода. `suggest` — блок `suggestions`. Публикация: маркер в предложении заменяется блоком `excerpt` один раз за ход; неизвестный, невыданный в этом ходе маркер или одиночное `[[` — предложение удержано. Цифры внутри цитаты не проверяются. Системная инструкция: числа через `student_facts`, цитаты маркерами, идеи через `suggest`. `/recap` идёт моделью с развёрнутой задачей (прочитать записи, пройденное, слабые места, идеи, цитаты маркерами).
- **Web.** `fact-blocks.tsx`: `facts` — `StudentFacts` (22-04), `lessons` — Panel «Lessons today / tomorrow» с read-only строками (`TimePair`, исход), при несвежем календаре строка «The calendar view is not current.» и никогда не «No lessons», `pays_soon` — `DueList` в Panel (пустое состояние как на Today), `excerpt` — `blockquote` с линией 2px и подписью «From notes · Wed 8 Oct · stored text» (текст через `MarkdownView` со `skipHtml`), `suggestions` — Panel «Suggestions» с кнопками secondary compact и подписью «Not saved to the student's notes.», нажатие кладёт текст в поле и ничего не отправляет, `read_failed` — баннер «Could not read the student's records.» с Refresh records («Refreshing…» пока идёт запрос; успех подставляет свежий блок на месте).

## Проверки

Выполнено:

- `yarn workspace @dv-lab/contracts|api|web typecheck`, `yarn workspace @dv-lab/web lint`: код 0 (последний прогон на HEAD с коммитами параллельной сессии). `prettier --check` по файлам плана: чисто. `node scripts/hygiene-check.mjs`: clean. `yarn knip`: код 0, только прежние подсказки конфигурации.
- `node scripts/dev-checks/chat-api.mjs answers` (`dvlab_test`): `CHAT_ANSWERS_OK`. Карточки `Alex Example 2207` (без баланса), `2208` (долг), `2209` (ноль): `/today` равен урокам `GET /today` (ключ, начало, исход, ученик, дата, состояние календаря), `/payments` равен `paysSoon` в том же порядке с порогом, `/tomorrow` — следующий день зоны учителя; блок `facts` по Refresh равен `GET /students/:id` (остаток, следующий урок целиком, Pays soon, порог, зона), «без начального баланса» — `null`; `/today please` — свободный вопрос (`model_unavailable` без ключа), ` /TODAY` — команда; число строк `chat_usage_attempts` и `chat_turns` не изменилось; Refresh и команды не создают строк в других таблицах; 400 на пяти неверных телах, 404, 403 ученику, 401 без сессии; сбой чтения (неверная зона в контексте) даёт `read_failed` с ключом, Refresh по нему — свежий блок; на воскресенье учителя «завтра» — понедельник следующей недели, его окно отличается от окна воскресенья, уроки равны `readLessonDay`.
- `node scripts/dev-checks/chat-api.mjs runs`: `CHAT_RUNS_OK` (заглушка провайдера). Новые сценарии: маркеры заметки и раздела дают два блока `excerpt` с текстом из базы и цифрами внутри, текст ответа сохраняет предложения и не содержит маркеров и сохранённого текста; выдуманный id, настоящий id, не выданный в этом ходе (отрезан лимитом 30), одиночное `[[` — предложение удержано, блок `withheld`; настоящий id без вызова инструмента — удержано; вопрос об остатке — один блок `facts` при двух вызовах, равный `GET /chat/records`, в тексте нет цифр, предложение с «3 lessons left» удержано; список маркеров через запятую даёт «Sections.» и два блока; `suggest` — одна строка с «10 minutes» отброшена, заметки не пишутся, все строки с числом — ошибка `ideas_not_allowed`; `/recap` уходит моделью с задачей. Список инструментов теперь из девяти (`suggest` после `student_notes`).
- Регрессия после правок `actions.ts`, `runs.ts`, `tools.ts`: `chat-api.mjs records`, `conversations`, `notes`, `comments`, `actions`, `target` — все `_OK`. После прогонов в `dvlab_test` 0 карточек `Alex Example 22%`, разговоров и разделов профиля.
- `grep` по `facts.ts` на арифметику (`[-+*/%]`, `Math.`): совпадений нет, кроме строк `import`; в файле только `addDays(today, 1)`.

Не выполнено:

- `node scripts/dev-checks/chat-web.mjs answers light|dark` и `wait-dev.mjs down`: на портах 3000 и 4000 стенд владельца, его не трогали. Раздел написан, `node --check` проходит. Вероятные места падения при первом запуске: Today в соседней вкладке снимается через 500 мс после `#today-pays-soon` (он есть и у скелетона), `sendCommand` рассчитывает, что список команд открыт и Enter выбирает пункт, а не отправляет сообщение; подмена ответа `POST …/messages` через `page.route` предполагает, что `use-chat` принимает подставленный блок как есть. Для UI это «не проверено»: рост блоков, вид в светлой и тёмной темах, телефон 390 px не сверены с превью. Нужны записи `unrun-verify` в `.planning/WINDOWS.md` ведущей сессией.
- Вторая часть требования «календарь не свеж»: проверен только инвариант (следующий урок `none` только при свежем чтении, результат блока равен профилю). Состояние `last_known` через `calendar-seed.mjs` не сеялось: уроки завтрашнего дня и `last_known` требуют синтетического подключения Google в `dvlab_test`. Уроки следующего дня в `answers` — пустой список; строки из проекции календаря проверяет пересборка 25.1 и `readLessonDay`, который блок вызывает без изменений.
- `read_failed` по ключу карточки пишется из исключения в `student_facts`; сценария в `runs` нет (ломать чтение базы нечем), покрыт только путь команды чтения.
- `chat-api.mjs budget`, `calendar`, `chat-config.mjs`, `yarn build`, `yarn test`, `yarn install`: не повторялись.

## Дизайн

`~/dv-lab-design` на момент завершения v76 (на исполнении сверялся README ChatFacts и ChatMessage, план писался под v64). Precondition задачи 3 (DR-22-02 отвечен) выполнен: PLAN-INDEX строка 97, README ChatFacts, ChatMessage, DueList, LessonList.

**Вопрос Design dude (EXECUTOR-RULES 8).**

1. «Suggestions» описаны дважды по-разному: `ChatFacts` — панель с заголовком, до трёх строк `body` и подписью «Not saved to the student's notes.», без кнопок; `ChatMessage` и `ChatPage` — кнопки secondary compact с готовым вопросом. План требовал кнопки, вставляющие текст в черновик, и до четырёх идей. Сделан гибрид: панель, заголовок и подпись из `ChatFacts`, строки — кнопки, лимит 4. Идея урока («Start with a short reading warm-up.») в поле ввода выглядит как вопрос модели; нужен ответ, что должно происходить по нажатию на педагогическую идею.
2. Для `/today`, `/tomorrow`, `/payments` при сбое чтения использована единственная строка дизайна «Could not read the student's records.».
3. Строки уроков дня в чате — read-only (без кнопок отметки), имя ведёт в профиль ученика, а не открывает `LessonDialog` (диалог живёт в Today).
4. Для частичного охвата («Some records could not be read. The numbers may be incomplete.») источника в данных нет, строка не построена.

## Deviations from Plan

**1. [Rule 3] Файлы вне `files_modified`.** `apps/api/src/chat/runs.ts` (`blockNote` без default падал на typecheck от новых типов блоков; публикация цитат, `expandCommand` для `/recap`, состояние хода), `apps/web/app/(app)/_components/due-list.tsx` (тип пропса сужен до `Pick<StudentRow, 'id' | 'displayName' | 'balanceMinutes' | 'defaultLessonMinutes'>`, чтобы не копировать компонент), `chat-screen.tsx` (проброс `onSuggest` в черновик), `scripts/dev-checks/chat-runs.mjs` (дочерний скрипт раздела `runs`: список инструментов 8 → 9, сценарии), `scripts/dev-checks/README.md`. `student-facts.tsx` из плана не правился.

**2. Контракт шире плана.** Блок `read_failed`, `chatRecordsKey`, запрос и ответ `POST /chat/records/refresh` по ключу, инструмент `suggest` (в плане есть), поле `timeZone` в `excerpt` (дата записи показывается в главной зоне учителя).

**3. Pays soon без `readToday`.** План: `readToday(...).paysSoon`. Сделано: `listCards` + `paysSoonList` напрямую — те же два вызова, из которых `readToday` собирает список, без лишнего чтения недели календаря. Равенство с `GET /today` проверено в `answers`.

**4. `/recap`.** Сверх плана текст `/recap` разворачивается в задачу модели (`expandCommand`), а не уходит как есть.

**5. [Rule 1] Замечание владельца «Разделы профиля:,,».** Причина — наш код: при замене маркеров `[[section:…]], [[section:…]]` в предложении оставались запятые и двоеточие, а правило «пробел перед знаком» склеивало их в `:,,`. Маркер теперь забирает следующую за ним `,` или `;`, а `:`/`;`/`,` перед концом предложения превращаются в точку («Sections.»). `fact-blocks.tsx` и `messages.tsx` ни при чём. Правка скролла в `chat-screen.tsx` не делалась по распоряжению ведущей сессии.

**6. [Rule 1] Дата урока в `chat-runs.mjs`.** Сценарии с `mark_lesson` ломались с 00:00 до 02:00 по зоне учителя: фикстура передавала календарную дату, а день урока начинается в 02:00. Фикстура берёт `lessonDay(startsAt)`. Это не лечит поведение в этом окне (см. ниже).

## Known Stubs

- Свежий блок после Refresh records держится в состоянии компонента: после перезагрузки страницы в сообщении снова баннер «Could not read the student's records.».
- Нет строки частичного охвата («Some records could not be read…»).
- Блок `lessons` не открывает `LessonDialog` и не показывает кнопок отметки.

## Threat Flags

| Flag                     | File                        | Description                                                                                                       |
| ------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| threat_flag: endpoint    | apps/api/src/routes/chat.ts | Новый `POST /chat/records/refresh`: сессия и роль учителя, `no-store`, только чтение, без хода и без записи       |
| threat_flag: data-egress | apps/api/src/chat/tools.ts  | `student_notes` теперь отдаёт провайдеру `id` записей и маркеры цитат (внутри заявленной границы api → Anthropic) |

## Для следующих планов

- **Баг из 22-08 (не чинился, по SCOPE BOUNDARY).** В `lesson-target.ts` при указанной дате ищутся только `day.lessons`. Модель получает `Now: <календарная дата> <время>` из `currentMessage`; с 00:00 до 02:00 по зоне учителя календарная дата уже следующая, а день урока ещё предыдущий, и `mark_lesson`/`add_comment` с этой датой отвечают `clarify(date_time)` с пустыми вариантами (так упала фикстура `runs` в 00:35). Нужно либо передавать модели день урока, либо принимать календарную дату в этом окне. Файла `deferred-items.md` я не создавал (в коммит `docs` идёт только SUMMARY), запись нужна ведущей сессией.
- **22-15:** блок `suggestions` и `read_failed` уже в контракте; чипы модели и уровня не затронуты.
- **22-16:** блоки `facts`, `lessons`, `pays_soon`, `excerpt`, `suggestions`, `read_failed` лежат в `chat_messages.blocks`; удаление и вычистка разговора их не требуют отдельной обработки. Порядок уборки фикстур в проверках прежний: `chat_actions` → `chat_usage_attempts` → `chat_turns` → `chat_messages` (сначала с `reply_to`) → `chat_conversations`.
- **22-17:** `chat-web.mjs answers light|dark` требует dev-стека на 3000 и 4000 и записи `unrun-verify` до первого запуска; `chat-api.mjs answers` на воскресенье учителя проверяет только дату и равенство `readLessonDay`.

## Self-Check: PASSED

Файлы на месте: `apps/web/app/(app)/chat/_components/fact-blocks.tsx`, все изменённые файлы из `key-files`. Коммиты 37ae82b, c51b131, 4150778, 78264c2, 68c75a6 есть в ветке. Рабочее дерево чисто по файлам плана (остаются `apps/web/next.config.ts` владельца и правки параллельной сессии `ui-skeletons` в Schedule), `apps/web/AGENTS.md` нет, процессов не оставлено, порты 3000 и 4000 не трогались.
