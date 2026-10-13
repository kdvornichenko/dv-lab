---
phase: 22-chat-with-mentions-and-quick-marks
plan: '02'
status: complete
verification: blocked
subsystem: web
tags: [schedule, today, lesson-dialog, move-form, scope-dialog, drag, optimistic-write, allfrom, no-show, done]

requires:
  - phase: 22-01
    provides: 'binding.mark в окне недели, правило: Done не переносится и не отменяется, снятие no_show при переносе позже текущего момента'
  - phase: 22-18
    provides: 'calendarSeriesContext.allFrom, разрез серии с любой даты не раньше allFrom'
provides:
  - 'lesson-actions.ts: changeableLesson, startedLesson, seriesScopesFor (области по allFrom), writeIssueFor (причина недоступности записи)'
  - 'Schedule: начавшийся урок без Done перетаскивается и переносится, в том числе в прошлое; вопрос области только у вхождения не раньше allFrom'
  - 'Футер урока: строка Done, неактивные кнопки со строкой причины, вторая фраза отмены no_show'
  - 'Today: диалог начавшегося урока с рядом отметок, футером, формой переноса и отменой'
  - 'optimistic-writes.ts: codeRefusal для lesson_done и outside_sync_window'
  - 'scripts/dev-checks/schedule-started-web.mjs: браузерная проверка (не запускалась)'
affects: [22-08, 22-10, 22-14]

actuals:
  tokens: 20193
  tasks: 5
  commits: 5
plan_head_before: f2b5c20
plan_head_after: 5c4a067

key-files:
  created:
    - scripts/dev-checks/schedule-started-web.mjs
  modified:
    - apps/web/lib/lesson-actions.ts
    - apps/web/app/(app)/schedule/_components/schedule-screen.tsx
    - apps/web/app/(app)/schedule/_components/use-lesson-drag.ts
    - apps/web/app/(app)/schedule/_components/lesson-move-form.tsx
    - apps/web/app/(app)/schedule/_components/optimistic-writes.ts
    - apps/web/app/(app)/schedule/_components/calendar-lesson-dialog.tsx
    - apps/web/app/(app)/schedule/_components/scope-dialog.tsx
    - apps/web/app/(app)/schedule/_components/lesson-footer.tsx
    - apps/web/app/(app)/schedule/_components/lesson-dialogs.tsx
    - apps/web/app/(app)/schedule/_components/lesson-dialog.tsx
    - scripts/dev-checks/calendar-web-drag.mjs
    - scripts/dev-checks/calendar-web-editor.mjs
    - scripts/dev-checks/README.md
    - e2e/move.spec.ts
    - e2e/no-show.spec.ts
    - e2e/support/tz-schedule.ts

key-decisions:
  - 'Web решает только вид: «урок начался» и строка no_show считаются через canChange из core, границу серии берёт из allFrom api; решение о переносе принимает api'
  - 'Область переноса вхождения: ["one","following","all"] только при originalOn >= allFrom (строки одной зоны серии), иначе один урок без вопроса'
  - 'Отмена начавшегося вхождения серии и одиночного урока: вопрос футера без ScopeDialog'
  - 'Причину недоступности записи собирает writeIssueFor (запись заблокирована, чтение не свежее, команды ждут, editBlock, нет события), текст берётся из READ_ISSUES'

requirements-completed: [CHAT-03]

duration: ~4h
completed: 2026-10-13
---

# Phase 22 Plan 02: Начавшийся урок в Schedule и Today Summary

Начавшийся урок без Done переносится и отменяется из Schedule (в том числе броском мыши в прошлое) и из Today, Done показывает строку вместо кнопок, «All lessons» режет серию с `allFrom`, вопрос области задаётся только там, где разрез его выполнит. Код написан, typecheck и lint чистые; браузерная проверка и e2e не запускались (см. «Не проверено»).

## Дизайн

Версия дизайна в `~/dv-lab-design/VERSION`: v65 (план называл v63; тексты v63 в v65 не менялись). Реализованные отличия от прежнего поведения: строка Done вместо Move lesson и Cancel lesson; неактивные кнопки со строкой причины над ними при недоступной неделе; три строки судьбы `no_show` под превью формы; строка «This lesson moves alone…»; область переноса от `allFrom`; вопрос отмены начавшегося урока без строк ScopeDialog; строка под группой ScopeDialog «Lessons with a mark or a comment, and the lessons before them, stay at their old time.». Фраза отказа `lesson_done` («This lesson is marked Done, so it stays where it is.») взята из ChatNotices (в OptimisticWrite v61 причины для этого кода нет).

## Задачи и коммиты

