---
phase: 24-google-calendar-connection-and-outbound-sync
plan: '03'
subsystem: infra
tags: [google-calendar, pg-boss, drizzle, postgres, configuration]
requires:
  - phase: 24-02
    provides: Восемь Calendar tables, typed journal и inputs Drizzle generator
provides:
  - Exact server dependencies и fail-closed CalendarConfig
  - Additive domain migration и migrator-owned singleton queue
  - Runtime options без DDL с работающим supervisor
affects: [24-04, 24-05, 24-06, 24-07, 24-13]
tech-stack:
  added: [pg-boss@12.37.1, googleapis@185.0.0, '@opentelemetry/api@1.9.1']
  patterns:
    - Migrator выполняет DDL и grants, app выполняет queue DML
    - Explicit disabled config без неявного включения Calendar
key-files:
  created:
    - apps/api/src/calendar/queue-schema.ts
    - packages/db/drizzle/20261011161301_google_calendar/migration.sql
    - packages/db/drizzle/20261011161301_google_calendar/snapshot.json
  modified:
    - apps/api/package.json
    - yarn.lock
    - apps/api/src/config.ts
    - .env.example
    - deploy/env.example
    - apps/api/src/migrate.ts
    - deploy/compose.yaml
key-decisions:
  - Queue schema, policy и privileges принадлежат prepareCalendarQueue под dvlab_migrator
  - Runtime сохраняет supervise true при migrate false, createSchema false и reindex false
  - Cron scheduler и исторические queue stats не используются command queue
  - Обязательный OpenTelemetry API peer установлен после отдельного human approval без exporter/provider configuration
  - Compose читает существующий api.env в raw-режиме
requirements-completed: [GCAL-01, GCAL-03]
coverage:
  - id: 24-03-D1
    description: Exact dependencies и типизированный server config
    verification:
      - kind: other
        ref: yarn workspace @dv-lab/api typecheck
        status: pass
    human_judgment: false
  - id: 24-03-D2
    description: Additive migration, идемпотентный bootstrap и app-role maintenance в существующей dev persistence
    verification:
      - kind: other
        ref: env -u DATABASE_URL -u MIGRATOR_DATABASE_URL yarn db:migrate
        status: pass
      - kind: other
        ref: APP_QUEUE_RUNTIME_OK и role catalog; точные команды ниже
        status: pass
    human_judgment: false
actuals:
  tokens: 44869
  tasks: 3
  commits: 2
commits: 2
plan_head_before: 9cc96c1ef947f7e91be2c09e908991cae4cde900
plan_head_after: a21ea4721825df3feef431cf06981dd0b4f096d4
duration: 15min
completed: 2026-10-11
status: complete
---

# Phase 24 Plan 03: Зависимости, конфигурация и очередь Calendar Summary

**Восемь Calendar tables и singleton queue созданы под migrator; app выполняет maintenance без CREATE, а Google config требует полного набора параметров и 32-byte keys.**

## Scope и результат

Три задачи завершены. Task 1 — checkpoint без файлов; tasks 2/3 имеют отдельные commits. Требования GCAL-01/GCAL-03 в frontmatter относятся к инфраструктурной части плана, а не к завершению OAuth или provider sync.

Начало: 2026-10-11T16:04:57.357Z. Завершение source: 2026-10-11T16:19:27Z. Изменено 10 source/config/generated файлов; этот SUMMARY — отдельный одиннадцатый файл. Actuals: ceil(179473 / 4) = 44869 по символам реализованного Git diff, включая generated snapshot и lockfile. Два commits измерены из persisted ledger до metadata commit.

Допущения: A1 — разрешён существующий dev Postgres и нужные роли; проверены URL suffix/role и сервер PostgreSQL 18. A2 — 24-02 schema присутствует; generator создал ровно два файла. A3 — config.enabled сам по себе не реализует UI/write gate; runtime wiring относится к 06/07. Stop condition: scoped checks, два task commits и SUMMARY; 24-04 не начат.

## Task Commits

1. **Package legitimacy / authority:** закрыт полученным human approval на pg-boss12.37.1 и googleapis185.0.0. В задаче нет файлов; пустой commit не создавался.
2. **Pins и config:** `31b3c40` — `feat(24-03): закрепил зависимости и проверил конфигурацию Calendar`.
3. **Migration и queue bootstrap:** `a21ea47` — `feat(24-03): подготовил миграции и очередь Calendar под раздельными ролями`.

