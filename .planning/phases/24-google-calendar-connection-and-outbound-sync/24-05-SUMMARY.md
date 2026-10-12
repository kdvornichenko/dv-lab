---
phase: 24-google-calendar-connection-and-outbound-sync
plan: '05'
subsystem: api
tags: [google-calendar, reads, history, next-index, e2e]
requires:
  - phase: 24-04
    provides: OAuth connection, credential lease, immutable historyCutoverAt
provides:
  - Atomic complete Google window with persisted last_known
  - Shared ordered-prefix next index without a date horizon
  - Account-bound history and mark eligibility
affects: [24-06, 24-07, 24-08, 24-09, 24-11, 24-12, 24-13, 24-14]
actuals:
  tokens: 20768
  tasks: 3
  commits: 3
plan_head_before: 6ec89188636df1a68d0e05340edf614c5e223dd5
plan_head_after: f788f431bbd0579c326f69529c8986af6bea2069
tech-stack:
  added: []
  patterns:
    - Network reads outside SQL; complete publication with revision CAS
    - Persisted proof determines history and next eligibility
key-files:
  created:
    - apps/api/src/calendar/read-model.ts
    - apps/api/src/calendar/reads.ts
    - apps/api/src/calendar/event-mapping.ts
    - apps/api/src/calendar/history.ts
  modified:
    - apps/api/src/routes/schedule.ts
    - apps/api/src/schedule/marks.ts
    - apps/api/src/schedule/rows.ts
    - apps/api/src/today/today.ts
key-decisions:
  - Receipt belongs to the exact request context and confirmed publication revision.
  - Minimal cancelled identities need no fabricated ETag or timestamps.
  - A new history mark requires pre-cutover local history or a matching confirmed provider fact.
  - Existing marks remain eligible and accounting reads remain unchanged.
requirements-completed: [GCAL-02, GCAL-09, GCAL-10]
verification-status: partial
coverage:
  - id: D1
    description: Complete Google window and disconnected unavailable response
    requirement: GCAL-02
    verification:
      - kind: e2e
        ref: 'e2e/calendar.spec.ts: [calendar] window stays unavailable'
        status: pass
      - kind: e2e
        ref: 'Real connected pagination, cancellation and restart journeys'
        status: unknown
    human_judgment: false
  - id: D2
    description: Shared next index without an arbitrary date horizon
    requirement: GCAL-09
    verification:
      - kind: other
        ref: yarn workspace @dv-lab/api typecheck
        status: pass
      - kind: e2e
        ref: 'e2e/today.spec.ts: [calendar] next C2 cards'
        status: unknown
    human_judgment: false
  - id: D3
    description: History cutoff and server-side mark eligibility
    requirement: GCAL-10
    verification:
      - kind: other
        ref: yarn workspace @dv-lab/api typecheck
        status: pass
      - kind: e2e
        ref: 'e2e/marks.spec.ts and e2e/today.spec.ts: [calendar] history'
        status: unknown
    human_judgment: false
duration: 32min
completed: 2026-10-11
status: complete
---

# Phase 24 Plan 05: Google reads, next index и граница истории

**Полное окно Google публикуется одной транзакцией; next использует доказанный ordered prefix; отметки после cutover требуют подтверждённого урока.**

Завершены три задачи исходников. Это не приёмка реального Google. Connected/provider/fault E2E остаются **UNVERIFIED**. Поле requirements-completed перечисляет требования плана; полное подтверждение этих требований принадлежит приёмке фазы.

## Performance

- Начало: 2026-10-11 17:05:52 UTC.
- Окончание исходников: 2026-10-11 17:37:34 UTC.
- Изменены 23 source/test файла. Этот SUMMARY — отдельный результат.
- 83 070 символов реализованного Git diff, ceil(chars/4) = 20 768.
- Три task commits измерены через отдельный ledger 24-05. Документационный коммит не входит в интервал actuals.

