# UI-SPEC Review — Phase 23

## UI-SPEC VERIFIED

**Фаза:** 23 — Confirmed Chat Changes and Entry Points.
**Статус:** APPROVED.
**Блокирующих замечаний:** 0. B01/B02 — RESOLVED.
**Дата:** 2026-10-12, Asia/Ho_Chi_Minh.
**Authoritative source SHA-256:** `64015672b8296c849464357a54de63e5d398a39b361a39c7dc7b1faf6610d234`.

## Scope Card

| Поле         | Контракт проверки                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Outcome      | Bounded native recheck только B01/B02; current APPROVED/BLOCKED и семь verdicts с proof reuse                                                                                        |
| In scope     | P09 error/recovery и safe current target; ровно четыре Phase23 content sizes; связь с прежними SC1/SC5/F03/F05/F08/E03/E07/E09/E11                                                   |
| Out of scope | Fresh full UI/architecture/source audit, external home writes, pixel/token/spec edits, runtime/browser/provider/deps/DB/env/Git/agents/shared metadata/deletion; завершённая Phase22 |
| Write set    | Только `.planning/phases/23-confirmed-chat-changes-and-entry-points/23-UI-CHECK.md`                                                                                                  |
| Acceptance   | Original raw B01/B02 unchanged, два concrete dispositions, current hashes, seven verdicts, exact bounded doc/format checks                                                           |
| Verification | Статическая проверка changed properties/критических boundaries; прежние Visuals/Color/Spacing flags и прочие proofs переиспользованы. Public E2E/actual delivery NOT RUN             |
| Work map     | P09/current target закрывает B01; four content roles/shared shell inheritance закрывают B02; root-pin/hash/doc/format закрывают артефакт                                             |
| Stop         | Этот отчёт записан и проверен; parent владеет corrections, bindings, UI consideration probe и native planning gate                                                                   |

A1 — final22/24/25 source/types/model/budget/Google seams PROPOSED и требуют execution rebind; основание — CONTEXT D-01/A1, UI-SPEC:29,284,342 и текущее задание. Это не наблюдаемая ошибка current implementation. A2 — actual provider/model/cap/payment DELETE grants/phone keyboard не наблюдались; основание — UI-SPEC:33,342 и исключения задачи. Static evidence не заменяет runtime proof.

Первичный workflow — typed gsd-ui-checker, выбранный через ранее прочитанный work-router с адаптером без побочных действий. Native role fingerprint неизменен. AGENTS, EXECUTOR-RULES и config имеют прежние fingerprints: их действующие правила переиспользованы без повторного чтения. Local `.runtime/skills`/`.agents/skills` отсутствуют; config не содержит agent_skills и не отключает workflow.ui_safety_gate. Разрешение написать один отчёт — явное исключение текущего задания из read-only/no-file-creation native роли. UI-SPEC не изменяется.

## Dimension Results

Dimensions1/4 — current bounded recheck. Dimensions2/3/5/6/7 и ссылки в их notes — baseline proof reuse; полного повторного audit нет.