Metadata commit содержит только этот SUMMARY. Общие STATE/ROADMAP/HANDOFF/state.json/WINDOWS принадлежат parent и не изменены.

## Изменённые файлы

| Файл                                                               | Причина                                                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `apps/api/package.json`                                            | Exact pins трёх разрешённых server dependencies                                            |
| `yarn.lock`                                                        | Разрешения новых dependencies; все прежние 800 resolutions сохранены                       |
| `apps/api/src/config.ts`                                           | CalendarConfig, enabled flag, обязательные OAuth поля, exact callback и keyring validation |
| `.env.example`                                                     | Шесть Google env names без значений                                                        |
| `deploy/env.example`                                               | Те же names для оператора                                                                  |
| `apps/api/src/calendar/queue-schema.ts`                            | Runtime options и migrator bootstrap/grants singleton queue                                |
| `apps/api/src/migrate.ts`                                          | Последовательный запуск domain migrations и queue bootstrap                                |
| `deploy/compose.yaml`                                              | Existing api.env подключён к api через optional raw env_file                               |
| `packages/db/drizzle/20261011161301_google_calendar/migration.sql` | Generator output: 8 tables, 7 indexes, 13 RESTRICT FK                                      |
| `packages/db/drizzle/20261011161301_google_calendar/snapshot.json` | Snapshot штатного generator для следующей миграции                                         |

## Decisions Made

