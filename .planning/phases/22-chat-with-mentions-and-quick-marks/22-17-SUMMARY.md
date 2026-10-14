---
phase: 22-chat-with-mentions-and-quick-marks
plan: '17'
subsystem: testing
tags: [dev-checks, caddy, docs, chat, sse]
status: complete
requires:
  - phase: 22-chat-with-mentions-and-quick-marks
    provides: 'проверки 22-01…22-16 и 22-18 (chat-api.mjs, chat-config.mjs, mark-revision.mjs, schedule-started*.mjs, schedule-comments-series.mjs)'
provides:
  - 'scripts/dev-checks/chat-final.mjs: все серверные проверки фазы 22 одной командой, строка CHAT_FINAL_OK'
  - 'Caddyfile: поток хода /api/chat/turns/<id>/stream без сжатия (matcher @compressible)'
  - 'AGENTS.md, deploy/RUNBOOK.md (раздел 14), scripts/dev-checks/README.md: владельцы чата, выкатка, проверки, живая сессия владельца'
affects: [22-verify, deploy, phase-23]
actuals:
  tokens: 5400
  tasks: 3
  commits: 11
plan_head_before: dd8e1c31bf79ab0fea5a897140c54cb732702fc5
plan_head_after: 59bc60157f0743b4bc6b47da12784f28106bf180
tech-stack:
  added: []
  patterns:
    - 'итоговый прогон фазы: последовательный spawnSync по строкам успеха, остановка на первом провале с кодом выхода проверки'
    - 'дочерним проверкам не передаются ANTHROPIC_*, DATABASE_URL и MIGRATOR_DATABASE_URL'
key-files:
  created:
    - scripts/dev-checks/chat-final.mjs
  modified:
    - AGENTS.md
    - deploy/RUNBOOK.md
    - deploy/caddy/Caddyfile
    - scripts/dev-checks/README.md
key-decisions:
  - 'Caddy: path_regexp из 22-SERVER-PREP (проверен Server guy на caddy 2.11.7), а не glob `not path` из плана'
  - 'chat-final.mjs убирает ANTHROPIC_* из окружения проверок: в оболочке исполнителя задан ANTHROPIC_BASE_URL, SDK взял бы его и обошёл заглушку api.anthropic.com'
  - 'schedule-comments-series.mjs добавлен в chat-final.mjs сверх списка плана: это проверка фазы 22 (22-07)'
requirements-completed: [CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-07, CHAT-08, CHAT-09, CHAT-11]
duration: 30min
completed: 2026-10-14
---

# Phase 22 Plan 17: Итоговая проверка фазы и документы Summary

Все серверные проверки фазы 22 идут одной командой `chat-final.mjs` (19/19, `CHAT_FINAL_OK`) без Google и Anthropic; Caddy исключает поток хода из сжатия; AGENTS.md, RUNBOOK и README проверок описывают чат, выкатку и живую сессию владельца.

## Задачи и коммиты

| # | Задача | Коммит |
| --- | --- | --- |
| 1 | Упрощение кода (только обзор) и `chat-final.mjs` | 930c4a9 |
| 2 | AGENTS.md, RUNBOOK раздел 14, README проверок, Caddyfile | e33a784 |
| 3 | build, test, knip; e2e не запускались (ниже) | без коммита |

`commits: 11` в frontmatter измерено `git rev-list --count` от `plan_head_before`: из них два коммита этого плана, остальные девять — параллельный UI-исполнитель v81/v82 (`ui(...)`, `docs(22)`, `fix(schedule)`).

## Проверки

| Команда | Результат |
| --- | --- |
| `node scripts/dev-checks/chat-final.mjs` | код 0, `19/19 checks passed`, `CHAT_FINAL_OK` |
| `yarn typecheck` | код 0, 5/5 |
| `yarn lint` | код 0 |
| `yarn build` | первый запуск код 1: `schedule-screen.tsx(246)` в незакоммиченной правке UI-исполнителя; повтор после его коммита — код 0 |
| `yarn test` | код 0: contracts 48, db 21, api 47 тестов |
| `yarn knip` | код 0, только подсказки конфигурации |
| `node scripts/hygiene-check.mjs` | `hygiene-check: clean` |
| `yarn prettier --check` RUNBOOK, README, AGENTS.md, chat-final.mjs | чисто |
| `grep -n "@compressible" deploy/caddy/Caddyfile` | matcher и `encode @compressible zstd gzip` |
| `caddy validate` | локально бинарника нет; проверяет шаг CI `Caddyfile` (job `Verify`, `caddy:2.11.7`) |
| `yarn test:e2e`, `wait-dev.mjs down` | не запускались: порты 3000 и 4000 занимает стенд владельца |

