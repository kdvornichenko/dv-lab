# Calendar fault harness: C13 operator handoff

Source/static candidate. Реальные SSH, DB, OAuth, Google pagination и fault recovery: **UNVERIFIED** до приёмки на attested main runtime. Новый HTTP endpoint, порт или environment не требуется. Оператор — Server guy; parent владеет functional evidence и fixtures.

## Runtime и authority

Использовать существующий API service после candidate CI. Runner: `/app`, UID `node`, Node 24, обычные container credentials. Флаг только `E2E_CALENDAR_FAULTS`: абсолютный canonical путь к серверному control JSON вне `/app`. Каталог принадлежит runtime UID и имеет mode0700; файлы — canonical regular0600 того же UID. Symlinks, repository paths и файл больше64KiB отвергаются. Путь должен быть доступен тому же container namespace при restart; secrets не переносятся на Mac.

`exclusiveSyntheticProcess: true` означает эксклюзивную управляемую runtime/provider-fixture lease. База остаётся существующей main DB. Это не утверждение, что в DB только synthetic данные. На время lease запрещены параллельные fault writers, изменение connection/grant и сторонние provider fixtures. SQL этого harness только читает identity, account и connection; произвольного SQL нет.

## Серверный control JSON

Схема `dv-lab-calendar-fault-v1`, strict object. Authoritative exported validators: `/app/apps/api/dist/calendar-fault-protocol.mjs`.

| Поле                      | Тип / значение                                                |
| ------------------------- | ------------------------------------------------------------- |
| schema                    | `dv-lab-calendar-fault-v1`                                    |
| runId                     | свежий UUID lease                                             |
| pid                       | положительный integer в API container namespace               |
| processStartTicks         | строка Linux `/proc/PID/stat`, поле22                         |
| apiBuildSha               | точный40-hex deployed API SHA из attestation                  |
| entrySha256               | SHA256 реального `apps/api/dist/server.mjs`                   |
| loaderSha256              | SHA256 реального `apps/api/dist/calendar-faults.mjs`          |
| origin                    | `https://dv-lab.dev`                                          |
| persistenceFingerprint    | SHA256 JSON DB identity в порядке `database,address,port,oid` |
| authorizationScope        | `prelaunch-main-synthetic-fixtures-test-google-primary`       |
| accountId                 | UUID разрешённого active teacher                              |
| connectionId              | UUID текущей owned `google_connections`                       |
| connectionGeneration      | точный integer generation этого grant                         |
| primaryCalendarId         | фактический TEST PRIMARY ID, не alias `primary`               |
| calendarFaultsAuthorized  | `true`                                                        |
| exclusiveSyntheticProcess | `true`, runtime lease                                         |
| runtimeRoot               | `/app`                                                        |
| expiresAt                 | ближайший срок lease, ISO UTC                                 |
| rule                      | `null` до arming либо rule ниже                               |

PRIMARY ID и account/connection остаются в private файле. Startup проверяет account role/status, connection generation/state/credential mode/calendar ID и фактическую DB role `dvlab_app`. DSN и Google credentials читает только существующий `loadConfig`; envelope открывает существующий token owner. Наружу они не возвращаются.

## Запуск до приложения

Нельзя добавить preload в уже работающий Node process. Нужен один контролируемый restart того же API service. Не запускать второй API process. Сначала остановить текущий service в рамках runtime lease. Не применять automatic restart loop во время stop fault.

Оператор предварительно создаёт private control JSON с attested полями, `rule:null`, временными pid/ticks/hashes. В entrypoint существующего container shell получает свой PID до `exec`. Этот PID и start ticks сохраняются после `exec node`. Bootstrap выполняется тем же UID в `/app`:

```sh
set -e
export FAULT_API_PID=$$
node --input-type=module -e '
import {readFileSync} from "node:fs";
import {faultManifest,readFaultJson,writeRuntimeControl,hash} from "/app/apps/api/dist/calendar-fault-protocol.mjs";
const file=process.env.E2E_CALENDAR_FAULTS;
const seed=faultManifest.parse(readFaultJson(file,"/app"));
if(seed.rule!==null) throw Error("Bootstrap requires an unarmed lease");
const pid=Number(process.env.FAULT_API_PID);
const stat=readFileSync(`/proc/${pid}/stat`,"utf8");
const processStartTicks=stat.slice(stat.lastIndexOf(")")+2).trim().split(/\s+/)[19];
const entrySha256=hash(readFileSync("/app/apps/api/dist/server.mjs"));
const loaderSha256=hash(readFileSync("/app/apps/api/dist/calendar-faults.mjs"));
writeRuntimeControl(faultManifest.parse({...seed,pid,processStartTicks,entrySha256,loaderSha256}));
'
exec node --enable-source-maps --import /app/apps/api/dist/calendar-faults.mjs /app/apps/api/dist/server.mjs
```

Bootstrap должен завершиться с0 до `exec`; entrypoint обязан остановиться при ошибке (`set -e`). Attested build/origin/DB/account/generation не вычислять из предположений и не менять для обхода отказа. Startup сверяет `/proc/PID/cwd`, command line с абсолютными `--import`/server paths, process start ticks, hashes и окружение реального процесса. Только после успешной проверки создаётся `calendar-fault-ready-RUNID.json` с mode0600. Нет ready — нет arming.

