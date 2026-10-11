---
phase: 24-google-calendar-connection-and-outbound-sync
reviewed: 2026-10-11T20:06:12Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - apps/api/src/calendar/cancelled-singles.ts
  - apps/api/src/calendar/command-result.ts
  - apps/api/src/calendar/commands.ts
  - apps/api/src/calendar/connection-control.ts
  - apps/api/src/calendar/credentials.ts
  - apps/api/src/calendar/dispatch.ts
  - apps/api/src/calendar/event-mapping.ts
  - apps/api/src/calendar/gateway.ts
  - apps/api/src/calendar/journal.ts
  - apps/api/src/calendar/read-model.ts
  - apps/api/src/calendar/recovery.ts
  - apps/api/src/calendar/single-observation.ts
  - apps/api/src/calendar/worker.ts
  - apps/api/src/routes/schedule.ts
  - apps/api/src/schedule/changes.ts
  - apps/api/src/schedule/command-apply.ts
  - apps/api/src/schedule/command-plan.ts
  - apps/api/src/schedule/single-command.ts
  - e2e/move.spec.ts
  - e2e/support/calendar-commands.ts
  - e2e/support/calendar-single.ts
findings:
  critical: 3
  warning: 0
  info: 0
  total: 3
status: issues_found
base: 6ada73b31758986538c9db9c8312570a6f737d8d
head: 407d9c99fa53afe681d168ff08b2c7efe2451918
runtime_verification: UNVERIFIED
resolution_status: resolved_source
resolution_head: 81cfa23
parent_integration: 4d1e1ee50538c97cef1314e577e15f1ed144ce9f
---

# 24-08: независимый backend review

## Source resolution

Parent проверил исправления трёх исходных findings перед integration. Первичный pinned review ниже сохранён.

- CR-01 закрыт source commits `f0e8b0e` и `68efafa`: настоящий успешный conditional cancel PATCH получает `fields: id`; отдельный cancellation ACK хранит actual id/HTTP status/If-Match и исходный baseline. `parseMaster` не требуется. Sparse GET не становится нашим ACK. Existing tombstone journey проверяет действительный id-only результат через public API и real persistence.
- CR-02 закрыт `607aefa`: immutable validated unowned snapshot идёт в R2 insert; ACK проверяет его fingerprint. Unsupported snapshot сохраняет recovery barrier вместо insert с потерей данных.
- CR-03 закрыт `e431f2f`: один admission deadline 30 секунд ограничивает refresh, provider pages и capture; transaction проверяет budget до persist.

Final delta `68efafa` прошёл owner API typecheck/build, scoped quality, Prettier и `git diff --check` с exit0; exact commands и fingerprints находятся в `24-08-SUMMARY.md`. Parent integration `4d1e1ee` с обязательным mapped `binding.studentId` прошла `yarn workspace @dv-lab/api typecheck`, exit0. Parent проверил только changed claims; исходные accepted CR-02/03 не пересматривались повторно. Connected E2E, DB/provider observations и real-clock acceptance остаются UNVERIFIED. Source resolution не закрывает runtime acceptance фазы.

## Scope Card

Результат: actionable review SC2/SC3/R2 перед parent integration. Scope: ровно 21 source/E2E-файл из закреплённого diff; зависимости прочитаны только для проверки вызовов. Владельцы контрактов: schedule prepare/apply, calendar journal/gateway/worker/read model и existing move journey. Публичные сигнатуры не менялись.

За границей: source fixes, Git mutations, зависимости, env, runtime, DB, Google API, CUA, платные вызовы, другие агенты, удаления и широкий quality audit. Единственный write set — этот отчёт.

A1: семантический объект review — commit 407d9c99fa53afe681d168ff08b2c7efe2451918. Основание: задание и git rev-parse. Более поздний HEAD не входит в выводы.
A2: connected provider proof отсутствует. Основание: задание и 24-07/24-08 SUMMARY. Его получение требует отдельной runtime authority.

Критерий приёмки review: проверить conditional ACK и atomic projection; immutable retry и R2 proof/reservation; fences, admission/recovery limits и honesty статусов. Work map: contract → pinned changed segments и необходимые вызовы → проверка гипотез → отчёт. Stop: все эти claims рассмотрены; новые эксперименты не нужны.

