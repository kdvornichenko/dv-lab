# Архитектурный осмотр — фаза 21

Дата: 2026-10-10. Область: `packages/core` (balance, lessons, schedule), `packages/db/src/schema.ts` (students, payments, lesson_series, lesson_exceptions, lessons), `apps/api/src/cards`, `apps/api/src/schedule`, `apps/api/src/routes`, `packages/contracts`, `apps/web` (students, Today, schedule). Источник: gsd-arch-scan.

## Находки

### 1. Правило «что входит в остаток» живёт в SQL и в тексте web, а не в core (возврат 19-#4)
- Файлы: `packages/core/src/balance.ts:1-4`, `apps/api/src/cards/card-facts.ts:15-44`, `apps/web/components/app/ledger-text.tsx:79-88`.
- Трение: LEDG-08 требует, чтобы каждое число остатка шло из `packages/core`, а отбор оплат делает SQL в `apps/api`, подпись формы повторяет правило в web. Фаза добавит вычеты за уроки (отметка, флаг неявки, граница по дате открытия); без владельца в core условия разойдутся по SQL, подписям и инструментам чата (фаза 22).
- Проверка удалением: удаление `cardBalances` вынесет правило во все экраны, значит модуль нужен, но владелец правила — SQL.
- Категория: in-process (core) и local-substitutable (агрегат Postgres). Тесты сегодня: нет. Отношение к фазе: расширяет. Сила: Strong.
- Рекомендация: в этой фазе.

### 2. Исход урока лежит в двух способах хранения, смещение времени и исход смешаны в `kind`
- Файлы: `packages/db/src/schema.ts:256,284`, `packages/core/src/schedule.ts:17-33,92-111,138-157,218`, `apps/api/src/schedule/rows.ts:70-91`, `apps/api/src/schedule/changes.ts:58-233`, `packages/contracts/src/schedule.ts:57,94`, `apps/web/app/(app)/schedule/_components/lesson-block.tsx`, `lesson-dialog.tsx`.
- Трение: состояние вхождения записано колонкой `status` у одиночного урока и `kind` у исключения серии; новый исход («проведён», «неявка») трогает 8+ мест на четырёх слоях, а отметки относятся к прошлым урокам, где `refusal`/`canChange` запрещают правки.
- Проверка удалением: `occurrenceAt` держит сложность; разборы в `rows.ts`, `changes.ts`, `lesson-block.tsx` — копии одного словаря.
- Категория: in-process, схема local-substitutable. Тесты: нет. Отношение: расширяет. Сила: Strong.
- Рекомендация: в этой фазе.

### 3. «Сегодня» и граница даты в трёх зонах (возврат 20-#3)
- Файлы: `packages/core/src/lessons.ts:62-69` (`localIsoDate`, зона среды), `apps/api/src/routes/payments.ts:34-38` (`latestPaymentDate`, UTC+сутки; импортирует `routes/students.ts`), `packages/core/src/schedule.ts:183` (`todayOf`, зона Вьетнама).
- Трение: Today и граница `opening_balance_on` сравнивают дату из зоны браузера с моментом урока по Вьетнаму; ночной урок попадает по другую сторону даты открытия.
- Категория: in-process. Тесты: нет. Отношение: расширяет. Сила: Worth exploring.
- Рекомендация: в этой фазе (откладывалось в 20 именно до фазы 21).

### 4. Перевод остатка в уроки и порог «pays soon» считает клиент
- Файлы: `students-screen.tsx:116-119`, `opening-balance-panel.tsx:113-116`, `packages/core/src/lessons.ts:56-66`, `packages/contracts/src/students.ts:146`.
- Трение: порог LEDG-07 сравнивается в уроках (минуты / длительность урока ученика); при делении в двух местах у правила два владельца, а `null` («не задан», D-09) отличается от нуля.
- Категория: in-process. Тесты: нет. Отношение: расширяет. Сила: Worth exploring.
- Рекомендация: в этой фазе (одним предикатом в core вместе с находкой 1).

### 5. Две одинаковые формулы минут в модуле, куда лягут вычеты
- Файлы: `packages/core/src/lessons.ts:44-53` (`creditedMinutes`, `lessonsToMinutes`), вызовы `apps/api/src/cards/payments.ts:96,138`, `cards/cards.ts:112`; лишний фильтр `gt(credited_minutes, 0)` в `card-facts.ts:31`.
- Трение: вычет за урок станет третьим вариантом той же арифметики.
- Категория: in-process. Тесты: нет. Отношение: расширяет. Сила: Speculative.
- Рекомендация: отложено.

## Решения

