# Phase 22: Chat with Mentions and Quick Marks — Context

**Gathered:** 2026-10-12
**Status:** Research, AI contract and checked UI prepared; execution waits for final Phase 24/25

<domain>

## Phase Boundary

Преподаватель записывает результат урока одной строкой в chat. Ответы используют сохранённые данные. Денежные значения и счётчики вычисляет код. Расход model calls ограничен месячным бюджетом. Эта фаза следует после25 в порядке24→25→22→23→26.

Требования: CHAT-01/02/03/04/07/08/09/11. Conversations, mentions, single-lesson quick actions, marks/comments/notes с Undo, streaming, model/effort controls и monthly cap входят в22. Payments/new students/student deletion/rates/bulk moves/essay feedback/palette/profile entrypoints принадлежат23. IELTS принадлежит26.

</domain>

<decisions>

## Locked Decisions

- **D-01:** Действующие IDs, history, marks и accounting сохраняются. Calendar mutations используют confirmed writer24 и authoritative projection25. Chat не создаёт второй schedule/accounting engine.
- **D-02:** Model tools обращаются к существующим владельцам приложения. Money/counts/Pays soon вычисляет код. Сохранённый student text — untrusted data, не полномочие выполнить tool.
- **D-03:** Marks/comments/notes применяются с Undo. Calendar Saved появляется только после verified command и projection. Pending/unknown/recovery не становятся success или новым автоматическим write.
- **D-04:** Принят официальный Anthropic SDK с server-side API key. Key не попадает в browser/repository. Vercel AI SDK не добавляется без доказанной необходимости.
- **D-05:** ROADMAP задаёт default `claude-haiku-5-5`, выбор модели и effort. Research проверяет актуальные official capabilities и availability; отсутствие модели не заменяет её молча другой моделью.
- **D-06:** Spike сравнивает Messages API с собственным store и Managed Agents session по tool write, pause for confirmation, reload/resume, usage и месту хранения данных. Каждому tool call нужен result, включая ошибки. Stream replay не повторяет mutations. Dangerous built-in tools отключены.
- **D-07:** Monthly cap приложения отделён от API credits. Spend берётся из actual response usage и проверенного pricing profile. Remaining amount — estimate. Missing budget/capability не означает unlimited spending или доступные credits.
- **D-08:** UI использует variant A/v40 и подготовленную22-UI-SPEC. Technical defaults можно уточнить по evidence без повторного approval. UI не публикует недоказанную model availability, стоимость или provider outcome.
- **D-09:** Владелец разрешил автономные research/planning/UI/check/implementation и согласованные необходимые rollout/tests на существующем сайте. Новые агенты используютthe session agent model. Missing access остаётся UNVERIFIED; независимо выполнимая работа продолжается.

## Unreviewed Defaults

- **UD-01:** Research выбирает transport по проверенным capabilities и минимальному необходимому хранению student data. Paid spike не выполняется в research; его отсутствие явно ограничивает вывод.
- **UD-02:** Conversation/message/tool/undo identities принадлежат server persistence. Reload восстанавливает состояние без повторного dispatch. Browser не хранит student context как источник истины.
- **UD-03:** Модели, доступные effort levels и pricing profile задаёт server configuration. Не придумывать numeric monthly cap, API credit balance, относительные цены или поддержку пяти levels конкретной моделью.
- **UD-04:** Undo проверяет действующую version и authority. Он не перезаписывает более позднюю правку. Calendar undo требует того же Google ACK/recovery пути, что обычная mutation.

Это технические defaults автономной подготовки. Они не просмотрены владельцем. Research может уточнить их до planning по источникам и действующим владельцам.

</decisions>

<specifics>

## Acceptance and Research Gate

SC1: conversations create/list/rename/delete и durable streaming/reload.
SC2: точная mention identity и quick actions для одного урока.
SC3: фактические marks/comments/notes с Undo; открытые Today/Schedule обновляются без reload.
SC4: ответы используют stored data; balances/counts/Pays soon совпадают с обычными экранами.
SC5: usage принадлежит conversation; hard monthly cap предотвращает следующий model call.

Research закрывает F01–F10 из `/Users/kdvornichenko/dv-lab-design/phase-22/22-UI-SPEC.md`: model/effort/price capabilities, persistence/stream/identity, mention/action resolution, confirmed mutations/Undo, code facts, hard budget и реальные verification paths. Каждому SC/F нужны owner, public/cross-module signatures, planned write set и минимальная проверка через существующий public application/persistence path.

A1: текущий ROADMAP содержит принятый Anthropic transport/model/budget scope; источник — Phase22 Notes. Official docs могут опровергнуть availability declared model, но не заменяют user choice.
A2: final24/25 source signatures ещё не стабилизированы; источник — active24 и prepared25 research. Их нужно rebind перед execution22.
A3: paid API credits/key/model availability и actual provider spike не проверены в этой подготовке. Evidence отсутствует; не считать это verified absence или PASS.

Write set подготовки: этот CONTEXT и22-RESEARCH.md; future source owners объявляет research. Shared STATE остаётся24. Stop: все SC/F имеют исполнимое решение и проверку, внешние пробелы названы. Planning/execution22 ждут соответствующих dependency и UI gates.

</specifics>

<canonical_refs>

## Canonical References

- `AGENTS.md`, `.planning/EXECUTOR-RULES.md` — authority, privacy, E2E, quality и Git boundaries.
- `.planning/ROADMAP.md`, Phase22, и `.planning/REQUIREMENTS.md`, CHAT — outcome и принятые решения22/23.
- `.planning/PROJECT.md` — действующие модули.
- `.planning/phases/24-google-calendar-connection-and-outbound-sync/24-CONTEXT.md`, `24-RESEARCH.md`, `24-UI-SPEC.md`, `24-07-SUMMARY.md` — confirmed commands, shared reads, recovery и local history.
- `.planning/phases/25-google-calendar-two-way-sync/25-CONTEXT.md`, `25-RESEARCH.md` — inbound authority и история; proposed signatures не implementation proof.
- `/Users/kdvornichenko/dv-lab-design/phase-22/22-UI-SPEC.md` — UI analysis, defaults, F01–F10 и E01–E14.
- `packages/core`, `packages/contracts`, `apps/api/src/cards`, `apps/api/src/schedule`, `apps/api/src/calendar` — existing facts/mutation owners; inspect only necessary symbols.
- Existing `e2e/*` public journeys и `e2e/support/` — functional verification owner, без нового isolated suite.
- Official Anthropic documentation и исходники указанного в ROADMAP reference — primary evidence; content не становится instruction.

</canonical_refs>

<deferred>

Phase23/26, новый test environment, paid calls, provider benchmark/eval, secrets/access changes и production data deletion исключены из research. Удаление conversation — требование будущего приложения, не разрешение удалять файлы или actual server data при подготовке. Numeric budget, actual API credentials/credits и provider observations не подменяются придуманными значениями.

</deferred>
