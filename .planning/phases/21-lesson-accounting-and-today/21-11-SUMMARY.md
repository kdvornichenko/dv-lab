---
phase: 21-lesson-accounting-and-today
plan: 11
subsystem: web
status: complete
tags: [today, lesson-marks, lesson-dialogs, payments, e2e, design-v40]
requires:
  - phase: 21-08
    provides: 'Мутация markLesson и существующий диалог отметки'
  - phase: 21-10
    provides: 'Чтение Today, строки уроков и Pays soon'
  - phase: 21-17
    provides: 'Действия начавшегося урока по D-17'
provides:
  - 'Быстрые отметки Today с исправлением и снятием'
  - 'Общий LessonDialogs для Today и расписания'
  - 'Изолированный Add payment с выбором активного ученика'
affects: [21-12, 21-13, 21-18]
requirements: [SHELL-05, LEDG-03, LEDG-06]
tech-stack:
  added: []
  patterns:
    - 'Одна markLesson и перечитывание после мутации'
    - 'Защита повторной отправки и устаревшего ответа'
    - 'E2E через публичный UI и настоящую persistence'
key-files:
  created:
    - apps/web/app/(app)/_components/today-mark-controls.tsx
    - apps/web/app/(app)/schedule/_components/lesson-dialogs.tsx
    - apps/web/app/(app)/students/[id]/_components/payment-student-picker.tsx
    - scripts/dev-checks/ledger-web/common.mjs
    - scripts/dev-checks/ledger-web/marks-dialog.mjs
    - scripts/dev-checks/ledger-web/marks-view.mjs
    - scripts/dev-checks/ledger-web/settings.mjs
    - scripts/dev-checks/ledger-web/students.mjs
    - scripts/dev-checks/ledger-web/today-due.mjs
    - scripts/dev-checks/ledger-web/today-marks.mjs
    - scripts/dev-checks/ledger-web/today-payment.mjs
    - scripts/dev-checks/ledger-web/today-read.mjs
    - scripts/dev-checks/ledger-web/today-rows.mjs
    - scripts/dev-checks/ledger-web/today.mjs
  modified:
    - apps/web/app/(app)/_components/today-lessons.tsx
    - apps/web/app/(app)/_components/today-screen.tsx
    - apps/web/app/(app)/schedule/_components/schedule-screen.tsx
    - apps/web/app/(app)/students/[id]/_components/record-payment-dialog.tsx
    - apps/web/lib/lesson-mark-text.ts
    - scripts/dev-checks/ledger-web.mjs
key-decisions:
  - 'UI соответствует v40; действия урока сохраняют принятый D-17'
  - 'Add payment имеет отдельный коммит и отдельный journey today-payment'
  - 'Фикстуры убираются только по ID карточек, созданных текущим прогоном'
  - 'Production web проверен через штатный Next webpack после ограничения Turbopack EPERM'
plan_head_before: 6e35fe07b4ee36da8eaf20a7c35c97957535234b
plan_head_after: 34da0dc1395f1926be18218ee4c0d50446f426a2
commits: 3
actuals:
  tokens: 57975
  tasks: 3
  commits: 3
duration: 'unverified: точное время запуска не сохранено'
completed: 2026-10-11
---

# Фаза 21, план 11: действия Today — SUMMARY

Today сохраняет, исправляет и снимает отметки через существующую markLesson. Today и расписание открывают общий хост диалогов урока. Add payment записывает оплату выбранному активному ученику и обновляет Pays soon.

## Выполненные задачи

| Задача | Результат                                                                                                 | Коммит    |
| ------ | --------------------------------------------------------------------------------------------------------- | --------- |
| 1      | Done / No-show, меню исправления, Clear mark, pending, ошибка строки, stale reload                        | `fe16465` |
| 2      | Общий LessonDialogs; строка, Enter и Esc; отмена и восстановление по D-17; фокус строки                   | `0008714` |
| 3      | Add payment во всех состояниях Today; Student без preset; сохранение и обновление Today; профиль сохранён | `34da0dc` |

Каждая задача закоммичена отдельно с обычными хуками и трейлером Codex. Перед каждым коммитом получен ROOT_PIN_OK. Удалений файлов нет. Snapshot проверок плана: `34da0dc1395f1926be18218ee4c0d50446f426a2`.

