# UI-SPEC Review — Phase 22

## UI-SPEC VERIFIED

**Фаза:** 22 — Chat with Mentions and Quick Marks.
**Статус:** APPROVED.
**Блокирующих замечаний:** 0. B01/B02 — RESOLVED.
**Дата:** 2026-10-12, Asia/Ho_Chi_Minh.

## Scope Card

Результат — bounded recheck только B01/B02 принятого SC1–SC5/F01–F10. Authoritative input — current ROOT 22-UI-SPEC.md, SHA-256 `eb57f0f35101a3cf7d50c6204dd2914cd4a36775f24f2df83ae9a231c0f17328`. Проверены изменённые labels/focus и recovery, их связь с SC1/SC4, F02/F06/F08 и E01/E08. Остальные dimensions используют прежнее доказательство; Visuals/Color/Spacing flags остаются неблокирующими для approved v40. Единственный файл записи — этот отчёт. Source, main `/Volumes/T7`, shared metadata, чужие edits, Git mutations, runtime/browser/provider/env/dependencies/DB, полный повторный audit и redesign исключены. Новый parent-owned 22-AI-SPEC не проверяется и не изменяется этим recheck.

Критерии приёмки recheck: исходные B01/B02 raw evidence сохранены; оба свойства получили evidence-based disposition; семь verdicts и current fingerprints записаны; scoped doc/format checks завершены. Карта работы: labels/focus закрывают B01; безопасные recovery actions и owner/E08 binding закрывают B02; hash/root-pin/doccheck закрывают воспроизводимость. Stop — отчёт записан и проверен. Прежние предположения сохраняются: A1 — final24/25 types требуют execution rebind по CONTEXT A2; A2 — provider/model/key/credits/finite cap UNVERIFIED по CONTEXT A3. Это execution gates, не новые UI blockers.

Первичный workflow — typed gsd-ui-checker. Work-router применён с адаптером без побочных действий. Разрешение записать этот отчёт — явное исключение текущего задания из read-only/no-file-creation роли; UI-SPEC не изменена. Проектные `.codex/skills` и `.agents/skills` отсутствуют; config не содержит agent_skills. Native семь dimensions: Copywriting, Visuals, Color, Typography, Spacing, Registry Safety, Inventory Provenance. Composition и design safety проверены внутри соответствующих dimensions и SC/F, а не как замена native dimensions.

## Dimension Results

Dimension1 — current recheck. Dimensions2–7 и их ссылки — baseline proof reuse, не новый полный audit.

| Dimension               | Verdict | Доказательство                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 Copywriting           | PASS    | Current UI-SPEC:109,145,154,195–196,205–206,216,220: specific labels и separate safe recovery; B01/B02 RESOLVED. Остальное copy-доказательство переиспользовано.                                                                                                                                                                                       |
| 2 Visuals / composition | FLAG    | UI-SPEC:85–101 задаёт одну conversation column, bubbles, fixed composer, overlay, narrow layout; :215–219 задаёт focus/labels/motion. Явный основной focal point не назван.                                                                                                                                                                            |
| 3 Color                 | FLAG    | UI-SPEC:33,85–99,171 отсылает к принятому v40; principles:67 задаёт neutral palette и единственный link accent. ModelControls запрещает кодировать effort цветом. Новые decorative accents не добавлены. Split 60/30/10 явно не записан. Destructive token существует в принятой системе.                                                              |
| 4 Typography            | PASS    | UI-SPEC:91–99 задаёт body 13/20, caption и наследуемый font-medium; новые размеры/веса сверх принятого v40 не объявлены. Body line-height явный. Общий каталог шрифтов v40 не является новой шкалой Phase22; redesign исключён заданием.                                                                                                               |
| 5 Spacing               | FLAG    | UI-SPEC:92–99 использует существующие space-1/2/3/4; :101 задаёт margins16px. Approved v40 включает padding12px/10px, поэтому эти inherited значения не становятся BLOCK и не заменяются. Полная применяемая spacing scale/исключения явно не сведены в контракте. Размеры popup/chips, радиусы, проценты и motion offsets не считаются spacing scale. |
| 6 Registry Safety       | PASS    | UI-SPEC:87: manual Base UI/variant A v40, без новых third-party blocks. config.workflow.ui_safety_gate отсутствует: gate включён. Fresh shadcn install/view не нужен; Radix/cmdk не предлагаются. SDK legitimacy — отдельный execution/dependency gate, не UI registry.                                                                                |
| 7 Inventory Provenance  | PASS    | UI-SPEC:85 перечисляет компоненты, которые эта фаза намерена переиспользовать. §9 — proposed owners/types, не inventory доступных компонентов design system. Closed allowlist отсутствует; перечисление не ограничивает доступные компоненты v40. Enumeration command не запускался.                                                                   |