| Задача | Что сделано | Коммит |
| ------ | ----------- | ------ |
| 1 | `changeableLesson`, `startedLesson`, `seriesScopesFor`, `writeIssueFor` в `lesson-actions.ts`; `canMove` без условия времени; бросок в прошедший слот; форма переноса: вопрос по `scopes.length > 1`, строки `no_show` и «moves alone», проп `openingOn`; `codeRefusal` для `lesson_done` и `outside_sync_window` | f8a8315 |
| 2 | `calendar-lesson-dialog.tsx`: Move и Cancel по `changeableLesson`, области по `allFrom`, `seriesMoveBody` и `movedBlocks` с `allFrom` вместо `nextSeriesDate`, фраза отказа по коду; `lesson-footer.tsx`: строка Done, строка причины, вторая фраза no_show; текст `scope-dialog.tsx` | 219848f |
| 3 | Today: `lesson-dialogs.tsx` находит событие начавшегося урока в окне Today или читает неделю урока (`useStartedWeek`); `lesson-dialog.tsx` получает футер, форму переноса (`scopes=['one']`, `openingOn`), отмену и возврат через `useScheduleMutation` | 8ff9fb5 |
| 4 | `schedule-started-web.mjs`, ожидания `calendar-web-drag.mjs` (начавшийся урок: курсор grab и рамка, Esc ничего не шлёт; текст ScopeDialog) и `calendar-web-editor.mjs` (текст ScopeDialog), строка README | 5c4a067 |
| 5 | Ожидания e2e: см. ниже | 9636b1e |

`commits: 5` — измерено по `git log --grep "(22-02)"`; `rev-list` от `plan_head_before` даёт больше, потому что коммиты 22-03 лежат на той же ветке. Коммит `docs(22-02)` с этим SUMMARY в счёт не входит.

## Что проверено

- `yarn workspace @dv-lab/web typecheck` и `yarn workspace @dv-lab/web lint` — без ошибок после каждой задачи; `yarn prettier --check` по изменённым файлам — чисто.
- `node --check` всех трёх браузерных сценариев; запуск `schedule-started-web.mjs light` дошёл до проверки портов и остановился без побочных действий (порты заняты, см. ниже).
- `yarn playwright test --list` — 228 тестов в 10 файлах, спеки разбираются.

## Не проверено

Браузерная проверка в обеих темах не выполнена, потому что она невозможна в текущем состоянии стенда. Нужно решение ведущей сессии.

1. **Порты 3000 и 4000 заняты чужим стеком.** `yarn workspace @dv-lab/api dev` и `yarn workspace @dv-lab/web dev` запущены с 18:44 из этого же worktree (pid оболочек yarn 56657 и 56659, `next dev` 57812), на порт 3000 идёт соединение `ngrok`, а в `apps/web/next.config.ts` лежит неотправленная правка `allowedDevOrigins` с адресом ngrok. Это живой стенд владельца; я его не трогал, `next.config.ts` не восстанавливал и не коммитил. `wait-dev.mjs down` из-за этого красный.
2. **Сид отказывает на `dvlab_dev`.** `calendar-seed.mjs up dev` (его вызывают `calendar-web-drag.mjs` через `calendar-commands.mjs fixtures dev`, `calendar-web-editor.mjs` и мой сценарий) падает с «teacher already has a current Google connection that is not synthetic»: в `dvlab_dev` есть действующее подключение `connected` с адресом владельца, создано 2026-10-12 (стенд 25.1). Отключать его я не вправе.
3. Запасной путь, который я заложил: `schedule-started-web.mjs light|dark test` берёт `dvlab_test` (фикстурный учитель, сид `up test`). Он не запускался: `dvlab_test` занят проверками 22-03 (его `docs(22-03)` ещё не было), а порты заняты.

Поэтому не запускались: `schedule-started-web.mjs light` и `dark`, `calendar-web-drag.mjs light`, `calendar-web-editor.mjs light`, `wait-dev.mjs down` как зелёная проверка. Весь новый UI (Schedule и Today, обе темы) не открывался в браузере; проверка — вручную или этими скриптами после того, как владелец остановит стенд и либо отключит свою связь в `dvlab_dev`, либо будет выбрана база `test`. Сценарий `schedule-started-web.mjs` написан по образцу существующих, но ни разу не доходил до браузера: возможны правки селекторов при первом прогоне (особенно Today и вопрос «outside_sync_window» для недели вне диапазона: текст причины может оказаться `history_only` или `provider_unavailable`, сценарий печатает найденную строку).

`yarn test:e2e` не запускался: условие задачи 5 не подтверждено (подключение в `dvlab_dev` настоящее, назвать его тестовым аккаунтом я не могу), `E2E_FIXTURE_DATABASE=test` в этой волне не подходит.

## Правки e2e (задача 5, статические, без прогона)

- `e2e/move.spec.ts`: сценарий «a marked started lesson moves with its mark» заменён на «a Done started lesson stays where it is until the mark is cleared»: у Done нет Move lesson и Cancel lesson, есть строка Done, после отметки Scheduled кнопка Move lesson активна, остаток возвращается.
- `e2e/support/tz-schedule.ts` (`markedPastMove`, вызывается `marks.spec.ts` «E05 E10 D-17…»): отметка `done` заменена на `no_show` (Done теперь отказывает `lesson_done`; No-show остаётся при переносе на прошлое начало, вычет тот же, `no_show_deducts` по умолчанию true).
- `e2e/no-show.spec.ts` «cancelled marked lesson deducts nothing until restored»: отметка `done` заменена на `no_show`, ожидания отметки соответствуют.
- `e2e/marks.spec.ts`, `e2e/support/ui.ts` не менялись.

