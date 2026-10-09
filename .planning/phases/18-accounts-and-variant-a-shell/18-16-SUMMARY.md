---
phase: 18-accounts-and-variant-a-shell
plan: 16
subsystem: deploy
tags: [compose, caddy, deploy-sh, runbook, ci, knip, agents-md, ipv6, bootstrap]

requires:
  - phase: 18-accounts-and-variant-a-shell
    provides: "18-07 и 18-10: dist/bootstrap-teacher.mjs с режимом --reset-password; 18-09: строка журнала sign-in refused с outcome и clientIp, 401 unauthenticated на /auth/me; 18-11: proxy 307 на /login, API_INTERNAL_URL в DAL web; 18-14, 18-17: экраны и страницы состояний для AGENTS.md"
  - phase: 17-skeleton-on-the-server
    provides: "compose, Caddyfile, deploy.sh, RUNBOOK, ci.yml, knip.json, AGENTS.md; сеть compose с IPv6 (2bcd8c0)"
provides:
  - "deploy/compose.yaml: сервис bootstrap (профиль tools, entrypoint node apps/api/dist/bootstrap-teacher.mjs, роль dvlab_app), API_INTERNAL_URL=http://api:4000 у web"
  - "deploy/caddy/Caddyfile: X-Frame-Options DENY"
  - "deploy/deploy.sh: smoke принимает на / 200 или 307, требует /login 200 и /api/auth/me 401 с code unauthenticated"
  - "deploy/RUNBOOK.md: 6.1 на /healthz, /login, /api/auth/me; 8.1–8.3 переключают клон до deploy.sh; раздел 10 (10.1 выкатка с условным пересозданием сети, 10.2 CLIENT_IP_OK, 10.3 первый учитель, 10.4 снятие блокировки, 10.5 восстановление пароля)"
  - ".github/workflows/ci.yml: расширенный шаг Web and api boundary и новый шаг Client address trust"
  - "knip.json: packages/contracts, entry bootstrap-teacher, ignore 38 файлов копии варианта A, ignoreExportsUsedInFile; yarn knip зелёный"
  - "AGENTS.md: contracts, шрифты, bootstrap-teacher.mjs, владельцы модулей фазы 18, команды и переменные"
affects: [18-15, phase-18-release]

tech-stack:
  added: []
  patterns:
    - "Инварианты конфигурации деплоя (адрес клиента, граница пакетов) живут только в шагах ci.yml, без тест-файлов"
    - "Блоки RUNBOOK выкатки сначала переключают клон на целевой sha, чтобы работал deploy.sh выкатываемого релиза"

key-files:
  created: []
  modified:
    - deploy/compose.yaml
    - deploy/caddy/Caddyfile
    - deploy/deploy.sh
    - deploy/RUNBOOK.md
    - .github/workflows/ci.yml
    - knip.json
    - AGENTS.md

key-decisions:
  - "knip: ignoreExportsUsedInFile: true вместо снятия export в коде api. Восемь рукописных символов (violatesUnique, hashSessionToken, MAX_PAIR_FAILURES, MAX_LOGIN_FAILURES, WINDOW_SECONDS, LOCK_SECONDS, SignInAttempt, CredentialInput) используются только внутри своих файлов; неиспользуемых нигде экспортов опция не скрывает"
  - "RUNBOOK 10.1: dc down выполняется только если у сети dv-lab_default EnableIPv6 не true (на VPS сеть уже пересоздана, там выкатка идёт без простоя)"
  - "RUNBOOK 10.2: проба входа с вымышленным логином probe-<случайное>@invalid проходит схему signInRequest (иначе 400 без строки sign-in refused); подделанный X-Forwarded-For 192.0.2.1"
  - "RUNBOOK 10.3 и 10.5: назад присылаются только маркеры Teacher created / Password reset и NO_BOOTSTRAP_CONTAINER, без логина и пароля; отсутствие контейнера проверяется по меткам compose"
  - "8.3 (повтор того же sha) тоже переключает клон: после отката клон стоит на прошлом sha"

requirements-completed: [ACCT-01, ACCT-03, ACCT-05]

actuals:
  tokens: 7000
  tasks: 3
  commits: 3