## Accomplishments

### Task 1 — полное окно

Все страницы events.list используют фиксированные фильтры. Повторные IDs/tokens, неверные данные, нарушенный порядок и неполный traversal не публикуют fresh. Сеть работает вне SQL. Запись окна, events и revision атомарна; CAS проверяет account, generation, revision и fingerprint mappings/commands/rules.

Fresh требует receipt текущего запроса. Последнее полное окно сохраняется в БД. Другая requestedRange не выдаётся за покрытую. Pending barrier не снимается чтением. External events не получают lesson binding по заголовку.

Series context использует проверенный master, поддерживаемое weekly rule и ordered future reference. Version включает master ETag и revision. Неполное доказательство не открывает whole-series editing.

### Task 2 — next index

Ordered stream начинается в now и не имеет timeMax или горизонта 30/90 дней. Первая mapped active timed occurrence после полного префикса даёт known. End-of-list даёт none. Отсутствие bindings доказывается отдельно в receipt и не подделывает provider end-of-list. Deadline оставляет unresolved students в unknown.

Publication использует тот же CAS и глобальную revision. Старый или уже прошедший known не вычисляется заново по recurrence. Pending students не получают преждевременный next. Public consumers подключает 24-06.

Cancelled identities могут не иметь ETag. Sparse tombstones участвуют в проверке повторов, но не записываются с выдуманным ETag. Полное окно и отсутствие active event закрывают resurrection. Строгая валидация active events сохранена.

### Task 3 — история и отметки

History eligibility учитывает account и неизменный cutoff. Старый local subject должен существовать до cutoff, а его начало должно быть раньше cutoff. Все сохранённые marks остаются доступны; существующий расчёт балансов не изменён.

После cutoff требуется matching timed provider fact, active representation, совпадение local ref, student, времени и длительности. Более новое покрывающее окно, перенос, отмена или противоречащий next proof запрещают использование прежнего факта. Reserved mappings и затронутые pending refs не становятся новыми оплачиваемыми уроками.

При отказе новых marks API возвращает существующий 409 lesson_changed. Connection share lock предшествует domain lock и удерживает границу публикации в транзакции. Наличие живого provider connection не требуется для уже сохранённого подтверждённого прошлого.

Today применяет тот же фильтр к раскрытым occurrences и series. Формулы recurrence остаются в core. Исторический UI отдельно не добавлен.

## Task Commits

| Task | Commit  | Результат                      |
| ---- | ------- | ------------------------------ |
| 1    | 70d47e8 | Атомарное чтение окна Google   |
| 2    | 9314fa9 | Общий next index без горизонта |
| 3    | f788f43 | Граница истории и отметок      |

Коммиты не удаляют файлы. SUMMARY коммитится отдельно.

## Files Created/Modified