| id | название | решение | причина | модуль-владелец |
|----|----------|---------|---------|-----------------|
| 1 | Правило остатка в core | в этой фазе | LEDG-08, вычеты за уроки лягут в то же правило | `packages/core/src/balance.ts` |
| 2 | Исход вхождения у одного владельца | в этой фазе | новый исход не размножается по четырём слоям | `packages/core/src/schedule.ts` |
| 3 | Одна «сегодня» в зоне Вьетнама | в этой фазе | откладывалось в 20 до этой фазы, граница даты открытия остатка | `packages/core` |
| 4 | Порог N и уроки считает core | в этой фазе | один предикат вместе с находкой 1 | `packages/core/src/lessons.ts` |
| 5 | Две формулы минут | отложено | слабая находка, ничего не ломает | `packages/core/src/lessons.ts` |

## Для планировщика

- Углубить правило остатка (находки 1 и 4) отдельным планом до планов, которые трогают остаток (D-13, D-16).
- Углубить владельца исхода вхождения (находка 2) отдельным планом до планов с отметками (D-14).
- Ввести одну «сегодня» и границу даты (находка 3) до расчёта вычетов (D-15).

## Вне находок
- Мёртвого кода в области нет. `card-facts.ts` уже единственный владелец производных фактов карточки (решение 20-#2). Таблицы настроек нет: для порога N и флага неявки места в схеме пока нет.

## После исполнения

Дата: 2026-10-11. Verdict: **архитектурная source-проверка завершена; новых подтверждённых findings — 0**. Доработать в фазе — 0; новых отложенных решений — 0. Принятый риск — только source inference.

### Область и происхождение доказательств

Frozen product HEAD: `8c3cb5d`, задан владельцем. Повторно использован завершённый review `bec43a9484e2c55aa8b857e2f971a159841af155`: 213 файлов inventory (105 существующих путей union PLAN/SUMMARY и 108 actual phase paths из последующих commits), плюс два evidence companions — `apps/web/lib/lesson-actions.ts` и `apps/web/components/app/layout-parts.tsx`. Fingerprint прежнего inventory: `3f864f7e3bf36a19b3a1875f92f9f4383df3b31ebcad20a4a2de148c55a294e3`.

Workflow-owned base — `17933a95cad1640f0de251254ed4b6af48789205`, коммит первого 21-01-PLAN. Product base — `b32615eccbee33eff75e5963d89480db2207d87c`, состояние продукта перед планированием. Прежняя проверка доказала одинаковый scoped source diff для этих баз; различие относится к planning artifacts. Этот факт повторно не проверялся.

Все 18 планов DONE по текущему заданию. Итоговые [21-13-SUMMARY.md](21-13-SUMMARY.md) и [21-18-SUMMARY.md](21-18-SUMMARY.md) привязаны как evidence владельцев. В PLAN18 остались `.mjs` projections; SUMMARY18 перечисляет actual files в разделе «Файлы», но не имеет `key-files`. Поэтому 13 существующих TS-файлов Playwright (config и 12 файлов e2e) включены явно. Это ограничение inventory metadata, а не новая architectural finding.

Проверена только необходимая delta после `bec43a9`: типизированные private helpers, root ESM и runner, Playwright Interface, JSON guard, два Today transitions и V1 shrink. Сверка сохранённого manifest плана 13 (373 пути, snapshot HEAD `bec43a9` с записанным тогда working diff) дала 11 изменённых существующих путей; core/API rule owners совпадают. Snapshot плана 13 не выдаётся за чистый Git diff от `bec43a9`. Для delta fingerprint взяты эти 11 путей, 13 actual TS-файлов Playwright, `apps/web/package.json` и `knip.json`: 26 файлов. Git и runtime в этой проверке не запускались.

### Находки и проверенные claims

Новых подтверждённых findings нет. Прежние source proofs Locality и Depth сохраняются: `studentBalance` / `countsAfterOpening`, `lessonOutcome` / `occurrenceOutcome` / `lessonActions`, `scheduleToday` и `balanceState` / `paysSoonList` остаются владельцами rules21. Callers по-прежнему используют их Interface. Deletion test: удаление этих Modules перенесёт правило в несколько callers.

| Delta                       | Source proof и disposition                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root `type: module`, runner | `package.json` задаёт ESM корневому runner; workspace package.json сохраняют отдельные Modules. `playwright.config.ts:5` → `e2e/support/data.ts:7` → существующий `paths.mjs`. Build web использует `next build --webpack`. Второй владелец domain rules или новый port не введён. Claim об архитектурной регрессии отклонён.                                                                                                                                           |
| Playwright, 13 TS           | `e2e/support/test.ts:18` собирает fixtures через публичный HTTP Interface; `api.ts:17` владеет HTTP/JSON/dispose, `input.ts:1` — проверкой входа, `ui.ts:29` — действиями через UI. Data helpers владеют подготовкой и восстановлением fixtures. Девять journeys читают реальные UI/API и persistence. Это internal seams тестового Module; нового injectable port с одним Adapter нет. Deletion test переносит общий parsing, lifecycle и действия обратно в journeys. |
| Typed JSON guard            | `scripts/dev-checks/schedule-web/occurrence-state.ts:221` принимает `unknown` и проверяет object/null/property перед сравнением ожидаемого времени. Публичный Interface и expected behavior прежние. Новая domain policy не появилась.                                                                                                                                                                                                                                  |
| Today 80 ms и V1 shrink     | `today-lessons.tsx:96` и `today-screen.tsx:214` читают один `spring.fast.duration`; tween выбран в местах отрисовки строки и контейнера. `today-lessons.tsx:110` и `layout-parts.tsx:26` меняют сжатие существующих областей. Нового layout Module, второго владельца исхода/остатка или широкого Interface нет. UI verdict принадлежит отдельному review.                                                                                                              |

Dependency categories: вычисления и локальная композиция — **In-process**; приложение и PostgreSQL через сеть — **Remote but owned**. PostgreSQL stand-in отсутствует; **Local-substitutable** не заявляется. Дополнительный Adapter ради гипотетической замены не требуется.

Simplify применён read-only к delta: оснований для нового port, общего refactor по fanout или удаления SHIPPED CLI Interfaces нет. В прочитанных изменённых участках комментарии не потребовали исправления. Полный quality/security/UI audit не повторялся.

### Решения preplanning

| id  | Решение после исполнения     | Доказательство                                                                                 |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Закрыто по source            | Core владеет cutoff и вычетами; card-facts передаёт строки, web использует countsAfterOpening. |
| 2   | Закрыто по source            | Core определяет исход и действия; changes/marks и web вызывают тот же Interface.               |
| 3   | Закрыто по source            | Дата Today и ограничения дат используют scheduleToday / isAfterScheduleToday.                  |
| 4   | Закрыто по source            | Порог, null и перевод остатка в уроки остаются в core.                                         |
| 5   | Сохранено прежнее «отложено» | Две формулы минут не стали новым риском delta; повторное ledger entry не создаётся.            |

### Evidence и границы применимости

- Plan13: SUMMARY фиксирует завершённые проверки и отдельный affected proof V1; JSON guard проверен существующим `schedule-web changes` в обеих темах, original exit 0, 109 assertions в каждой. Эти результаты импортированы, здесь не запускались.
- Plan18: SUMMARY фиксирует девять journeys × две темы, собранные несколькими ограниченными запусками. Все **15/15** current source hashes (13 TS + два Today TSX) совпали с `21-18-final-metrics.json`. Старый `21-18-final-static.json` содержит устаревшие fingerprints части зависимостей и не используется как current proof всего product source.
- `/private/tmp/dv-lab-phase21-parallel/21-final-test.json`: `yarn test`, HEAD `f5e7083c7db741ec6a6d94b02dfd52ac85c21668`, original exit **0**. Связанный log: 11 suites, 116 tests; Turbo 5 successful / 5 total, 4 cached.
- `/private/tmp/dv-lab-phase21-parallel/21-final-build.json`: `yarn build`, тот же HEAD, original exit **0**. Связанный log: 2 successful / 2 total, 2 cached, FULL TURBO. Cached build не назван новым live build.
- Эти receipts подтверждают завершённые команды на `f5e7083`. Они не содержат manifest всех входов для независимого доказательства запуска именно на `8c3cb5d`; такой runtime claim остаётся unverified. Это не мешает закрыть архитектурные source claims и не требует нового прогона в этом scope.

SHA256 fingerprint — конкатенация отсортированных относительных путей, NUL и raw SHA256 bytes каждого файла; summaries относительно каталога фазы, receipts/logs относительно каталога evidence:

```text
source-delta-26: dc68cc7d6f7c2b9291cdaf0863e0347280fbcd576801a1c7b94e6036ea61f9d5
summary-13-18: f43511ca569ed335d8e2d21d2a7c35f1324189e4e34ae0eeb36d73e5f8959fbb
final-receipts-and-logs: 4f91d45320e9b3cfd8a82eafcfd19ecea8b0c817e603fb15432cf517bac0a57f
preplanning-bytes: 7bc934bbc3a2e04039b59045908e40874ade622b3a27da3cc2b9596dfecd4179
```

Проверка выполнена одним reviewer через Codex native adapter. Собственных runtime/DB/browser/build/test/CUA/Git операций, source/env изменений нет. Единственная запись — этот добавленный раздел; исходные preplanning bytes сохранены. Архитектурный stop достигнут. Format/privacy/commit принадлежат parent.
