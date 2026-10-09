---
phase: "18"
slug: "accounts-and-variant-a-shell"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-09"
---

# Phase 18 — Validation Strategy

> Контракт проверки фазы для выборочной обратной связи во время исполнения. Источник: раздел Validation Architecture в `18-RESEARCH.md`. Колонки Task ID, Plan, Wave и Threat Ref заполняет планировщик после раскладки задач по планам.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.3 (api и db уже подключены; в web добавляются с теми же версиями). Тесты api работают на настоящем Postgres (`dvlab_test`), тесты перезапуска и скрипта первого учителя запускают собранные `dist/server.mjs` и `dist/bootstrap-teacher.mjs` |
| **Config file** | `apps/api/vitest.config.ts` (Wave 0: `fileParallelism: false`, `globalSetup` с миграциями под `dvlab_migrator`), `packages/db/vitest.config.ts`, `apps/web/vitest.config.ts` (Wave 0) |
| **Quick run command** | `yarn workspace @dv-lab/api test test/auth/<file>.test.ts` (для web: `yarn workspace @dv-lab/web test test/<file>.test.ts`) |
| **Full suite command** | `yarn workspace @dv-lab/api build && yarn turbo run test --concurrency=1` |
| **Estimated runtime** | до 30 секунд на тест-файл; время полного набора уточнить по первому прогону после Wave 0 |

---

## Sampling Rate