| Dimension               | Verdict | Доказательство                                                                                                                                                                                                                                                                                          |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Copywriting           | PASS    | Current P09:234 содержит explicit recovery и Open record; :126/173/248 сохраняют target/operation/read boundaries. B01 RESOLVED.                                                                                                                                                                        |
| 2 Visuals / composition | FLAG    | :72–84,146,181,189–216,261–267 задают структуру и responsive/focus/status hierarchy. Один главный visual anchor для /chat с proposal явно не назван; это неблокирующая recommendation.                                                                                                                  |
| 3 Color                 | FLAG    | :76–82,214 наследуют surfaces/active/hover/primary/link/focus-ring v40; status имеет words/icon. Principles:67 резервирует единственный chromatic accent для link; Google/status hues семантические. Split60/30/10 явно не записан. Destructive token есть в принятой системе.                          |
| 4 Typography            | PASS    | Current :82/84 объявляют title16/body13/caption12/micro11 — ровно четыре content sizes; shared AppShell inherited отдельно. B02 RESOLVED; pixels/tokens не меняются.                                                                                                                                    |
| 5 Spacing               | FLAG    | :76–79 наследуют padding16/gap12, padding8×12 и gaps16/8; :210 — gutters16. 12px/прочие inherited exceptions approved v40 не становятся новым BLOCK по заданию. Полная spacing scale явно не сведена. 44px hit area, shell/menu widths, line-height, radius и motion offsets не являются spacing scale. |
| 6 Registry Safety       | PASS    | :68: inherited manual Base UI/variant A v40, no new third-party block/registry install/Radix/cmdk/dependency. Registry gate включён; дополнительное vetting не требуется при отсутствии нового registry input.                                                                                          |
| 7 Inventory Provenance  | PASS    | :57–66 — D1–D8 phase reuse/adaptation, :282–297 — semantic owners/proposed symbols, не перечень доступных DS exports. Inventory доступных компонентов/closed allowlist не объявлен. Enumeration command не запускался.                                                                                  |

## Исходные B01/B02 — raw evidence, оба RESOLVED

Следующие исходные записи сохранены без изменения и относятся только к baseline source SHA `8bbea43e3f12a2cea565a2f9fdc42ed7561453578d05936a61b4c65a6cd9ff2f`. Их BLOCK/line references не являются current dispositions. Actual corrections ниже оцениваются по required properties, а не буквальному fix hint.

### B01 — Dimension 1: отдельный unsupported-record error требует recovery path

- **Required property:** каждый error state содержит понятный безопасный следующий шаг. Native Dimension1 BLOCK при error copy без solution path.
- **Actual evidence:** UI-SPEC:232, P09, отдельная строка copy `This record cannot be removed in chat.` заканчивается отказом. В этой же строке `Review archive` связан с permanent student deletion; :124 явно делает archive отдельным proposal только для student. Он не может автоматически считаться next step для payment/note/comment/Calendar record. :120–121 различают эти targets, :171/246 имеют безопасные normal links, но не связывают их с этим P09 fallback. :257 связывает recovery P12/P14/P19/P20/P25/P26, не P09 fallback.
- **Связь с acceptance:** SC1/CHAT-05, F03/F08, D2. В unsupported deletion path не закрыт пользовательский failure contract для точного target; этот finding не утверждает, что backend уже ошибочно удаляет данные.
- **Expected observable outcome:** unsupported removal оставляет business data/IDs/history/account unchanged. Пользователь видит точный target и может открыть допустимый current read view или выбрать поддерживаемую операцию. Note/payment/lesson refusal не предлагает архивировать student как замену. Никаких автоматических Send, Confirm, retraction, archive, account deactivation или physical deletion.
- **Минимальная коррекция, пример, не обязательный механизм:** связать этот fallback с существующим safe normal target из §8/P23 и добавить действие/фразу вроде `Open this record to review the available actions.` Target-specific wording и link берутся из подтверждённого read target. Для permanent student deletion сохраняется уже описанный distinct `Review archive` → новая preview → отдельная decision. Любой механизм, достигающий свойства без расширения операций, подходит.
- **Proposed owner/public operation:** F03 (:290), api/chat/card-intents.ts и existing cards/final22 retraction/final24 owners; F08 (:295) allowlist/source spans; web proposal-card/messages и receipt navigation. prepareProposal/readProposal (:288) сохраняют actor/target scope; hint не вводит нового delete tool.
- **E-case:** E03 (:307) различает archive/delete/account и unsupported target; E11 (:315) проверяет safe refusal/no bypass; E07 (:311) проверяет current safe view. Это дополнение к существующим durable journeys, не новая suite. NOT RUN.

### B02 — Dimension 4: локальная декларация содержит пять font sizes