## Изменённые файлы

Пути относительны корню существующего worktree. В коде плана изменены 20 файлов.

| Файл                                                                      | Причина                                                           |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `apps/web/app/(app)/_components/today-mark-controls.tsx`                  | Быстрые кнопки, меню, pending guard и одна markLesson             |
| `apps/web/app/(app)/_components/today-lessons.tsx`                        | Основная кнопка строки, отдельные кнопки отметки и ошибка строки  |
| `apps/web/app/(app)/_components/today-screen.tsx`                         | Перечитывание, общий диалог, фокус и действие оплаты              |
| `apps/web/app/(app)/schedule/_components/lesson-dialogs.tsx`              | Общий хост урока и диалогов серии; чтение недели для overlaps     |
| `apps/web/app/(app)/schedule/_components/schedule-screen.tsx`             | Использование общего хоста и актуального перечитывания            |
| `apps/web/app/(app)/students/[id]/_components/record-payment-dialog.tsx`  | Необязательный preset, выбор ученика, validation и submit guard   |
| `apps/web/app/(app)/students/[id]/_components/payment-student-picker.tsx` | Активные ученики, чтение карточки, latest-response guard и ошибка |
| `apps/web/lib/lesson-mark-text.ts`                                        | Общая подпись Clear mark                                          |
| `scripts/dev-checks/ledger-web.mjs`                                       | Диспетчер существующих journeys и двух разделов плана             |
| `scripts/dev-checks/ledger-web/common.mjs`                                | Общие helpers и уборка только собственных ID, включая оплаты      |
| `scripts/dev-checks/ledger-web/marks-view.mjs`                            | Существующие проверки вида и tooltip отметок                      |
| `scripts/dev-checks/ledger-web/marks-dialog.mjs`                          | Существующие действия диалога отметки                             |
| `scripts/dev-checks/ledger-web/students.mjs`                              | Сохранённый journey карточек из общего скрипта                    |
| `scripts/dev-checks/ledger-web/settings.mjs`                              | Сохранённый journey настроек из общего скрипта                    |
| `scripts/dev-checks/ledger-web/today-read.mjs`                            | Чтение, ошибки, счётчики, зона и смена дня                        |
| `scripts/dev-checks/ledger-web/today-rows.mjs`                            | Строки, Earlier, пустое состояние и узкий экран                   |
| `scripts/dev-checks/ledger-web/today-due.mjs`                             | Существующий journey Pays soon                                    |
| `scripts/dev-checks/ledger-web/today.mjs`                                 | Последовательность Today и read-only проверка порога              |
| `scripts/dev-checks/ledger-web/today-marks.mjs`                           | E2E быстрых отметок и общего диалога                              |
| `scripts/dev-checks/ledger-web/today-payment.mjs`                         | Изолированный E2E выбора и записи оплаты                          |

Этот SUMMARY — отдельный документ и отдельный docs(21-11) commit. Внутренняя декомпозиция объявлена до правок. Публичные API и contracts не изменены. Новых зависимостей нет. E2E-инфраструктура плана 21-18 не добавлена.

## Failure modes и наблюдаемые исходы

Сценарии записаны до реализации поведения.

