# Архитектурный осмотр — фаза 26

**Дата:** 2026-10-12. **Источник:** native `gsd-arch-scan --auto`, foreground read-only exploration.
Source IELTS: `df57b7000c6adc60f35071065b4423d426d263a0`. Target source: `913fc5ae9286aca9a48b5ce4272699c846849874`; HEAD `81a1175` добавил только документы.

## Scope Card

Результат — четыре необходимых owner seams для переноса существующего IELTS в /ielts. C1: concrete friction + exact owner; C2: принятое решение + J26 public proof; C3: проверяемый source pin/fingerprint. В scope: SC1–SC5/F01–F10, M01–M12 и Source06.2 parity через точные callers. Вне scope: implementation, повтор полного research/audit, source22/23/25 как вымышленный код, env/DB/student data/media/runtime/network/paid calls/deps/Git/deletion. Write set — только этот report. Work map: A1→SC1/4,J01/06; A2→SC3,J02; A3→SC1/2/4,J01/04/06; A4→SC2/4,J04/06; source comparison→C3. Stop — все четыре Strong имеют disposition.

Допущения: A1 — actual private crosswalk/counts/media checksums/quiescence не наблюдались; основание — Research26 external gates. A2 — final22/23/24/25 может изменить target interfaces; source перед execution26 требуется rebind. A3 — UI26 пока готовится; этот осмотр относится к domain/auth/storage seams и не утверждает UI/runtime readiness. Все Strong решения приняты в фазу по действующей автономной авторизации. Старый hosting выключается только после parity и отдельного подтверждения учителя.

## Находки

### 26-A1 — Account lifecycle отделён от optional card binding

**Strong; extends auth owner; SC1/SC4; F02/F03/F09; M02/M10; J26-01/J26-06.**

Target: `auth/accounts.ts:82 createStudent, :161 deactivateStudent`; `db/schema.ts:25 accounts`.
Source: `auth/accounts.ts:180 resetStudentPassword, :204 deactivateStudent, :219 reactivateStudent`.

Target deactivation проверяет account ID вместе с card ID и не обслуживает IELTS-only account с studentId=null. createStudent создаёт новый hash/ID; import сохранённых credential identities требует отдельной адаптации.

Deletion-test: общий auth owner необходим. Иначе import и IELTS management повторят password/status/epoch/session revocation. Dependencies: in-process credential logic + real PostgreSQL; local-substitutable adapter не подтверждён.

**Рекомендация:** account-level lifecycle и проверенный hash import у существующего auth owner. Card operations сохраняют проверку связи. Private crosswalk различает Source legacy user, target account и target card. Совпадающий scrypt profile не требует второго password/session engine.

Source durable `student-access.spec.ts:31/51/72` покрывает landing/teacher denial. Старые integration accounts:164/262/305 описывают reset/deactivate/reactivate, не target import. NOT RUN. J01/06 доказывают mapped login, revoked session, unlinked lifecycle и UUID/login/card conflict.

### 26-A2 — Timer command имеет idempotent identity и receipt

**Strong; extends transferred command owner; SC3; F05/F09; M05/M06; J26-02.**

Source: `tasks/store.ts:377 commandAttemptsIn, :437 commandAttempts`; `tasks/timer.ts:44 adjust`; `teacher/rooms/use-command.ts:21`.

Command содержит delta без command key/receipt. Повтор после committed adjust с потерянным ответом применяет delta ещё раз. Row lock сериализует операции, но не устраняет повтор.

Deletion-test: domain command owner необходим. Иначе room board и teacher attempt view отдельно реализуют unknown-outcome recovery. Dependencies: timer in-process, commands/receipt real PostgreSQL, public transport ports & adapters.

**Рекомендация:** atomic effect+receipt по исходной identity. Browser повторяет ту же identity или читает status. openAttempt:655 уже защищает единственный start; timer arithmetic/grace/FromStep переиспользуются.

Source durable `lesson-flow.spec.ts:60/114` покрывает Give/pause/submit/End; старые unit timer tests описывают arithmetic. Lost-ACK adjust не доказан. NOT RUN. J02: same-key replay, changed-body conflict, две вкладки и исходные transitions.

### 26-A3 — Media reference не является публичным playback URL

**Strong; extends references/authorization owner; SC1/SC2/SC4; F03/F04/F09; M01/M04/M08/M10; J26-01/J26-04/J26-06.**

Source: `media/policy.ts:61 isBlobUrl`; `sections/store.ts:41/101`; `sections/snapshot.ts:40 buildSnapshot`; `media/library.ts:34`.

Catalog validation/usage accounting используют URL как identity, а snapshots сохраняют attached media/mediaUrls. Target session не защищает оставшийся public Blob URL. Замена только catalog оставит historical snapshots на прежнем transport.

Deletion-test: один references/authorization owner необходим. Иначе catalog/attempt/library/import повторят URL→object mapping и access. Dependencies: traversal in-process, PostgreSQL persistence, Blob true external (mock category); target disk заменяет storage adapter, готовый substitute не подтверждён.

**Рекомендация:** private manifest разрешает legacy references; runtime projection гидратирует authenticated media address. IDs, snapshot semantics и editing provenance сохраняются. Import не recompile/recheck и не global text replacement.

Source durable `mock-test.spec.ts:89` имеет sound-check journey; старые media-library integration:163 проверяют snapshot/legacy usage. Private Range/HEAD и migrated refs не доказаны. NOT RUN. J01/04/06: foreign media ID denial, retained history, реальные bytes и complete reference mapping.

### 26-A4 — Upload reservation и verified publication имеют одного владельца

**Strong; extends upload owner; SC2/SC4; F04/F08/F09; M08/M12; J26-04/J26-06.**