- **Required property:** Phase23 typography contract объявляет не более четырёх font sizes. Native Dimension4 BLOCK при более четырёх.
- **Actual evidence:** UI-SPEC:82 — `Existing app-scale: display22, title16/22 weight600, body13/20, caption12/16, micro11/14`. Пять distinct font sizes — 22,16,13,12,11. 22px после slash в title16/22 — line-height, не шестой размер. :81 отдельно использует heading16/body13/caption12; :209 использует micro. Ошибка — новая явная локальная декларация сверх native limit, не неправильный v40 token.
- **Source boundary:** tokens.css:294–299 действительно определяет `.app-scale` display22; AppShell README требует app-scale root. Общие approved v40 files не меняются. Шкала registry/system целиком не считается новой Phase23 inventory и не проверяется на redesign; этот BLOCK относится к строке :82 в текущем контракте.
- **Связь с acceptance:** SC5/D1/D5/D7/D8 — исполнимый declared typography contract поверх approved components. Это конкретное native ограничение, не предпочтение reviewer и не claim о runtime appearance.
- **Expected observable outcome:** четыре локальных Phase23 роли имеют однозначные размеры и line-height; shared AppShell сохраняет approved v40. Executor не получает поручения вводить отдельную пятую локальную ступень или менять DS tokens.
- **Минимальная коррекция, пример, не обязательный механизм:** если display здесь только shared shell inheritance, не объявлять его дополнительным локальным Phase23 size; определить четыре content roles title16/body13/caption12/micro11 и отдельно сослаться на неизменный AppShell. Если display нужен именно новому Phase23 content, убрать redundant local role по утверждённому design source. Hint не требует менять пиксели существующих компонентов, уменьшать шрифт или переписывать v40.
- **Proposed owner:** Design dude владеет строкой typography UI-SPEC; будущие web proposal-card/essay-feedback/profile/agenda owners F09 (:296) используют approved primitives. Public domain signatures не меняются.
- **E-case:** E09 (:313) — long text/amount/model/title, phone/themes/focus; doccheck проверяет число локальных объявленных sizes. Runtime/E2E NOT RUN; исправление не требует нового тестового окружения.

## Bounded recheck — dispositions

### B01 — RESOLVED

- **Current evidence:** P09:234: `This record cannot be removed in chat. Review its available actions in the existing screen.` / `Open record`. Error теперь содержит next step, не обещание удаления или mutation retry.
- **Critical scope:** :126 сохраняет distinct permanent-student refusal → Review archive → новая archive preview/decision; account deactivation отдельна, physical schedule/history removal исключено. :173 связывает navigation только с server-known normal targets, требует current identity/eligibility revalidation и P23 safe list/profile route при gone/changed target. P23:248 сохраняет этот recovery. Open record допустим только для актуально разрешённого teacher object; без fresh resolved target speculative record action не показывается/не исполняется. Эта граница использует existing D3/F05 logic и текущую инструкцию parent, не новый delete operation.
- **Observable outcome:** безопасный просмотр точного record/доступных операций; zero automatic Send/Confirm/delete/archive/retraction. Refusal note/payment/lesson не превращается в archive student. Existing confirmation, immutable payload/digest/target versions и Decline boundaries не изменены.
- **Owner/E-case:** current F03:292, F05:294 и F08:297; existing card-intents/proposal-card/messages и typed normal navigation. prepareProposal/readProposal F01:290 остаются PROPOSED. Existing E03:309, E07:313 и E11:317 проверяют exact target, safe ordinary view и refusal/no bypass; их declared scope не менялся. NOT RUN.
- **Disposition:** конкретное исправление required property, не обещание исправить при implementation. Formatter не изменил английскую copy.

### B02 — RESOLVED