| Риск                                 | Ожидаемый исход                                                                            | Наблюдаемый исход                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Успешная отметка                     | Сохраняется в persistence, меняются строка, счётчик и остаток                              | Подтверждено в today-marks                     |
| Исправление / снятие                 | No-show и Clear mark проходят той же мутацией; остаток пересчитан                          | Подтверждено в today-marks                     |
| Повторный клик                       | Одна отправка; обе кнопки disabled; spinner; геометрия строки сохраняется                  | Подтверждено в today-marks                     |
| Отказ отметки                        | Старая отметка сохранена; ошибка в строке; повторная попытка доступна                      | Подтверждено принудительным отказом            |
| Stale отметки                        | Today перечитывается; старая ошибка исчезает                                               | Подтверждено stale-сценарием                   |
| Строка против кнопки                 | Кнопка отметки не открывает диалог; строка и Enter открывают его                           | Подтверждено в today-marks                     |
| Esc / отмена / восстановление        | Фокус возвращается; отменённая строка зачёркнута; восстановленная сохраняет отметку        | Подтверждено по D-17                           |
| Earlier                              | Отмеченная строка уходит; панель существует ровно при наличии других строк                 | Подтверждено в today-marks                     |
| Today loading / error                | Add payment доступен во всех состояниях                                                    | Подтверждено в today-payment                   |
| Нет ученика / pending карточки       | Save payment недоступен                                                                    | Подтверждено в today-payment                   |
| Устаревшая карточка A после выбора B | Сохраняются последний выбор и его валюта                                                   | Подтверждено задержанным ответом A             |
| Отказ оплаты                         | Запись не появляется; введённая сумма сохраняется                                          | Подтверждено принудительным отказом            |
| Запись оплаты                        | Оплата записана выбранной карточке; второй карточке ничего не записано; Pays soon обновлён | Подтверждено UI и чтением реальной persistence |
| Оплата из профиля                    | Нет поля Student; существующая запись оплаты работает                                      | Подтверждено в today-payment                   |

Успешные мутации выполнялись публичным UI через настоящий API и dev PostgreSQL. Перехват сети применён для отказов, задержек и ошибок чтения. Сохранение не подменялось. Фикстуры и чтение результата используют публичный API; SQL используется только для уборки собственных фикстур и итогового счётчика.

## Проверки

Все команды выполнялись с workdir:

`/Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today`

Полная команда первого браузерного journey:

```sh
env PLAYWRIGHT_CORE='/Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/node_modules/playwright-core/index.mjs' node scripts/dev-checks/ledger-web.mjs today-marks
```

В остальных браузерных строках таблицы перед `node` использован тот же `env PLAYWRIGHT_CORE` с этим абсолютным путём. Установленный Playwright: `@playwright/test 1.63.0`, локальный playwright-core. UI-проверки использовали браузерную зону America/New_York; Today показывал дату и время Asia/Ho_Chi_Minh.

| Команда после общего префикса, где он нужен                                                                 | Exit | Решающий результат                                                        |
| ----------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------- |
| `yarn workspace @dv-lab/web typecheck`                                                                      | 0    | TypeScript без ошибок                                                     |
| `yarn workspace @dv-lab/web lint`                                                                           | 0    | ESLint без ошибок                                                         |
| `yarn workspace @dv-lab/web build --webpack`                                                                | 0    | Next 16.4.0: Compiled successfully; TypeScript; 8/8 страниц; build traces |
| `node scripts/dev-checks/ledger-web.mjs today-marks`                                                        | 0    | TODAY_MARKS_PART1_OK и LEDGER_WEB_TODAY_MARKS_OK                          |
| `node scripts/dev-checks/ledger-web.mjs today-marks dark`                                                   | 0    | Те же два маркера, тёмная тема                                            |
| `node scripts/dev-checks/ledger-web.mjs today-payment`                                                      | 0    | LEDGER_WEB_TODAY_PAYMENT_OK                                               |
| `node scripts/dev-checks/ledger-web.mjs today-payment dark`                                                 | 0    | LEDGER_WEB_TODAY_PAYMENT_OK                                               |
| `node scripts/dev-checks/ledger-web.mjs marks`                                                              | 0    | LEDGER_WEB_MARKS_OK                                                       |
| `node scripts/dev-checks/ledger-web.mjs today`                                                              | 0    | TODAY_WEB_PART1/2/3_OK и LEDGER_WEB_TODAY_OK                              |
| `node scripts/dev-checks/wait-dev.mjs up`                                                                   | 0    | DEV_UP_OK                                                                 |
| `node scripts/dev-checks/wait-dev.mjs down`                                                                 | 0    | DEV_DOWN_OK; свои процессы остановлены                                    |
| `node node_modules/.cache/21-11/quality.cjs`                                                                | 0    | 20 файлов; 384 функции/колбэка; нарушений нет                             |
| `node node_modules/.cache/21-11/types.cjs`                                                                  | 0    | 8 TS/TSX файлов; 355 bindings и 149 функций; any findings: []             |
| `git diff 6e35fe07b4ee36da8eaf20a7c35c97957535234b --check`                                                 | 0    | Вывод пуст                                                                |
| `git grep -nE '<LessonDialog[[:space:]]*$\|<LessonDialog[[:space:]]' -- apps/web`                           | 0    | Единственное место: lesson-dialogs.tsx:135                                |
| `rg -n 'apiRequest\|markLesson\|CLEAR_MARK_LABEL' 'apps/web/app/(app)/_components/today-mark-controls.tsx'` | 0    | markLesson и общая подпись; apiRequest отсутствует                        |

