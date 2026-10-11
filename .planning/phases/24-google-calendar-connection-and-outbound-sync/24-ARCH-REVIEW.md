# Phase 24 — Architectural Review

**Дата:** 2026-10-11. **Статус:** пересмотр под D-13/D-14; design decisions, runtime UNVERIFIED.
**Scope:** только [RESEARCH](24-RESEARCH.md), этот ARCH-REVIEW и [COVERAGE](COVERAGE.md). Source/Git/env/DB/dependencies/provider не меняются.
**Критерий:** Google source, shared confirmed reads, command ACK до success, recovery и local history. Ниже пять обязательных границ; это не findings в ещё не написанном коде.

## AR-01 — Journal до Google, confirmed domain после Google

**SC2,3 / GCAL-02,03.** Старые schedule mutations непосредственно меняют DB и отвечают 200/201. Их нельзя обернуть outbox после commit: новый контракт запрещает ранний Save. Прочитанные seams: `apps/api/src/routes/schedule.ts`, `schedule/{schedule,changes,series}.ts`; `DbExecutor` сохраняется.

**Решение:** prepare immutable command с preconditions и reserved IDs; journal transaction → single writer → verified Google result → idempotent projection/domain transaction. `202 CalendarCommandReceipt` — pending. Unknown/lost reply и projection_pending имеют отдельные статусы. `GET /google/commands/by-request/:requestId` восстанавливает correlation, даже если POST response потерян.

**Retry:** definitive not-applied failure не превращается в deferred edit; нужен новый Save/requestId. Unknown dispatched attempt сначала reconciles GET/instances; тот же conditional attempt может продолжить ещё pending command. Новый incompatible edit блокируется. Lease/generation alone не являются Google fencing: deterministic IDs/If-Match и reconciliation barrier нужны вместе.

**Owner/write set:** calendar commands/journal/worker; schedule command-plan/command-apply и существующие mutations; contracts/schedule routes; additive DB journal/mappings.

**Удаление границы ломает:** окно между remote acceptance и DB commit, false success, повторный cut/new IDs. Generic event bus, Redis и client writers не нужны.

**Доказательство:** public create/move journey с разрывом до dispatch, после Google accept, после ack до DB projection; после restart одно representation и applied только после projection. Два edits на base version → один explicit conflict. Сейчас NOT RUN.

## AR-02 — Один confirmed read owner для Schedule, Today upcoming и nextLessonAt

**SC2,4,5 / C2.** Existing `today/today.ts` читает local readWindow; `cards/card-facts.ts::cardNextLessons` использует loadScheduleRows/nextLessons. Если заменить только week endpoint, три surfaces расходятся.

**Решение:** calendar/read-model — общая normalized provider projection с generation/revision/coverage. calendar/reads публикует window только после всех страниц. Routes делают network refresh до SQL read snapshot. Today future и next index берут те же event identities/время/status, а не local legacy future. Cache last-known — persisted minimal fields, не fake availability. Next search возвращает unknown при incomplete traversal, none — только с proof.

**Owner/write set:** новые read-model/reads; существующие routes/{schedule,today,students}, today/today, cards/{card-facts,card-rows,cards}; contracts/{calendar,schedule,today,students}; Today/Students/Schedule consumers. Все точные signatures и поля в RESEARCH, разделы 1–2 и inventory.

**History:** existing marks/balance остаются local-owned. historyCutoverAt отличает прежнюю реальную историю от legacy future, которое нельзя со временем превратить в Google-confirmed past. Existing marks не удаляются. cardBalances и paysSoonList сохраняют семантику; финансы не передаются Google.

**Удаление границы ломает:** Schedule показывает Google, Today/Students предлагают другой будущий урок, outage выглядит как пустой день, old legacy recurrence создаёт false past.

**Доказательство:** один public journey читает Schedule → Today → Students при first connect, внешнем Google изменении, failed page, cache/restart и incomplete next search. Legacy future отсутствует во всех upcoming; historical marks/balance неизменны. Сейчас NOT RUN.

## AR-03 — Stable identity, disappearing tombstone и честный partial cut

