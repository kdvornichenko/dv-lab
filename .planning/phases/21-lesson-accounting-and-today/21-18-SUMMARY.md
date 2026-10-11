---
phase: 21-lesson-accounting-and-today
plan: 18
subsystem: testing
tags: [playwright, e2e, today, lesson-accounting]
requires:
  - phase: 21-13
    provides: Итоговая приёмка и dev baseline
provides:
  - Девять durable E2E journeys в light/dark
  - Изоляция собственных фикстур и точное восстановление настроек
  - Exit opacity Earlier за 80 мс
affects: [phase-21-final-verification]
tech-stack:
  added: []
  patterns: [typed-public-interface-e2e]
requirements-completed: [LEDG-03, LEDG-04, LEDG-05, LEDG-06, LEDG-07, LEDG-08, SHELL-05, SCHED-02]
completed: 2026-10-11
---

# 21-18: durable E2E

## Результат и границы

Девять journeys прошли в обеих темах через публичный UI/API и настоящую `dvlab_dev`. Доказательства собраны несколькими ограниченными запусками: 18 уникальных выполнений, без повторения зелёного real-clock сценария. Фикстуры — только восемь точных синтетических имён 2182–2189 с `import_key IS NULL` и ownership ledger.

Исходный HEAD: `c53b08c507dca4ca6d110d2622fbffe2d09164b4`. Установка Playwright уже выполнена отдельным `e8782a4`; зависимости и lockfile здесь не менялись. Вместо `.mjs` используются 13 TS-файлов с проверкой explicit/inferred any. Корневой `type: module` нужен загрузке `paths.mjs` из Playwright config. Workspace package boundaries сохранены.

Коммиты реализации: `4dc57f3` — opacity fix; `ad5b901` — infrastructure; `0acdbf7` — journeys; `a28bfaf` — docs. Последний коммит содержит только этот SUMMARY.

## Runtime

Raw evidence и первоначальные статусы: `/private/tmp/dv-lab-phase21-parallel/21-18-preparation.md` и перечисленные ниже логи в том же каталоге. Скриншоты только синтетических элементов и закрытые error artifacts лежат вне репозитория, в `STATE_DIR/phase21-e2e/results/<UUID>/`. Каждый запуск использует новый output directory.

| Journey                                                             | light/dark | Доказательство                                                                                       |
| ------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| dialog marks deduct by lesson length                                | PASS/PASS  | `21-18-tracer-2.log`                                                                                 |
| dialog corrections recompute the balance everywhere                 | PASS/PASS  | `21-18-affected.log`; также Tab, focus-visible, Enter, Esc и заполненная строка 320 px               |
| Today quick marks set and correct a mark                            | PASS/PASS  | `21-18-journeys.log`; реальная граница часов, busy window POST + reload                              |
| no-show deducts unless the flag is off                              | PASS/PASS  | `21-18-journeys.log`                                                                                 |
| cancelled marked lesson deducts nothing until restored              | PASS/PASS  | `21-18-journeys.log`                                                                                 |
| a marked started lesson moves with its mark                         | PASS/PASS  | `21-18-journeys.log`                                                                                 |
| a moved series occurrence leaves a ghost that deducts nothing       | PASS/PASS  | `21-18-journeys.log`; restored marked tail Done/No-show × cut/end, stale empty cut 409               |
| Pays soon follows the threshold and the balance                     | PASS/PASS  | `21-18-today-final.log`; null/zero header, SSR date, delayed real PATCH, disabled field, second save |
| Earlier, not marked lists a past unmarked lesson until it is marked | PASS/PASS  | `21-18-today-final.log`; normal/reduced motion, row 13/20, panel 12/8/16                             |