- `CalendarConfig` — discriminated union: `{enabled:false}` либо полный enabled config. При true нужны client ID/secret, exact `https://dv-lab.dev/api/google/callback`, active key ID и JSON keyring. Формат keyring: object из key IDs в canonical base64 строку ровно 32 байт; active key обязан существовать. После validation значения становятся Buffer. Ошибки не печатают входные значения.
- `prepareCalendarQueue(migratorUrl)` проверяет actual current_user и создаёт schema/queues только под `dvlab_migrator`. App получает schema USAGE, table SELECT/INSERT/UPDATE/DELETE, sequence USAGE/SELECT и EXECUTE invoker functions. App не получает CREATE или ownership.
- `calendarQueueOptions` экспортируется для следующего worker owner: migrate:false, createSchema:false, reindex:false, supervise:true, schedule:false, persistQueueStats:false. Maintenance не выключен. Cron scheduler не нужен command queue; исторические stats выключены, поскольку их включение в этой версии выполняет daily-partition DDL. Текущие monitoring counters сохраняются.
- Policy queue `calendar-command` — singleton. Bootstrap проверяет existing policy и не переписывает несовместимую очередь молча. Payload/dispatch/recovery ещё не реализованы; будущий worker передаёт только commandId, durable journal остаётся источником command state.
- Новых extensions нет: применённый pg-boss использует доступные PostgreSQL 18 functions. `deploy/postgres/ensure-db.sql` менять не потребовалось. Queue grants принадлежат bootstrap, поэтому обновление не требует повторного superuser provisioning.
- Compose использует существующий private `api.env`, `format: raw` сохраняет JSON и литеральные символы. При отсутствии файла config остаётся disabled. Это source wiring, live deploy не выполнялся. Формат сверён с [Docker Compose documentation](https://docs.docker.com/reference/compose-file/services/#env_file).

## Проверки

Все процессы завершены с исходным exit status, без head pipeline. Доказательство относится к task head `a21ea4721825df3feef431cf06981dd0b4f096d4` и fingerprints ниже.

| Команда / метод                                                                                                                                        |           Exit | Краткий результат                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------: | ---------------------------------------------------------------- |
| `node --version`; `yarn --version`                                                                                                                     |              0 | v24.17.0 / 4.18.1                                                |
| `yarn workspace @dv-lab/api add --exact pg-boss@12.37.1 googleapis@185.0.0`                                                                            |              0 | Оба pins установлены, age gate сохранён                          |
| `yarn workspace @dv-lab/api add --exact @opentelemetry/api@1.9.1`                                                                                      |              0 | Установлен разрешённый обязательный peer                         |
| `node --input-type=module -e 'import { PgBoss } from "pg-boss"; console.log("PG_BOSS_IMPORT_OK");'`                                                    |              0 | PG_BOSS_IMPORT_OK                                                |
| `yarn db:generate --name=google_calendar`                                                                                                              |              0 | Ровно migration.sql и snapshot.json в указанном каталоге         |
| `env -u DATABASE_URL -u MIGRATOR_DATABASE_URL yarn db:migrate`                                                                                         | 0, два запуска | migrations=9; bootstrap без ошибок                               |
| `yarn workspace @dv-lab/api typecheck`                                                                                                                 |              0 | Ошибок нет                                                       |
| `yarn prettier --check apps/api/src/calendar/queue-schema.ts apps/api/src/migrate.ts apps/api/src/config.ts apps/api/package.json deploy/compose.yaml` |              0 | All matched files use Prettier code style                        |
| `git diff --check`                                                                                                                                     |              0 | stdout пуст                                                      |
| Catalog через existing sql.mjs, команда ниже                                                                                                           |              0 | app CREATE=false; queue USAGE/DML/functions=true; owner=migrator |
| Operational queue probe, команда ниже                                                                                                                  |              0 | schemaVersion=45, singleton, supervise=true, errors=0            |
| Catalog maintenance timestamp                                                                                                                          |              0 | monitored=true, maintained=true                                  |
| Повторный migration/catalog                                                                                                                            |              0 | 9 migrations, 8 tables, 1 singleton queue, 0 commands/jobs       |

Generator outputs объявлены до apply и не редактировались вручную. Разбор заголовков всех 28 SQL statements подтвердил CREATE TABLE/INDEX и ALTER TABLE ADD CONSTRAINT; DML, DROP, TRUNCATE и CREATE EXTENSION отсутствуют. Слова ON DELETE относятся только к RESTRICT FK.

Реальная migration/queue проверка выполнена только в существующей `_dev` persistence через локальный ignored `.env`. URL обеих env files прошли suffix/role precondition; `_test` не менялась этим планом. Никаких student fixtures, cleanup/TRUNCATE, новых environments, runtime web/API процессов, Google calls или telemetry exporter/provider configuration нет.

### Точные operational команды

Предварительная проверка URL (read-only, без значений):

```sh
env -u DATABASE_URL -u MIGRATOR_DATABASE_URL node --input-type=module -e 'import {readFileSync} from '\''node:fs'\''; import {parseEnv} from '\''node:util'\''; import assert from '\''node:assert/strict'\''; import {resolveDatabaseUrl} from '\''./packages/db/src/connection.ts'\''; for (const [file,suffix] of [['\''.env'\'','\''_dev'\''],['\''.env.test'\'','\''_test'\'']]) {const env=parseEnv(readFileSync(file,'\''utf8'\'')); for (const role of ['\''app'\'','\''migrator'\'']) {const url=new URL(resolveDatabaseUrl(role,env)); assert.ok(decodeURIComponent(url.pathname).endsWith(suffix)); assert.equal(url.username,role==='\''app'\''?'\''dvlab_app'\'':'\''dvlab_migrator'\'');} console.log(file+'\'' ROLE_URLS_OK'\'');}'
```

Migration запускалась через wrapper, который сохраняет exit и выводит безопасные поля logger без hostname:

```sh
python3 -c 'import subprocess,json,sys
r=subprocess.run(["env","-u","DATABASE_URL","-u","MIGRATOR_DATABASE_URL","yarn","db:migrate"],capture_output=True,text=True)
for line in r.stdout.splitlines():
 try:
  d=json.loads(line)
  out={k:d[k] for k in ("level","migrations","msg") if k in d}
  err=d.get("err",{})
  if err: out["error"]={k:err[k] for k in ("type","code","constraint","table","schema") if k in err}
  print(json.dumps(out))
 except json.JSONDecodeError:
  print("NON_JSON_STDOUT_OMITTED")
if r.stderr: print("STDERR_PRESENT bytes="+str(len(r.stderr)))
print("MIGRATE_EXIT="+str(r.returncode))
sys.exit(r.returncode)'
```

App-role catalog:

```sh
env -u DATABASE_URL -u MIGRATOR_DATABASE_URL node scripts/dev-checks/sql.mjs .env app 'SELECT
 current_user = '\''dvlab_app'\'' AS app_role,
 has_database_privilege(current_user, current_database(), '\''CREATE'\'') AS database_create,
 has_schema_privilege(current_user, '\''google_calendar_queue'\'', '\''CREATE'\'') AS queue_create,
 has_schema_privilege(current_user, '\''google_calendar_queue'\'', '\''USAGE'\'') AS queue_usage,
 (SELECT bool_and(n.nspowner = (SELECT oid FROM pg_roles WHERE rolname = '\''dvlab_migrator'\'')) FROM pg_namespace n WHERE n.nspname = '\''google_calendar_queue'\'') AS migrator_owner,
 (SELECT bool_and(has_table_privilege(current_user,c.oid,p.priv)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN unnest(ARRAY['\''SELECT'\'','\''INSERT'\'','\''UPDATE'\'','\''DELETE'\'']) AS p(priv) WHERE n.nspname='\''google_calendar_queue'\'' AND c.relkind IN ('\''r'\'','\''p'\'')) AS all_queue_dml,
 (SELECT bool_and(has_function_privilege(current_user,p.oid,'\''EXECUTE'\'') AND NOT p.prosecdef) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='\''google_calendar_queue'\'') AS functions_execute_invoker,
 (SELECT count(*)::int FROM pg_tables WHERE schemaname='\''public'\'' AND tablename LIKE '\''google_%'\'') AS domain_tables,
 (SELECT count(*)::int FROM google_calendar_queue.queue WHERE name='\''calendar-command'\'' AND policy='\''singleton'\'') AS singleton_queues,
 (SELECT count(*)::int FROM google_commands) AS domain_commands,
 (SELECT count(*)::int FROM google_calendar_queue.job) AS queue_jobs'
```

Результат: app_role=true, database_create=false, queue_create=false, queue_usage=true, migrator_owner=true, all_queue_dml=true, functions_execute_invoker=true, domain_tables=8, singleton_queues=1, domain_commands=0, queue_jobs=0. Это actual catalog и operational proof, не E2E приложения.

Для запуска maintenance использованы production runtime options; только интервалы monitor/maintenance сокращены до 1 секунды, чтобы проверка выполнила DML, а не пропустила недавний проход:

```sh
env -u DATABASE_URL -u MIGRATOR_DATABASE_URL node --env-file=.env --input-type=module -e 'import { PgBoss } from '\''pg-boss'\'';
import { resolveDatabaseUrl } from '\''./packages/db/src/connection.ts'\'';
import { calendarQueueOptions, calendarCommandQueue } from '\''./apps/api/src/calendar/queue-schema.ts'\'';
const boss=new PgBoss({...calendarQueueOptions,connectionString:resolveDatabaseUrl('\''app'\'',process.env),maintenanceIntervalSeconds:1,monitorIntervalSeconds:1});
let errors=0;
boss.on('\''error'\'',()=>{errors++;});
try {
 let version; let policy;
 try {
  await boss.start();
  version=await boss.schemaVersion();
  policy=(await boss.getQueue(calendarCommandQueue))?.policy;
  await boss.supervise(calendarCommandQueue);
 } finally {await boss.stop();}
 if(errors!==0||version!==45||policy!=='\''singleton'\'')throw new Error('\''queue verification failed'\'');
 console.log(JSON.stringify({status:'\''APP_QUEUE_RUNTIME_OK'\'',schemaVersion:version,policy,supervise:true,migrate:false,createSchema:false,reindex:false,errors}));
} catch(error) {console.log(JSON.stringify({status:'\''APP_QUEUE_RUNTIME_FAILED'\'',type:error instanceof Error?error.name:'\''Unknown'\'',code:typeof error?.code==='\''string'\''&&/^[A-Z0-9_]+$/.test(error.code)?error.code:null}));process.exitCode=1;}'
env -u DATABASE_URL -u MIGRATOR_DATABASE_URL node scripts/dev-checks/sql.mjs .env app 'SELECT monitor_on IS NOT NULL AND monitor_on > now() - interval '\''1 minute'\'' AS monitored, maintain_on IS NOT NULL AND maintain_on > now() - interval '\''1 minute'\'' AS maintained FROM google_calendar_queue.queue WHERE name = '\''calendar-command'\'''
```

После второго migration:

```sh
env -u DATABASE_URL -u MIGRATOR_DATABASE_URL node scripts/dev-checks/sql.mjs .env migrator 'SELECT (SELECT count(*)::int FROM drizzle.__drizzle_migrations) AS domain_migrations, (SELECT count(*)::int FROM pg_tables WHERE schemaname='\''public'\'' AND tablename LIKE '\''google_%'\'') AS domain_tables, (SELECT count(*)::int FROM google_calendar_queue.queue WHERE name='\''calendar-command'\'' AND policy='\''singleton'\'') AS singleton_queues, (SELECT count(*)::int FROM google_commands) AS domain_commands, (SELECT count(*)::int FROM google_calendar_queue.job) AS queue_jobs'
```

### Природа прежних 15 config checks

В task 2 были выполнены прямые изолированные функциональные вызовы `loadConfig` с synthetic env и `node:assert`. Это **не static checks и не E2E**. Результат exit 0: disabled=2, enabled=1, rejected=12, redaction=true. Они не проверяют HTTP, browser, persistence или Google. Новая suite/файл тестов не создана. После уточнения пользователя новые изолированные функциональные проверки не добавлялись.

Точная ранее выполненная команда сохранена для проверяемости метода; это запись полученного evidence, не рекомендация расширять test policy:

```sh
node --input-type=module -e 'import assert from '\''node:assert/strict'\'';
import { loadConfig } from '\''./apps/api/src/config.ts'\'';
const base = {PORT:'\''4000'\'',APP_ORIGIN:'\''http://localhost:3000'\'',DATABASE_URL:'\''postgresql://app:fixture@localhost/dvlab_test'\'',NODE_ENV:'\''test'\''};
const configured = {...base,GOOGLE_CALENDAR_ENABLED:'\''true'\'',GOOGLE_CLIENT_ID:'\''fixture-client'\'',GOOGLE_CLIENT_SECRET:'\''fixture-secret'\'',GOOGLE_REDIRECT_URI:'\''https://dv-lab.dev/api/google/callback'\'',GOOGLE_TOKEN_KEY_ID:'\''current'\'',GOOGLE_TOKEN_KEYRING:JSON.stringify({current:Buffer.alloc(32,1).toString('\''base64'\'')})};
assert.deepEqual(loadConfig(base).calendar,{enabled:false});
assert.deepEqual(loadConfig({...base,GOOGLE_CALENDAR_ENABLED:'\''false'\''}).calendar,{enabled:false});
const parsed=loadConfig(configured).calendar; assert.equal(parsed.enabled,true); assert.equal(parsed.keyring.current.length,32);
let rejected=0;
for(const field of Object.keys(configured).filter(k=>k.startsWith('\''GOOGLE_'\'') && k!=='\''GOOGLE_CALENDAR_ENABLED'\'')) {const env={...configured}; delete env[field]; assert.throws(()=>loadConfig(env),/Invalid Google Calendar/); rejected++;}
for(const changed of [{GOOGLE_CALENDAR_ENABLED:'\''1'\''},{GOOGLE_REDIRECT_URI:'\''http://localhost/callback'\''},{GOOGLE_TOKEN_KEYRING:'\''fixture-secret'\''},{GOOGLE_TOKEN_KEY_ID:'\''absent'\''},{GOOGLE_TOKEN_KEYRING:JSON.stringify({current:Buffer.alloc(31).toString('\''base64'\'')})},{GOOGLE_TOKEN_KEYRING:JSON.stringify({current:Buffer.alloc(33).toString('\''base64'\'')})},{GOOGLE_TOKEN_KEYRING:JSON.stringify({current:'\''!'\''.repeat(44)})}]) { assert.throws(()=>loadConfig({...configured,...changed}),e=>e instanceof Error&&!e.message.includes('\''fixture-secret'\'')&&e.message.startsWith('\''Invalid'\''));rejected++;}
console.log('\''CONFIG_STATIC_OK disabled=2 enabled=1 rejected='\''+rejected+'\'' redaction=true'\'');'
```

## Качество owned diff

Simplify прочитан и применён. Новых comments и подтверждённого dead/redundant code нет. Runtime exports предназначены следующему worker owner; фиктивный consumer не добавлен. `unknown` остался только у JSON.parse input в config.ts:68, сразу перед keyring.safeParse. Не осталось explicit/inferred any. Первоначальный any у assignment JSON.parse устранён до task commit.

Инструмент — existing `scripts/dev-checks/time-zone-metrics.ts`, Node24.17.0, TypeScript6.0.3. Denominator: 3 handwritten TS files, 9 functions/callbacks. JSON/YAML manifests проверены как data/config. Generated SQL/snapshot и dependencies исключены из TS metrics; SQL semantics проверены additive statements и реальным PostgreSQL. Top-level миграционный try/catch не является отдельной function/callback.

Halstead: TS AST leaf tokens; operators = keyword/punctuation SyntaxKind, operands = identifier/literal text; trivia/comments исключены, nested functions отдельно, type tokens включены. D=(unique operators/2)*(total operands/unique operands).

| Файл                     | Строки | CC max | Cognitive max |             D max |
| ------------------------ | -----: | -----: | ------------: | ----------------: |
| config.ts                |     84 |      7 |             6 |            20.075 |
| calendar/queue-schema.ts |     57 |      6 |             3 | 25.03846153846154 |
| migrate.ts               |     16 |      0 |             0 |                 0 |

`loadConfig`: CC 2→2; ветвление прежнее. Новые `loadCalendarConfig` и `prepareCalendarQueue`: baseline отсутствует → CC 7/6. Все функции ниже порогов. Начальное finding any исправлено; raw unknown finding явно рассмотрено как разрешённая input boundary, а не скрыто.

Команда воспроизведения metrics/type inspection приведена ниже. Исходные измерения выполнены тем же script в двух вызовах: аргументы `apps/api/src/config.ts` и отдельно `apps/api/src/calendar/queue-schema.ts apps/api/src/migrate.ts`; оба завершились с exit 0. Исходники после измерения не менялись.

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
const present=execFileSync('\''git'\'',['\''ls-tree'\'','\''--name-only'\'','\''9cc96c1ef947f7e91be2c09e908991cae4cde900'\'','\''--'\'',path],{encoding:'\''utf8'\''}).trim();
const before=present?execFileSync('\''git'\'',['\''show'\'','\''9cc96c1ef947f7e91be2c09e908991cae4cde900:'\''+path],{encoding:'\''utf8'\''}):'\'''\'';
const current=measureSource(path,source),previous=measureSource(path,before);
const lines=changedLines(before,source);
const changed=current.functions.filter(fn=>{const prior=previous.functions.find(p=>p.name===fn.name&&before.slice(p.start,p.end)===source.slice(fn.start,fn.end));return !prior;});
for(const fn of changed)for(let line=fn.line;line<=fn.endLine;line++)lines.add(line);
const types=inspectTypes(programs.get(workspace),resolve(path),lines);
const failures=current.functions.filter(f=>f.cyclomatic>=22||f.cognitive>=22||f.difficulty>=80);
const unresolvedTypes=types.filter(t=>!(path==='\''apps/api/src/config.ts'\''&&t.line===68&&t.kind==='\''unknown'\''&&source.split('\''\n'\'')[67].includes('\''const keys: unknown = JSON.parse'\''))); failed ||= current.lines>=500||failures.length>0||unresolvedTypes.length>0;
return {path,sha256:hash(source),lines:current.lines,functions:current.functions.length,changedFunctions:changed.length,maximum:{CC:Math.max(0,...current.functions.map(f=>f.cyclomatic)),cognitive:Math.max(0,...current.functions.map(f=>f.cognitive)),D:Math.max(0,...current.functions.map(f=>f.difficulty))},types,reviewedBoundary:'\''config.ts:68 JSON input immediately validated by keyring.safeParse; no any survives'\'',unresolvedTypes,failures};
});
console.log(JSON.stringify({status:failed?'\''FAIL'\'':'\''PASS'\'',node:process.version,typescript:ts.version,method:METRIC_METHOD,files:reports},null,2));
process.exitCode=failed?1:0;' apps/api/src/config.ts apps/api/src/calendar/queue-schema.ts apps/api/src/migrate.ts
```

## Source fingerprints

| Файл                                                               | SHA-256                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `.env.example`                                                     | `c234f2efccc0a2fdfd5d9869649edb37ac228dda3d7bc4022335c3b237d10713` |
| `apps/api/package.json`                                            | `d08967e894e007730318f4ba3af0023bb24b87d113994f388dd2ad09a6d695cc` |
| `apps/api/src/calendar/queue-schema.ts`                            | `37431dc2988b0a37b414295763195a2e357cac9074d59bfd94d51cebf900a022` |
| `apps/api/src/config.ts`                                           | `deebf084be043e6470e4a116bb1fa0228588b26a3fd75bf58083098c6163d1c0` |
| `apps/api/src/migrate.ts`                                          | `1c2b1413badd90d1b40ce09743f6a13b90a5999491ca0e9320395a26f59b5046` |
| `deploy/compose.yaml`                                              | `3bc30aa826d8d03af72fd097b1150de0c33dbf6cba5650270e1837ed59874871` |
| `deploy/env.example`                                               | `08f73144bdf934ca84b9ca4e2599ce9138e34946d453a4f9aaacf3d581e69e43` |
| `packages/db/drizzle/20261011161301_google_calendar/migration.sql` | `39770e5580071ee4832b9d36d47bd54b9ed6f99ef03461aae639352412b645b4` |
| `packages/db/drizzle/20261011161301_google_calendar/snapshot.json` | `ae72d53869d650e90be6c18a296a1f55a324164f8d5e54ee3e1ffa1e50647b41` |
| `yarn.lock`                                                        | `62b181c055ff57111dcc0d0ff19c1cd93e9535bcdbeb0f112b18c2f86ccc40be` |

## Deviations from Plan

1. **[Rule 3 — Dependency blocker, разрешён человеком] Обязательный peer.** Installed pg-boss12.37.1 требует `@opentelemetry/api:^1.9.0` и без него падает при import с ERR_MODULE_NOT_FOUND. Исполнение остановлено до отдельного human approval на exact1.9.1 и lockfile. После approval установлен только этот пакет; import, migration и maintenance прошли. Commit `a21ea47`. Это не разрешение добавлять exporter или telemetry service.
2. **[Rule 1 — Type safety] JSON input boundary.** Убрано inferred any у assignment: JSON.parse сразу помещён в const unknown и проверен Zod. Commit `31b3c40`.
3. **Процедурное отклонение проверки config.** 15 прямых изолированных вызовов сначала были неверно названы static. Классификация исправлена выше. E2E policy ими не считается выполненной; последующих новых isolated suites/checks нет.
4. **Минимальный file set.** `ensure-db.sql` сохранён: новые extensions не нужны, schema/current/default grants обслуживает миграционный owner. Generated paths добавлены в inventory после generator и до apply.

## Gates и ограничения

- Initial pins: human approval получен 2026-10-11T15:50Z. Parent npm facts: official repositories timgit/pg-boss и googleapis/google-api-nodejs-client; Node engines >=22.12 / >=22; publication 2026-10-08T15:56:14Z / 17:11:09Z. Yarn1440 не отключён.
- Third peer: отдельный human approval получен после checkpoint. Read-only npm metadata: exact1.9.1, official open-telemetry/opentelemetry-js, Node>=8, published2026-03-25T15:53:54.092Z.
- Точный registry и pinned installed source использованы для queue API. [Constructor](https://raw.githubusercontent.com/timgit/pg-boss/12.37.1/docs/api/constructor.md), [queues](https://raw.githubusercontent.com/timgit/pg-boss/12.37.1/docs/api/queues.md). Context7 MCP/CLI недоступны; использованы official docs и установленная версия.
- Прежний ESLint peer warning остаётся вне scope. Missing OpenTelemetry peer устранён. Existing lock resolutions: 800→834, removed/upgraded=0.
- UI/write gate disabled Calendar, OAuth exchange/refresh/revoke, Google ACK, durable command recovery и worker dispatch ещё не реализованы этим планом. Нет provider functional PASS.
- Full tests/build и Google E2E не запускались: их owner13. Docker CLI отсутствует; compose проверен YAML parser и official schema, не Docker execution. API env_file operator wiring ещё не проверено на сервере.
- Новых security surfaces сверх dependency/runtime-role boundaries threat model нет. Known Stubs отсутствуют. Auth gates не возникали.
- Parent владеет shared planning tracking и WINDOWS. Этот executor их не менял. Parent получает procedural deviation и verification limits из SUMMARY.

## Self-Check: PASSED

Наличие всех 11 файлов подтверждено. Оба task commits — ancestors HEAD. Все 10 source/config/generated fingerprints совпали. Число task commits сверено с persisted ledger. Self-check: exit 0, `SELF_CHECK_PASSED files=11 commits=2 fingerprints=10`.
