---
phase: 24-google-calendar-connection-and-outbound-sync
plan: '02'
subsystem: database
tags: [google-calendar, contracts, zod, drizzle, command-journal]
requires:
  - phase: 21.1-default-time-zone
    provides: Реальные ScheduleSeries, ScheduleOccurrenceRef и input schemas с сохранённой зоной
provides:
  - Строгий публичный Calendar wire с отдельными read freshness, write capability и command state
  - Восемь additive таблиц для connection, OAuth, journal, mapping и confirmed read provenance
affects: [24-03, 24-04, 24-05, 24-06, 24-07, 24-08, 24-09, 24-10, 24-11, 24-12, 24-13]
tech-stack:
  added: []
  patterns:
    - Account/connection composite foreign keys с RESTRICT
    - Приватные Zod schemas для JSON-полей без SDK payload
    - Bigint revisions без преобразования в небезопасный number
key-files:
  created:
    - packages/contracts/src/calendar.ts
    - packages/db/src/calendar-schema.ts
    - packages/db/src/calendar-read-schema.ts
    - packages/db/src/calendar-values.ts
  modified:
    - packages/contracts/src/auth.ts
    - packages/contracts/src/index.ts
    - packages/db/src/index.ts
    - packages/db/drizzle.config.ts
key-decisions:
  - Существующие schedule, TodayResponse и StudentRow не меняются до атомарного переключения producers в 06
  - Приватная валидация journal отделена от публичных contracts и таблиц
  - Read projection имеет отдельный schema owner; imports идут от read к connection/journal без цикла
  - Calendar identity и historyCutoverAt сохраняются в единственной строке connection на account
requirements-completed: [GCAL-01, GCAL-02, GCAL-03, GCAL-09, GCAL-10]
coverage:
  - id: 24-02-D1
    description: Аддитивные Calendar DTO и request schemas без смены действующих producers
    verification:
      - kind: other
        ref: yarn workspace @dv-lab/contracts typecheck
        status: pass
    human_judgment: false
  - id: 24-02-D2
    description: Типизированные declarations восьми таблиц и входы Drizzle generator
    verification:
      - kind: other
        ref: yarn workspace @dv-lab/db typecheck
        status: pass
    human_judgment: false
actuals:
  tokens: 11886
  tasks: 2
  commits: 2
commits: 2
plan_head_before: 8116e48b1788b68d93f84536d3142d5ac4797148
plan_head_after: 785658eb69af40a1695bb300497a8bed0cbdf752
duration: 10min
completed: 2026-10-11
status: complete
---

# Phase 24 Plan 02: Calendar wire и durable schema Summary

**Добавлены строгие Calendar DTO и восемь таблиц с account ownership, provenance полных чтений, уникальными representations и durable command/stage facts.**

## Scope и результат

Две задачи 24-02 выполнены в статической границе SC1–5/C2. Доказаны компиляция типов, формат и качество owned source. Поля `requirements-completed` и coverage относятся к interface/schema части этого плана; они не подтверждают полный runtime результат Phase 24.

Допущения: A1 — source 21.1 присутствует; подтверждено чтением реальных `ScheduleSeries` и input schemas на BASE. A2 — declarations не выполняют DB/provider writes; runtime, миграции и E2E принадлежат следующим планам. Stop condition: два scoped task commits, статические проверки и SUMMARY.

- Начало реализации: 2026-10-11T15:50:02.076Z.
- Завершение source: 2026-10-11T15:59:11.556607+00:00.
- Изменено: 8 source/config файлов; этот SUMMARY — отдельный девятый файл.
- Actuals: `ceil(47543 / 4) = 11886` по символам реализованного Git diff, не по токенам модели.
- `commits: 2` измерено через persisted Git ledger до metadata commit; границы диапазона сохранены в frontmatter.

## Task Commits

1. `4b9627a` — `feat(24-02): добавил контракты чтения и команд Google Calendar`.
2. `785658e` — `feat(24-02): добавил схему подключения проекции и журнала Google Calendar`.

Metadata commit содержит только этот SUMMARY. Его hash возвращается оркестратору после коммита.

## Files Created/Modified