Строки `chat-final.mjs` (по порядку, секунды): `SCHEDULE_STARTED_OK` 26, `SCHEDULE_STARTED_SERIES_OK` 20, `SCHEDULE_COMMENTS_SERIES_OK` 17, `MARK_REVISION_OK` 28, `CHAT_CONFIG_OK` 8, `CHAT_RECORDS_OK` 7, `CHAT_CONVERSATIONS_OK` 6, `CHAT_NOTES_OK` 9, `CHAT_COMMENTS_OK` 11, `CHAT_TARGET_OK` 29, `CHAT_ACTIONS_OK` 14, `CHAT_CALENDAR_OK` 47, `CHAT_BUDGET_OK` 8, `CHAT_RUNS_OK` 29, `CHAT_ANSWERS_OK` 10, `CHAT_MODELS_OK` 8, `CHAT_DELETE_OK` 10, `CALENDAR_READS_OK` 10, `CALENDAR_FINAL_OK` 191 (15/15 внутри). После прогона в `dvlab_test` 0 вымышленных карточек, 0 разговоров, 0 ходов, 0 попыток.

`CHAT_RUNS_OK` получен в 01:3x по `Asia/Ho_Chi_Minh`, в окне 00:00–02:00, где 22-14 видел падение `clarify(date_time)`; исправление 5916256 уже было в коде.

`chat-final.mjs` прогнан на коде до коммита 6eec690 другой сессии (`apps/api/src/chat/tools.ts`, `scripts/dev-checks/chat-runs.mjs`).

В `dvlab_dev` одно текущее подключение Google в состоянии `connected` (запрос `select state, count(*) from google_connections where retired_at is null`): e2e на dev только если это тестовый аккаунт владельца, иначе `E2E_FIXTURE_DATABASE=test`.

## Статус SC и требований

| SC / требование | Статус | Доказательство |
| --- | --- | --- |
| SC1 разговоры и поток ответа | api: PASS; браузер: UNVERIFIED | 22-05 `CHAT_CONVERSATIONS_OK`, 22-16 `CHAT_DELETE_OK`, 22-13 `CHAT_RUNS_OK` (SSE, переподключение, Stop); `chat-web.mjs conversations`, `stream`, `delete` не запускались |
| SC2 `@` и быстрые формы | api: PASS; браузер: UNVERIFIED; Google: сессия владельца | 22-08 `CHAT_TARGET_OK`, 22-09 `CHAT_ACTIONS_OK`, 22-10 `CHAT_CALENDAR_OK`; `chat-web.mjs composer`, `calendar` не запускались |
| SC3 Undo и обновление экранов без перезагрузки | api: PASS; браузер: UNVERIFIED | 22-09 `CHAT_ACTIONS_OK`, 22-06 `CHAT_NOTES_OK`, 22-07 `CHAT_COMMENTS_OK`; `chat-web.mjs actions` (Today во второй вкладке) не запускался |
| SC4 ответы из данных, числа равны Today и Students | api: PASS; живая модель: сессия владельца | 22-04 `CHAT_RECORDS_OK`, 22-14 `CHAT_ANSWERS_OK`, 22-13 удержание предложений с числами |
| SC5 расход по разговору и месячный предел | api: PASS; живой `usage`: сессия владельца | 22-12 `CHAT_BUDGET_OK`, 22-13 `CHAT_RUNS_OK`, 22-15 `CHAT_MODELS_OK` |
| CHAT-01 | PASS (api) | 22-05, 22-16 |
| CHAT-02 | PASS (api) | 22-08 |
| CHAT-03 | PASS (api) | 22-08, 22-09, 22-10, 22-01, 22-18 |
| CHAT-04 | PASS (api) | 22-06, 22-07, 22-09, 22-03 |
| CHAT-07 | PASS (api), модель — владелец | 22-04, 22-14 |
| CHAT-08 | PASS (api) | 22-04, 22-13, 22-14 |
| CHAT-09 | PASS (api), браузер и Caddy на сервере — владелец и Server guy | 22-13, `dvlab:data-changed`; Caddy в этом плане |
| CHAT-11 | PASS (api) | 22-12, 22-13, 22-15 |

## Сессия владельца

- `yarn test:e2e` на dev-стеке в обеих темах. Условие: в `dvlab_dev` нет подключения Google в состоянии `connected`, либо это тестовый аккаунт владельца; иначе `E2E_FIXTURE_DATABASE=test` и dev-стек на `.env.test`. Известные падения по 22-02: сценарии с кнопкой Move series и полями `#move-series-*` диалога, удалённого в 25.1 (`changeSeries`, `cutSeriesToWednesday`, `calendar-series-ui.ts`, `tz-schedule.ts` `crossZoneTail`, `tz-stale-forms.ts`, `marks.spec.ts` `blockedDialog`/`pendingDialogMark`/`clockPermissions`, `move.spec.ts` `restoredTail`/`staleEmptySeries`/`movedFallback`).
- Браузерные разделы `chat-web.mjs` в обеих темах: `records`, `conversations`, `notes`, `comments`, `composer`, `actions`, `calendar`, `budget`, `stream`, `answers`, `models`, `delete`; затем `wait-dev.mjs down`.
- Живой вопрос модели с ключом владельца локально: поток, Stop reply, перезагрузка во время ответа; расход по `usage` в Settings → Assistant.
- Перенос и отмена урока из чата с записью в Google только на тестовом аккаунте (25.1 D-11).
- Server guy: выкатка с миграциями фазы, перезагрузка Caddy и проверка потока без `Content-Encoding` на сервере (RUNBOOK 14.3).