duration: 50min
completed: 2026-10-09
status: complete
plan_head_before: 9bef27ae2e87fe5e7063f218ebb91f8a8d38542a
plan_head_after: 51014b18a8998efabaa241a04692449005d18a10
commits: 3
---

# Phase 18 Plan 16: Выкатка релиза фазы 18, инварианты CI и knip Summary

**Compose получил сервис первого учителя и восстановления пароля из образа api и адрес api для web, Caddy запрещает встраивание, smoke deploy.sh принимает 307 на корне и проверяет /login и маршрут auth за Caddy, RUNBOOK описывает выкатку релиза фазы 18 с переключением клона, жёсткой проверкой адреса клиента до создания учителя, снятием блокировки и восстановлением пароля; CI держит инварианты адреса клиента и границы contracts, `yarn knip` снова зелёный.**

## Performance

- **Duration:** около 50 мин
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- `deploy/compose.yaml`: сервис `bootstrap` (образ `dv-lab-api:${APP_TAG}`, профиль `tools`, `restart: 'no'`, `logging: *logging`, `entrypoint: ['node', 'apps/api/dist/bootstrap-teacher.mjs']`, `NODE_ENV: production`, `DATABASE_URL` роли `dvlab_app` на `dvlab`, `depends_on db service_healthy`); у `web` `API_INTERNAL_URL: http://api:4000`. Сеть с IPv6, порты и healthcheck не менялись. Dockerfile api не менялся (`git diff --quiet` и против `origin/master`).
- `deploy/caddy/Caddyfile`: `X-Frame-Options "DENY"` в блоке `header`; `trusted_proxies` нет.
- `deploy/deploy.sh`: `LOGIN_CODE` и `ME` объявлены рядом с `WEB_CODE`; `smoke_ok` запрашивает `/login` и `/api/auth/me` через `--resolve` на 127.0.0.1; успех — sha и `"db":"ok"` в `/healthz`, `/` 200 или 307, `/login` 200, `/api/auth/me` 401 с `"code":"unauthenticated"`. Строки `smoke failed` и `smoke:` печатают `login=` и `me=` (код).
- `deploy/RUNBOOK.md`:
  - раздел 0: переменные `CLIENT_IPV4`, `TEACHER_EMAIL`, `TEACHER_NAME`; раздел 10 в форме вызова compose; «Релиз фазы 18 — разделы 10.1, 10.2, 10.3 вместо обычного 8.1»;
  - 6.1: `for p in /healthz /login` (200) и `/api/auth/me` (401) по `-4` и `-6`; 6.5: шлюз Docker вместо адреса клиента — раздел 10.1; 6.6: без сессии открывается страница входа;
  - 8.1–8.3: `fetch` и `checkout -q --detach` на цель перед `deploy.sh`, одна фраза почему;
  - 10.1: переключение клона, `dc down` только при `EnableIPv6` не `true`, `deploy.sh "$SHA"`, порядок действий при ошибке сети в откате;
  - 10.2: проба входа с Mac по `-4` и `-6` (401), блок на сервере сверяет `remote_ip` в журнале Caddy и `clientIp` в строках `sign-in refused` api, отсутствие `192.0.2.1`, печатает `CLIENT_IP_OK`; иначе стоп до создания учителя (D-26, R3);
  - 10.3: `dc --profile tools run --rm bootstrap --email … --name …`, проверка отсутствия контейнера `bootstrap`, вход владельца на `https://dv-lab.dev/login` и смена пароля (критерий 1);
  - 10.4: `psql -X -U dvlab_migrator -d dvlab -v ON_ERROR_STOP=1 -c 'delete from sign_in_throttles'`, запасной `-U postgres`;
  - 10.5: `run --rm bootstrap --reset-password --email "$TEACHER_EMAIL"`, коды и строки вывода.
