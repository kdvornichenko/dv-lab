# Phase 21 — UI Review

**Audited:** 2026-10-11
**Status:** COMPLETE — открытых обязательных UI findings нет.
**Baseline:** утверждённый дизайн v40, `21-UI-SPEC.md`, LEDG-03…08, SHELL-05 и актуальные D-решения, включая D-17.
**Source:** application source после `4dc57f38e5a358d866a74df35c7182c29d095e64`; итоговые journeys и evidence — `21-18-SUMMARY.md` на `f5e7083`. Последующие изменения planning не меняют проверенное поведение.
**Screenshots:** повторно использованы 12 просмотренных PNG owner13 и два after PNG для V1. Новых captures нет.
**Interaction evidence:** существующие public UI/API E2E owner18, обе темы, настоящая persistence. Reviewer runtime не запускал.

## Граница проверки

Итоговая проверка связывает прежние F1–F6 и V1 с завершёнными evidence 13/18. Дополнительный source scope — только два изменения transition в `4dc57f3` и удаление ставших неиспользуемыми reduced-motion hooks. Полный аудит неизменённого source не повторялся.

Прежняя source-проверка и просмотр screenshots сохранены в `/private/tmp/dv-lab-phase21-parallel/21-ui-review-draft.md` и `21-ui-review-fingerprint.json`. Это исторические snapshots. Их прежние pending18-статусы заменены диспозициями этого отчёта; весь старый manifest не объявляется заново проверенным на последнем HEAD.

Write set этого завершения: только `21-UI-REVIEW.md`. Product source, тесты, STATE, Git и runtime reviewer не менял. Scope закрыт после записи отчёта.

## Pillar Scores

| Pillar            | Score | Доказательство                                                                                      |
| ----------------- | ----- | --------------------------------------------------------------------------------------------------- |
| Copywriting       | 4/4   | F3: null/zero header; F4: дата в SSR h1 — фактические assertions owner18                            |
| Visuals           | 4/4   | V1: два after PNG и geometry при 320 px; заполненная строка проверена в corrections journey         |
| Color             | 4/4   | Прежние 12 PNG light/dark и сопоставление с v40 tokens; новых отклонений в узком delta нет          |
| Typography        | 4/4   | F5: computed body 13/20 и отдельный secondary token в Earlier journey                               |
| Spacing           | 4/4   | F6: computed Panel header 12/8/16, с учётом app rem scale                                           |
| Experience Design | 4/4   | F1/F2 busy POST + reload, реальная граница часов, keyboard/focus, Settings save, opacity exit 80 мс |

**Overall: 24/24 в проверенном scope.** Это оценка шести UI pillars по указанным доказательствам. Она не заменяет phase verifier, полный accessibility audit или отложенный ручной Calendar UAT.

## Диспозиции

| ID               | Исходный дефект или criterion                                       | Итог           | Доказательство                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1               | Footer LessonDialog оставался доступным во время сохранения отметки | FIXED          | Required `locked` в `lesson-footer.tsx`, `busy` wiring и guards в `lesson-dialog.tsx`; delayed реальный POST + reload блокируют элементы диалога, закрытие и move fields. Journey `Today quick marks set and correct a mark`, light/dark |
| F2               | Today row позволял открыть диалог во время quick mark               | FIXED          | Один pending kind и производный busy в `today-lessons.tsx`; та же journey проверяет блокировку на POST + reload и возврат управления                                                                                                     |
| F3               | В header отсутствовало явное Not set при null balance               | FIXED          | `student-profile.tsx` всегда выводит StudentBalance. `e2e/today.spec.ts:24` проверяет Not set с CTA и 0 lessons left без CTA; computed ghost background проверен. Pays soon journey, light/dark                                          |
| F4               | Initial Today heading не содержал дату                              | FIXED          | Server page передаёт initialDate; `e2e/today.spec.ts:31` читает реальный SSR response, сверяет Date header и точный h1 с датой Vietnam. Pays soon journey, light/dark                                                                    |
| F5               | Основной текст строки Today не наследовал body token                | FIXED          | `today-lessons.tsx` содержит text-body; Earlier journey проверяет computed typography 13/20. Secondary time использует отдельный token. Light/dark                                                                                       |
| F6               | Верхний padding заголовка Panel отличался от v40                    | FIXED          | `layout-parts.tsx` использует px-4 pt-3 pb-2; `e2e/today.spec.ts:52` измеряет 12/8/16/16 с rem scale. Earlier journey, light/dark                                                                                                        |
| V1               | Counters и панели Today обрезались при ширине 320 px                | FIXED          | `ac713f5`: min-width и shrink колонок; два after PNG, numeric geometry и viewport bounds owner13. Заполненная строка дополнительно проверена в `e2e/marks.spec.ts:21`, corrections journey, light/dark                                   |
| FECR01           | Поле Pays soon могло оставаться доступным при сохранении            | CLOSED_RUNTIME | Held реальный PATCH, disabled field, сохранённое значение и повторное сохранение; `e2e/today.spec.ts:249`, финальный Pays soon run                                                                                                       |
| FECR02 / FEclock | Доступные действия могли устареть после начала урока                | CLOSED_RUNTIME | `e2e/marks.spec.ts:278`: реальные часы API и браузера, открытые Schedule/Today dialogs до и после границы; mark становится доступен, Whole series actions исчезают. Не browser-only clock mock                                           |
| Keyboard/focus   | Требовалось доказать доступность действий клавиатурой               | CLOSED_RUNTIME | `e2e/marks.spec.ts:47`: Tab → focus-visible → Enter; открытие диалога, Escape и возврат focus. Corrections journey, light/dark                                                                                                           |
| Earlier exit     | Spring давал измеренные 100 мс вместо 80 мс                         | FIXED          | `4dc57f3`: tween с duration spring.fast.duration и easeOut для строки и контейнера. Четыре финальных EARLIER_EXIT наблюдения: WAAPI duration 80, delay 0, intermediate opacity true, transformChanged false                              |