| Файл                                      | Причина                                                                                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/calendar.ts`      | Exact RESEARCH §2/7 wire, strict UUID/version/ISO/date inputs, command receipts/status, recovery/OAuth/conflict endpoints.                         |
| `packages/contracts/src/auth.ts`          | Добавлены Calendar error codes; прежние auth/default-zone codes сохранены.                                                                         |
| `packages/contracts/src/index.ts`         | Публичный экспорт Calendar contracts.                                                                                                              |
| `packages/db/src/calendar-schema.ts`      | Connection, OAuth flow, immutable-plan journal, stages и representation mappings.                                                                  |
| `packages/db/src/calendar-read-schema.ts` | Полные окна, минимальные event facts и next-prefix/end-of-list proof.                                                                              |
| `packages/db/src/calendar-values.ts`      | Strict приватные schemas для encrypted envelope, provider time, captured input/rule, reservations, lineage, requests, attempts и acknowledgements. |
| `packages/db/src/index.ts`                | Экспорт Calendar tables и private storage validators для API.                                                                                      |
| `packages/db/drizzle.config.ts`           | Generator читает base schema и оба Calendar schema owners.                                                                                         |
| `24-02-SUMMARY.md`                        | Результат, измерения, воспроизводимые команды и границы handoff.                                                                                   |

## Проверки

Все команды выполнялись из `/Users/kdvornichenko/.codex/worktrees/phase24-contracts/dv-lab`.

| Команда                                                                                                                                                                                                                                                                                             | Статус       | Решающий вывод                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------- |
| `yarn workspace @dv-lab/contracts typecheck`                                                                                                                                                                                                                                                        | PASS, exit 0 | stdout пуст.                                                                                      |
| `yarn workspace @dv-lab/db typecheck`                                                                                                                                                                                                                                                               | PASS, exit 0 | stdout пуст.                                                                                      |
| `yarn exec prettier --check packages/contracts/src/calendar.ts packages/contracts/src/auth.ts packages/contracts/src/index.ts packages/db/src/calendar-schema.ts packages/db/src/calendar-read-schema.ts packages/db/src/calendar-values.ts packages/db/src/index.ts packages/db/drizzle.config.ts` | PASS, exit 0 | All matched files use Prettier code style!                                                        |
| `git diff --check`                                                                                                                                                                                                                                                                                  | PASS, exit 0 | stdout пуст.                                                                                      |
| `git diff --cached --check`                                                                                                                                                                                                                                                                         | PASS, exit 0 | stdout пуст перед task 2 commit.                                                                  |
| `bash scripts/gsd/root-pin.sh /Users/kdvornichenko/.codex/worktrees/phase24-contracts/dv-lab`                                                                                                                                                                                                       | PASS, exit 0 | ROOT_PIN_OK перед правкой и каждым commit.                                                        |
| `node /Users/kdvornichenko/.codex/gsd-core/bin/gsd-tools.cjs query git.base-branch --is-protected agent-24-contracts`                                                                                                                                                                               | PASS, exit 0 | false; дополнительные проверки detached, agent namespace, exact branch и spawn sentinel пройдены. |
| `git show --first-parent --diff-filter=D --name-only --pretty=format: HEAD`                                                                                                                                                                                                                         | PASS, exit 0 | stdout пуст после каждого task commit.                                                            |

Поиск TODO/FIXME/placeholder, новых комментариев и явных any/unknown в новых файлах: совпадений нет (`rg` exit 1 означает отсутствие совпадений). Типы дополнительно проверены TypeScript checker ниже. Проверки завершаются с исходным exit status, без пайпа в head.

### Качество owned source

Инструмент — существующие `scripts/dev-checks/time-zone-metrics.ts`, TypeScript 6.0.3, Node v24.17.0. Восемь owned source/config файлов; 34 функции/callbacks, из них 31 новых. В существующих функциях ветвление не изменено. Для новых функций baseline отсутствует; после изменения CC ≤4 и cognitive ≤2. SQL CHECK strings включены как строковые operands TS, а их SQL-семантика не объявляется измеренной. Dependencies, generated migrations и planning Markdown не являются handwritten executable source этого изменения.

Halstead: AST leaf tokens; operator — SyntaxKind keyword/punctuation, operand — identifier/literal text; trivia/comments исключены, вложенные функции измеряются отдельно. `D = (unique operators / 2) * (total operands / unique operands)`. Type/JSX tokens включены. Числа ниже — максимумы по функциям, строки — физические.

| Файл                                      | Строки | Функции | CC max | Cognitive max | D max |
| ----------------------------------------- | -----: | ------: | -----: | ------------: | ----: |
| `packages/contracts/src/calendar.ts`      |    330 |      16 |      4 |             2 |  8.55 |
| `packages/contracts/src/auth.ts`          |    107 |       3 |      4 |             2 | 10.40 |
| `packages/contracts/src/index.ts`         |      8 |       0 |      0 |             0 |  0.00 |
| `packages/db/src/calendar-schema.ts`      |    368 |       7 |      1 |             0 | 14.07 |
| `packages/db/src/calendar-read-schema.ts` |    171 |       5 |      1 |             0 | 12.03 |
| `packages/db/src/calendar-values.ts`      |    229 |       3 |      2 |             1 |  4.90 |
| `packages/db/src/index.ts`                |      7 |       0 |      0 |             0 |  0.00 |
| `packages/db/drizzle.config.ts`           |      7 |       0 |      0 |             0 |  0.00 |

`any/unknown findings=[]`, нарушений порогов нет. Проверены изменённые строки и целиком изменённые функции. `simplify` применён к owned diff: новых комментариев, ненужных совместимостей и подтверждённого мёртвого кода не оставлено. Новые публичные schemas предназначены для явно назначенных зависимых owners; временные consumers или isolated tests ради их использования не добавлялись.

Полная команда измерения и type inspection (exit 0, `status: PASS`), пригодная для повторения:

```sh
node --input-type=module -e 'import { readFileSync } from '\''node:fs'\'';
import { resolve } from '\''node:path'\'';
import { execFileSync } from '\''node:child_process'\'';
import { createHash } from '\''node:crypto'\'';
import ts from '\''typescript'\'';
import { measureSource, changedLines, inspectTypes, METRIC_METHOD } from '\''./scripts/dev-checks/time-zone-metrics.ts'\'';
const files=process.argv.slice(1);
const programs=new Map();
let failed=false;
const hash=s=>createHash('\''sha256'\'').update(s).digest('\''hex'\'');
const reports=files.map(path=>{
const workspace=path.split('\''/'\'').slice(0,2).join('\''/'\'');
if(!programs.has(workspace)){
const config=ts.getParsedCommandLineOfConfigFile(workspace+'\''/tsconfig.json'\'',{}, {...ts.sys,onUnRecoverableConfigFileDiagnostic:d=>{throw new Error(ts.flattenDiagnosticMessageText(d.messageText,'\'' '\''))}});
if(!config||config.errors.length)throw new Error('\''Invalid tsconfig'\'');
programs.set(workspace,ts.createProgram([...config.fileNames,resolve(path)],config.options));
}
const source=readFileSync(path,'\''utf8'\'');
const present=execFileSync('\''git'\'',['\''ls-tree'\'','\''--name-only'\'','\''8116e48b1788b68d93f84536d3142d5ac4797148'\'','\''--'\'',path],{encoding:'\''utf8'\''}).trim();
const before=present?execFileSync('\''git'\'',['\''show'\'','\''8116e48b1788b68d93f84536d3142d5ac4797148:'\''+path],{encoding:'\''utf8'\''}):'\'''\'';
const current=measureSource(path,source),previous=measureSource(path,before);
const lines=changedLines(before,source);
const changed=current.functions.filter(fn=>{const prior=previous.functions.find(p=>p.name===fn.name&&before.slice(p.start,p.end)===source.slice(fn.start,fn.end));return !prior;});
for(const fn of changed)for(let line=fn.line;line<=fn.endLine;line++)lines.add(line);
const types=inspectTypes(programs.get(workspace),resolve(path),lines);
const failures=current.functions.filter(f=>f.cyclomatic>=22||f.cognitive>=22||f.difficulty>=80);
failed ||= current.lines>=500||failures.length>0||types.length>0;
return {path,sha256:hash(source),lines:current.lines,functions:current.functions.length,changedFunctions:changed.length,maximum:{CC:Math.max(0,...current.functions.map(f=>f.cyclomatic)),cognitive:Math.max(0,...current.functions.map(f=>f.cognitive)),D:Math.max(0,...current.functions.map(f=>f.difficulty))},types,failures};
});
console.log(JSON.stringify({status:failed?'\''FAIL'\'':'\''PASS'\'',node:process.version,typescript:ts.version,method:METRIC_METHOD,files:reports},null,2));
process.exitCode=failed?1:0;' packages/contracts/src/calendar.ts packages/contracts/src/auth.ts packages/contracts/src/index.ts packages/db/src/calendar-schema.ts packages/db/src/calendar-read-schema.ts packages/db/src/calendar-values.ts packages/db/src/index.ts packages/db/drizzle.config.ts
```

### Source fingerprints

| Файл                                      | SHA-256                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `packages/contracts/src/calendar.ts`      | `e186f6ae8824fcfe115a40698aef64d635fca7b2d29a9cbe165d9807442a1fa1` |
| `packages/contracts/src/auth.ts`          | `c95327e66143ce30f2285f3ad4bf725c186c115e5c4c414f5978e5b080096290` |
| `packages/contracts/src/index.ts`         | `6c7bcb4d755988c6eb422f6685cda144b68ae7aac7ac8a858b8d18f7c695782b` |
| `packages/db/src/calendar-schema.ts`      | `3e0a840276411c7c541c9859a86d57a8d4b2cf7604237d2ba94599a92dcaa2ac` |
| `packages/db/src/calendar-read-schema.ts` | `d086cfe5e16ae8878610bb8c5a36feb215e6f37c2dc75aa701470dc3be61c918` |
| `packages/db/src/calendar-values.ts`      | `3bcef294656b6354743907406bee7cb8b3bb8cedaf4c64bedd3d508e2eee69b9` |
| `packages/db/src/index.ts`                | `62334d82d655463b34b9cae5f2761f1a8cf043c9877ed09a09b664b7eb20f740` |
| `packages/db/drizzle.config.ts`           | `abbb95fe8e15f797bbd8307685516f86aecf869840d6cc6f9b4fae474dfb9f44` |

## Decisions Made

- `202 CalendarCommandReceipt` не имеет признака saved. `applied` snapshot требует confirmed effect/revision; unavailable и unknown не превращаются в пустой успешный read.
- Новые inputs строго отвергают посторонние поля. Account/calendar identity отсутствует в command inputs и определяется сервером. OAuth callback input остаётся untrusted и разбирается отдельно; лишние query fields отбрасываются.
- `ScheduleSeries` и `ScheduleOccurrenceRef` переиспользуются через type-only contracts; существующие input schemas расширяются command metadata. SDK, tokens и приватный journal в contracts не включены.
- Все FK используют RESTRICT. Account/connection составные FK препятствуют связыванию записей разных владельцев. Mapping удерживает reserved/active/retired history; unique constraints ограничивают active representation и поколения.
- Revisions используют PostgreSQL bigint с JS bigint. Number generations ограничены SQL CHECK диапазоном безопасных целых. Public revision передаётся десятичной строкой.
- Read windows сохраняются с revision и complete coverage. Event rows связаны с конкретным window/generation/revision. Last-known выбирается из полного persisted snapshot; неполные окна не выдаются за подтверждённые.
- Приватный storage формат имеет Zod validators; `$type` Drizzle задаёт только TypeScript-тип и сам по себе не выполняет runtime validation.

## Deviations from Plan

**1. [Rule 2 — Missing critical functionality] Приватный storage validation owner.** Для обязательного typed journal без `unknown`/SDK payload добавлен `packages/db/src/calendar-values.ts`. Inventory объявлен до правки. Это DB-only формат; новых dependencies нет. Проверки: DB typecheck и scoped metrics, commit `785658e`.

**2. [Rule 2 — Project constraint] Отдельный owner confirmed read schema.** После форматирования единый файл имел 523 строки. Таблицы windows/events/next с их provenance и coverage выделены в `calendar-read-schema.ts`. Эта граница отделяет чтения от secrets/journal; imports идут в одну сторону. Inventory, DB exports и Drizzle inputs обновлены. Итог: 368/171 строк, commit `785658e`.

## Ограничения и handoff

- Миграции не генерировались и не применялись. SQL catalog/constraint execution — UNVERIFIED, owner 03. `drizzle.config.ts` уже содержит все три schema inputs.
- Write-once `historyCutoverAt` и immutable request/plan/lineage требуют транзакционных guards в runtime owners 04/07. CHECK проверяет допустимую форму строки, но не сравнивает OLD/NEW при UPDATE. Этот план не заявляет реализованный runtime guard.
- При admission owner 07 должен сохранить command и все immutable stage requests одной транзакцией, включая summary в owned payload. При dispatch нельзя заново читать изменившееся имя карточки для старой команды.
- Storage JSON validators надо вызывать на входе persistence/gateway boundary. Encrypted envelope имеет keyId и base64url nonce/tag/ciphertext. Access token durable не хранится.
- Account connection row и calendar identity сохраняются после Disconnect вместе с cutover, cache, mappings и journal. Изменение target при reconnect запрещает runtime owner 04.
- E2E, Google ACK, cache restart, OAuth/revoke, cut/restore, same-request retry и immutable-update поведение не запускались и не объявлены PASS. DB fixtures, runtime, browser/CUA, builds, full tests, installs и provider calls не выполнялись.
- 24-03 не начат. Утверждённые зависимости не устанавливались этим планом.
- Общие STATE/ROADMAP/HANDOFF/WINDOWS/state.json не изменены: их обновляет parent после интеграции worktree, как требует parallel-mode execution workflow. Эти runtime claims принадлежат назначенным следующим планам; у 24-02 нет пропущенного automated verify.
- Новых threat surfaces сверх T-24-37/T-24-38 нет: добавлены лишь предусмотренные DTO и storage declarations. Read-through SQL/provider proof остаётся частью последующих задач.
- Known Stubs отсутствуют; auth gates не возникали.

## Self-Check: PASSED

Наличие 9 файлов подтверждено. Оба task commits — ancestors текущего HEAD. Все 8 source SHA-256 совпали с измеренными. Команда self-check завершилась с exit 0: `SELF_CHECK_PASSED files=9 commits=2 fingerprints=8`.