Точная проверка форматирования задачи 3:

```sh
yarn prettier --check 'apps/web/app/(app)/_components/today-screen.tsx' 'apps/web/app/(app)/students/[id]/_components/record-payment-dialog.tsx' 'apps/web/app/(app)/students/[id]/_components/payment-student-picker.tsx' scripts/dev-checks/ledger-web.mjs scripts/dev-checks/ledger-web/common.mjs scripts/dev-checks/ledger-web/today-payment.mjs
```

Exit 0: `All matched files use Prettier code style!`

Точная итоговая проверка фикстур:

```sh
node scripts/dev-checks/sql.mjs .env migrator "select count(*)::int as n from students where display_name like 'Alex Example 21%' and import_key is null"
```

Exit 0: `rows:[{"n":0}]`. Настоящие импортированные карточки не менялись. Учительские настройки читались; исходное состояние сохранено.

### Регрессия расписания без чужих фикстур

Пройденные read и changes относятся к snapshot задачи 2 `0008714`. Задача 3 общий хост и его зависимости не меняет. Повторные прогоны после задачи 3 выполнены только для changed-input Today и today-marks.

Чтобы сохранить чужие карточки, существующий schedule-web запущен без изменения файла. Только в памяти заменены номера фикстур на диапазон плана и сужена уборка. Точный выполненный запуск для read:

```sh
env PLAYWRIGHT_CORE='/Volumes/T7/personal/dv-lab/.claude/worktrees/gsd+phase-21-lesson-accounting-and-today/node_modules/playwright-core/index.mjs' node --input-type=module -e 'import { readFileSync } from '\''node:fs'\'';
process.argv.splice(1, 0, '\''scripts/dev-checks/schedule-web.mjs'\'');
let source = readFileSync('\''scripts/dev-checks/schedule-web.mjs'\'', '\''utf8'\'');
source = source.replaceAll("from '\''../../packages/core/src/index.ts'\''", "from '\''" + new URL('\''packages/core/src/index.ts'\'', '\''file://'\'' + process.cwd() + '\''/'\'').href + "'\''").replaceAll("from '\''./web.mjs'\''", "from '\''" + new URL('\''scripts/dev-checks/web.mjs'\'', '\''file://'\'' + process.cwd() + '\''/'\'').href + "'\''");
source = source.replaceAll('\''Alex Example 2007'\'', '\''Alex Example 2187'\'').replaceAll('\''Alex Example 2008'\'', '\''Alex Example 2188'\'').replaceAll('\''Alex Example 2141'\'', '\''Alex Example 2189'\'').replaceAll("like = '\''Alex Example 20%'\''", "like = '\''Alex Example 2188%'\''");
await import('\''data:text/javascript;base64,'\'' + Buffer.from(source).toString('\''base64'\''));' read
```

Та же команда с последним аргументом `changes` проверила изменения расписания.

| Раздел  | Exit | Результат               |
| ------- | ---- | ----------------------- |
| read    | 0    | SCHEDULE_WEB_READ_OK    |
| changes | 0    | SCHEDULE_WEB_CHANGES_OK |

Это автоматическая браузерная регрессия. Ручной календарный UAT отложен пользователем до Google-синхронизации и не объявлен пройденным.

### Версия и фикстуры E2E

Финальные today-payment в обеих темах, today-marks и today проверены на неизменённом product-коде, закоммиченном как `34da0dc`. Тёмный today-marks и независимые marks/read/changes доказаны на `0008714`; соответствующие действия задачи 3 не изменены.