| Файл                                                                              | Причина                                                         |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| apps/api/src/calendar/provider-events.ts                                          | Разбор provider input, включая sparse cancelled identities      |
| apps/api/src/calendar/read-state.ts                                               | Request context, receipt и opaque versions                      |
| apps/api/src/calendar/event-mapping.ts                                            | Persisted bindings и pending barriers                           |
| apps/api/src/calendar/read-pages.ts                                               | Полное окно и ordered prefix без date horizon                   |
| apps/api/src/calendar/series-context.ts                                           | Проверенные master/rule/reference для whole series              |
| apps/api/src/calendar/read-store.ts                                               | Атомарная публикация window/next с CAS                          |
| apps/api/src/calendar/reads.ts                                                    | Координация сети, credential lease и publication                |
| apps/api/src/calendar/read-model.ts                                               | Общие window/next DTO из подтверждённых фактов                  |
| apps/api/src/calendar/gateway.ts                                                  | Google events list/master transport                             |
| apps/api/src/calendar/history.ts                                                  | Общая eligibility истории и marks                               |
| apps/api/src/app.ts                                                               | Внедрение reader в приложение                                   |
| apps/api/src/server.ts                                                            | Composition wiring reader                                       |
| apps/api/src/routes/schedule.ts                                                   | GET week через reader; accountId для mark handlers              |
| apps/api/src/routes/today.ts                                                      | Передача accountId в Today context                              |
| apps/api/src/schedule/rows.ts                                                     | Общий фильтр раскрытых history blocks                           |
| apps/api/src/schedule/marks.ts                                                    | Проверка eligibility и порядок блокировок                       |
| apps/api/src/today/today.ts                                                       | Фильтрация lessons/Earlier и соответствующих series             |
| e2e/calendar.spec.ts                                                              | Public window, repeated reads и observed cancellation cases     |
| e2e/today.spec.ts                                                                 | C2 card responses и history visibility journeys                 |
| e2e/marks.spec.ts                                                                 | Public history mark journey                                     |
| e2e/support/calendar-next.ts                                                      | Общие проверки всех card response paths                         |
| e2e/support/calendar-history.ts                                                   | Проверка observed synthetic fixture, cutoff, marks и балансов   |
| e2e/support/data.ts                                                               | Выбор существующей .env.test, suffix guard и отдельное evidence |
| .planning/phases/24-google-calendar-connection-and-outbound-sync/24-05-SUMMARY.md | Результаты, evidence и границы передачи                         |

## Verification

Все команды выполнялись в worktree agent-24-contracts. API build, full root tests/build/knip, Google consent/events и deployment не выполнялись.

| Команда                                                                                                                                                                                                                                                                               | Статус                 | Решающий результат                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------- |
| `yarn workspace @dv-lab/api typecheck`                                                                                                                                                                                                                                                | PASS, exit 0           | Нет ошибок                                                                          |
| `yarn exec tsc --noEmit --strict --target ES2024 --module ESNext --moduleResolution Bundler --allowImportingTsExtensions --allowJs --skipLibCheck --types node e2e/calendar.spec.ts e2e/today.spec.ts e2e/marks.spec.ts e2e/support/calendar-next.ts e2e/support/calendar-history.ts` | PASS, exit 0           | Новый E2E TypeScript проверен                                                       |
| `yarn playwright test e2e/calendar.spec.ts --grep '\\[calendar\\] window stays unavailable' --project=light --no-deps`                                                                                                                                                                | PASS, exit 0           | 1 passed; localhost, реальная dev persistence, Calendar disabled                    |
| `E2E_FIXTURE_DATABASE=test E2E_TARGET_ORIGIN=https://dv-lab.dev yarn playwright test e2e/marks.spec.ts e2e/today.spec.ts --grep '\\[calendar\\] history' --project=light`                                                                                                             | UNVERIFIED, exit 1     | Preflight: E2E_TARGET_ATTESTATION отсутствует; запросы и fixture writes не начались |
| Та же history команда с `--list`                                                                                                                                                                                                                                                      | Discovery only, exit 0 | 2 history cases и setup/cleanup найдены                                             |
| `git diff --check`                                                                                                                                                                                                                                                                    | PASS, exit 0           | Нет whitespace ошибок                                                               |
| `node scripts/dev-checks/wait-dev.mjs down`                                                                                                                                                                                                                                           | PASS, exit 0           | DEV_DOWN_OK                                                                         |
| `bash scripts/gsd/root-pin.sh ~/.claude/worktrees/phase24-contracts/dv-lab`                                                                                                                                                                                         | PASS, exit 0           | ROOT_PIN_OK                                                                         |
| Pre-commit HEAD/ledger guard                                                                                                                                                                                                                                                          | PASS, exit 0           | agent-24-contracts, protected=false                                                 |

Prettier: `yarn prettier --check` с явным списком всех 23 файлов таблицы исходников выше — exit 0, `All matched files use Prettier code style!`. Список совпадает с `git diff --name-only 6ec89188636df1a68d0e05340edf614c5e223dd5 f788f431bbd0579c326f69529c8986af6bea2069`.