Не чинил (перечень для ведущей сессии):

- Сценарии, которые ведут кнопку Move series и поля `#move-series-*` диалога, удалённого в 25.1: помощники `changeSeries`, `cutSeriesToWednesday` (`e2e/support/ui.ts`), `e2e/support/calendar-series-ui.ts`, `tz-schedule.ts` (строки 115-116, `crossZoneTail`), `tz-stale-forms.ts`; в `marks.spec.ts` — `blockedDialog`/`pendingDialogMark` и `clockPermissions` (ждут кнопку Move series); в `move.spec.ts` — `restoredTail`, `staleEmptySeries` и `movedFallback`, все внутри исключённого сценария «a moved series occurrence leaves a ghost that deducts nothing» (`move.spec.ts:461`).
- `movedFallback`, `restoredTail`, `pendingDialogMark`, `clockPermissions` отдельно зависят от правила 22-01: они ставят Done и затем переносят вхождение обратно (теперь `lesson_done`). Замена Done на No-show ломает их ожидания «moved» (перенос позже текущего момента снимает отметку), нужна переписка, а не правка.
- Сценарии Google-записи фаз 24 и 25.1 (перенос требует подключения) названы здесь как неизменённые; результат каждого сценария двух файлов не получен, так как прогона не было.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Правки двух e2e-файлов вне `files_modified`**
- **Found during:** Task 5
- **Issue:** `e2e/no-show.spec.ts` и `e2e/support/tz-schedule.ts` не названы в плане, но их ожидания (отмена и перенос Done) ломает `lesson_done` из 22-01.
- **Fix:** замена `done` на `no_show` и соответствующих ожиданий (см. выше).
- **Commit:** 9636b1e

**2. [Rule 3 - Blocking] Режим `test` в браузерном сценарии**
- **Found during:** Task 4
- **Issue:** сид `up dev` отказывает при подключении владельца в `dvlab_dev`, а план называет только `dev`.
- **Fix:** `schedule-started-web.mjs` принимает аргумент `test` (`dvlab_test`, фикстурный учитель, `startCalendarApi` в процессе сценария вместо `calendar-dev-api.mjs`).
- **Commit:** 5c4a067

**3. Проп `openingOn` формы переноса**
- Третья строка судьбы no-show («stays but is not counted… opening balance date») требует даты открытия остатка, которой нет в `CalendarEventView`. Проп `openingOn?: string | null` передаёт только Today (`block.ledger.openingOn`); в Schedule строки нет — как в плане.

**4. Край «All lessons»**
- Если сдвиг дня уводит `first` раньше `allFrom`, `from = allFrom` и `newStartsOn` не отправляется: новая серия начинается с `firstOnOrAfter(allFrom, weekday)`, на неделю позже оптимистичного вида. Это тот же край, что раньше давал зажим к сегодняшней дате.
- Без `allFrom` серийных областей нет (`seriesScopesFor` даёт `['one']`); запасной путь `seriesMoveBody` при `allFrom === null` ведёт себя как «this and following».

**5. Строка «moves alone» только при контексте серии**
- `movesAlone` включается, когда урок — вхождение серии, контекст серии есть и области свелись к `one`. Вхождение без контекста серии (контекст строится api только при свежем чтении и наличии следующего вхождения) переносится одно без пояснения.

## Для следующих планов

- 22-08, 22-10, 22-14: правило видимости действий урока для web — `changeableLesson`, область переноса — `seriesScopesFor`, причина недоступности — `writeIssueFor` и `READ_ISSUES` (все в `apps/web/lib/lesson-actions.ts` и `google-calendar-state.tsx`); фразы отказов по коду — `codeRefusal` в `optimistic-writes.ts`.
- Ведущей сессии: перед браузерной проверкой остановить стенд владельца (или договориться о другой паре портов), выбрать базу (`dev` без подключения владельца или `test` после `docs(22-03)`), затем `node scripts/dev-checks/schedule-started-web.mjs light`, `dark` (и `test` в конце, если база test), `calendar-web-drag.mjs light`, `calendar-web-editor.mjs light`, `wait-dev.mjs down`. Незапущенные проверки нужно внести в журнал `.planning/WINDOWS.md` как `unrun-verify`.
- Today: диалог начавшегося урока читает неделю урока через `controller.readWindow`, если урока нет в окне Today; для недели вне диапазона футер показывает причину из `READ_ISSUES` (или `history_only`, если события нет в свежем окне).

## Known Stubs

Нет.

## Threat Flags

Нет: новых маршрутов, путей входа и доступа к файлам нет; web только предлагает действие, правило проверяет api (T-22-04).

## Self-Check: PASSED

- Файлы: `scripts/dev-checks/schedule-started-web.mjs` и этот SUMMARY на месте.
- Коммиты f8a8315, 219848f, 8ff9fb5, 9636b1e, 5c4a067 есть в истории ветки.
- Оговорка: проверка поведения в браузере и e2e не выполнены (раздел «Не проверено»).
