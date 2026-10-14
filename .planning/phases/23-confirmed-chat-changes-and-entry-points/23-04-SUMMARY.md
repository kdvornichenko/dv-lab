---
phase: 23-confirmed-chat-changes-and-entry-points
plan: '04'
subsystem: web
tags: [palette, command-palette, chat, today, student-profile, base-ui, nextjs]

requires:
  - phase: 23-confirmed-chat-changes-and-entry-points
    provides: 23-01 ChangeProposal и use-chat с decideChange
provides:
  - палитра с группами Actions, Students, Screens, поиском учеников по /students/options, New chat и Add payment
  - прибытие /?dialog=payment на Today (форма Add payment открывается один раз, параметр убирается)
  - прибытие /chat?new=1 (пустой новый разговор без создания записи) и /chat?new=1&student=<id> (черновик @Имя с привязкой упоминания)
  - кнопка Ask in chat в профиле активной карточки
  - проверка scripts/dev-checks/entry-web.mjs (разделы palette и ask)
affects: [23-05, 23-06, 23-07, 23-08, 23-09, 23-13]

actuals:
  tokens: 12000
  tasks: 3
  commits: 4
plan_head_before: c34df5f275b374ecfe046cb46d0b70146de94fd4
plan_head_after: ac13abafadf609d6c9e245ba779fc24b9f2941d4

tech-stack:
  added: []
  patterns:
    - 'Прибытие по параметру адреса в уже смонтированный экран: сравнение пропа с запомненным значением во время рендера (setState при смене пропа), удаление параметра через withoutSearchParams и router.replace в эффекте'
    - 'Autocomplete Base UI в режиме mode="none": список групп собирает сам компонент, строки состояния (loading, error, empty) идут псевдоэлементом группы, потому что группа без элементов не рисуется'

key-files:
  created:
    - scripts/dev-checks/entry-web.mjs
  modified:
    - apps/web/app/(app)/_components/command-palette.tsx
    - apps/web/app/(app)/_components/today-screen.tsx
    - apps/web/app/(app)/(today)/page.tsx
    - apps/web/app/(app)/chat/page.tsx
    - apps/web/app/(app)/chat/_components/chat-screen.tsx
    - apps/web/app/(app)/chat/_components/use-chat.ts
    - apps/web/app/(app)/students/[id]/_components/student-profile.tsx
    - scripts/dev-checks/README.md

key-decisions:
  - 'Add payment из палитры ведёт на /?dialog=payment и открывает форму Today (у Today уже есть свежий пояс и asOf), второго владельца диалога в оболочке нет'
  - 'Ученики палитры — активные из /students/options; строка ученика без второй строки (в ответе нет цели, уровня и следующего урока), приём DR-23-05 по README SearchPalette'
  - 'Пустой запрос показывает все три группы (так на эталонном скриншоте), Students всегда рисуется со своим состоянием'
  - 'useChat принимает startNew: при новом разговоре по адресу последний разговор не выбирается и ?c= не пишется; на уже открытом чате новый разговор начинает beginNew без правки адреса'
  - 'Ошибка чтения списка при Ask in chat даёт строку P28 «Could not open chat for this student. Try again.», отсутствие ученика в списке — «This student is no longer available. Choose a student again.»'

requirements-completed: [SHELL-04, CARD-05]

coverage:
  - id: D1
    description: 'Палитра ищет учеников, группы Actions → Students → Screens, @ только ученики, одинаковые имена — разные строки по id, состояния loading, error, empty, IME, фокус на заголовке'
    requirement: SHELL-04
    verification:
      - kind: automated_ui
        ref: 'node scripts/dev-checks/entry-web.mjs palette light|dark'
        status: pass
    human_judgment: false
  - id: D2
    description: 'New chat и Add payment из палитры ничего не записывают сами; форма оплаты открывается один раз без ученика, Ctrl+K при открытом диалоге игнорируется'
    requirement: SHELL-04
    verification:
      - kind: automated_ui
        ref: 'node scripts/dev-checks/entry-web.mjs palette light|dark'
        status: pass
    human_judgment: false
  - id: D3
    description: 'Ask in chat: кнопка у активного, нет у архивного; адрес только new=1 и id; черновик @Имя с привязкой, фокус в поле, ничего не отправлено; архивный по адресу даёт строку P28'
    requirement: CARD-05
    verification:
      - kind: automated_ui
        ref: 'node scripts/dev-checks/entry-web.mjs ask light|dark'
        status: pass
    human_judgment: false

duration: 150min
completed: 2026-10-14
status: complete
---

# Фаза 23, план 04: точки входа — итоги

**Палитра находит учеников и предлагает New chat и Add payment, профиль активной карточки открывает чат с готовым черновиком упоминания; ни один переход ничего не записывает сам.**

## Что сделано

