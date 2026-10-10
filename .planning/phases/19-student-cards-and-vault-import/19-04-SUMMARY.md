---
phase: 19-student-cards-and-vault-import
plan: 04
subsystem: core
tags: [packages-core, money, intl, lessons, balance, knip, ci]

requires:
  - phase: 19-student-cards-and-vault-import
    provides: каркас @dv-lab/core и ссылки на него в api и web (19-01)
provides:
  - "money.ts: currencyDigits, parseMoney, formatMoney, minorToInput, currencySymbol"
  - "lessons.ts: parseLessons, hundredthsToDecimal, decimalToHundredths, formatHundredths, suggestLessons, creditedMinutes, lessonsToMinutes, formatLessons, lessonsPhrase, localIsoDate"
  - "balance.ts: balanceMinutes"
  - "knip.json: рабочая область packages/core"
  - "ci.yml, шаг Web and api boundary: три проверки границы core"
affects: [19-07, 19-08, 19-09, 19-11, 19-12, 19-13, 19-19]

actuals:
  tokens: 1450
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "деньги в целых минимальных единицах, уроки в целых сотых долях; разбор только через строки, без умножения дробей"
    - "показ денег и уроков только через Intl.NumberFormat en-US в core"

key-files:
  created:
    - packages/core/src/money.ts
    - packages/core/src/lessons.ts
    - packages/core/src/balance.ts
  modified:
    - packages/core/src/index.ts
    - knip.json
    - .github/workflows/ci.yml

key-decisions:
  - "lib ES2023 в packages/core/tsconfig.json хватает: tsc знает trailingZeroDisplay и signDisplay 'negative' (A2 подтверждено, tsconfig не менялся)"
  - "creditedMinutes и lessonsToMinutes округляют половину от нуля (для положительных значений совпадает с Math.round из плана, для отрицательного открывающего остатка симметрично)"
  - "formatLessons с signDisplay 'negative': не бывает '-0'"
  - "formatHundredths собирается из строки hundredthsToDecimal без группировки, чтобы строку предзаполнения поля Lessons снова принимал parseLessons"
  - "localIsoDate собирает YYYY-MM-DD из formatToParts en-CA, а не из готовой строки format"
  - "проверка зависимостей core в CI смотрит dependencies, peerDependencies и optionalDependencies"

requirements-completed: [LEDG-01, LEDG-02, LEDG-09]

plan_head_before: 5f30106
plan_head_after: e22294f

duration: 15min
completed: 2026-10-10
status: complete
---

# Phase 19 Plan 04: Правила денег, уроков и остатка в packages/core Summary

**Чистые функции core для денег (разбор и показ по Intl en-US с narrowSymbol и stripIfInteger), уроков в сотых долях, зачтённых минут, перевода открывающего остатка и свёртки остатка; knip и CI держат границу core как у contracts.**

## Performance

- **Duration:** около 15 мин
- **Tasks:** 3
- **Files modified:** 6 (три новых файла core, index.ts, knip.json, ci.yml)

## Accomplishments

- `money.ts`: число знаков валюты из Intl (для пустой валюты 2), разбор суммы из текста формы в целые минимальные единицы склейкой строк целой и дробной части, показ `₽1,500` / `₽1,500.50` / `₸90,000` и `1,500` без валюты, строка для поля формы без группировки, узкий символ валюты.
- `lessons.ts`: уроки в сотых долях (0..9999999), перевод в строку `numeric(7,2)` и обратно через строки, предзаполнение уроков по ставке только при совпадающей валюте, зачтённые минуты и минуты открывающего остатка, показ уроков до двух знаков и фраза `1 lesson` / `N lessons`, локальная дата `YYYY-MM-DD`.
- `balance.ts`: `balanceMinutes(openingMinutes, credited)` — null без открывающего остатка, иначе сумма; отбора по дате нет (его делает модуль карточек api, находка 4 осмотра).
- `knip.json`: блок `packages/core` рядом с contracts; `ci.yml`: в шаге `Web and api boundary` три проверки core (ноль зависимостей, нет импортов `pg`, `node:*`, `@dv-lab/*`, нет `process.env`).