Source: `api/teacher/media/upload/route.ts:26`; `teacher/tasks/use-media-upload.ts:131`; `teacher/tasks/media-actions.ts:39`; `media/store.ts:8/15`.

Quota читается перед upload без reservation. Concurrent uploads проходят по одному остатку. Bytes публикуются раньше отдельной registration; size/hash поступают от клиента.

Deletion-test: один publication owner необходим. Иначе library/editor/import повторят reservation, byte verification и disk↔DB recovery. Dependencies: disk local-substitutable category (substitute не подтверждён), real PostgreSQL, Source Blob true external/mock.

**Рекомендация:** reservation → server-measured bytes/hash → verified ready; DB/media journal восстанавливает исходный key после interruption/lost reply. Files сохраняются. Cleanup/delete этим решением не разрешены.

Старые unit media-policy и integration media-library:192/243 описывают policy/dedup/accounting. Durable public race/restart proof не обнаружен. NOT RUN. J04/06: concurrent quota, interruption, lost ACK, mismatch и zero false ready.

## Решения

| ID    | Решение     | Причина                                                        | Owner                         |
| ----- | ----------- | -------------------------------------------------------------- | ----------------------------- |
| 26-A1 | В этой фазе | Import/lifecycle сохраняют identity и epoch без второго auth   | auth/accounts + M10 identity  |
| 26-A2 | В этой фазе | Потерянный ответ не должен повторить timer delta               | M05/M06 domain commands       |
| 26-A3 | В этой фазе | Все historical references имеют реальную private authorization | M08 references + M10 manifest |
| 26-A4 | В этой фазе | Quota и disk/DB publication должны быть согласованы            | M08 uploads + M12 composition |

## Для планировщика

- Углубить принятые владельцы до их consumers; переиспользовать actual final target seams после rebind.
- Grading/publication/stats отдельной находки не имеют: saveWritingGrade, runResultVisible и bucketByLocalDay уже владеют правилами. Сохраняются separate Writing grades, manual Speaking, missing bands и last skill band за viewer-local day.
- Review highlights/notes остаются редактируемыми в разрешённом Source scope; answers read-only. Continue without the recording сохраняет предупреждение.
- Source monoliths 894/744 lines не копируются целиком: M04/M06 разделяются по ответственности и проходят действующие quality gates.
- Старые Source tests сохраняются в Source repo; новые target tests — только необходимые durable public J01–J06, до поведения. New isolated suites не создаются.
- Counts/checksums/crosswalk/active rooms/parity и E26-01…06 остаются UNVERIFIED. Source DB PROD не используется для fixtures/tests/TRUNCATE.

## Проверка и fingerprints

Проверены 12 явно указанных Source paths и 3 target anchors. `git diff --exit-code <pin> -- <exact paths below>` в каждом root: exit0, empty output. SHA-256 текущих bytes через node:crypto: exit0, ARCH26_PINS_OK source=12 target=3. Файлы Source/target не изменялись. Это статический snapshot, не runtime/test proof.

| Root   | File                                      | SHA-256                                                          |
| ------ | ----------------------------------------- | ---------------------------------------------------------------- |
| SOURCE | src/lib/auth/accounts.ts                  | 5d81d9a7a0b63d17538a51e8cf724b9a88c0ff83ad4fb72378e46e52ea596c58 |
| SOURCE | src/lib/tasks/store.ts                    | a204ba89230f6033c6f9ad81807fb4855ee78945586ec0d3b549571da442d400 |
| SOURCE | src/lib/tasks/timer.ts                    | 8d0f91d08d9569c65ad5231acb91696bfee086f08145b9438f013e2210cdf758 |
| SOURCE | src/app/teacher/rooms/use-command.ts      | 6ffbf9300c9283ea12acbc1082ba2856b007751a53eab93f7af735ef1f21c3f8 |
| SOURCE | src/lib/media/policy.ts                   | dccb07f6ea45355a1505c7238b53e78d6f6e2b4c6b3d3d00b0fdef270b193abf |
| SOURCE | src/lib/sections/store.ts                 | 22a9809a190b03f80ddcfeea58b054775da91c7ae79d1632f077841b2240f93d |
| SOURCE | src/lib/sections/snapshot.ts              | 4645127cb05051562f6d1b6eb9e261290729b7811d700bc8743eb619d692ba7e |
| SOURCE | src/lib/media/library.ts                  | c95c7120b3597a3d01c5a1560e0d3993a3e193e79e14ec7be41cd6a73273fd4f |
| SOURCE | src/app/api/teacher/media/upload/route.ts | f7a8adce04f92cc7d6984940ec26154e5f4d73797a318ebe70c7ef96019305b8 |
| SOURCE | src/app/teacher/tasks/use-media-upload.ts | 9e2e069c6ed22656a820d2ef260858855c940f805ce74cdbec6d2c91e56e0d66 |
| SOURCE | src/app/teacher/tasks/media-actions.ts    | 529c6e5cd6fe8c3f8debcfa8762edb2bc357a4d82b6bd54e89b91368db085b51 |
| SOURCE | src/lib/media/store.ts                    | 5fc7743849359c37e174d0a47f1c9c9aa63e3bfaba13918808eb7b2b9d039e0e |
| TARGET | apps/api/src/auth/accounts.ts             | 3fd36d96015ce9debea75dffe5e11a0b780628f7f3284b012409f919dfb16b04 |
| TARGET | apps/api/src/auth/passwords.ts            | 7f96fb1ea8014e024f464739ebdf6ff026c67eba06c72b2cd8e3ed1a0573bd7a |
| TARGET | packages/db/src/schema.ts                 | 3f190ad368cb89b5cabd7a08c57ab94c4c4c815a9aa09d92cc877cb3218551de |