## Исходные B01/B02 — raw evidence, оба RESOLVED

Следующие исходные записи сохранены без изменения. Их строки и формулировки относятся к baseline UI-SPEC SHA `e1689b27354a8397101058db691952babb11c1ebf520088b103bb840384e0175`, а не к текущему источнику. Current dispositions приведены после обеих записей. Исходные fix hints остаются необязательными примерами; фактические исправления оцениваются по свойствам.

### B01 — Dimension 1: конкретные CTA

- **Критерий:** native Dimension1 запрещает CTA `Cancel` и `Save`. Свойство — action label однозначно называет действие над объектом.
- **Доказательство:** UI-SPEC:108 — «Rename — labelled TextField, Cancel/Save»; :195 P03 — «Conversation title / Cancel / Save»; :196 P04 — «Cancel / Delete conversation». Это interactive labels, а не status `Saved` из P15. Принятые tokens/геометрия компонентов не отменяют отдельное native copy-правило; CONTEXT не фиксирует эти конкретные rename/delete labels как locked answer.
- **Связь:** SC1/CHAT-01, F03/F08/F09. Native copy-контракт для rename/delete не выполнен; это не finding о runtime correctness.
- **Ожидаемый observable outcome:** rename явно сохраняет название; отказ от rename сохраняет прежнее название; отказ от deletion сохраняет conversation. Visible/accessibility labels называют соответствующее действие; focus возвращается opener, paid Send не запускается.
- **Наименьшая коррекция, пример, не обязательный механизм:** уточнить только copy существующих controls: `Rename conversation`, `Keep current title`, `Keep conversation`. Согласовать §5/P03/P04/focus references, без изменения layout, tokens или confirmation mechanics. Любой вариант, достигающий свойства и сохраняющий locked решения, подходит.
- **Proposed owner/E2E:** F09 web conversation-list/chat-screen и существующий Dialog composition; F03 conversations owner. E01 проверяет rename/delete/отказ/draft, E13 — focus. Никаких новых продуктов, confirmation gates или suite не требуется.

### B02 — Dimension 1: путь восстановления ошибки ответа

- **Критерий:** error copy обязана иметь solution path; отсутствие решения — native BLOCK.
- **Доказательство:** UI-SPEC:206, P14: `Could not read the student's records.` и `Could not verify this answer from the available records.` Оба заканчиваются причиной отказа. `Suggestions` — название narrative блока, не действие восстановления. UI-SPEC:162–163 описывает withholding/reread на сервере, но не product next step для этих двух ошибок. P13/P16 `Check status` относится к неизвестному run/Calendar outcome, не объявлено действием P14.
- **Связь:** SC4/CHAT-07/CHAT-08, F06/F09/F10. В пользовательском failure path ответа не определён следующий шаг; safe отказ описан, actionable error contract — нет.
- **Ожидаемый observable outcome:** read failure предлагает перечитать записи; rejected answer предлагает уточнить вопрос по доступным записям. Эти states не превращаются в empty data, не публикуют неподтверждённые числа и не запускают автоматический paid retry. Draft и выбранная student identity сохраняются.
- **Наименьшая коррекция, пример, не обязательный механизм:** добавить к read failure `Refresh the student's records and try again.` и существующее read-only refresh действие. Для rejected answer — `Ask about the available records, or make your question more specific.` Следующий model request остаётся явным Send с fresh admission. Не показывать пользователю названия DTO, validators или provider internals.
- **Proposed owner/E2E:** F06 chat/facts.ts и F09 web messages/use-chat; E08 различает read error/rejected answer/missing data и проверяет withheld numbers; E14 сохраняет untrusted-data boundary. Расширяется существующий durable journey, новый isolated test не нужен.

## Bounded recheck — dispositions

### B01 — RESOLVED

