# Архитектурный осмотр — фаза 23

**Дата:** 2026-10-12. **Источник:** native `gsd-arch-scan --auto`, отдельный foreground read-only explorer. **Source pin:** `913fc5ae9286aca9a48b5ce4272699c846849874`; текущий HEAD `81a1175` добавил только документы. UI-SPEC SHA-256: `28ca26a976ac47d3bf168d80e0472e458031f3fca1f316993c8ad2ba3b7bf03b`.

## Scope Card

Результат — решения по необходимым owner seams перед планированием23. В scope: SC1/SC2/SC3, F01–F05/F09 и точные existing payment/card/series callers; остальные SC/F проверены на отдельное подтверждённое трение. Вне scope: source implementation, повтор22/24/25 review, полный аудит, runtime/provider/DB/browser/env/deps/Git/deletion. Write set — только этот report. C1: concrete friction + exact owner; C2: accepted decision + existing public evidence path; C3: source pin/fingerprints. Work map: A1→SC1/3,E01/02/04; A2→SC1/3,E02/04/07; A3→SC2/3,E05/06/07; fingerprint check→C3. Stop — три кандидата имеют disposition.

Допущения: A1 — source22/25 отсутствует, будущие signatures остаются PROPOSED; основание — текущие research/plan artifacts. A2 — финальные24/25 interfaces могут закрыть часть предложенного seam; основание — active Source24 и execution dependency gate. Перед execution23 нужен final22/24/25 rebind. Нового инженерного approval не требуется: все Strong рекомендации приняты по действующей автономной авторизации.

## Находки

### 23-A1 — Исправление той же оплаты и атомарная композиция

**Strong; extends; SC1/SC3; F01/F02/F05/F09; P1/P2; E01/E02/E04.**

Source: `cards/payments.ts:86 recordPayment(Database,…)`, `:119 deletePayment(DbExecutor,…)`, `:133 assignPayment(Database,…)`; `routes/payments.ts:46`; `record-payment-dialog.tsx:131`; `payments-tab.tsx:88`.

`assignPayment` не исправляет amount/date/note обычной назначенной оплаты. Delete→record меняет ID и provenance. Собственная transaction в recordPayment мешает общей атомарной записи effect+proposal receipt. Чтение current defaultLessonMinutes:96–109 без captured card revision может изменить creditedMinutes после preview.

Deletion-test: payments owner необходим. Иначе Chat и обычная форма повторят credit conversion, date guard, locking и provenance. Dependencies: orchestration/core in-process, PostgreSQL real persistence, web→owned API ports & adapters; local-substitutable adapter отсутствует.

**Рекомендация:** расширить payments owner исправлением same payment ID и executor-based записью. Сохранить transaction facade обычного endpoint. Принятые payment/card CAS охватывают assign/delete и captured lesson length. Core/card-facts только читаются.

Existing durable evidence: `e2e/today.spec.ts:436/448` и `support/tz-ledger.ts` проверяют payment через публичную форму/базу и stale zone. Same-ID correction/atomic receipt они не доказывают. E01/E02/E04 закрывают repeat Confirm, lost response, changed revisions и сохранение ID/source/student binding. NOT RUN.

### 23-A2 — Узкая ставка и защита полной формы

**Strong; extends; SC1/SC3; F02/F03/F05/F09; P2/P3; E02/E04/E07.**

Source: `cards/cards.ts:27 cardValues`, `:97 updateCard`; `student-form-dialog.tsx:210`; `routes/students.ts:135`; `packages/db/src/schema.ts:94 students`.

Полный stale draft перезаписывает поздние rate/goals/прочие поля, поскольку updateCard проверяет ID без expected revision. Rate proposal через полный snapshot переносит этот конфликт в Chat. updatedAt не заменяет row revision.

Deletion-test: cards owner необходим. Иначе callers повторят field preservation, CAS и status/history policy. Dependencies: in-process + real PostgreSQL; local-substitutable implementation отсутствует.

**Рекомендация:** узкая rate/currency mutation и CAS для ordinary full update. Update/archive/restore/opening участвуют в одной revision policy. Переиспользовать final22 revision, если он появится. createCard(DbExecutor,…):56 уже допускает внешнюю transaction; отдельной находки по create нет.

Existing `e2e/no-show.spec.ts:8/25` сохраняет обычную форму и проверяет accounting. Concurrent card/rate CAS не доказан. E02/E04/E07 проверяют stale full form, fresh narrow rate update, unrelated fields и неизменность ранее сохранённого creditedMinutes. NOT RUN.

### 23-A3 — Input zone массового переноса отделена от account guard

**Strong; extends command policy; SC2/SC3; F04/F05/F09; P4/P5; E05/E06/E07.**

Source: `schedule/series.ts:59 moveSeries`; `core/schedule-series.ts:103 replacementRule`; `contracts/schedule.ts:58 moveSeriesRequest`; `calendar/series-context.ts:18 readSeriesContexts`; `calendar/commands.ts:33/130/133`.