| Команда                                                                                             | Original exit и решающий результат                                                                        | Лог                            |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `yarn playwright test --list`                                                                       | 0; 20 tests = 9 × 2 + setup/cleanup                                                                       | discovery, manifest            |
| `yarn test:e2e --grep "^dialog marks deduct by lesson length$"`                                     | 1; no tests, якорь не совпал с полным Playwright title                                                    | `21-18-tracer.log`             |
| `yarn test:e2e --grep "dialog marks deduct by lesson length"`                                       | 0; 4 passed                                                                                               | `21-18-tracer-2.log`           |
| `yarn test:e2e --grep-invert "dialog marks deduct by lesson length"`                                | 1; 14 passed, 4 failed на двух Today assertions                                                           | `21-18-journeys.log`           |
| `yarn test:e2e --grep "dialog corrections recompute\|Pays soon follows\|Earlier, not marked lists"` | 1; 4 passed, 4 failed; corrections/keyboard/320 прошли                                                    | `21-18-affected.log`           |
| `yarn test:e2e --grep "Earlier, not marked lists" --project=light`                                  | 1; setup ждал временный Schedule heading, journey не исполнялся                                           | `21-18-motion-observation.log` |
| `yarn test:e2e --grep "Pays soon follows\|Earlier, not marked lists"`                               | producer exit утрачен: zsh отклонил запись в readonly `status`; wrapper exit 1. Не считается command PASS | `21-18-today-focused.log`      |
| `yarn test:e2e --grep "Earlier, not marked lists" --project=light`                                  | 1; точная opacity WAAPI длительность 100 мс вместо 80                                                     | `21-18-motion-numeric.log`     |
| `yarn test:e2e --grep "Earlier, not marked lists"`                                                  | 0; 4 passed после исправления                                                                             | `21-18-earlier-final.log`      |
| `yarn test:e2e --grep "Pays soon follows\|Earlier, not marked lists"`                               | **0; 6 passed**, обе темы, setup и cleanup                                                                | `21-18-today-final.log`        |

Начальная загрузка config до добавления ESM завершилась exit 1. Повторная discovery прошла. Ошибочные ожидания тестов исправлены по UI-SPEC: computed transparency вместо CSS-класса, weekday/date с запятой в SSR, короткий месяц Sep в строке Earlier. Setup ждёт готовую week-grid вместо временного заголовка Schedule.

### Earlier: измерение и исправление

Измеряется только `KeyframeEffect.target ===` синтетической строки и opacity с конечным значением 0. Probe начинается до реального POST и наблюдает ту же строку через rAF/MutationObserver до удаления. Родительские, дочерние и hover-анимации исключены. Строка действительно видима среди первых восьми; UI click выполнен.

Installed Motion преобразовывал duration-based spring через `calcGeneratorDuration` с шагом 50 мс. При токене 0.08 браузер получал 100 мс. У строки и контейнера Earlier задан opacity tween с прежним токеном 0.08 и easeOut. Общие spring tokens и другие анимации не менялись.

Четыре финальных наблюдения: WAAPI duration **80 мс**, delay **0**, промежуточная opacity есть, transform не меняется, панель сохраняется до завершения строки, максимальный межкадровый интервал **17.9 мс**. Raw числа находятся в `EARLIER_EXIT` строках `21-18-today-final.log`. Порог 80 мс не ослаблен.

Если в Earlier остаются чужие уроки, исчезновение последней панели не проверяется; annotation сохраняет это ограничение. Реальные строки не менялись ради последней панели. Переполнение Pays soon использует принятый API/order/+N fallback. Автоматическая навигация в целевую неделю не добавлена; действует `/schedule`. Manual calendar UAT остаётся отложенным к фазам 24/25.

## Static quality и Simplify