**SC2,3 / GCAL-02.** Google позволяет задать ID standalone/master; instances имеют canonical ID/originalStartTime. Cancelled non-instance может исчезнуть. Методы не дают remote transaction. [insert/status](../../../docs/google-calendar/articles/v3/reference/events/insert.md#status), [instances](../../../docs/google-calendar/articles/v3/reference/events/instances.md), [recurring](../../../docs/google-calendar/articles/guides/recurringevents.md).

**Решение:** stable local identity плюс отдельно journalled representationGeneration. Retry не увеличивает generation. Restore исчезнувшего cancelled single сначала доказывает доступ к calendar/отсутствие active representation и разрешает unknown attempts; затем резервирует новый deterministic ID. Одного 404 недостаточно.

**Cut:** pure core21.1 prepare → reserved IDs/old natural key lineage → GET captures → cancel relevant tail/trim → prove tail inactive → ensure detached/new master → final provider proof → domain apply. Каждый confirmed Google stage отражается в read model как known partial, pending representations имеют transition binding. Полный Save/rollback до финального proof запрещён. Stage failure требует explicit resume того же journal; marks копируются актуальными под lock. Legacy unmapped series не считается существующим Google master.

**Owner/write set:** mapping/transitions/journal; schedule series/command-plan/command-apply; DB lineage. Core/timezones/nextSeriesReference/UUID-free cut result остаются владельцами 21.1. Его 13/37/9 — принятое планирование, не реализованный source.

**Удаление границы ломает:** дубли после retry, dead-end restore, потеря moved/marked tail или неверный UI при половине remote cut.

**Доказательство:** real provider cancellation/restore и cut/end с moved/marked/effective-past tail, crashes на material stages, old prefix и marks intact. Injected 404 не доказывает исчезновение Google tombstone. Сейчас UNVERIFIED.

## AR-04 — Один OAuth/credential/lifecycle owner и разрешимый Disconnect

**SC1,3,4.** Server OAuth, fixed callback, два принятых scopes и primary-only. State одноразовый, PKCE/session epoch/TTL/generation; authenticated envelope/key ID/AAD; refresh coordinated. Старый working grant заменяется только после проверки нового target/scopes.

**Disconnect:** stop admission/dispatch, revoke-only credentials, preserve cache/history/mapping/journal/Google events. Unsent commands не оживают при reconnect. Revoke 200 — documented success; lost reply + 400 остаётся failure. Explicit operator confirmation после удаления grant в Google и остановки old attempts даёт recovery с `operator_confirmed`, а не ложным provider proof. Новый consent не пересекается со старым revoke. [OAuth revoke](../../../docs/google-calendar/articles/related/identity/protocols/oauth2/web-server.md#tokenrevoke)

**Runtime:** migration role ставит pg-boss schema; app runtime без DDL/reindex и без privileged fallback. Composition/lifecycle запускает и закрывает queue resources до DB pool. App factory без side effects. Caddy callback query redaction дополняет sanitized API errors.

**Owner/write set:** connection/credentials/gateway; config/server/migrate/lifecycle; google routes; DB connection/flow; env examples/compose/grants/Caddy. Package versions/age evidence сохранены в RESEARCH; установка не выполнялась.

**Удаление границы ломает:** replay/wrong-account grant, leaked token, late refresh overwrites reconnect, permanent disconnect trap, revoked new grant или app-role DDL.

**Доказательство:** public auth negative paths, refresh concurrency, disconnect lost-response recovery, real-role startup/shutdown. Production/deployed pages/day-8 остаются отдельными external proofs.

## AR-05 — Safe DTO, complete conflicts и правдивая privacy

**SC4,5,6 / UI B1–B6.** B1 connection actions отличаются от network availability. B2 requested/snapshot range + read status/revision и общий read owner. B3 stable request/command identity + expectedVersion/generation. B4 pending/unknown/projection_pending/partial и unresolved targets. B5 complete=true только после all pages; B6 title/time cache + journal/credentials/backups/draft storage. Exact definitions принадлежат RESEARCH, не повторяются здесь вторым schema owner.

**Решение:** teacher API gates обязательны независимо от disabled UI. Calendar reads допускают явный last-known; все calendar edits проверяются заново сервером. Conflicts advisory при complete overlap, но incomplete/provider outage не открывает Save. Only exact own instances excluded; all-day exclusive end и полный finite/check-through range. Никакого Phase25 matching/watch UI.

**Privacy:** persist только выбранные provider title/time/status/availability/identity/version + window coverage, mapping и journal; details в RESEARCH разделе 8. Unsaved draft в памяти вкладки, browser correlation IDs без input. Cache/history не удаляется Disconnect; backup deletion/TTL не обещаются. Marks/payments/rates/notes не уходят Google. Public /welcome/privacy/terms — explicit allowlist, private root Today сохранён.

**Owner/write set:** contracts и web shared state, schedule/Today/Students callers, public pages/proxy. api-client остаётся transport owner. UI-SPEC B1–B6/D7 должен связаться с этим stable handoff после проверки parent; это не новый product approval.

**Удаление границы ломает:** false empty/false saved, потеря page-2 conflict, stale response unlocks Save, privacy обещает отсутствие реально сохраняемого cache.

**Доказательство:** public routes, no false toast на 202, read-only transitions, pagination/range race, anonymous allowlist, reviewed exact privacy fields. Сейчас NOT RUN.

## Порядок и evidence

1. DTO/schema и E2E failure modes → OAuth/gates/public pages.
2. Общий projection/read owner и C2 consumers.
3. Single command tracer/recovery → recurring/cut lineage.
4. UI/conflicts/privacy binding → scoped static/E2E evidence.
5. Отдельно authorized deployment/Production/day-8.

Это design order, не разрешение на execution. [COVERAGE](COVERAGE.md) содержит все 38 Calendar methods и 4 OAuth capabilities. [RESEARCH](24-RESEARCH.md) содержит input hashes, воспроизводимые static commands, exact write inventory и 6SC map.

**Результат:** пять архитектурных границ закрывают текущие D-01…D-14 и C2. Runtime/provider, cut/DST parity, disappearing tombstone, production и day-8 не проверены.