## Task Commits

1. **Задача 1 (tracer): деньги в core, импорт из apps/api** - `8d4f974` (feat)
2. **Задача 2: уроки, зачтённые минуты, остаток, дата** - `26934df` (feat)
3. **Задача 3: knip и граница core в CI** - `e22294f` (ci)

**Plan metadata:** коммит `docs(19-04)` с этим файлом.

Число коммитов посчитано по `git log --grep="(19-04)"`: в той же ветке параллельно коммитили 19-03, 19-05 и 19-06, поэтому `git rev-list 5f30106..HEAD` их тоже включает.

## Проверки

| Проверка | Результат |
|----------|-----------|
| `yarn workspace @dv-lab/core typecheck` (после каждой задачи) | без ошибок |
| `19-04-core.mjs money` | 29 PASS, `CORE_MONEY_OK` |
| tracer-гейт: повтор verify задачи 1 после коммита | `CORE_MONEY_OK` |
| `19-04-core.mjs` (обе части) | 68 PASS (29 денег и 39 уроков), 0 FAIL, `CORE_MONEY_OK` и `CORE_LESSONS_OK` |
| импорт `@dv-lab/core` из каталога apps/api (`node --input-type=module -e`) | `₽1,500` |
| `! grep -nE "parseFloat\|\* *100(\b\|\))" money.ts` | совпадений нет |
| `! grep -nE "parseFloat\|Number\(.*\) *\* *100" lessons.ts` | совпадений нет |
| `! grep -nE "paidOn\|openingOn\|> *opening" balance.ts` | совпадений нет |
| `19-04-boundary.sh` (те же команды, что в ci.yml, плюс самопроверка шаблона на apps/api/src/server.ts) | `BOUNDARY_OK` |
| `node -e` по knip.json (entry `src/index.ts` у packages/core) | код 0 |
| `grep -c "packages/core" ci.yml` | 5 |
| `prettier --check` по packages/core/src, knip.json, ci.yml | чисто |
| `yarn knip --workspace packages/core` | только подсказка «Remove redundant entry pattern» для `src/index.ts` (та же форма блока, что у contracts) |

Таблица случаев (вход → результат, все совпали с планом):

- currencyDigits: RUB, KZT, USD, EUR, null → 2.
- parseMoney: '1 500' RUB → 150000; '1500,5' → 150050; '1500.55' → 150055; '1500.555' → null; '0' → null; '-5' → null; 'abc' → null; '9,999' KZT → null; '1 234' (обычный пробел и U+00A0) RUB → 123400; '1 234,50' (обычный пробел и U+202F) без валюты → 123450.
- formatMoney: 150000 RUB → '₽1,500'; 150050 RUB → '₽1,500.50'; 9000000 KZT → '₸90,000'; 150000 null → '1,500'; 150050 null → '1,500.50'.
- minorToInput: 150050 RUB → '1500.5'; 150000 RUB → '1500'.
- currencySymbol: RUB '₽', KZT '₸', USD '$', EUR '€'.
- parseLessons: '1.5' → 150; '1,25' → 125; ' 2 ' → 200; '0' → 0; '0.333', '-1', '', 'abc', '100000' → null.
- hundredthsToDecimal: 150 → '1.50'; 5 → '0.05'. decimalToHundredths: '1.50' → 150; '0.05' → 5; '12' → 1200.
- formatHundredths: 150 → '1.5'; 200 → '2'; 25 → '0.25'.
- suggestLessons: 250000 RUB при ставке 100000 RUB → 250; 100000 RUB при 300000 RUB → 33; 100000 KZT при RUB → null; без ставки → null.
- creditedMinutes: (150,60) → 90; (33,60) → 20; (150,45) → 68; (null,60) → 0. lessonsToMinutes(300,60) → 180.
- formatLessons при 60: 90 → '1.5'; 15 → '0.25'; 20 → '0.33'; 180 → '3'; 0 → '0'; -80 → '-1.33'.
- lessonsPhrase: 60 → '1 lesson'; 90 → '1.5 lessons'; 0 → '0 lessons'.
- balanceMinutes: (null,[60]) → null; (180,[]) → 180; (180,[60,30]) → 270.
- localIsoDate(new Date(2026, 9, 9, 0, 30)) → '2026-10-09'.