Открытых BLOCKER/WARNING: **0**. Новых fixes и рекомендаций: **0**. V1 сохранён как исправленный дефект, а не отклонённое замечание: before PNG действительно показывали обрезку.

## Детали pillars

### Copywriting

F3 и F4 закрыты существующими browser/SSR assertions. Проверяются разные состояния null и zero, точный h1 до hydration и английский UI. Payment caption balance + rate без plan остаётся принятым ограничением StudentDetail. Новый plan field не требуется.

### Visuals

Прежние screenshots покрывают Today/Earlier, LessonDialog, profile debt, Settings Payments и PaymentDialog в light/dark. Два after PNG owner13 при 320×800 показывают пустой Today; именно они закрывают исходную обрезку counters/panels. Проверка заполненной строки при 320 px и доступности её действий принадлежит успешной corrections journey owner18. По пустым screenshots такая проверка не заявляется.

### Color

Повторно использована прежняя оценка 12 PNG: нейтральные surfaces различимы; selected row и mark selection нейтральные; debt имеет отдельную красную точку, Needs a mark — amber/yellow, ошибка PaymentDialog — semantic red. Прежний scan 43 handwritten/support files дал 0 text-primary/bg-primary/border-primary; fallback focus-ring совпадает с токеном.

Численное распределение 60/30/10, computed RGB и contrast ratio не измерялись. Approved Switch colors и ограничения principles.md сохраняются. Полный contrast/a11y audit в этот claim не входит.

### Typography

F5 закрыта computed CSS в обеих темах. Прежняя проверка source установила text-body на UL и сохранение micro/caption для вторичного текста. Повторный scan всего приложения не выполнялся.

### Spacing

F6 закрыта computed padding, включая rem scale. Принятые EmptyState padding и прочие неизменённые spacing решения не пересматривались.

### Experience Design

E2E проверяют настоящие запросы и результат в приложении/persistence. Сетевые задержки удерживают реальный POST/PATCH и reload, не подменяя успешный ответ. FEclock пересекает настоящую границу времени. Keyboard assertions проверяют focus-visible и восстановление focus после Escape.

Обе transition строки после `4dc57f3` имеют `{ type: 'tween', duration: spring.fast.duration, ease: 'easeOut' }`. Это сохраняет opacity fade при normal и reduced motion. Удалены только неиспользуемые reduced hooks. `initial={false}`, opacity-only exit и inert для уходящей строки сохранены.

## Runtime evidence и повторный запуск

Все команды ниже выполнены owner18 в корне phase-21 worktree. Reviewer использовал завершённые результаты и не повторял запуски. Полный manifest, fixture scope и исходные статусы находятся в `21-18-SUMMARY.md` и `/private/tmp/dv-lab-phase21-parallel/21-18-preparation.md`. Настройка dev stack и запуск описаны в `scripts/dev-checks/README.md`.