## Mac private inputs и SSH

Сохранить прежние `E2E_TARGET_ORIGIN`, `E2E_FIXTURE_DATABASE=prelaunch`, `E2E_TARGET_ATTESTATION`, teacher/fixture inputs и `E2E_PRELAUNCH_SQL_OPERATOR_FILE`. Они проходят existing target/SQL guards. `E2E_CALENDAR_FAULTS` на Mac указывает на отдельный canonical0600 client JSON вне checkout:

```json
{
	"schema": "dv-lab-calendar-fault-ssh-v1",
	"runId": "<server lease UUID>",
	"identitySha256": "<calendarFaultIdentity of parsed server manifest>",
	"controlFile": "<canonical server control path>",
	"operatorSha256": "270be066a9ae9e1f4a16a8a68d8cfc1460d64a3f7973a28aa0726de943060e2c"
}
```

В client JSON нет PID, DB identity components, account/PRIMARY ID или credentials. `calendarFaultIdentity` исключает только mutable `rule`; остальные поля immutable. Вычислять SHA через exported функцию над `faultManifest.parse(...)`, не над raw JSON bytes.

Adapter читает точный validated operator schema `dv-lab-prelaunch-sql-ssh-v1`: `sshAlias`, `environmentScript`, `apiContainer`. Проверяет указанный SHA256. `environmentScript` не выполняет: credentials уже находятся в API container. SSH target и container берёт только из validated файла. Host key checking обязателен; forwarding отключён. Единственная remote команда:

```text
sudo -n docker exec -i -e E2E_CALENDAR_FAULTS=<server control path> <validated apiContainer> node /app/apps/api/dist/calendar-fault-operator.mjs
```

Stdin — strict `{runId,identitySha256,binding,operation}`. `binding`: exact origin/apiBuildSha/persistenceFingerprint/authorizationScope из existing target attestation. Operations только `arm` с rule, `disarm`/`evidence` с ruleId, `inspect`. Нет arbitrary command/SQL/kill/start action. Arm проверяет живой owned PID и DB/connection binding. Evidence и disarm работают после exit86/expiry по immutable ready identity; они не вызывают DB или signal.

## Rule и pagination

`armCalendarFault(input: Omit<CalendarFaultRule,'id'>): string`; existing sync helpers unchanged. Rule: `id` UUID, `method` GET/POST/PATCH, `resource` events/event/calendarList, `page` first/next/any, `action` drop_response/delay_response/stop_before_request/stop_after_response, `delayMs` integer0..15000, optional `pageSize` integer1..100. Page size допустим только GET events.list.

```ts
const ruleId = armCalendarFault({
	method: 'GET',
	resource: 'events',
	page: 'next',
	action: 'drop_response',
	delayMs: 0,
	pageSize: 1,
})
```

Loader наблюдает настоящий OAuth refresh для единственного разрешённого encrypted grant. Только его настоящий access token плюс фактический PRIMARY URL допускают fault; другой account/token/calendar проходит без изменения. CalendarList faults ограничены тем же token. Неизвестный transport/token не считается сработавшим fault.

Page size меняет только query `maxResults`, начиная с первой owned events.list страницы. Все остальные query parameters сохраняются. Fault действует один раз только на запрошенную page; `next` требует настоящий `pageToken`. Writes не меняются. Fixture owner должен создать минимум два synthetic events и записать реальные expected/observed/provider evidence. Нет fake pages/200/404 или массового seeding.

## Evidence, restart relay и cleanup

`calendarFaultEvidence(ruleId)` возвращает только run/rule/identity hash, UTC time, phase и настоящий HTTP status. PID, пути, token, account/calendar ID, response bodies и содержимое событий не возвращаются. Stop before request не доказывает provider absence; drop после реального response не доказывает applied projection.

После `stop_before_request`/`stop_after_response` loader пишет `process_stopping` и завершает свой API process с86. Оператор сохраняет evidence, disarm именно старого rule и фиксирует stop. Затем он перезапускает тот же service с обычным CMD без fault flag для journal recovery; parent сохраняет старый run/rule identity и проверяет публичную recovery journey. Не переиспользовать старый manifest/PID после restart. Для следующей fault lease нужны fresh runId, actual PID/start ticks, hashes, срок и новый ready proof.

Mutable control меняется атомарной rename. Arm/disarm используют private directory lock; release переименовывает его в unique `.released`, без удаления. При timeout/неопределённом результате нельзя повторять arm/disarm/kill автоматически. Сначала `inspect`/`evidence` и проверка фактического процесса. Если crash оставил `.lock`, owner подтверждает, что control writer завершён, и архивирует lock recoverable способом; adapter сам stale lock не снимает. Read-only evidence не создаёт locks.

После последнего scenario: disarm owned rule; вернуть ordinary API invocation без флага; проверить public health/build через parent; закончить lease. После expiry loader перестаёт менять requests/page size. Private proofs, manifests и released locks сохранить для приёмки; не удалять. Synthetic fixture cleanup остаётся existing fixture/provider owner; этот harness не удаляет rows/events и не предоставляет cleanup SQL.

API build выполнен локально; runner packaging проверяется COPY chain. Docker image build и функциональная работа в main container остаются UNVERIFIED до CI/Server guy.