## Для выката (Server guy)

Миграции фазы (этап `migrate`, под `dvlab_migrator`): `20261013113547_lesson_mark_revision`, `20261013123301_chat_conversations`, `20261013123305_chat_conversations_revoke_delete`, `20261013124933_chat_entries`, `20261013124936_chat_entries_revoke_delete`, `20261013130032_chat_settings`, `20261013135713_chat_messages_actions`, `20261013135720_chat_messages_actions_revoke_delete`, `20261013161230_chat_budget`, `20261013161237_chat_budget_revoke_delete`, `20261013163655_chat_turns`, `20261013163659_chat_turns_revoke_delete`, `20261013181712_chat_messages_redacted_body`. Переменная `ANTHROPIC_API_KEY` в файле окружения api (уже на сервере, `env_file` подхватывает). Caddy перезагружает `deploy.sh`; проверка потока — RUNBOOK 14.3, права — 14.4.

## Deviations from Plan

1. **[Rule 2 - безопасность проверок] `ANTHROPIC_*` не передаются проверкам.** В оболочке задан `ANTHROPIC_BASE_URL`; все запуски api в проверках наследуют `process.env`, SDK взял бы этот адрес и обошёл заглушку `api.anthropic.com`. `chat-final.mjs` убирает `ANTHROPIC_*`, `DATABASE_URL` и `MIGRATOR_DATABASE_URL` из окружения дочерних процессов; `yarn build` и `yarn test` шли через `env -u ANTHROPIC_BASE_URL`. Коммит 930c4a9.
2. **Caddy: `path_regexp` вместо `not path /api/chat/turns/*/stream`.** Взят вариант 22-SERVER-PREP, проверенный на caddy 2.11.7; путь потока `/chat` + `/turns/:id/stream` за префиксом `/api` совпадает с `^/api/chat/turns/[^/]+/stream$`. Коммит e33a784.
3. **`schedule-comments-series.mjs` в `chat-final.mjs`.** В списке плана его нет, но это проверка фазы (22-07), а must-have требует всех проверок одной командой.
4. **Порты ниже 4200.** Задание разрешало порты проверок от 4200; `calendar-reads.mjs` (4103) и `calendar-final.mjs` (4103, 4106, 4109, 4111, 4190–4199) план требует запускать, их порты зашиты в скриптах. Порты были свободны, `startCalendarApi` отказывает на занятом порту; 3000 и 4000 не трогались.
5. **e2e и браузерные разделы не запускались.** Стенд владельца на 3000 и 4000 (процессы из этого worktree); задание запрещает проверки на этих портах. Записано в `.planning/WINDOWS.md` (запись 14, `unrun-verify`), файл остался в рабочем дереве.
6. **Упрощение кода — только обзор.** Повторяющихся функций в `apps/api/src/chat`, `routes/chat.ts`, `cards/notes.ts`, `schedule/comments.ts` нет (единственное совпадение имён `clarify` — разные функции); knip чист. `apps/web` не открывался: его правит параллельный UI-исполнитель.
7. **Трейлер коммитов** `Claude Sonnet 5.5` по заданию; план исполняла модель Opus 5.5.

## Известные долги

- 22-14: окно 00:00–02:00 в `lesson-target.ts` исправлено другой сессией коммитом 5916256 до прогона `chat-final.mjs`. Коммит 6eec690 (`chat/tools.ts`) и правки `chat-runs.mjs` пришли после прогона: перед PR `chat-final.mjs` нужно прогнать на итоговом HEAD.
- 22-15: дата цен «as of 12 Oct 2026» зашита статично.
- 22-16: Undo применённого действия по id после удаления разговора технически возможен (из интерфейса недоступен).
- Порядок уборки фикстур чата и запрет параллели `models`/`delete`/`budget`/`chat-config.mjs` записаны в README.

## Known Stubs

Нет.

## Threat Flags

Нет: новых маршрутов нет; Caddyfile меняет только сжатие одного пути (T-22-48).

## Self-Check: PASSED

`scripts/dev-checks/chat-final.mjs` на месте; коммиты e33a784 и 930c4a9 найдены; `grep` находит `apps/api/src/chat` и `restoreMarkAfterMove` в AGENTS.md, `ANTHROPIC_API_KEY` в RUNBOOK, `@compressible` в Caddyfile.