- `command-palette.tsx`: чтение `GET /students/options` при открытии (счётчик запросов отбрасывает устаревший ответ), группы Actions (New chat, Add payment, темы, Sign out), Students, Screens; `mode="none"` с собственной фильтрацией (NFC без регистра), запрос с `@` показывает только учеников; строки «Loading students…», «Could not load students.» с Refresh students и «No students found» идут псевдоэлементом группы; палитра закрывается до перехода; Enter при композиции IME не выбирает; после перехода к ученику фокус ставится на заголовок профиля.
- Today: `page.tsx` разбирает `dialog` (только `payment`), `TodayScreen` получает `arrival`; после чтения Today форма Add payment открывается один раз, параметр убирается, при сбое чтения форма не открывается, параметр убирается.
- Чат: `page.tsx` передаёт `startNew`; `useChat(conversationId, { startNew })` не выбирает последний разговор и не пишет `?c=`; `beginNew` начинает новый разговор на уже открытом чате; `ChatScreen` убирает `new` и `c` из адреса, ставит фокус и при `student` после готового списка учеников ставит черновик `@Имя ` с привязкой упоминания; ученика нет в списке или чтение упало — строка P28 над полем.
- Профиль: кнопка Ask in chat (secondary, MessageSquare) у активной карточки, порядок Ask in chat, Archive, Record payment; у архивной карточки кнопки нет.
- `entry-web.mjs`: разделы `palette` и `ask`, описание в README dev-checks.

## Коммиты задач

1. **Задача 1 (палитра, Today)** — `ce1b05d` (feat), поправка строк состояний — `cf8880b` (fix)
2. **Задача 2 (New chat по адресу, Ask in chat)** — `b238f68` (feat)
3. **Задача 3 (браузерная проверка)** — `ac13aba` (feat)

## Проверки

- `yarn workspace @dv-lab/web typecheck` — 0; `yarn workspace @dv-lab/web lint` — 0; Prettier на файлах плана — чисто.
- `node scripts/dev-checks/entry-web.mjs palette light` и `palette dark` — `ENTRY_WEB_PALETTE_OK` (20 проверок в каждой теме: порядок групп, `@`, две одинаковых карточки с разными id, Enter и фокус на заголовке, New chat без новых строк `chat_conversations` и `chat_messages`, Add payment без записи, Ctrl+K при диалоге, загрузка, сбой чтения и Refresh, пусто, ширина 390 без горизонтальной прокрутки, консоль без новых ошибок).
- `node scripts/dev-checks/entry-web.mjs ask light` и `ask dark` — `ENTRY_WEB_ASK_OK`.
- Скриншоты `entry-palette-*` и `entry-ask-*` в `STATE_DIR` просмотрены в светлой и тёмной темах.
- Карточки `Alex Example 2330`–`2333` и разговор убраны скриптом после каждого прогона.
- Не запускалось: `yarn test`, `yarn build`, `yarn knip` (запрещены в волне), `yarn db:*`.

## Отклонения от плана

### Автоисправления

**1. [Правило 3] Порт 4000 занят dev api владельца**
- Задание говорило, что 4000 свободен, но на нём слушает `yarn workspace @dv-lab/api dev` владельца с `APP_ORIGIN`, указывающим на туннель (проверка Origin отказывает `localhost:3000`). Я его не трогал.
- `entry-web.mjs`: если порт свободен, поднимает свой api; иначе использует работающий и через `page.route` с `route.fetch` подставляет в запросы `/api` значение `APP_ORIGIN` из `.env` (адрес в файлах не записан, читается из окружения). `route.continue` с подменой заголовка работал нестабильно, `route.fetch` проходит стабильно.
- Собственных процессов и портов скрипт после себя не оставляет; на 3000 и 4000 слушают процессы владельца.

**2. [Правило 1] Группа Students без элементов не рисовалась**
- Autocomplete Base UI отбрасывает группу без элементов, поэтому состояния loading, error и empty не показывались. Исправлено в `cf8880b`: состояние — псевдоэлемент группы, который рендерится строкой состояния, а не `Autocomplete.Item`.

**3. [Правило 3] Архивация фикстуры SQL, а не через api**
- `POST /students/:id/archive` теперь требует ревизию карточки (работа 23-02), поэтому архивная карточка проверки ставится прямым `update` в `dvlab_dev` (`status` и `archived_at`).

### Прочие отклонения

- В записи ученика палитры нет второй строки (цели, уровня, следующего урока): `/students/options` отдаёт только id, имя и длину урока; по README SearchPalette она нужна для одинаковых имён. Одинаковые имена различаются только порядком ответа сервера; открытие идёт строго по id. Если дизайну нужна вторая строка, нужен шире ответ api (отдельный план).
- Для действия «Open student» и фокуса на заголовок страница профиля не менялась: палитра дожидается `h1` с именем и ставит на него фокус сама (до 5 секунд).

## Что важно следующим планам

- `useChat(conversationId, { startNew })` и `beginNew` в `use-chat.ts`; `ChatScreen` принимает `startNew`. Прибытие в чат по `?new=1` убирает `new` и `c` из адреса.
- `TodayScreen` принимает `arrival: { payment: boolean }`; чужие вызовы `TodayScreen` без него не соберутся (других вызовов нет).
- `entry-web.mjs` выполняется и против api владельца (подмена Origin), и против собственного api, если порт 4000 свободен.
- Кнопка Ask in chat и ссылка Add payment лежат в шапке профиля; планы 23-06 и 23-07 (вкладка Lessons, правка оплаты) должны сохранить порядок Ask in chat, Archive, Record payment.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности: параметры `new`, `student`, `dialog` разбираются как в плане (только `1`, UUID и `payment`), имя и черновик строятся на клиенте из списка учеников по id.

## Self-Check: PASSED

- Файлы: `scripts/dev-checks/entry-web.mjs`, `apps/web/app/(app)/_components/command-palette.tsx`, `apps/web/app/(app)/chat/_components/chat-screen.tsx` — на месте.
- Коммиты `ce1b05d`, `b238f68`, `cf8880b`, `ac13aba` — в истории ветки.