- **Свойство:** interactive label называет действие над объектом; generic Cancel/Save CTA отсутствует в исправленных controls.
- **Current evidence:** UI-SPEC:109 и P03/P04:195–196 — `Keep title / Save title`, `Keep conversation / Delete conversation`; :145,154,205 — `Stop reply`. :220 согласует initial/return focus и accessible names с labels. `Save title` — конкретный verb+noun; status `Saved` и внутреннее описание Cancel semantics в F02/F08 не являются CTA.
- **Observable outcome:** Keep title сохраняет прежний saved title; Save title сохраняет новый через прежнего owner; Keep conversation сохраняет chat. Stop reply действует на тот же run по fresh capability, не откатывает committed changes и не обещает no charge. Unknown outcome ведёт в Check status, liability сохраняется.
- **Owner/public symbol/proposal:** :232 F03 сохраняет create/list/rename/deleteConversation; :231 F02 — chat/runs.ts и durable ChatTurn/ChatEvent/readTurn/readEvents; :237 F08 — deleteConversation и conversations/store/usage control owner. Никакая новая runtime signature не объявлена implemented. Final binding остаётся execution gate; label correction не создаёт нового operation.
- **Проверка:** :249 E01 и :261 E13 явно включают Keep/Save semantics и focus; E09 сохраняет replay/run isolation. B01 закрыт конкретным изменением контракта, не обещанием выполнить его позднее. Runtime/E2E NOT RUN.

### B02 — RESOLVED

- **Свойство:** read failure и rejected answer имеют разные actionable next steps без автоматического model/tool retry.
- **Current evidence:** P14:206 — `Refresh records` и `Ask another question`; :161 задаёт отдельное поведение, :216 связывает каждую кнопку только со своим failure, :220 задаёт focus и keyboard activation без отправки turn.
- **Observable outcome:** Refresh records выполняет account-bound safe read для того же target/coverage, повторно проверяет session/identity, показывает pending/failure и сохраняет draft/student context. Успех обновляет только verified facts/asOf/coverage; original reply/tool/ChatTurn не повторяется. Ask another question переводит focus в current draft и сохраняет identity. Нажатие/Enter не отправляет запрос; отдельный explicit Send требует normal model/budget admission и mention validation. Rejected prose не становится verified после refresh.
- **Owner/public symbol/proposal:** :161 и :235 F06 связывают safe read с chat/facts.ts/readChatFacts и прежними cardFacts/readToday/core; :159 сохраняет code templates/typed facts и validation ДО stream publication. F02 durable identities и F08 deletion/usage liabilities не обходятся recovery controls. Нет нового финансового owner, backend retry или model fallback.
- **Проверка:** :256 E08 явно проверяет оба recovery actions, сохранение identity и zero automatic model/tool retry; :261 E13 — focus/keyboard. SC4 остаётся связан с authoritative code facts; SC1 не получает повторный turn. B02 закрыт concrete contract change. Runtime/E2E NOT RUN.

## Recommendations — не блокируют

- **Dimension2:** одной фразой назвать основным visual anchor текущий ответ/результат в conversation, а composer — следующим действием. Сохранить утверждённую композицию. Новые eyebrows не добавлять.
- **Dimension3:** зафиксировать применяемый inherited neutral/link contract и ориентир 60/30/10 в prose. Не перекрашивать v40 и не вводить новую палитру.
- **Dimension5:** записать используемые значения space tokens и явное наследование approved v40 exceptions. Не заменять 10/12px padding и не нормализовать компоненты заново.
- Однословные `Send`, `Refresh`, `Undo`, `Was` — inherited/контекстные labels. Это не самостоятельные blockers и не основание расширять дизайн.

## SC1–SC5 и F01–F10: полнота semantic contract