- **Current evidence:** :82: `Phase23 content roles: title16/22 weight600, body13/20, caption12/16, micro11/14`. Ровно четыре distinct font sizes — 16/13/12/11. 22/20/16/14 после slash — line-height, не дополнительные sizes.
- **Scope boundary:** :84 явно оставляет existing AppShell app-scale у shared shell и не вводит пятую локальную display-role. Micro11 retained, в том числе second-zone helper. Approved v40 pixels/tokens/компоненты не изменены; это уточнение декларации local content scope.
- **Observable outcome:** новые Phase23 content surfaces используют четыре named roles; inherited shell heading остаётся у прежнего owner. No redesign/global font restriction.
- **Owner/E-case:** parent-owned ROOT UI-SPEC correction; будущие F09:298 web owners сохраняют approved primitives/public signatures. E09:315 остаётся прежним long text/phone/themes scenario. Runtime/E2E NOT RUN.
- **Disposition:** required max-four property доказано текущим текстом, с независимым shared inheritance; исходный raw finding сохранён.

## Recommendations — неблокирующие

- **Dimension2:** явно назвать главный visual anchor в proposal screen: точная текущая preview с decision под ней. Сохранить объявленные card/scroll/focus rules; eyebrow не добавлять.
- **Dimension3:** кратко обозначить inherited accent reservation и ориентир60/30/10. Не перекрашивать v40, semantic status или Google colours.
- **Dimension5:** указать используемую spacing scale и явное approved inheritance/исключения; не нормализовать уже утверждённые 12px/прочие component paddings.

`Save disabled` в :196 — shorthand состояния ordinary payment form, не новая declared button label: P21:244 и PaymentDialog задают `Save payment`. Он не превращён в отдельный generic CTA finding. Новые decisions `Save rate`, `Keep rate`, `Record payment`, `Move lessons` конкретны. `Cancel lesson` — verb+noun, не запрещённый generic `Cancel`. Global v40 label replacement не требуется (:276).

## SC / F / D binding — baseline proof reuse

Следующие таблица/notes и их line numbers сохранены как baseline evidence; прежние B01/B02 references относятся к исходному snapshot. Current dispositions выше закрывают оба findings. Остальные claims, declared11 E2Es и PROPOSED final24/25/22 gates не перепроверяются и не меняются.

| Criterion                  | Actual spec evidence / bound owner                                                                                                                                                                                                                          | Observable failure proof                                                                                                                                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SC1 / CHAT-05              | :88–109,115–130; F01–03/F08; D1/D2. Actor/account/conversation/current revision/digest, frozen payload/targets/versions; same decision identity/one winner, metadata only before decision, local effect+receipt atomic                                      | E01–03/E11: Decline zero business writes; stale/race/replay не повторяет payment/card и не использует model/free-text yes как authority. B01 ограничен unsupported error recovery.                                                                                       |
| SC2 / CHAT-06              | :134–161; F04; D4. MSK=Europe/Moscow; omission=Asia/Ho_Chi_Minh независимо от display/creation zone; server complete seal/membership/versions/exclusions/open-ended rules. Fresh whole-plan validation before first provider write; serial same24 writer    | E05/E06: no guessed count/one-week scope/browser recurrence; fold/gap policy observable. Confirmed prefix retained, unresolved child reads original journal; changed remainder требует новую explicit decision. Нет full Saved, clone, compensation или implicit replay. |
| SC3 / CHAT-12              | :165–173; F02/F05/F07; D3/D7. Payment edit sameID/source/student binding/core; narrow setCardRate, full card CAS, numeric revisions; current typed receipt routes                                                                                           | E04/E07: no delete-recreate/stale unrelated fields/double credit; draft не перезаписывается refresh; changed/gone target gets current safe view. Shared invalidation перечитывает actual facts в открытых экранах, не только router.refresh.                             |
| SC4 / CHAT-10              | :177–185; F06/F08; D5. Fixed server approximate label before first token и после reload; read-only registry, final22 model/usage/budget, finite limits. Qualitative default/unassessed task; optional numeric bands unavailable до validated rules/evidence | E10/E11: no official IELTS26 result/new entity/fabricated score/provider credit/cap; malformed/refused/truncated stays incomplete. Essay injection не создаёт proposal/write. Next question требует отдельный admitted Send.                                             |
| SC5 / SHELL-03/04, CARD-05 | :189–216,261–267; F07; D6–D8. Palette Actions→Students→Screens, exact IDs/current eligible async options; New chat/Add payment; profile Lessons/Payments/Ask exact draft without Send; one overlay/ordinary forms                                           | E07–09: IME/obsolete options/error vs empty; no private content in URL; stable opener/focus. 320/375px keyboard/dvh/touch/scroll/agenda/themes/reduced motion доступны по design contract, actual browser evidence required. B02 ограничен typography declaration.       |