Дополнительно (`19-04-edges.mjs`, вне таблицы плана): formatLessons(-1,60) → '-0.02'; lessonsToMinutes(-150,45) → -68; hundredthsToDecimal(-5) → '-0.05'; decimalToHundredths('-1.50') → -150; formatHundredths(100000) → '1000' (без группировки); parseLessons('99999.99') → 9999999; formatMoney(1500,'JPY') → '¥1,500'; parseMoney('1500.5','JPY') → null; parseMoney('1500.','RUB') → null.

Не запускалось: полный `yarn knip` (красный до 19-19 по правилам фазы), lint и build (в плане не требуются, web и api core пока не вызывают), новые тесты (директива владельца, у core нет скрипта test).

## Decisions Made

См. key-decisions во frontmatter. Главное: lib ES2023 хватило, tsconfig core не менялся (A2 подтверждено).

## Deviations from Plan

### Auto-fixed Issues

None.

### Уточнения реализации (в рамках формулировок плана)

- creditedMinutes и lessonsToMinutes округляют половину от нуля вместо голого `Math.round`: для неотрицательных сотых результат тот же (вся таблица плана), для отрицательного открывающего остатка `-67.5` даёт `-68`, а не `-67`, как округляет Intl в formatLessons.
- formatLessons получил `signDisplay: 'negative'`, чтобы малые отрицательные значения не показывались как `-0`.
- Проверка зависимостей core в CI смотрит также peerDependencies и optionalDependencies (план называл только dependencies; «ноль зависимостей» строже).
- В таблице 19-04-core.mjs случаи с пробелами прогнаны дважды: с обычным пробелом и с U+00A0 / U+202F.

## Issues Encountered

- В shell `grep` — это ugrep, он не принимает `(\b|\))` из acceptance-шаблона; проверки выполнены `/usr/bin/grep` с тем же шаблоном.
- `yarn prettier --write` переформатировал lessons.ts (перенос аргументов) до коммита.

## Known Stubs

None.

## Threat Flags

Нет новой поверхности: чистые функции без ввода-вывода. T-19-09 (плавающая точка): разбор денег и уроков через строки, grep на parseFloat чист. T-19-10: в balance.ts нет сравнения дат. T-19-11: CI-проверки границы core добавлены и прогнаны скриптом.

## Next Phase Readiness

- api (19-07, 19-08) и импорт (19-09) берут `parseMoney`, `decimalToHundredths`, `hundredthsToDecimal`, `creditedMinutes`, `lessonsToMinutes`, `balanceMinutes` из `@dv-lab/core`; отбор оплат по дате открытия остаётся в модуле карточек api.
- web (19-11 и далее) показывает деньги через `formatMoney`, уроки через `formatLessons` / `lessonsPhrase`, предзаполняет поле Lessons через `suggestLessons` + `formatHundredths`, поле суммы через `minorToInput`, пункты валюты через `currencySymbol`, «сегодня» через `localIsoDate`.
- `decimalToHundredths` бросает Error на строке не в форме `-?\d+(\.\d{1,2})?` (ожидает значение столбца numeric(7,2)); для ввода учителя нужен `parseLessons`.
- knip будет сообщать о неиспользуемых экспортах core, пока их не подключат api и web.

## Self-Check: PASSED

- packages/core/src/money.ts, lessons.ts, balance.ts, index.ts существуют.
- Коммиты 8d4f974, 26934df, e22294f есть в `git log`.

---
*Phase: 19-student-cards-and-vault-import*
*Completed: 2026-10-10*