## Narrative Findings (AI reviewer)

### CR-01 — P1 / BLOCKER: минимальный cancelled ACK не подтверждает успешную отмену

**File:** /Users/kdvornichenko/.codex/worktrees/phase24-contracts/dv-lab/apps/api/src/calendar/command-result.ts:78-85
**Связанные строки:** gateway.ts:275-301 (conditional PATCH и verifyGoogleResult); dispatch.ts:314-315 (refusedDispatch); recovery.ts:197-205 (GET через тот же verifier).

**Issue:** verifier безусловно требует полный private marker, затем parseMaster требует etag/status. Для cancelled resource Google не гарантирует эти дополнительные поля. Настоящий успешный conditional cancel с ответом, содержащим id/status и без extendedProperties, отклоняется как external_change на строке 81. ACK не сохраняется, domain остаётся scheduled, command становится recovery_required/unknown. Последующий sparse GET снова проходит тот же verifier и не может завершить команду. Barrier блокирует новые edits, а confirmedCancellation не допускает R2, поскольку cancel не applied.

**Проверяемый путь:** существующий принадлежащий приложению single → PATCH status=cancelled с исходным If-Match → настоящий 2xx с минимальным cancelled event без private properties → verifyGoogleResult бросает до acknowledgeCommand. Это доказанный отказ parser на разрешённой форме ответа; фактическое получение такого ответа в runtime здесь UNVERIFIED. Источник: локальный docs/google-calendar/articles/v3/reference/events.md:331 и [официальный Events resource](https://developers.google.com/workspace/calendar/api/v3/reference/events#status). На календаре organizer обычно сохраняются детали; это не основание требовать их во всех cancelled responses.

**Минимальный fix:** отдельный verified result для прямого успешного conditional cancel. Связать его с неизменным dispatch attempt, target ID, If-Match, фактическими status/generation и доступными cancellation facts. Сохранённые baseline facts должны иметь явное происхождение; не выдавать их за поля текущего GET. Для потерянного ответа sparse GET по-прежнему не должен превращаться в доказательство собственного ACK только по marker или отсутствию. Не ослаблять общий verifier для move/restore/insert.

### CR-02 — P1 / BLOCKER: R2 replacement теряет чужие writable fields

**File:** /Users/kdvornichenko/.codex/worktrees/phase24-contracts/dv-lab/apps/api/src/calendar/event-mapping.ts:54-60
**Связанные строки:** schedule/single-command.ts:152-183; command-result.ts:87-92; dispatch.ts:322-327.

**Issue:** replacement копирует только payload restore. В нём есть summary/start/end/status и маркеры. Description, location, reminders, attendees и чужие extendedProperties туда не попадают. Cancellation journal хранит нормализованный event и hash чужих полей, а не значения для восстановления. Новый insert создаёт representation без этих данных. preservesUnowned возвращает true для insert, поэтому утрата не препятствует applied.

**Проверяемый путь:** single → пользователь добавляет location и description в Google → fresh read → verified cancel → tombstone действительно исчезает → полный R2 absence proof → replacement insert. В исходящем body нет location/description независимо от результата Google. Старое cancelled событие сохраняется как mapping history, но новая active representation теряет данные. Actual tombstone disappearance остаётся UNVERIFIED; дефект построения replacement body виден непосредственно в коде.

**Минимальный fix:** сохранять необходимый immutable snapshot поддерживаемых чужих writable fields при подтверждённой отмене и использовать его для R2 replacement. Проверять сохранение этих полей в ACK нового event. Учитывать параметры Google для полей, которые нельзя просто скопировать. Если values не сохранены либо корректно восстановить их нельзя, оставить recovery_required с честной причиной вместо insert, теряющего данные. Одного fingerprint недостаточно для восстановления values.

### CR-03 — P2 / BLOCKER: admission R2 не имеет общего лимита 30 секунд

**File:** /Users/kdvornichenko/.codex/worktrees/phase24-contracts/dv-lab/apps/api/src/calendar/commands.ts:89-99
**Связанные строки:** credentials.ts:139-158; single-observation.ts:90-126; gateway.ts:149-182.

**Issue:** admitSingle передаёт observeSingle только lease signal. У этого signal нет общего deadline. primary ограничивает собственный вызов 30 секундами, а identitySearch выполняет до 1000 страниц с отдельным 10-секундным timeout каждой страницы. Лимит 30 секунд worker появляется после admission и не ограничивает публичный POST. dispatchDeadline также только записывается после чтений и не прерывает их.

**Проверяемый путь:** restore missing single → primary/GET/primary занимают часть бюджета → identity search возвращает несколько страниц, каждая быстрее 10 секунд, суммарно дольше 30 секунд. POST продолжает держать account lease и читать Google после admission deadline. Затем может вернуть 202 для уже просроченной команды, которую worker завершит not_applied. Это нарушение bounded admission, а не замечание об алгоритмической производительности.

**Минимальный fix:** создать общий admission signal с оставшимся временем до context.now + 30000 и передать его через все provider reads/пагинацию. Проверить deadline внутри transaction перед persistCommand. При исчерпании бюджета не принимать expired command как pending. Сохранять отдельный HTTP timeout 10 секунд и не превращать incomplete identity search в absence proof.

## Отклонённые гипотезы и границы выводов

- Known UI generation mismatch не продублирован. Backend ACK хранит фактическую confirmation generation в stage; apply сравнивает её с текущей connection. commandSnapshot оставляет captured generation, как указано parent.
- Unknown GET404 не становится effect=none только по отсутствие события: observeAbsence сохраняет unknown/recovery. rejectObservedPrecondition требует доказанные rejected attempts.
- Replacement generation не вычисляется заново при dispatch retry: request и reservation читаются из journal. Старые mapping rows переводятся в retired, физического удаления нет.
- Private marker сам по себе не подтверждает PATCH: verifier проверяет owned fields; acknowledge дополнительно проверяет исходный unowned fingerprint. Полнота самого списка writable fields не сертифицирована широким аудитом.
- If-Match действительно передаётся в HTTP headers. SDK retry выключен в interceptor и параметрах вызова. После первого 401 attempt фиксируется как rejected; повторный dispatch не получает refresh callback и снова проверяет deadline/generation.
- Retained fixture journeys прочитаны как исходники. Их названия и сохранённые DB observations не считаются новым connected E2E PASS.
- Simplify применён только как read-only проверка touched comments и лишних ветвей. Source не исправлялся.

## Evidence и ограничения

Pinned inventory: git diff --name-only 6ada73b31758986538c9db9c8312570a6f737d8d 407d9c9 — exit 0, 21 файл.
Pin: git rev-parse 407d9c9 — exit 0, 407d9c99fa53afe681d168ff08b2c7efe2451918.
Fingerprint: git diff --raw 6ada73b31758986538c9db9c8312570a6f737d8d 407d9c9 — exit 0, old/new Git blob IDs для тех же 21 paths. Commit фиксирует полные blobs; working tree не использован как semantic source.
Чтение: git show 407d9c9:<path> и git diff 6ada73b 407d9c9 -- <paths>. Повторить эти команды для точных строк и всех changed segments.
.gitignore: git check-ignore для reviewed calendar source и нового E2E helper не нашёл ignored paths. .codexignore и .codegraph отсутствуют. Локальные project skill directories отсутствуют; agent-skills query не указал дополнительных SKILL.md.
Контекст: AGENTS.md, EXECUTOR-RULES, 24-08 PLAN, CONTEXT, RESEARCH §3/§4, 24-07 SUMMARY и релевантные 24-08 SUMMARY claims. Указания на execution/commits не применялись к этому review.

Runtime/Google/DB/E2E/typecheck/build/metrics: NOT RUN по authority. Connected Google TESTPRIMARY/grant missing — известное ограничение, не дополнительная ошибка. Owner quality measurements не перепроверены и не объявлены PASS. Приёмка SC2/SC3/R2 в runtime остаётся UNVERIFIED.

Write connector open_workspace вернул Internal error. Для единственного разрешённого отчёта использован доступный file patch tool вместо shell file creation. Никакие source, shared metadata или другие artifacts не записывались.

Изменённый файл: 24-08-INTEGRATION-REVIEW.md — этот независимый отчёт для parent integration.