F01–F10 явно bound в :288–297; D1–D8 — :59–66; E01–E11 — :305–315. Research Standard Stack:122–135 совпадает с Base UI и existing22 SDK boundary; new deps не предлагаются. Source/proposed distinction :284 и final rebind :342 честны.

Archive сохраняет stable student ID, history, account access; account deactivation отдельна. Delete payment — конкретная payment row, note/comment retraction — собственный eligible22 entry/version; Calendar cancel/end сохраняет rows/history. Permanent physical student/history deletion unsupported. New card не создаёт login. Эти различные targets/effects не объединены в один destructive tool (:115–124).

D1 заменяет mock Git/document receipt и countdown на domain receipt; D3 явно исключает lab delete-and-record-again; D4 не копирует unconditional cancelled reset или sample timezone как authority; D5 исключает mock bands. Названия/суммы/цены mock previews не переносятся в продукт. Поздние research gaps «no23 UI-SPEC yet»/pending22 B1/B2 описывают прежний snapshot, не current failure: current23 root hash принят, Phase22 завершена. Это не повод изменять research или повторять old22 audit.

Designer сообщил 51links/12fps/51semantic checks exit0. Это upstream document evidence; reviewer не выдаёт эти counts за свой runtime/visual test. Functional browser/provider/DB/Google/model/phone/Production — **NOT RUN**. New provider/model/cap/Google seams остаются PROPOSED/final execution gates, не дополнительные blockers. Ни один verdict не означает готовность source к human code review.

## Baseline fingerprints — SHA-256

ROOT: `~/.claude/worktrees/phase-24-google-calendar-preparation/dv-lab`. Эта таблица сохраняет baseline fingerprints первоначальной проверки; current recheck inputs записаны отдельно ниже. ROADMAP23 scope включает heading до следующего Phase heading; REQ7 — семь исходных requirement lines в file order, joined LF без final newline и table rows.

| Вход                                | SHA-256                                                          |
| ----------------------------------- | ---------------------------------------------------------------- |
| ROOT23 UI-SPEC                      | 8bbea43e3f12a2cea565a2f9fdc42ed7561453578d05936a61b4c65a6cd9ff2f |
| ROOT23 RESEARCH                     | f73f6553f9998bc19b45c53e63d190f18f7f19bc6e19e17bdddde62a2184aae1 |
| ROOT23 CONTEXT                      | bb571e0e3d95e375c9c45b264eb34046be6314f500596ededf019d5efdb0d115 |
| ROADMAP23 scoped section            | 017ea958f1fc16cfdd66b55cc76d86eed8bb117acb46a9e82558a8dee80d66e7 |
| REQ7 original lines                 | 53b4e2d73e267d37c7ad78a20cb210e330f7a498ee23e96f7ddd5a0a852a2713 |
| AGENTS.md, unchanged                | fbef0e319fe49ffb5ab0067e8feac8093172f958b0a70808ff5a376bbb72c9be |
| EXECUTOR-RULES.md, unchanged        | 1eca1fa30e110bd04658cbf885d1b2189ce854f3cd3ed49664194f6121cbd449 |
| config.json, unchanged              | 96efe8c9224af4dcd6883de8104787005a34d274a90a0561526d3cc7dc6ac068 |
| Native gsd-ui-checker.md, unchanged | 7f3c9ac062ee37dcb2049f989ff093aedcce675775400434ca145518f8a5126a |
| Design tokens.css, current v40      | 9de5ec97cdd57274454b44112d43d8059ee7cc22384fe4f672c70d6aa360cfcf |