| Критерий | Связанные строки UI-SPEC / F / E2E                     | Результат статической проверки                                                                                                                                                                                                                                                            |
| -------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC1      | :105–108,140–158,164; F02/F03/F08/F09/F10; E01/E09/E14 | Actual terminal отличён от waiting; persist-before-publish/cursor/dedupe и original outcome read исключают blind replay. Delete закрыт при unknown run/mutation/usage; liability не стирается. Sensitive stored text untrusted. B01 требует copy-коррекции, не нового persistence design. |
| SC2      | :112–132; F03/F04/F05; E02/E05/E06                     | Exact selected student ID; edited/removed/ambiguous refs требуют selection; title/name не ключ. Captured now/account zone, no nearest/latest guess, missing time/DST дают zero writes. Single move/cancel через existing24 confirmation.                                                  |
| SC3      | :136–138,155–164; F05/F09; E03/E04/E06/E07             | Undo latest revision CAS; own-entry inverse сохраняет другие entries; Google wins и fresh precondition. Atomic local receipt и durable authoritative invalidation вызывают Today/Schedule hooks reread, не только router.refresh.                                                         |
| SC4      | :162–164,206,232,253; F06; E08/E14                     | Financial/count answers из code facts/templates, валидация ДО publication, включая числа словами; source/asOf/coverage и post-mutation reread. Model prose не authority. B02 ограничен actionable error copy.                                                                             |
| SC5      | :62–83,168–182,233,255–257; F01/F07; E10/E11/E12       | Actual configured model/effort, per-attempt pricing/period, finite cap required. Account lock и reserve перед каждым request/continuation; usage unknown fail closed, no timer release. Credits отдельно; numeric cap/credit balance/×3 не придуманы.                                     |

Все F01–F10 явно связаны в UI-SPEC:225–236; десять bindings не заменяют source implementation. R9 Messages API + official SDK — технический default; Managed Agents practical spike NOT RUN. Actual models/key/credit access/number cap UNVERIFIED. Phase24 09–11 partial и Phase25 PROPOSED preparation не создают требования redesign или свежего исследования. Final signatures rebind — execution gate. ROADMAP:389 содержит старую формулировку credit exhaustion → budget reached; CONTEXT D07, RESEARCH P9 и UI-SPEC:180 согласованно разделяют credits и app cap. Это принятое уточнение, а не blocker.

Эта SC/F таблица и номера строк сохранены как baseline evidence; полный audit не повторялся. B01/B02 закрыты текущими dispositions выше. Layout/v40, F01–F10 и прочие proofs переиспользованы по bounded заданию; label/read recovery не меняют type/registry/provenance contract. Current ROOT UI-SPEC совпадает с новым supplied SHA. Browser/E2E/runtime/provider/production PASS здесь не заявлен. E01–E14 — expected outcomes, NOT RUN. Отсутствие fresh enumeration не defect: inventory доступных компонентов не объявлен.

## Baseline fingerprints — SHA-256

Paths без абсолютного префикса относятся только к ROOT `/Users/kdvornichenko/.codex/worktrees/phase-24-google-calendar-preparation/dv-lab`. Эта таблица сохраняет исходный snapshot; current recheck inputs приведены отдельно ниже. Внешний design file здесь — baseline, не текущий execution input.

| Вход                                                            | SHA-256                                                          |
| --------------------------------------------------------------- | ---------------------------------------------------------------- |
| AGENTS.md                                                       | fbef0e319fe49ffb5ab0067e8feac8093172f958b0a70808ff5a376bbb72c9be |
| .planning/EXECUTOR-RULES.md                                     | 1eca1fa30e110bd04658cbf885d1b2189ce854f3cd3ed49664194f6121cbd449 |
| .planning/config.json                                           | 96efe8c9224af4dcd6883de8104787005a34d274a90a0561526d3cc7dc6ac068 |
| 22-CONTEXT.md                                                   | 1f8e990f50ff18abc01d125b3c410857465efcf0d521d427b46b27b19f9216fa |
| 22-RESEARCH.md                                                  | 38e3a5cfbd03fffbc618886e1fc632aadf6ca417e0f3fa76f3705af09565a708 |
| ROOT 22-UI-SPEC.md                                              | e1689b27354a8397101058db691952babb11c1ebf520088b103bb840384e0175 |
| /Users/kdvornichenko/dv-lab-design/phase-22/22-UI-SPEC.md       | e1689b27354a8397101058db691952babb11c1ebf520088b103bb840384e0175 |
| ROADMAP: Phase22 до Phase23, без последнего заголовка           | cf0140ace1e4baeef5fc9d3386e192c36f85f40f0190f876b21caccb8a4e3b0e |
| REQUIREMENTS: Chat Assistant до IELTS, без последнего заголовка | f00806273d777aab970c5b57d04fcadebae3f35d518e60abb4fd63b0fb7e4c68 |
| /Users/kdvornichenko/dv-lab-design/VERSION                      | bf022ec33f714d073548153e496277fee35e01749059b7139c34f35294f208cf |
| /Users/kdvornichenko/dv-lab-design/project/tokens.css           | 9de5ec97cdd57274454b44112d43d8059ee7cc22384fe4f672c70d6aa360cfcf |
| /Users/kdvornichenko/dv-lab-design/project/principles.md        | ab9451cb8cdcdad1d3689c39eb5271338fb979bd3af63f14c28fa03aa145e61f |
| /Users/kdvornichenko/.codex/agents/gsd-ui-checker.md            | 7f3c9ac062ee37dcb2049f989ff093aedcce675775400434ca145518f8a5126a |