| Команда                                                                                             | Original status | Решающий результат                                                                                                                                            |
| --------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn test:e2e --grep "dialog marks deduct by lesson length"`                                       | exit 0          | 4 passed: light/dark + setup/cleanup; `21-18-tracer-2.log`                                                                                                    |
| `yarn test:e2e --grep-invert "dialog marks deduct by lesson length"`                                | exit 1          | 14 passed, 4 failed. В этой записи прошли quick marks, real clock, no-show, cancelled/restore, marked move и moved series в обеих темах; `21-18-journeys.log` |
| `yarn test:e2e --grep "dialog corrections recompute\|Pays soon follows\|Earlier, not marked lists"` | exit 1          | 4 passed, 4 failed. Corrections с keyboard/focus/320 прошли в обеих темах; `21-18-affected.log`                                                               |
| `yarn test:e2e --grep "Earlier, not marked lists"`                                                  | exit 0          | 4 passed после opacity fix; `21-18-earlier-final.log`                                                                                                         |
| `yarn test:e2e --grep "Pays soon follows\|Earlier, not marked lists"`                               | exit 0          | 6 passed, обе темы + setup/cleanup; `21-18-today-final.log`                                                                                                   |

Итог: **9 journeys × 2 темы = 18 успешных уникальных выполнений**, собранных несколькими ограниченными запусками. Это не утверждение об одном полностью зелёном запуске. Ранние падения, неверный anchored grep, setup timeout и run с утраченным producer exit сохранены в SUMMARY18. Run с утраченным exit не используется как command PASS. Последние два Today journeys имеют отдельный завершённый exit 0.

В `21-18-today-final.log` четыре EARLIER_EXIT наблюдения соответствуют light/dark × normal/reduced. WAAPI durations равны 80 мс, delays — 0; intermediateOpacity и panelRetained — true, transformChanged — false. Максимальный frame gap — 17.9 мс. Время между обнаружением exit и удалением DOM отдельно от WAAPI duration; оно не переименовано в длительность анимации.

Фикстуры принадлежат owner18 и ограничены восемью точными synthetic IDs/именами 2182–2189 с `import_key IS NULL`. Имена и пользовательское содержимое в evidence этого отчёта не включены. SUMMARY18 фиксирует `E2E_CLEANUP_OK fixtures=0 settings=restored`, exact teacher restore, пустой auth state, отсутствие owned fixtures и `DEV_DOWN_OK`.

## Source и fingerprint provenance

Прочитан только дополнительный product diff двух файлов `4dc57f3`. Read-only `git diff --exit-code HEAD -- <два файла>` и `git diff --exit-code 4dc57f38e5a358d866a74df35c7182c29d095e64 HEAD -- <два файла>` завершились exit 0 с пустым выводом. Новая product логика вне этого delta не добавлялась.

| Текущий файл                                       | SHA-256                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/web/app/(app)/_components/today-lessons.tsx` | `91e1f227f67b2d7a89c97f5a34b6ec47f48e37b3b27513653108e55736453b8d` |
| `apps/web/app/(app)/_components/today-screen.tsx`  | `dfe990af0faa43b45ca2d5b6b92531df37a032a0dc366333ef51a1b2cef3b739` |
| `e2e/marks.spec.ts`                                | `f5ee8382fa0b21fab8e00c5e6c063ce9fdc9dac7685078e1e9dc455f072f8c2e` |
| `e2e/today.spec.ts`                                | `b28932edbef2b613240c9fa049d3a0ce31a07cd996234a62fd964321b4e3d471` |
| `21-13-SUMMARY.md`                                 | `846d1b81c972dd917262a06852da1a642fe37dad623d0316e4990b835b4ad840` |
| `21-18-SUMMARY.md`                                 | `e71e7af2256187e636e06a441178b45aa3ba4a102111a88574e7b256c01d8370` |

Все raw artifacts ниже лежат в `/private/tmp/dv-lab-phase21-parallel/`.

| Artifact                    | SHA-256                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `21-18-tracer-2.log`        | `fc7a77ca9e17d23e6a643bd706ba10a232d721d0d47b735d72de927da8e601fb` |
| `21-18-journeys.log`        | `a2472d506ae0eecb888ae7302be9836fbbfe09681377c67afbb6b39b4260d67e` |
| `21-18-affected.log`        | `9d2ad286dddb0dc8676053105d5716c53098ccaccc916221052ff78d3768a9a3` |
| `21-18-today-final.log`     | `0846246355dd47f7d92ba0c7ac66497aef791545e1b3b7e7b921803274f678bf` |
| `21-18-earlier-final.log`   | `c9455d90e8edb22708455ee6ed025d8e3a53b44a734e784a2ccd87bfdd959089` |
| `21-18-final-static.json`   | `25a42cc8906e3b00a1eed23ee7fe9e0ca967bc75ebf626764ef4b5018ae07396` |
| `21-18-final-metrics.json`  | `c3ca8c912884e70face00eb3c87a5d1bb83e6e8bdfc6c8d893a4d77db3115904` |
| `21-18-product-before.json` | `5738559841deca5e85ee8eb6f1dcc191c8781724e47676cb118d5a5867290d7f` |