| Команда                                                                                                                                                                                                             | Exit | Результат                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------- |
| `node /private/tmp/dv-lab-phase21-parallel/21-18-verify.ts`                                                                                                                                                         | 0    | 13 files, 9 titles, diagnostics/any/syntaxFailures/forbidden/comments пусты |
| `node /private/tmp/dv-lab-phase21-parallel/21-18-metrics.cjs`                                                                                                                                                       | 0    | 15 files, 257 functions/callbacks; violations пусты                         |
| `yarn workspace @dv-lab/web typecheck`                                                                                                                                                                              | 0    | Types generated successfully; tsc без ошибок                                |
| `yarn workspace @dv-lab/web exec eslint 'app/(app)/_components/today-lessons.tsx' 'app/(app)/_components/today-screen.tsx'`                                                                                         | 0    | Пустой вывод                                                                |
| `yarn knip`                                                                                                                                                                                                         | 0    | Нет dead-code findings; остались 18 прежних configuration hints             |
| `yarn prettier --check playwright.config.ts e2e package.json knip.json AGENTS.md scripts/dev-checks/README.md 'apps/web/app/(app)/_components/today-lessons.tsx' 'apps/web/app/(app)/_components/today-screen.tsx'` | 0    | All matched files use Prettier code style                                   |
| `git diff --check`                                                                                                                                                                                                  | 0    | Пустой вывод                                                                |

Первый format check дополнительно передал `.gitignore` и получил exit 2: у Prettier нет parser для него. Повторная команда выше проверяет поддерживаемые файлы; `.gitignore` проверен diff review. Итоговые format/privacy для SUMMARY указаны ниже.

Метрики: TypeScript 6.0.3, ESLint 10.12.0 classic complexity, parser 8.71.1. Максимумы по функции: CC **19**, cognitive **20**, Halstead D **33.913**; максимальный файл **440** физических строк. Cognitive — AST nesting/логические последовательности; это не SonarJS. Halstead: leaf tokens тела функции, вложенные функции отдельно; типы/imports/trivia исключены; identifiers/literals — operands, прочие токены — operators; `D=(n1/2)*(N2/n2)`. SQL-строки, generated artifacts и dependencies не оцениваются как JS/TS-код.

Изменённые ветвления: `LessonRow` CC 12→11; `Panels` 5→4; setup callback 4→5; `observeExit.inspect` 16→19; `markEarlier` 10→12. Все ниже 22. Fingerprints и числа каждого файла/функции: `21-18-final-metrics.json`; product before: `21-18-product-before.json`; исходный draft: `21-18-metrics.json`. Strict/no-any evidence: `21-18-final-static.json`. Его старое поле `readiness: unverified` относится к отдельному static-only отчёту; runtime и окончательный Halstead gate доказаны указанными отдельными результатами, а не этим полем.

Simplify применён к owned diff. Удалены неиспользуемые reduced hooks после одинакового opacity fade и два избыточных explicit config пути knip. Новых code comments нет. Дополнительных абстракций и тестовых слоёв нет. Полный quality/security audit не выполнялся.

## Восстановление и остановка

- Каждый завершённый запуск: `E2E_CLEANUP_OK fixtures=0 settings=restored`. Cleanup независимыми finally выполняет очистку фикстур, exact restore, публичный sign-out, scrub и dispose.
- `node /private/tmp/dv-lab-phase21-parallel/21-13-evidence.mts settings-after`: exit 0, `TEACHER_EXACT_RESTORE_OK sha256=8ec157deee53f848bf1b5cf6259be2b590c8a791a97912a6d5b96ff06da5f886`.
- Этот hash равен исходному baseline 21-13 и принадлежит тому же аутентифицированному учителю. Начальный hash18 от `[]` относится к другой форме запроса — таблице settings без LEFT JOIN; baseline не заменялся.
- `node scripts/dev-checks/sql.mjs .env migrator "select count(*)::int as n from students where display_name in ('Alex Example 2182','Alex Example 2183','Alex Example 2184','Alex Example 2185','Alex Example 2186','Alex Example 2187','Alex Example 2188','Alex Example 2189') and import_key is null"`: exit 0, `n=0`.
- Проверка JSON содержимого private state: exit 0, `PRIVATE_STATE_SCRUB_OK auth=empty settings=null owned=0`. Файлы сохранены, удалений нет.
- Оба собственных dev-процесса завершились exit 0. `node scripts/dev-checks/wait-dev.mjs down`: exit 0, **DEV_DOWN_OK**.