UI-SPEC:280 имеет hash design tokens.json, не tokens.css; два разных файла не трактуются как drift. Input hashes доказали current source/research/ROADMAP/REQ binding, не неизменность provider docs или runtime.

## Current recheck fingerprints — SHA-256

| Вход                               | SHA-256                                                          |
| ---------------------------------- | ---------------------------------------------------------------- |
| Authoritative ROOT 22-UI-SPEC.md   | eb57f0f35101a3cf7d50c6204dd2914cd4a36775f24f2df83ae9a231c0f17328 |
| ROOT 22-RESEARCH.md, без изменений | 38e3a5cfbd03fffbc618886e1fc632aadf6ca417e0f3fa76f3705af09565a708 |
| ROOT 22-CONTEXT.md, без изменений  | 1f8e990f50ff18abc01d125b3c410857465efcf0d521d427b46b27b19f9216fa |
| 22-UI-CHECK.md до recheck          | 9d68829557c82b1b11ace47a0d5b50ec7611cf0f91a34e28b9ce80b2fed7d6d0 |

Current fingerprints проверены без чтения runtime/source/env/provider. Итоговый SHA отчёта возвращается в stdout/final после formatting; self-hash в самом файле не записывается.

## Проверки и structured return

- `bash scripts/gsd/root-pin.sh /Users/kdvornichenko/.codex/worktrees/phase-24-google-calendar-preparation/dv-lab` — exit0, `ROOT_PIN_OK`, выполнено до записи.
- `node /Users/kdvornichenko/.codex/gsd-core/bin/gsd-tools.cjs query agent-skills gsd-ui-checker` — baseline exit0; роль и правила переиспользованы, повторного query/full audit нет.
- Current fingerprints — Python stdlib pathlib/hashlib, exit0; authoritative ROOT UI-SPEC совпадает с новым supplied SHA, RESEARCH/CONTEXT unchanged. Исходный отчёт совпал с baseline output SHA до записи.
- Raw B01/B02 сверены целиком с literal baseline blocks: exit0, `RAW_EVIDENCE_OK B01=unchanged B02=unchanged`.
- Scoped Prettier check — exit0, `All matched files use Prettier code style!`; bounded doccheck — exit0, `DOC_CHECK_OK dimensions=7 resolved=2`; fingerprints — exit0. Final report SHA возвращается родителю после formatting. Это не browser proof.

Точные минимальные rerun commands из ROOT:

```sh
yarn prettier --check .planning/phases/22-chat-with-mentions-and-quick-marks/22-UI-CHECK.md
python3 -c 'from pathlib import Path; import re; s=Path(".planning/phases/22-chat-with-mentions-and-quick-marks/22-UI-CHECK.md").read_text(); rows=re.findall(r"^\|\s+([1-7]) .*?\|\s+(PASS|FLAG|BLOCK)\s+\|",s,re.M); assert rows==list(zip("1234567",["PASS","FLAG","FLAG","PASS","FLAG","PASS","PASS"])); assert "**Статус:** APPROVED" in s; assert all(x in s for x in ["### B01 — RESOLVED","### B02 — RESOLVED","NOT RUN"]); print("DOC_CHECK_OK dimensions=7 resolved=2")'
shasum -a 256 .planning/phases/22-chat-with-mentions-and-quick-marks/{22-UI-SPEC.md,22-RESEARCH.md,22-CONTEXT.md,22-UI-CHECK.md}
```

**Ready for Planning:** UI-SPEC APPROVED по семи native dimensions; B01/B02 RESOLVED, прежние flags неблокирующие. Parent выполняет post-approval UI consideration probe22 и native planning gate. Этот checker не пишет UI-SPEC frontmatter, source или другие артефакты и не запрашивает повторное user approval. Structured frontmatter return для researcher/parent: `status: approved`, `reviewed_at: 2026-10-12` (дата recheck; точный timestamp назначает writer). Это design approval, не phase/runtime/provider PASS и не снятие final24/25 execution gates.