- `.github/workflows/ci.yml`: шаг `Web and api boundary` дополнен (нет импортов `@dv-lab/api` и `@dv-lab/db` в `apps/web`, нет `transpilePackages`, у `packages/contracts` зависимости ровно `zod`, в `packages/contracts/src` нет `pg`, `node:*`, `@dv-lab/*` и `process.env`); новый шаг `Client address trust` (нет `trusted_proxies`, у `api` нет `ports`, у сети `default` `enable_ipv6: true`). Оба шага до `yarn install`, только git grep, awk и node.
- `knip.json`: workspace `packages/contracts`, `src/bootstrap-teacher.ts` в entry api, `ignore` в `apps/web` ровно для 38 файлов копии (`components/ui/**`, `components/sidebar-app/**`, `components/fluid-hover-highlight.tsx`, `hooks/**`, двенадцать файлов `lib` по именам), `ignoreExportsUsedInFile: true`. `proxy.ts` knip находит сам (не помечался), в entry не добавлялся.
- `AGENTS.md`: `packages/contracts`, шрифты Inter Variable и JetBrains Mono Variable, `bootstrap-teacher.mjs`; команды (`yarn dev` через portless, стек из двух команд, `yarn test` в db, contracts и api); окружение (`API_INTERNAL_URL`, `API_DEV_PROXY_URL`, `DEV_TEACHER_LOGIN`, `DEV_TEACHER_PASSWORD`, `DEV_STUDENT_PASSWORD`, SQL только к `_dev`/`_test`); владельцы: `sign-in.ts` (`createSignIn().attempt`), `sessions.ts`, `account-rows.ts`, `accounts.ts`, `middleware.ts`, `api-client.ts`, `proxy.ts`, `session.ts`, `status-pages.tsx`, `read-error.tsx`, `skeleton.tsx`, Base UI и запрет Radix/cmdk, шаги CI.

## Task Commits

1. **Задача 1 (tracer): сервис bootstrap, API_INTERNAL_URL, RUNBOOK 10.1 и 10.3** - `fd36b55` (feat)
2. **Задача 2: X-Frame-Options, smoke, RUNBOOK 6.1/6.5/8.x/10.2/10.4/10.5, шаги CI** - `54d752a` (feat)
3. **Задача 3: knip.json и AGENTS.md** - `51014b1` (chore)

**Plan metadata:** коммит `docs(18-16)` с этим файлом. `commits: 3` измерено `git rev-list --count 9bef27a..51014b1`; параллельных коммитов в диапазоне нет.

## Проверки

Скрипты: `scratchpad/18-16-checks.sh`, `18-16-ci-negative.mjs`, `18-16-smoke.sh`.

`bash 18-16-checks.sh 3` (verify и acceptance всех трёх задач), итог:

```
--- task 1
compose ok
PASS tsdown entry bootstrap-teacher
PASS Dockerfile copies dist
PASS RUNBOOK run --rm bootstrap
PASS RUNBOOK checkout before deploy
PASS no e-mail in compose and RUNBOOK
PASS Dockerfile api unchanged
PASS Dockerfile api unchanged vs master
--- task 2
PASS X-Frame-Options DENY
PASS no trusted_proxies in Caddyfile
PASS smoke /login
PASS smoke /api/auth/me
PASS smoke 307
PASS bash -n deploy.sh
PASS RUNBOOK unlock
PASS RUNBOOK 6.1 paths
PASS RUNBOOK reset-password
PASS RUNBOOK CLIENT_IP_OK
PASS RUNBOOK sign-in refused
PASS ci.yml trusted_proxies
PASS ci.yml packages/contracts
PASS ci.yml valid YAML
PASS no anonymous GHCR access in section 10
SKIP shellcheck: not installed
--- CI steps on the current tree
ok: Web and api boundary
ok: Client address trust
--- task 3
PASS yarn knip
PASS prettier
PASS knip ignores no handwritten code
PASS AGENTS.md mentions @dv-lab/contracts
PASS AGENTS.md mentions createSignIn
PASS AGENTS.md mentions account-rows
PASS AGENTS.md mentions api-client
PASS AGENTS.md mentions read-error
PASS AGENTS.md mentions status-pages
CHECKS_OK
```

`node 18-16-ci-negative.mjs` — шаги CI из ci.yml запускаются `bash -e` в копии нужных файлов (временный git-репозиторий в scratchpad) с внесённым нарушением:

```
PASS Web and api boundary / clean tree: exit 0
PASS Web and api boundary / web imports @dv-lab/db: exit 1
PASS Web and api boundary / web imports @dv-lab/api subpath: exit 1
PASS Web and api boundary / transpilePackages: exit 1
PASS Web and api boundary / contracts extra dependency: exit 1
PASS Web and api boundary / contracts imports pg: exit 1
PASS Web and api boundary / contracts imports node:crypto: exit 1
PASS Web and api boundary / contracts imports @dv-lab/db: exit 1
PASS Web and api boundary / contracts reads process.env: exit 1
PASS Client address trust / clean tree: exit 0
PASS Client address trust / trusted_proxies in Caddyfile: exit 1
PASS Client address trust / api publishes ports: exit 1
PASS Client address trust / web publishes ports (allowed): exit 0
PASS Client address trust / enable_ipv6 false: exit 1
PASS Client address trust / enable_ipv6 removed: exit 1
CI_NEGATIVE_OK
```

