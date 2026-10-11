# Phase 24 — Architectural Review

**Date:** 2026-10-11
**Scope:** OAuth, encrypted credentials, durable outbound sync, instance/cut identity, paginated conflicts and public-page boundary.
**Status:** preparation complete; implementation and provider proof not performed.
**Confidence:** MEDIUM — mandated confidence seam; source read plus official docs, no runtime. [VERIFIED: confidence seam, 2026-10-11]

## Контракт проверки

Результат — пять конкретных архитектурных решений для SC1–6. Это проектирование новых границ, не список доказанных дефектов ещё не написанной интеграции. Write set текущей работы: только 24-RESEARCH.md и этот файл. Source, Git, dependencies, env, DB, browser, Google и сервер не меняются. [VERIFIED: current user scope]

Применён deletion test: оставить границу только если без неё теряется atomicity, identity, credential security, lifecycle ownership или complete conflict result. Технические решения не требуют повторного одобрения. Product policy primary-only принята пользователем; см. CONTEXT D-11 и RESEARCH A1. [CITED: 24-RESEARCH.md, Open Questions]

## Карта ответственности

Предписанная карта основана на существующих module owners и принятом CONTEXT. [CITED: AGENTS.md:42-95] [CITED: .planning/phases/24-google-calendar-connection-and-outbound-sync/24-CONTEXT.md:23-36]

| Owner                                  | Owns                                                          | Must not own                               |
| -------------------------------------- | ------------------------------------------------------------- | ------------------------------------------ |
| Existing core / schedule               | Zones, recurrence, local cut/end, marks                       | OAuth, provider DTO, queue transport       |
| Schedule transaction + calendar outbox | Durable change intent and inserted-ID lineage                 | Remote HTTP request                        |
| Calendar connection/credentials        | Consent/state, key envelope, refresh generation               | User login replacement or schedule math    |
| Calendar worker/transition owner       | Latest-state reconciliation and one ordered remote transition | Browser requests or generic event platform |
| Calendar gateway                       | Google wire calls, pagination, conditional writes             | UI rendering or domain date rules          |
| Web public/private owners              | Safe connection DTO, explicit conflict interval, public pages | Tokens, Google SDK or direct DB imports    |

## AR-01 — Domain commit и sync intent должны иметь одну транзакционную границу

**Priority / criteria:** required; SC2,3.