| Journey / fixture reference                       | Ожидаемый результат                                                                          | Наблюдение                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `today-marks.mjs`: fixture 2180                   | Один lesson mark; исправление; снятие; отказ; stale; строка и Earlier                        | Все assertions пройдены; 1 собственная карточка убрана                  |
| `today-payment.mjs`: fixtures 2181 A/B            | Выбранная карточка получает оплату; вторая не получает; Pays soon меняется; профиль работает | Все assertions в обеих темах; 2 собственные карточки и их оплаты убраны |
| `marks-dialog.mjs`: fixtures 2182/2183            | Существующий диалог и его mark/cancel/future-сценарии                                        | LEDGER_WEB_MARKS_OK                                                     |
| `today-read.mjs`, `today-rows.mjs`: fixtures 2184 | Чтение, ошибка, смена дня, строки, Earlier, 320 px                                           | TODAY_WEB_PART1_OK / PART2_OK                                           |
| `today-due.mjs`: fixtures 2185                    | Порядок и состояния Pays soon, ссылки и фокус                                                | TODAY_WEB_PART3_OK                                                      |
| `schedule-web.mjs`: remap 2187/2188/2189          | Существующие read/changes, серия, отмена, перенос и stale                                    | Оба SCHEDULE_WEB маркера; cleanup пройден                               |

Для повторного запуска нужен один dev-стек, существующая .env и приведённый локальный PLAYWRIGHT_CORE. Команды запуска собственного стека были `env -u DATABASE_URL -u MIGRATOR_DATABASE_URL yarn workspace @dv-lab/api dev` и `yarn workspace @dv-lab/web dev`. Во время final build стек уже был остановлен. Значения credentials не печатались.

## Code Quality Gates и simplify

Применены навыки simplify и cyclomatic-complexity к owned diff. Подтверждённых dead/redundant-code findings не осталось. Финальный simplify не потребовал новых product-правок.

Область: 20 изменённых source/tooling файлов; 384 функции/колбэка. Измерения реальны, по ESLint 10.12.0 и TypeScript 6.0.3 scanner/AST. Локальные измерители и подробный JSON находятся в игнорируемом `node_modules/.cache/21-11/`; они не добавлены в репозиторий.

| Критерий                                          | Максимум   | Порог   |
| ------------------------------------------------- | ---------- | ------- |
| Cyclomatic, ESLint classic, каждая функция/колбэк | 21         | <22     |
| Cognitive по локальной AST-конвенции              | 18         | <22     |
| Halstead Difficulty                               | 34,6       | <80     |
| Физические строки, включая пустые и комментарии   | 432        | <500    |
| Явный или выведенный any в изменённых TS/TSX      | 0 findings | Нет any |

Cognitive учитывает ветвление, вложенность, else-if и последовательности логических операторов; вложенные функции измерены отдельно. Сравнение с SonarJS не выполнялось: совместимость конвенций unverified.

Halstead: пунктуация и keywords — операторы; identifiers/literals — операнды. Trivia пропускается. TS-синтаксис учитывается. Тела вложенных функций исключаются из родителя и измеряются отдельно. Формула D = (n1 / 2) × (N2 / n2). Это локальная scanner-конвенция; полного JS/TS type erasure нет.

До/после — максимум отдельной функции/колбэка в каждом модуле относительно исходного `6e35fe0`, без усреднения:

| Модуль                                              | CC до → после    | Cognitive до → после |
| --------------------------------------------------- | ---------------- | -------------------- |
| today-lessons                                       | 8 → 10           | 7 → 10               |
| today-mark-controls                                 | новый → 5        | новый → 4            |
| today-screen                                        | 5 → 7            | 5 → 6                |
| lesson-dialogs                                      | новый → 14       | новый → 10           |
| schedule-screen                                     | 32 → 17          | 30 → 16              |
| record-payment-dialog                               | 15 → 19          | 12 → 18              |
| payment-student-picker                              | новый → 9        | новый → 8            |
| исходный ledger-web → распределённые journey-модули | 42 → максимум 21 | 29 → максимум 15     |

В ходе задачи 3 validation/description вынесены в предметные helper-функции: промежуточные CC 29 / cognitive 27 устранены. В исходном ledger-web имелось 1894 строки; декомпозиция выполнена по существующим journeys, а не по номерам строк. Изменённые TS/TSX bindings и returns проверены TypeScript Program. Статическая типизация перенесённых .mjs как TypeScript не заявлена; inferred-any проверка для нетипизированного JS unverified. Это не полный аудит репозитория или доказательство отсутствия любого dead code.