Quality: `node --max-old-space-size=8192 scripts/dev-checks/calendar-quality.ts --base 6ec89188636df1a68d0e05340edf614c5e223dd5` с повторёнными `--owned <path> --new <path>` для этих 23 файлов, source-hash-bound `--boundary-review` для input/error boundaries и `--json` — exit 0, PASS. Точные аргументы восстановимы из files/sha256/boundaries в private report.

### Качество и fingerprints

- Node 24.17.0; TypeScript 6.0.3; ESLint 10.12.0.
- Owned scope: 23 файла, 370 функций/callbacks. Три неизменённых measurement tools входят в отдельный инструментальный denominator.
- Максимумы: CC 20; cognitive 18; Halstead Difficulty 42.75; файл 459 физических строк.
- CC: ESLint classic AST. Cognitive: DVLab AST nesting/control/logical-sequence v1, не Sonar.
- Halstead: executable AST leaves; trivia/import/type syntax исключены; nested function владеет токенами один раз; D=(n1/2)*(N2/n2).
- Types: any findings 0; unknown только на проверенных Google/HTTP/private JSON/SQL-output/WebSocket/error boundaries.
- Изменённые ветвления: GET week callback CC 2→3, cognitive 1→1; markOccurrence callback CC 4→5, cognitive 3→4; markLesson callback CC 3→4, cognitive 2→3.
- Ранние превышения Task 1 исправлены: traverseEvents CC 14/cognitive 24→10/12; supportedRule CC 25/cognitive 17→14/12.
- Итоговый fingerprint: `e9fb40021a635b7fa16394e7bdea161a0ddf0d7e5a1c6f8fd828f2a4615132cd`.
- Type input fingerprint: `a100899a50199117c19e87048246836b371f43179e24d784075a698978730487`.
- Private evidence: `STATE_DIR/phase24-05-task3-quality-final.json`; предыдущие Task 1/2 reports сохранены рядом.
- Выполненный disconnected E2E: `STATE_DIR/phase24-05-window-e2e.json`; fingerprint сценария на момент запуска `dc914892e6332129d42d2a8216c1d3848bc1079a28aac348a177933369e80361`. Последующие изменения connected/history ветвей не переименованы в новый functional PASS.

Simplify применён к owned diff. Удалён лишний export внутреннего типа, фильтрация серий согласована с показанными уроками. Подтверждённых dead/redundant findings не осталось. Это scoped review, не полный quality audit.

## E2E: выполнено, написано, отсутствует

**Выполнено:** только disconnected window через public API и настоящую dev persistence. Контроль mark/history и Google acknowledgements этим результатом не доказан.

**Написано, не выполнено:** repeated complete reads; real synthetic cancellation fixture; C2 list/detail/create/update/archive/restore/opening responses; history visibility и mark refusals/success/correction. History helper требует observed fixture в private STATE_DIR и сверяет teacher, cutoff, synthetic card ownership и refs. Fake provider responses не используются.

**Ещё не написаны полные самостоятельные source journeys:** interrupted page 2 + restart; фактически пустая nonfinal page; out-of-order concurrent responses; чужой account; beyond-prefix/end-of-list/deadline/passed-next matrix; реальный outage mark journey; whole-series reload. Sparse cancelled provider branch не доказана обычным cancellation fixture. Эти ветви нельзя считать покрытыми grep/discovery. Нужны реальные fixtures/transport/process fault controls и consumers следующих планов.

TDD сценарии добавлены до соответствующего поведения. Полная Google RED→GREEN evidence отсутствует; TDD provider gate не заявлен как PASS.

## Decisions Made