Ordinary interface связывает destination zone с locked account default. При иной account zone Vietnam/MSK ввод будет истолкован неправильно. Подмена expectedDefaultTimeZone смешает command input policy и проверку реальной настройки учителя.

Deletion-test: semantic owner необходим. Иначе Chat/ordinary callers повторят conversion/cutoff/scope, а Chat loop повторит journal/recovery. Dependencies: core in-process, command journal real PostgreSQL, Google true external (категория mock в DEEPENING); actual acceptance требует реальный provider, не mock ACK.

**Рекомендация:** расширить только command-zone policy и sealed bulk orchestration. Final24 explicit-zone/family-cut и final25 identity resolver переиспользуются после rebind. Account guard, serial writer и исходные child identities сохраняются. Если final24 уже даёт нужный seam, второй adapter не нужен.

Existing `e2e/move.spec.ts:57/63/84/102` проверяет identity, race, lost response и delayed ACK, но не whole-plan seal. E05/E06 проверяют MSK/Vietnam при иной account zone, полную membership до write, verified prefix, changed remaining target и resume original journal. NOT RUN.

Отдельного подтверждённого трения по palette/profile/phone, essay, sections и proposal lifecycle нет. Эти области расширяют уже выбранных владельцев. Отсутствие будущего source не является finding. Принятые22 A1–A3 и решения24/25 сохранены.

## Решения

| ID    | Решение                        | Причина                                                          | Модуль-владелец                                       |
| ----- | ------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------- |
| 23-A1 | В этой фазе                    | Same-ID correction + atomic effect/receipt требуются SC1/3       | cards/payments; shared proposal composition           |
| 23-A2 | В этой фазе                    | Rate и ordinary full form должны сохранить concurrent fields     | cards/cards; normal form callers                      |
| 23-A3 | В этой фазе после final rebind | CHAT-06 input policy отличается от account display/default guard | bulk orchestration + existing confirmed command owner |

## Для планировщика

- A1: producer payment mutation/CAS до proposal confirmation и ordinary edit consumer.
- A2: один revision owner для narrow rate и всех ordinary card writers; не повторять final22.
- A3: exact seal и zone semantics до child dispatch; re-use existing writer/receipts/recovery.
- Все signatures предлагаются planner; report не создаёт второй доменный engine или новую test layer.

## Проверка и fingerprints

Read-only explorer завершил scoped source review. Parent проверил 13 явно указанных source paths: `git diff 913fc5ae9286aca9a48b5ce4272699c846849874 -- <13 paths below>` — exit0, empty diff. SHA-256 вычислен node:crypto по текущим bytes, exit0. Это source snapshot, не runtime proof. Existing tests/roles/contracts, browser/Google/model/DB не запускались.

| File                                                                   | SHA-256                                                          |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| apps/api/src/cards/payments.ts                                         | 8fba4470f5e06ee37bd58156646d118cbd7b9e117e3ed036864b9302fa2f5030 |
| apps/api/src/routes/payments.ts                                        | 45203150c34b99de7f3e111f8f386d6d9f9d04b20df3994b954320e3628ceb50 |
| apps/web/app/(app)/students/[id]/_components/record-payment-dialog.tsx | ab1e55d1c13b5cbadbcc73a56c51c3020df92349f1e2bfb44d52d3c9078027b4 |
| apps/web/app/(app)/students/[id]/_components/payments-tab.tsx          | 7d3ea2cb1cf3c5363a7517c3974e6164752f815c25e74cc7c5aebba9ecf62409 |
| apps/api/src/cards/cards.ts                                            | 9e1884977d1528bd7d2d880d3b61afe636c78d6c4fd7f208782e772be91f5670 |
| apps/web/app/(app)/students/_components/student-form-dialog.tsx        | 0ba84d137bbde36df347db527812af21378f112fb0374633fa8da89a87f3ebb1 |
| apps/api/src/routes/students.ts                                        | d6667d63546062a4964787467fccaf94dd1094546f9d8c15dfa69f64c959afab |
| packages/db/src/schema.ts                                              | 3f190ad368cb89b5cabd7a08c57ab94c4c4c815a9aa09d92cc877cb3218551de |
| apps/api/src/schedule/series.ts                                        | 71c7d5db60cca9545802cf1866ea2504e61f3cd74d6cc2b29e3c40f322670092 |
| packages/core/src/schedule-series.ts                                   | f0b14a9cec1853b43734a0691e836861e727a891e7c322510fdac7868d0450c5 |
| packages/contracts/src/schedule.ts                                     | 19110c5db060b92946cdde9a17ea63ac7db8018a5be80c09d002ec10dee1d9c6 |
| apps/api/src/calendar/series-context.ts                                | 43bc8b864d407e7cef996b97f913afe80107c5011f1fb2ae260aa7ae55a5655f |
| apps/api/src/calendar/commands.ts                                      | 6bb40fba1061b6015f8d5787748ee29782a0950b23f076562b4074a9dab1b5a3 |