- **After every task commit:** тест-файл, который задача трогает (`yarn workspace @dv-lab/api test test/auth/<file>.test.ts` или `yarn workspace @dv-lab/web test test/<file>.test.ts`)
- **After every plan wave:** `yarn workspace @dv-lab/api build && yarn turbo run test --concurrency=1`, затем `typecheck`, `lint`, `knip`
- **Before `/gsd-verify-work`:** полный набор зелёный, ручной чек-лист в браузере пройден
- **Max feedback latency:** 30 секунд на тест-файл

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| — | — | — | ACCT-01 | — | cookie `__Host-dvlab_session; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`, без `Domain`; учитель входит по email и паролю | integration (HTTP через `createApp`, настоящий Postgres) | `yarn workspace @dv-lab/api test test/auth/routes.test.ts` | ❌ W0 | ⬜ pending |
| — | — | — | ACCT-01 | — | база не допускает второго активного учителя (`23505`, `accounts_one_active_teacher_uq`); после деактивации первого вставка проходит | integration (DB) | `yarn workspace @dv-lab/api test test/auth/accounts.test.ts` | ❌ W0 | ⬜ pending |
| — | — | — | ACCT-02 | — | создание ученика: сгенерированный пароль 12 символов из алфавита или свой 10-128; занятый логин даёт `login_taken`; ученик входит | integration | `yarn workspace @dv-lab/api test test/auth/accounts.test.ts` | ❌ W0 | ⬜ pending |
| — | — | — | ACCT-02 | — | деактивация: статус, `auth_epoch + 1` и удаление сессий в одной транзакции; старая cookie даёт 401; учитель деактивации не поддаётся (IDOR, устаревшая сессия) | integration | `yarn workspace @dv-lab/api test test/auth/accounts.test.ts` | ❌ W0 | ⬜ pending |
| — | — | — | ACCT-03 | — | в `sessions` лежит только sha256-хэш (64 hex), сырого токена нет; `CHECK` отвергает не-hex | integration | `yarn workspace @dv-lab/api test test/auth/sessions.test.ts` | ❌ W0 | ⬜ pending |
| — | — | — | ACCT-03 | — | сессия переживает перезапуск api: два запуска `dist/server.mjs`, SIGTERM между ними, тот же cookie даёт `GET /auth/me` 200 | integration, процесс (нужен `yarn workspace @dv-lab/api build`) | `yarn workspace @dv-lab/api test test/auth/restart.test.ts` | ❌ W0 | ⬜ pending |
| — | — | — | ACCT-03 | — | пять неудач на пару закрывают пару на 900 с, шестая (даже верная) даёт `locked`; 20 на логин со всех IP; IPv6 /64; неизвестный логин считается; успех сбрасывает; окно истекает (старение строки под ролью миграций) | integration (DB) | `yarn workspace @dv-lab/api test test/auth/throttle.test.ts` (юнит-тест `ipBucket` внутри) | ❌ W0 | ⬜ pending |
| — | — | — | ACCT-03 | — | 20 параллельных попыток одного логина допускаются ровно в пределах порога (гонка `FOR UPDATE`); 50 попыток и опрос `/healthz`: все 200 (D-20) | integration | `yarn workspace @dv-lab/api test test/auth/sign-in.test.ts` | ❌ W0 | ⬜ pending |
| — | — | — | ACCT-05 | — | скрипт первого учителя: создаёт, печатает пароль один раз, повторный запуск даёт код 3, работает `--password-stdin`, подключается под ролью приложения | integration, процесс (`dist/bootstrap-teacher.mjs`, нужен build) | `yarn workspace @dv-lab/api test test/auth/bootstrap-teacher.test.ts` | ❌ W0 | ⬜ pending |
| — | — | — | ACCT-05 | — | смена пароля: неверный старый даёт ошибку и счётчик; успех удаляет остальные сессии, текущая заменяется новой cookie и жива, старый пароль не входит | integration | `yarn workspace @dv-lab/api test test/auth/routes.test.ts` | ❌ W0 | ⬜ pending |
| — | — | — | ACCT-01, ACCT-02, ACCT-03, ACCT-05 | — | `sameOrigin`: POST без Origin или с чужим Origin даёт 403 `forbidden_origin`; JSON-ошибки идут конвертом; `HTTPException` не превращается в 500 | integration | `yarn workspace @dv-lab/api test test/auth/routes.test.ts` | ❌ W0 | ⬜ pending |
| — | — | — | SHELL-01 | — | `proxy.ts`: нет cookie даёт 307 на `/login`; проверяется только форма токена; `matcher` исключает `api`, `login`, статику | unit (web) | `yarn workspace @dv-lab/web test` | ❌ W0 | ⬜ pending |
| — | — | — | SHELL-01 | — | разделы, поле поиска открывает палитру (⌘K, клик, первый символ), навигация, выход | manual (браузер) | чек-лист в разделе Manual-Only Verifications | ручной | ⬜ pending |
| — | — | — | SHELL-02 | — | в `apps/web` (кроме `.next`, `node_modules`) нет кириллицы | contract (web) | `yarn workspace @dv-lab/web test test/english-only.test.ts` | ❌ W0 | ⬜ pending |
| — | — | — | SHELL-02 | — | нет `radix-ui`, `@radix-ui/*`, `cmdk` в `package.json` и импортах `apps/web` | contract (web) + ESLint `no-restricted-imports` | `yarn workspace @dv-lab/web test test/radix-free.test.ts`; `yarn workspace @dv-lab/web lint` | ❌ W0 | ⬜ pending |
| — | — | — | SHELL-02 | — | `typecheck`, `lint`, `build` web проходят с копией оболочки | build | `yarn workspace @dv-lab/web typecheck && yarn workspace @dv-lab/web lint && yarn workspace @dv-lab/web build` | ✅ команда | ⬜ pending |
| — | — | — | SHELL-02 | — | светлая и тёмная тема, нет вспышки при перезагрузке в тёмной, палитра и диалоги читаемы, ширина 320 и 1280 | manual (браузер) | чек-лист в разделе Manual-Only Verifications | ручной | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/vitest.config.ts` — `fileParallelism: false`, `globalSetup` с миграциями под `dvlab_migrator`
- [ ] `packages/db/src/testing.ts` и подпуть `@dv-lab/db/testing` (`resetTables`, роли приложения и миграций) — D-19
- [ ] `apps/api/test/support/server.ts` — `startApi`, вынесенный из `shutdown.test.ts`, с остановкой и повторным запуском
- [ ] `apps/api/test/auth/{passwords,throttle,sessions,accounts,sign-in,routes,restart,bootstrap-teacher}.test.ts` (юнит-тест `ipBucket` внутри throttle)
- [ ] `apps/web`: `vitest`, `vite`, `vitest.config.ts`, скрипт `test`, `test/{proxy,english-only,radix-free}.test.ts`
- [ ] `turbo.json` или корневой скрипт: `--concurrency=1` для `test`
- [ ] Спайки волны 0: Q1 (маршрут `/api/*` в локальной разработке), копия 37 файлов собирается, `Autocomplete` в `Dialog`, `yarn dev`
- [ ] Установка зависимостей: `yarn workspace @dv-lab/web add …` (один checkpoint по diff `yarn.lock`)

---

## Manual-Only Verifications

Браузерные проверки выполняются во встроенном браузере агента после автоматических; перед «готово» результат записывается в отчёт (правило владельца о проверке UI в браузере). Если встроенный браузер недоступен, чек-лист выполняет владелец.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Вход учителем и редирект анонима | ACCT-01, SHELL-01 | нужен браузер и настоящая cookie | 1) открыть приложение без cookie: ожидается редирект на `/login`; 2) войти учителем: открывается оболочка с разделами Today, Chat, Students, Schedule; 3) четыре раздела открываются, в пустых показано «Nothing here yet» |
| Палитра команд | SHELL-01 | нужны события клавиатуры и фокус | 1) клик по полю поиска в сайдбаре открывает палитру; 2) ⌘K открывает палитру; 3) первый печатный символ в поле поиска открывает палитру с этим символом; 4) Enter на пункте раздела переходит в раздел; 5) пункты темы и Sign out в палитре работают |
| Тема без вспышки | SHELL-02 | нужен реальный рендер | 1) переключить тему переключателем; 2) перезагрузить страницу в тёмной теме: белой вспышки нет; 3) палитра и диалоги читаемы в обеих темах; 4) консоль без ошибок (предупреждение next-themes о теге `script` допустимо, A8) |
| Узкий экран | SHELL-02 | нужен реальный рендер | ширина 320 px: нет горизонтальной прокрутки страницы; ширина 1280 px: оболочка не ломается |
| Жизненный цикл ученика | ACCT-02, ACCT-03 | нужны два окна браузера | 1) учитель создаёт ученика: пароль показан один раз; 2) войти учеником в другом окне; 3) учитель деактивирует ученика; 4) в окне ученика следующий запрос ведёт на `/login?reason=expired` |
| Смена пароля учителем | ACCT-05 | нужны два окна браузера | 1) войти учителем в двух окнах; 2) сменить пароль в первом; 3) первое окно остаётся в сессии; 4) второе окно разлогинено |
| Сгенерированный пароль первого учителя не остаётся в журнале | ACCT-05 | нужен Docker и сервер, у агентов доступа нет (A6) | владелец запускает `docker compose run --rm bootstrap --email … --name …` из RUNBOOK и проверяет, что вывод с паролем исчез вместе с контейнером |
| Реальный IPv6-адрес клиента виден Caddy, сброс блокировки | ACCT-03 | нужны VPS и IPv6-клиент (A1, A11) | владелец после выката входит неверным паролем по IPv6 и сверяет адрес клиента в журнале Caddy; если адрес схлопнулся в шлюз, блокировку снимает `delete from sign_in_throttles` под ролью миграций (строка в RUNBOOK), решение по способу разблокировки принимает Server guy до выкатки |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