- Не пересчитывать legacy future по local recurrence после cutover.
- Не привязывать history availability к живому соединению: проверять сохранённое доказательство.
- History и marks используют одну eligibility; share lock на connection идёт раньше domain locks.
- Next proof может опровергнуть старое history время только когда доказанный prefix действительно покрывает это время.
- Применять runtime authority отдельно от исходников и статических проверок.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 2 — недостающая связность]** Добавлены необходимые reader helpers, composition wiring и Today account/filter wiring. Файлы перечислены выше и объявлены до изменений. Parent подтвердил ownership; PLAN inventory обновляет parent.
2. **[Rule 1 — provider bug]** Исправлен отказ на минимальном cancelled resource без ETag. Active resource остаётся строгим; sparse tombstone не создаёт выдуманных provider facts. Коммит 9314fa9.
3. **[Rule 2 — корректность history]** Учтены более новые переносы/отмены, absence window, покрывающий next proof и pending occurrence refs. Коммит f788f43.
4. **[Rule 3 — E2E fixture boundary]** Существующий harness мог обращаться только к dev. Добавлен явный выбор test с отдельным private state и сохранёнными suffix/role guards. Новая БД или stand не создавались. Коммит f788f43.

## Issues Encountered / Deferred Issues

- History E2E остановлен отсутствием target attestation. Это ограничение среды; source/static proof не заменяет его.
- Read-only проверка существующей test базы: Calendar schema отсутствует; имеются чужие teacher accounts. Миграции/аккаунты не менялись.
- Экспериментальная E2E проверка с `--checkJs` ранее дала exit 2 на существующих JS helpers. Посторонние implicit-any/import errors не исправлялись. Финальная strict TS проверка выполнена без checkJs.
- До текущего checkout parent интегрировал Settings12/observer13. Эти параллельные изменения не переписаны данным executor.
- Пользователь разрешил synthetic-only тестирование на существующем prelaunch dv-lab.dev и его БД, отклонив отдельный stand. Клиент/consent/candidate/attestation/lease пока не предоставлены. Внешний runtime не вызывался.

## Known Stubs

Blocking code stubs, TODO/FIXME и skip/todo tests в owned файлах не найдены. Отсутствующие E2E journeys перечислены выше как authoring gaps, а не как выполненные сценарии.

## Передача parent / Next Phase Readiness

- **Остановлено перед 24-06.** Source readers и history filter готовы для подключения consumers. Их реальное Google поведение остаётся непроверенным.
- Parent уже интегрировал Task 1/2. Следующий source commit для merge: **f788f43**.
- `routes/schedule.ts`: Task 3 меняет только передачу accountId в два mark handlers. Сохранить GET week observation hook Archimedes.
- `server.ts`: Task 1 reader wiring нужно сохранять вместе с observer wiring, уже объединённым parent.
- `e2e/support/data.ts`: f788f43 содержит выбор .env.test и suffix guard в runSql. Arendt владеет последующим узким main-target runner; объединить оба намерения. Общий scripts/dev-checks/sql.mjs не менялся.
- History helper пока требует test database и attested HTTPS. Для текущей human-authorized main DB parent должен использовать свой узкий authorization path; широкий suffix bypass не добавлять.
- STATE.md, ROADMAP.md, HANDOFF, WINDOWS.md, state.json и PLAN inventories принадлежат parent и не изменялись.
- Для WINDOWS parent: unrun-verify для connected window/next/history; unmet-truth для ещё не написанных provider/fault journeys; deviation для описанных отклонений по принятой ledger policy.
- Собственные процессы остановлены: DEV_DOWN_OK. Чужой untracked apps/web/AGENTS.md сохранён.

## Self-Check: PASSED

Все 23 source/test файла и SUMMARY существуют. Коммиты 70d47e8, 9314fa9 и f788f43 являются предками HEAD. SHA-256 всех файлов из итогового quality report совпадают с текущими файлами. Число task commits равно трём по отдельному ledger 24-05. DEV_DOWN_OK подтверждён перед передачей.