Для сохранённых PNG owner13 проверены log SHA и соответствие paths/runs. Исходный JSONL не содержит per-image hash: cryptographic binding всех PNG к процессу не заявляется. Собственные image SHA reviewer, 67 прежних source records, design/context scope, 12 image records и V1 supplement с двумя after PNG/geometry находятся в прежнем `21-ui-review-fingerprint.json`. Они сохраняют свои даты и границы проверки.

## Quality и Simplify в узком delta

Simplify применён к двухфайловому delta: лишних state, guards, абстракций и comments не добавлено; удалён неиспользуемый reduced hook. Дополнительных правок не требуется.

Повторно использованы измерения owner18, без повторного запуска: TypeScript 6.0.3, ESLint 10.12.0, parser 8.71.1. Scope metrics: 15 файлов, 257 функций/callbacks; maxima CC 19, cognitive 20, function Halstead Difficulty 33.913, физический размер файла 440 строк. Violations пусты.

| Изменённая функция | CC before → after | Cognitive before → after | Halstead D before → after |
| ------------------ | ----------------- | ------------------------ | ------------------------- |
| LessonRow          | 12 → 11           | 12 → 11                  | 20.028 → 19.905           |
| Panels             | 5 → 4             | 5 → 3                    | 18.428 → 18.084           |

Метод: classic ESLint CC; cognitive — AST nesting/логические последовательности, не SonarJS. Halstead использует leaf tokens тела функции, вложенные функции отдельно; identifiers/literals — operands, остальные токены — operators. Типы, imports и trivia исключены; `D=(n1/2)*(N2/n2)`. SQL, generated artifacts и dependencies не измеряются как JS/TS source. File-level D не подменяет function gate.

`21-18-final-static.json` содержит 14 analyses: 13 runtime/config TS-файлов и отдельный checker record. Для 13 файлов diagnostics и explicit/inferred any пусты; актуальные analyses согласованы с metrics fingerprints. Старый массив `sourceFingerprints` и прежний static-only `readiness` не используются как доказательство актуального runtime PASS. Это не полный quality audit фазы.

## Принятые исключения и ограничения

1. **Последняя Earlier-панель — UNVERIFIED в условии, когда остаются реальные строки.** Завершённые journeys доказывают уход своей строки и сохранение панели до окончания exit. Полное удаление последней панели нельзя объявить наблюдённым, если фикстура не делает панель пустой. Реальные данные ради этого не менялись. Нового UI defect из отсутствия такого наблюдения не выведено.
2. **FECR03 — REFUTED:** PLAN21-11 принимает переход `/schedule`; target-week navigation не требуется.
3. **FEWR04 — DEFERRED:** caption о сохранении отметки при переносе находится в принятом backlog.
4. **FEWR08 — ACCEPTED INFO:** прежний moved-from link сохраняется по SUMMARY21-08.
5. Payment caption balance + rate без plan, Switch colors, read-error glyph и EmptyState padding сохранены по принятым решениям. Профильные Stat/NextPayment и новые Settings требования в фазу 21 не добавлены.
6. Ручной полный Calendar UAT отложен до Google phases 24/25. Реальная полночь Vietnam и отображение имени длиной 300 символов не объявляются пройденными: ограничения записаны в SUMMARY13. FEclock доказывает реальную границу начала урока, а не полночь.
7. UI-SPEC имеет историческую помету checker approval pending. Этот review опирается на утверждённый v40 и поздние решения владельца; новую дизайнерскую проверку F1–F6 не приписывает. Непроведённое уведомление дизайнера не выдаётся за approval.

## Files Audited и итог

Дополнительный source scope: `today-lessons.tsx`, `today-screen.tsx`. Evidence scope: SUMMARY13/18, указанные raw logs/static/metrics, соответствующие assertions в `e2e/marks.spec.ts` и `e2e/today.spec.ts`, прежние screenshots/geometry. Неизменённые lesson dialog/footer, profile, Panel, tokens и остальные source records использованы из существующего review; нового полного scan нет.

Registry baseline: components.json отсутствовал, сторонние registries не использовались. Новый registry audit не требовался.

**Recommendation count:** priority fixes 0; minor recommendations 0; новые findings 0. F1–F6, V1 и перечисленные runtime claims закрыты в заявленном scope. Известные ограничения сохранены для phase verifier.

**Изменённый файл:** `21-UI-REVIEW.md` — окончательная привязка существующих UI findings к evidence 13/18 и двухфайловому opacity delta. Review завершён.