Подробный JSON хранит SHA-256 каждого файла и значения каждой функции. Совокупный fingerprint 20 product/tooling файлов на момент измерения: `071de1625dccaf3b0be651dd1a50bf9d9906052e046fac58bfbaae9a096824c2`. Основной воспроизводимый идентификатор кода — полный commit `34da0dc1395f1926be18218ee4c0d50446f426a2`.

## Отклонения и ограничения

1. Актуальные указания владельца заменяют старые модели, пути и дизайн v36 в PLAN. Использованы текущий Codex, ~/.codex/gsd-core и v40.
2. Внутренняя декомпозиция браузерного скрипта закрывает file-size и complexity gates. Существующие journeys сохранены. Добавлены только запрошенные функциональные разделы today-marks и today-payment.
3. Уборка фикстур ограничена ID, созданными текущим процессом. Настройки читаются без мутации. При переходе урока через время начала Today перечитывает eligibility из core.
4. Первые браузерные попытки выявили ожидания анимации меню/Select. Первый today-payment в светлой теме завершился exit 1 на выборе следующего option во время закрытия popup; cleanup прошёл. После выбора await ожидает закрытия listbox. Исправленная проверка завершилась exit 0 в обеих темах; это не обход UI.
5. `yarn workspace @dv-lab/web build` завершился exit 1 из-за Turbopack EPERM при внутреннем bind CSS/PostCSS. Повтор с escalation дал тот же exit 1. Установленный Next поддерживает --webpack; production-сборка тем же Next через webpack завершилась exit 0, включая TypeScript и standalone traces. Turbopack-сборка в этом окружении остаётся unverified; она не записана как PASS.
6. Для dev-процессов и Playwright использована разрешённая escalation после sandbox EPERM/EMFILE. Хуки коммитов не отключались. yarn test и api build не запускались.
7. Ручной календарный UAT отложен. Source/метрики плана относятся к snapshot 34da0dc. Последующий F1 backend fix родителя в core/schedule и api/schedule не входит в 21-11; runtime-проверки этой версии принадлежат 21-13/21-18.
8. STATE, ROADMAP, HANDOFF и служебные JSON не изменены исполнителем. Generated apps/web/AGENTS.md, .planning/state.json и milestone.lock сохранены неотслеживаемыми.
9. Точное время начала исполнения не сохранено; полная duration unverified. Подтверждённый интервал между первым и третьим task commit — 26 мин 30 с. Это не выдано за полную duration.

### Stubs и границы доверия

UI-заглушек, мешающих цели плана, нет. Пустые draft/loading состояния имеют настоящие источники данных. Скан нашёл сохранённый fallback `SKIP day change: page.clock is not available` в today-read; на Playwright 1.63.0 эта ветка не исполнялась, проверки смены дня прошли. Новых network endpoints, auth paths или schema изменений нет. Использованы существующие /students, /payments и /mark.

## Actuals

Из ledger `gsd-plan-head-before-21-11` прочитан исходный HEAD. `git rev-list --count 6e35fe07b4ee36da8eaf20a7c35c97957535234b..34da0dc1395f1926be18218ee4c0d50446f426a2` дал 3 task commits. Отдельный последующий docs commit не входит в эту измеренную границу.

Реализованный git diff между этими HEAD содержит 231899 символов. На шкале estimateTokens chars/4, с округлением вверх: 57975. Это не счётчик токенов рантайма. Измерение выполнено до SUMMARY и excludes docs commit.

## Готовность следующего плана

Все три product-задачи 21-11 завершены. Собственный dev-стек остановлен; DEV_DOWN_OK и нулевой счётчик фикстур подтверждены. Следующий план по очереди — 21-12; оркестратор ведёт docs/finalchecks и проверки backend в 21-13/21-18.

## Self-Check: PASSED

Проверены 21 файл, включая SUMMARY: missing = []. Проверены коммиты fe16465, 0008714 и 34da0dc через git merge-base --is-ancestor: absent = []. Все 20 owned source/tooling файлов совпадают с snapshot 34da0dc: ownedFilesChangedSinceSnapshot = []. Команда self-check завершилась exit 0. Generated AGENTS.md и служебные JSON не включены в write set.