## Файлы

| Файл                                                               | Причина                                                                      |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `playwright.config.ts`                                             | Один worker, две темы, setup/cleanup и уникальные private output directories |
| `e2e/auth.setup.ts`                                                | Вход через UI, baseline и готовые экраны                                     |
| `e2e/cleanup.teardown.ts`                                          | Независимые restore/cleanup/sign-out/scrub шаги                              |
| `e2e/support/api.ts`                                               | Typed ответы публичного API                                                  |
| `e2e/support/data.ts`                                              | Dev credentials, guarded SQL, точные имена и ownership ledger                |
| `e2e/support/dates.ts`                                             | VN даты и настоящий допустимый временной диапазон                            |
| `e2e/support/input.ts`                                             | Валидация unknown JSON/SQL границ                                            |
| `e2e/support/test.ts`                                              | Фикстуры и finally восстановления                                            |
| `e2e/support/ui.ts`                                                | Публичные UI действия и согласованность остатков                             |
| `e2e/marks.spec.ts`                                                | Три journeys отметок, busy/clock и keyboard/320 проверки                     |
| `e2e/no-show.spec.ts`                                              | Два journeys no-show и отмены/восстановления                                 |
| `e2e/move.spec.ts`                                                 | Два journeys переносов, marked tail и stale 409                              |
| `e2e/today.spec.ts`                                                | Два journeys Today, настройки, SSR, exact exit timing                        |
| `apps/web/app/(app)/_components/today-lessons.tsx`                 | Opacity строки Earlier ровно 80 мс                                           |
| `apps/web/app/(app)/_components/today-screen.tsx`                  | Такой же fade контейнера Earlier                                             |
| `package.json`                                                     | Команда test:e2e и ESM для корневого runner                                  |
| `knip.json`                                                        | Учёт E2E без повторного config entry                                         |
| `.gitignore`                                                       | Защита стандартных Playwright output paths                                   |
| `AGENTS.md`                                                        | Команда E2E и её условия                                                     |
| `scripts/dev-checks/README.md`                                     | Граница E2E, private evidence и отсутствие запуска в CI                      |
| `.planning/phases/21-lesson-accounting-and-today/21-18-SUMMARY.md` | Результаты и границы доказательств                                           |

Итоговые проверки документации:

- `node /private/tmp/dv-lab-phase21-parallel/21-18-privacy.mjs`: exit 0, `PRIVACY_OK files=21`. После добавления commit hashes повторён только SUMMARY: `node /private/tmp/dv-lab-phase21-parallel/21-18-privacy.mjs .planning/phases/21-lesson-accounting-and-today/21-18-SUMMARY.md`, exit 0, `PRIVACY_OK files=1`.
- `yarn prettier --check knip.json .planning/phases/21-lesson-accounting-and-today/21-18-SUMMARY.md`: первоначальный exit 1 из-за нового SUMMARY; после `yarn prettier --write .planning/phases/21-lesson-accounting-and-today/21-18-SUMMARY.md` — exit 0, `All matched files use Prettier code style`.
- Исходники runtime зафиксированы в `0acdbf7`. SHA-256 всех 15 проверенных TS/TSX файлов совпадают с `21-18-final-metrics.json`; docs и knip cleanup не меняют runtime inputs. Повторить весь набор можно командой `yarn test:e2e` на этом коде после запуска API/web с dev `.env`. Для последнего исправления достаточно `yarn test:e2e --grep "Pays soon follows|Earlier, not marked lists"`.

## Передача

После DONE/DEV_DOWN_OK parent выполняет `yarn test` из-за root ESM и `yarn build` из-за изменённого production web source. Эти два gate здесь **не запускались**. Parent также владеет metadata, финальными reviews/verifier и UI review двухфайлового delta. STATE/ROADMAP/HANDOFF и три чужих untracked файла не изменялись. Push/PR/merge/deploy не выполнялись.
