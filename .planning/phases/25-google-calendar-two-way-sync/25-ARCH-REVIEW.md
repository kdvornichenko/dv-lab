# Архитектурный осмотр — фаза 25

Дата: 2026-10-12. Источник: gsd-arch-scan --auto. Source pin: `56e1be2`; integrated24-08/12. Область: только calendar/schedule command, read, mapping и history seams, которые расширяет25. Runtime/provider не запускались. Final24-09/10/11 signatures требуют rebind перед execution25.

## Контракт

Результат: определить необходимые границы shared identity для SC2/SC3/SC4 и F04/F05/F08 до planning. За границей: source fixes, Git, runtime, env, DB, dependencies, полный аудит репозитория и новая архитектура для уже принятого history/lease решения. Read-only explorer не писал файлы. Единственный artifact этого осмотра — этот отчёт. Приёмка: каждый Strong риск имеет source evidence и решение внутри25; speculative follow-up не создаётся.

## Находки

### A1 — Lesson identity между inbound и command admission

Strength: Strong. Phase25 extends. Existing `singleTarget` выбирает только app `googleEventMappings`; `validateEvidence` требует outbound marker. Отдельная inbound binding может стать читаемым lesson, который тот же public Move/Cancel interface отвергнет. Research Future Write Map называет dispatch/recovery/apply/result, но не этот admission path.

Source: `apps/api/src/schedule/single-command.ts:29,226`; callers `calendar/single-observation.ts:60` и `calendar/commands.ts:112–115`; UI `calendar-lesson-dialog.tsx:119` и `lesson-move-form.tsx:85`.

Deletion test: без общего resolver происхождение, current provider identity и проверка version снова распределяются между read и command callers. Dependencies: in-process + PostgreSQL, внешний Google. Категория внешней зависимости по vocabulary skill — mock; это не разрешение подменять provider proof. Existing E2E `move.spec.ts:55,61` доказывают source scenario single/race, но ещё не inbound-assigned flow. Runtime этих новых variants — UNVERIFIED.

### A2 — Materialized single с canonical Google instance

Strength: Strong. Phase25 extends. Текущий `entityKind=single` отвергает provider event с `recurringEventId`; verifier ожидает `dvKind=single`. Unsupported master materialization поэтому не может использовать standalone semantics для последующей записи.

Source: `apps/api/src/calendar/event-mapping.ts:168`, `schedule/single-command.ts:237`; read callers `calendar/read-pages.ts:75,93,129`; `calendar/series-context.ts:67,86`. Existing public details/single journeys не доказывают unsupported-master assignment и неизменность siblings.

Deletion test: без одного canonical instance resolver read и command admission независимо восстанавливают parent/original tuple. Dependencies: in-process + PostgreSQL, внешний Google; подтверждённого local substitute нет. R2 standalone clone для provider instance изменит identity и не закрывает этот риск.

## Решения

| ID  | Название                           | Решение     | Причина                                                                                                         | Модуль-владелец                                                            |
| --- | ---------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A1  | Shared lesson/provider identity    | В этой фазе | SC3 binding и SC4 writer должны использовать один подтверждённый provider target; fictitious commandId не нужен | calendar shared resolver + существующие schedule admission/evidence owners |
| A2  | Canonical instance materialization | В этой фазе | SC2/F05 сохраняет actual parent/original identity даже при local single projection                              | shared resolver + existing occurrence mutation owner                       |

Primary noun — validated provider identity с local ref и origin/provenance. App mapping остаётся подтверждённым provenance своего variant. Inbound binding не создаёт ложный outbound ACK. Known eligible inbound lesson проходит тот же confirmed writer. Unsupported whole-series editing остаётся явно unavailable. Materialized local single, который представляет Google instance, изменяет именно этот instance и сохраняет siblings; standalone R2 replacement для него запрещён.

Это необходимые технические решения в текущем outcome. Повторного user approval нет. Их интерфейсы проектирует planner. Решений «отложено» нет; broken-windows entry не создаётся.

## Для планировщика

- До consumers определить shared resolver для read и command admission. Расширить actual `schedule/single-command`, `calendar/single-observation` и финальные09 occurrence owners; не ограничивать command work map только dispatch/apply.
- Явно различать local ref и provider representation kind. При отсутствии доказанного eligibility показывать server capability unavailable, вместо false Ready.
- Extend existing durable assignment→single/occurrence Move/Cancel/Restore journey через public interface и real persistence/provider. Проверить отсутствие duplicate lessons и изменения siblings; новый isolated test suite не нужен.
- History freeze уже обоснован P7: `schedule/rows.ts:335–336` и caller `cards/card-facts.ts:41`. Сохранить одного owner и current marks; повторная архитектура не требуется.
- Lease/publication уже имеют owner: `credentials.ts:140`, `read-store.ts:87`. Один writer; без вложенного lease и transaction wrapper внутри inbound transaction.
- Проверить финальные24 symbols и fingerprints перед execution25. Ни source diagrams, ни исходники E2E не заменяют runtime evidence.

## Evidence

Read-only explorer проверил указанную область в Git HEAD56e1be2 и вернул ровно две Strong находки. Tracked ADR в этой области не найдены. CodeGraph отсутствует; indexing не выполнялся. Source08/12 учтён;09/10/11 не выдаются за реализованную зависимость. Source, env, DB, provider, build и test files не изменялись этим осмотром.