`bash 18-16-smoke.sh` — `smoke_ok` из deploy.sh с заглушкой curl:

```
PASS root 307, login 200, me 401 unauthenticated (smoke_ok=0, me=401)
PASS root 200 accepted (smoke_ok=0, me=401)
PASS root 302 rejected (smoke_ok=1, me=401)
PASS login 500 rejected (smoke_ok=1, me=401)
PASS login 307 rejected (smoke_ok=1, me=401)
PASS me 404 rejected (smoke_ok=1, me=404)
PASS me 200 rejected (smoke_ok=1, me=200)
PASS me 401 without code rejected (smoke_ok=1, me=401)
PASS me empty rejected (smoke_ok=1, me=)
PASS wrong sha rejected (smoke_ok=1, me=401)
PASS db down rejected (smoke_ok=1, me=401)
SMOKE_OK
```

Прочее:
- `yarn typecheck` (4 пакета), `yarn lint`, `yarn build` (api: `dist/bootstrap-teacher.mjs` 3.81 kB; web: маршруты и Proxy) — успешно.
- `node apps/api/dist/bootstrap-teacher.mjs --reset-password` без `--email`: код 2, две строки Usage (точка входа из compose запускается и знает режим сброса).
- `yarn knip` — код 0; печатает 15 configuration hints («Remove from ignore» для файлов копии без находок, «Remove redundant entry pattern» для entry, которые находят плагины tsdown и package.json). Подсказки не влияют на код выхода (`yarn knip --no-config-hints` — код 0, вывода нет). Entry и ignore оставлены, как требует план.
- `yarn prettier --check` по `knip.json`, `deploy/compose.yaml`, `.github/workflows/ci.yml`, `deploy/RUNBOOK.md`, `AGENTS.md` — чисто.
- Предусловие: `git merge-base --is-ancestor 17868c4969f15ee0b1012b91d2c06b5d2070757f origin/master` — код 0.

## Не проверялось локально

- `caddy validate` (Docker и caddy локально нет) — выполнит шаг CI `Caddyfile` на PR.
- `shellcheck -S warning deploy/deploy.sh` (не установлен) — выполнит шаг CI `Shell scripts`.
- `docker compose config` для compose.yaml (Docker нет) — проверен только разбор YAML пакетом `yaml` и структура сервисов.
- Блоки RUNBOOK раздела 10 на сервере: их выполняет оператор (Server guy) после merge PR фазы 18. Предположения, которые подтверждает он: A6 (журнал `run --rm` удаляется с контейнером), локальный вход `dvlab_migrator` в контейнере `db` без пароля, Caddy без `trusted_proxies` не пропускает подделанный `X-Forwarded-For` в правое значение.

## Decisions Made

См. `key-decisions` во frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] knip: восемь рукописных экспортов, используемых только внутри своих файлов**
- **Found during:** задача 3 (базовый прогон `yarn knip` до правок)
- **Issue:** knip помечал `violatesUnique` (accounts.ts), `hashSessionToken` (sessions.ts), `MAX_PAIR_FAILURES`, `MAX_LOGIN_FAILURES`, `WINDOW_SECONDS`, `LOCK_SECONDS` (throttle.ts), типы `SignInAttempt`, `CredentialInput` (sign-in.ts). Внешних потребителей нет, но каждый используется в своём файле. План велит записать такие находки пробелом, а must_have и координатор требуют код выхода 0.
- **Fix:** корневая опция `ignoreExportsUsedInFile: true`. Она скрывает только экспорты, на которые есть ссылки в том же файле; экспорт без единого использования knip по-прежнему покажет. Код api (вне files_modified) не менялся.
- **Files modified:** `knip.json`
- **Commit:** `51014b1`