**Evidence:** current moveSeries/endSeries run a DB transaction, update the old series and insert preserved lessons there. DbExecutor is defined verbatim as `export type DbExecutor = Database | Transaction`. [CITED: apps/api/src/schedule/series.ts:37-71] [CITED: packages/db/src/connection.ts:28-32] pg-boss singleton limits active jobs; localConcurrency only limits one process. [CITED: https://raw.githubusercontent.com/timgit/pg-boss/12.37.1/docs/api/queues.md] [CITED: https://raw.githubusercontent.com/timgit/pg-boss/12.37.1/docs/api/workers.md]

**Risk if omitted:** queue send after commit can be lost; stale payload can overwrite the latest local state; independent master/instance workers can interleave a cut.

**Decision:** app-owned intent and revision are written through the same DbExecutor as the mutation. Pump only wakes work. Worker reads latest state, serializes by connection, conditionally writes the provider resource and CAS-acks the matching revision/generation. Unknown results stay pending until reconciliation. Preserve unfinished transition steps while coalescing ordinary updates.

**Before → after:** domain transaction followed by optional delivery → one durable domain/intent boundary with retriable provider projection.

**Owner / planned write set:** existing schedule mutations; new calendar/outbox.ts, worker.ts and transition owner; DB schema and generated migration. Exact existing transaction inputs remain owned by schedule.

**Interface-strength check:** proposed `recordCalendarChange(tx, accountId, refs, transition)` receives a transaction and domain references. It does not accept credentials or a prebuilt Google payload. Worker start/close is injected by server.

**Deletion test:** removing the intent record leaves a commit-to-send failure window. A generic event bus, extra broker or independent per-route retry service adds no needed guarantee and is rejected.

**Observable proof:** durable public create/move journey; interrupt after local commit and after provider acceptance; restart; final matching Google event is unique and has the newest time. Two rapid edits plus delayed response cannot clear the newer intent. Real provider result is UNVERIFIED now.

## AR-02 — Natural occurrence identity и cut lineage должны пережить новый lesson ID

**Priority / criteria:** required; SC2,3; consumes 21.1.

**Evidence:** source ref union is verbatim:

```ts
{ kind: 'single'; lessonId: string } | { kind: 'series'; seriesId: string; originalOn: string }
```

[CITED: packages/contracts/src/schedule.ts:66-67]

Current keepCutLessons returns inserted `{ id: lessons.id }`, then reads `marks.get(lesson.originalOn)`; it does not return that pairing. [CITED: apps/api/src/schedule/series.ts:20-34] Google instances have a provider ID and originalStartTime; moving an instance retains the natural identity. [CITED: https://developers.google.com/workspace/calendar/api/v3/reference/events] [CITED: https://developers.google.com/workspace/calendar/api/guides/recurringevents]

**Accepted dependency:** TeacherSettings.defaultTimeZone is current account zone; series/single timeZone is immutable creation/rule zone. originalOn remains the old rule's natural date. Default setting changes no instants/IDs/rules. Cut retains the old prefix; new rule gets new ID/current default; detached moved/marked tail keeps instant/mark/old zone and gets new lesson IDs. Manual gap rejects, fold first, recurrence gap skips. This is stable proposed 21.1 contract, not implemented code. [VERIFIED: current user instruction] [CITED: ../../phase-21-1-default-time-zone/dv-lab/.planning/phases/21.1-default-time-zone/21.1-RESEARCH.md:171-246,414-432] [CITED: ../../phase-21-1-default-time-zone/dv-lab/.planning/phases/21.1-default-time-zone/21.1-ARCH-REVIEW.md:68-88]

**Risk if omitted:** detached past/moved history is lost or duplicated; exception insert produces an independent event as well as the recurring instance; converting from display date changes identity across zones.

**Decision:** deterministic ID for each master/standalone; canonical instance ID retrieved and stored for each affected natural key. Have keepCutLessons return old natural key → inserted lesson ID. Persist lineage and cut/end journal in that transaction. Worker resolves old identities, removes old tail representations, trims old master, then ensures detached singles/new master. Resume journal after failure; do not repeat local cut.

**Before → after:** IDs tied only to currently persisted local shape → explicit identity transition carrying old key, new key and provider state.

**Owner / planned write set:** schedule/series.ts insert result; calendar/event-mapping.ts and transitions.ts; mapping/journal tables. Core remains provider-free. No second timezone/cut module.

**Interface-strength check:** persisted IDs are created in API, not core. Calendar receives oldEndsOn/newRule/CutLesson lineage from the accepted cut result. Its lookup uses natural start, never moved effective date or server zone. Current account setting is absent from deterministic ID input.

**Deletion test:** removing lineage makes a moved/marked tail indistinguishable from a new unrelated single. A generic cross-provider identity framework is unnecessary; one Calendar mapping owner is sufficient.

**Observable proof:** extend durable move/marks journeys for occurrence move/cancel/restore and cut/end, including moved tail whose effective time is already past, marked/cancelled tail, cross-zone midnight and DST. Inspect provider counts, old prefix, new IDs and local marks. Real trim/exception behavior remains RESEARCH A3, not a claimed pass.

**Requirement clarification:** GCAL-02's wording about a deterministic event ID for every exception must mean stable mapped identity. The documented instance operation retrieves an instance before modifying it. Do not satisfy literal wording by violating recurring-event D-06. [CITED: .planning/REQUIREMENTS.md:78-78] [CITED: .planning/phases/24-google-calendar-connection-and-outbound-sync/24-CONTEXT.md:28-28] [CITED: https://developers.google.com/workspace/calendar/api/guides/recurringevents]

## AR-03 — Connection credentials, flow binding и refresh generation принадлежат одному owner

**Priority / criteria:** required; SC1,4.

**Evidence:** project separates app authentication from Calendar OAuth in D-02. Google describes offline refresh and secure token handling; OAuth BCP covers PKCE and redirect security. [CITED: .planning/phases/24-google-calendar-connection-and-outbound-sync/24-CONTEXT.md:24-26] [CITED: https://developers.google.com/identity/protocols/oauth2/web-server] [CITED: https://developers.google.com/identity/protocols/oauth2/resources/best-practices] [CITED: https://www.rfc-editor.org/rfc/rfc9700.html]

**Risk if omitted:** state replay binds the wrong connection; refresh races lose valid credentials; old callback overwrites a new grant; callback code appears in proxy logs despite sanitized app logging.

**Decision:** one-use DB state bound to current teacher session/account epoch; encrypted PKCE verifier; fixed callback; required-scope validation. Envelope credentials with key ID/AAD and coordinated refresh. Generation CAS fences callbacks, refresh and queue ack. Validate replacement grant before replacing the old working connection. Disconnect pauses dispatch, retains mappings/intents/events, revokes the grant and clears live credentials; its visible pending/error state persists if revocation fails. Same-calendar reconnect resumes latest state and unfinished transitions. This safe disposition is an engineering decision; primary-only initial calendar selection is accepted by the user (CONTEXT D-11).

**Before → after:** independent route/SDK token state → one connection owner with explicit transition and credential persistence rules.

**Owner / planned write set:** calendar/connection.ts, credentials.ts; config.ts; routes/google.ts; connection/flow tables; deploy/caddy/Caddyfile for query redaction. The gateway receives usable credentials through this owner; web receives no secret fields.

**Interface-strength check:** caller supplies authenticated account/session context; it cannot select an arbitrary account ID. Error DTO is sanitized and discriminated. Missing refresh_token is not an instruction to clear a stored token.

**Deletion test:** credential encryption primitives stay in Node crypto; app code only composes an explicit envelope policy. Removing the common refresh/generation owner introduces cross-process races. Adding another login system or identity scopes is not required.

**Observable proof:** public consent/denial/replay/wrong-session/partial-scope E2E; simultaneous pending requests after access-token expiration; revoked refresh produces reconnect; same-calendar reconnect resumes pending writes. Inspect no-store/redirect and redacted proxy/app log evidence. Production/day-8 proof remains external.

**Logging evidence:** current request logger emits `path: c.req.path`; current Caddy contains `log { format json }`. Both boundaries must be covered; app-only redaction is insufficient as a design. [CITED: apps/api/src/request-context.ts:47-54] [CITED: deploy/caddy/Caddyfile:16-19] [CITED: https://caddyserver.com/docs/caddyfile/directives/log]

## AR-04 — Queue installation and runtime preserve existing DB and shutdown owners

**Priority / criteria:** required; SC1,3.

**Evidence:** current role mapping is `{ app: 'DATABASE_URL', migrator: 'MIGRATOR_DATABASE_URL' }`; current public-schema grants are scoped in provisioning. Lifecycle accepts `type Closable = { name: string; close: () => Promise<void> }`. [CITED: packages/db/src/connection.ts:5-7] [CITED: deploy/postgres/ensure-db.sql:31-34] [CITED: apps/api/src/lifecycle.ts:3-3] pg-boss start can install/migrate schema; constructor exposes disabling migration/schema creation and reindex operations. [CITED: https://raw.githubusercontent.com/timgit/pg-boss/12.37.1/docs/api/ops.md] [CITED: https://raw.githubusercontent.com/timgit/pg-boss/12.37.1/docs/api/constructor.md]

**Risk if omitted:** app startup needs owner privileges or attempts DDL; work continues against a closing pool; maintenance is disabled merely to hide grants errors.

**Decision:** migration role installs queue schema and queues; app gets explicit required runtime privileges in that schema, retaining domain deletion restrictions. Runtime disables DDL/reindex and keeps required supervisor behavior. Start through server; close pump/worker before DB pool through lifecycle.

**Before → after:** package defaults control schema/startup → project composition/migration owners control lifecycle.

**Owner / planned write set:** migrate.ts, server.ts, lifecycle resource registration, ensure-db.sql, schema migration and API manifest. New env names are declared only through loadConfig and examples; no alternate DB URL resolver.

**Interface-strength check:** worker exports start/close; it never installs schema during request handling or app import. DB adapter must retain transaction/role semantics; it does not silently open a second privileged connection.

**Deletion test:** no extra OS service or worker deployment topology is needed now. Removing this adapter would bypass an existing durable privilege/lifecycle boundary.

**Observable proof:** authorized clean test DB → migration role setup → app-role startup → queued write/retry/maintenance → graceful shutdown/restart. No elevated runtime fallback. Package versions are proposals with SUS too-new; see RESEARCH package checkpoint. No packages or DB actions executed in research.

## AR-05 — Public API gateway owns complete conflict reads; web owns only safe presentation

**Priority / criteria:** required; SC4,5,6.

**Evidence:** Calendar events.list may paginate even below maxResults and defines overlap bounds through event end/start. [CITED: https://developers.google.com/workspace/calendar/api/v3/reference/events/list] Current web proxy excludes API/login/assets from its matcher and redirects other unauthenticated requests to `'/login'`; it does not yet encode the proposed public-page allowlist. [CITED: apps/web/proxy.ts:6-14] CONTEXT requires public homepage/privacy/terms and excludes Phase 25 controls. [CITED: .planning/phases/24-google-calendar-connection-and-outbound-sync/24-CONTEXT.md:31-32]

**Risk if omitted:** first-page results falsely declare no conflicts; unbounded recurrence is advertised as fully checked; making privacy public accidentally opens private routes; UI shows sync guarantees not implemented until 25.

**Decision:** one gateway consumes every page for a finite interval, returns explicit checked bounds/completeness, filters only the edited mapped identity, and handles cancelled/transparent/all-day semantics. Page failure is unavailable, never clean. Core generates proposed local occurrence intervals. Add public /welcome, /privacy and /terms outside the authenticated group; use /welcome as proposed Branding homepage and retain root Today. Privacy describes actual implemented data use.

**Before → after:** SDK/page details leak into UI → small typed DTO with connection state, checked interval and complete/conflict/unavailable result.

**Owner / planned write set:** calendar/gateway.ts, route/contracts; existing schedule/settings UI owners; proposed apps/web/app/{welcome,privacy,terms}/page.tsx and existing proxy.ts. No Google browser SDK or client-side recurrence. Root Today and its authenticated layout already exist; do not add a conflicting second root page. [CITED: apps/web/app/(app)/page.tsx:14-17] [CITED: apps/web/app/(app)/layout.tsx:11-27] [CITED: https://nextjs.org/docs/app/api-reference/file-conventions/route-groups]

**Interface-strength check:** read-only conflict method accepts validated finite instants and optional local ref; no arbitrary user-supplied provider URL. It returns minimal event display data without tokens. Method never mutates Google. RESEARCH section 8 defines the safe connection/sync snapshot, conflict union, pending-count semantics and exact privacy flows; UI-SPEC's explicit Check through closes the former A2 uncertainty. Do not persist full conflict/event bodies or put student titles into queue/log payloads.

**Deletion test:** removing gateway pagination means each UI caller must reproduce completeness/error semantics. A second query service, full Google API wrapper or new inbound engine does not close another accepted criterion.

**Observable proof:** public planning journey finds conflict beyond page one, reports failed-page state, handles all-day and self-exclusion, and displays its interval. Anonymous homepage/privacy/terms work while Today/settings remain guarded. Production publication and Branding links require later deployed proof.

## Порядок для planner

1. Apply accepted A1 primary-only initial calendar selection (CONTEXT D-11). Use UI-SPEC's explicit Check through and /welcome route. D2 Disconnect and D3 data-flow/DTO behavior are specified in RESEARCH section 8; they require binding, not another product interview. This does not reopen the timezone owner.
2. Consume exact 21.1 signatures, dependency fingerprints and cut/end contract.
3. Plan schema/intent/lineage and E2E failure modes before behavior.
4. Plan OAuth/security and queue/lifecycle boundaries.
5. Plan standalone, recurring/cut recovery, conflict/public UI waves with corresponding SC.
6. Retain external proof gates and SUS dependency checkpoint; do not mark them green from local simulations.

Это порядок решений, не новое разрешение implementation/deployment. [VERIFIED: current user scope]

## Evidence и ограничения

- Full sources, exact proposed signatures, capability/scopes table and test map are in 24-RESEARCH.md.
- Canonical 21.1 research SHA-256: `3db87f2370abb6cbfd6b94e563b8bc7d67eb42b23a4e09bf09647f7efeded657`; architecture SHA-256: `070199aad27d8bf7e00f0cead2a0a4a6fb77d5e54f7c10449551dcd19a3f0009`. [VERIFIED: SHA-256 read, 2026-10-11]
- Actual source transaction, credential middleware, composition/lifecycle, DB role and proxy seams were read. Source fingerprints are preserved in RESEARCH.
- Five findings retained; no general repository audit, new framework or Phase 25 implementation recommendation.
- Runtime/provider behavior, key rotation, fresh-role startup, package installation, deployed pages, Production and day-8 connection are **UNVERIFIED**. No absence-of-metadata compatibility claim is made.
- Current-file write set stays exactly RESEARCH/ARCH; source/Git/env/DB/dependencies/provider unchanged. [VERIFIED: current task execution boundary]

**Result:** архитектурные решения готовы для planner. Product policy A1 разрешена; указанные execution/proof gates требуют последующей обработки; ожидание actual 21.1 implementation для планирования не требуется.