Final report SHA возвращается после formatting в stdout/final. Self-hash внутри файла не записывается. Source/spec/research/context и Phase22 не изменены checker.

## Current recheck fingerprints — SHA-256

| Вход                         | SHA-256                                                          |
| ---------------------------- | ---------------------------------------------------------------- |
| Authoritative ROOT23 UI-SPEC | 64015672b8296c849464357a54de63e5d398a39b361a39c7dc7b1faf6610d234 |
| ROOT23 RESEARCH, unchanged   | f73f6553f9998bc19b45c53e63d190f18f7f19bc6e19e17bdddde62a2184aae1 |
| ROOT23 CONTEXT, unchanged    | bb571e0e3d95e375c9c45b264eb34046be6314f500596ededf019d5efdb0d115 |
| 23-UI-CHECK до recheck       | bc507fcbaf642a56ff78c0025b3508be551c616151c45fd345fd2d55148c4395 |

Full raw B01/B02 block preservation SHA-256: `146058f09e84af90aca7c46dbfc48ea54ee38a18ec46124062934fadf2fce12f`. Этот hash вычислен из исходного блока до edit и повторно проверен после edit/format. Final report self-hash возвращается только в stdout/final.

## Exact checks / structured return

- `bash scripts/gsd/root-pin.sh ~/.claude/worktrees/phase-24-google-calendar-preparation/dv-lab` — exit0, `ROOT_PIN_OK`, выполнено до создания отчёта.
- Input fingerprints — Python stdlib pathlib/hashlib, exit0; source/research/context/ROADMAP23/REQ7 совпали с current contract. Это document proof.
- Report format/doc/hash checks выполняются только для owned report/current23 inputs; фактические exit и короткий decisive output возвращаются родителю. Application tests не запускались.

Точные минимальные rerun commands из ROOT:

```sh
yarn prettier --check .planning/phases/23-confirmed-chat-changes-and-entry-points/23-UI-CHECK.md
python3 -c 'from pathlib import Path; import re; s=Path(".planning/phases/23-confirmed-chat-changes-and-entry-points/23-UI-CHECK.md").read_text(); rows=re.findall(r"^\|\s+([1-7]) .*?\|\s+(PASS|FLAG|BLOCK)\s+\|",s,re.M); assert rows==list(zip("1234567",["PASS","FLAG","FLAG","PASS","FLAG","PASS","PASS"])); assert "**Статус:** APPROVED" in s; assert all(x in s for x in ["### B01 — RESOLVED","### B02 — RESOLVED","NOT RUN"]); print("DOC_CHECK_OK dimensions=7 resolved=2")'
shasum -a 256 .planning/phases/23-confirmed-chat-changes-and-entry-points/{23-UI-SPEC.md,23-RESEARCH.md,23-CONTEXT.md,23-UI-CHECK.md}
```

**Ready for Planning:** UI-SPEC APPROVED; B01/B02 RESOLVED. Прежние Visuals/Color/Spacing flags неблокирующие, proof reuse выполнен. Parent выполняет post-approval probe23 и native planning gate. Checker не меняет UI-SPEC/source/external home/другие документы и не добавляет approval вопрос. Structured return для parent: status approved, reviewed_at 2026-10-12; actual writer назначает точный timestamp. Final24/25/22 model/budget/Google types/SDK/provider/runtime gates остаются PROPOSED/UNVERIFIED, это не functional PASS.