**2. [Rule 2 - Missing critical] 8.3 тоже переключает клон**
- **Found during:** задача 2
- **Issue:** план называет 8.1 и 8.2; после `DEPLOY_FAILED` с откатом клон стоит на прошлом sha, и повтор 8.3 запустил бы `deploy.sh` прошлого релиза.
- **Fix:** в 8.3 те же `fetch` и `checkout -q --detach "$SHA"`, фраза-пояснение относится к 8.1–8.3.
- **Commit:** `54d752a`

**3. [Указание координатора] Пересоздание сети в 10.1 условное**
- **Issue:** план описывает безусловный `dc down`; координатор сообщил, что VPS сеть уже пересоздал (D-26 подтверждено), и велел оставить шаг только для сервера без IPv6 в сети.
- **Fix:** `dc down` выполняется, только если `docker network inspect -f '{{.EnableIPv6}}' dv-lab_default` не `true`; значение печатается и присылается в отчёте.
- **Commit:** `fd36b55`

**4. [Дисциплина плана] Коммиты задач вместо «Не коммитить»**
- Общие правила фазы 18 требуют атомарный коммит каждой задачи: `fd36b55`, `54d752a`, `51014b1`.

**5. [Rule 3 - Среда] Проверки через скрипты scratchpad**
- Хук изоляции отклоняет цепочки `&&`, `!` и `$(...)`: `<automated>` всех задач и критерии приёмки собраны в `18-16-checks.sh` с тем же содержанием; добавлены отрицательные проверки шагов CI и заглушка для `smoke_ok`.

### Мелкие уточнения

- RUNBOOK 10.3 и 10.5: назад присылаются маркеры без логина (строка `Teacher created. Login: …` содержит e-mail).
- RUNBOOK 10.1: перед блоком образы проверяются блоком 4.2, чтобы простой после `dc down` не растягивался на ожидание образов.
- 6.6: «страница-заглушка» заменена на «без сессии — страница входа».

**Total deviations:** 1 Rule 3 (knip), 1 Rule 2 (8.3), 1 по указанию координатора, 2 организационных.
**Impact on plan:** состав файлов по плану; Dockerfile api и код приложения не менялись.

## Known Stubs

None.

## Threat Flags

None: новых сетевых точек нет. Сервис `bootstrap` (T-18-56, T-18-61), `X-Frame-Options` (T-18-55), smoke (T-18-58), шаги CI (T-18-62, T-18-63) и блоки 10.2/10.4 (T-18-57) соответствуют threat_model плана.

## Issues Encountered

- Локально нет Docker, caddy и shellcheck (см. «Не проверялось локально»).
- `.gsd/` в рабочем дереве не из этого плана, не коммитился. После сборок `AGENTS.md` turbo не менял, `apps/web/AGENTS.md` не появлялся.

## User Setup Required

Серверные шаги — оператору по RUNBOOK после merge PR фазы 18: 4.2 (образы `sha-<SHA>` доступны) → 10.1 (`DEPLOY_OK`) → 6.1–6.4 и 10.2 (`CLIENT_IP_OK`) → 10.3 (`Teacher created`, `NO_BOOTSTRAP_CONTAINER`) → вход владельца на `https://dv-lab.dev/login` и смена пароля (критерий 1 ROADMAP).

## Next Phase Readiness

- 18-15 (ручные проверки) может идти: код приложения этим планом не менялся, `yarn build` собран свежим (api dist и `.next`).
- CI на PR фазы 18 впервые выполнит `caddy validate` с `X-Frame-Options`, shellcheck нового `smoke_ok` и два шага инвариантов.
- Критерий 1 ROADMAP остаётся открытым до выкатки по разделу 10 и входа владельца.

## Self-Check: PASSED

- Файлы на диске: `deploy/compose.yaml`, `deploy/caddy/Caddyfile`, `deploy/deploy.sh`, `deploy/RUNBOOK.md`, `.github/workflows/ci.yml`, `knip.json`, `AGENTS.md` изменены и закоммичены (`git status` чистый, кроме чужого `.gsd/`).
- Коммиты `fd36b55`, `54d752a`, `51014b1` есть в `git log`.
- `CHECKS_OK`, `CI_NEGATIVE_OK`, `SMOKE_OK`, typecheck, lint, build, knip — пройдены.

---
*Phase: 18-accounts-and-variant-a-shell*
*Completed: 2026-10-09*
