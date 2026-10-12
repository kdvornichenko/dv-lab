# UI-SPEC Review — Phase 26

## UI-SPEC VERIFIED

**Фаза:** 26 — IELTS Section.
**Статус:** APPROVED.
**Блокирующих замечаний:** 0. B01 — RESOLVED.
**Дата:** 2026-10-12, Asia/Ho_Chi_Minh.
**Authoritative UI-SPEC SHA-256:** `af71092c2ccd26dd2e34e1b88a6e2f00c6acc8be57b6b0ecc39949a7a26fc8e8`.

## Scope Card

| Поле         | Контракт проверки                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outcome      | Bounded recheck B01 и affected Recording/Media semantics; current APPROVED/BLOCKED и семь native verdicts с proof reuse                                                                           |
| In scope     | Current C45/§243 recovery, explicit selection/original identity/dedup/unknown duration/Give gate; current input hashes; сохранность raw B01 и owned report                                        |
| Out of scope | Fresh full UI/source/architecture/research audit, source/protected inputs/external home, Git/runtime/browser/DB/provider/data/env/deps/paid calls/agents/shared metadata/deletion/phase execution |
| Write set    | Только `.planning/phases/26-ielts-section/26-UI-CHECK.md` в ROOT                                                                                                                                  |
| Acceptance   | Original raw B01 unchanged, concrete current disposition, семь verdicts с reuse, source/report hashes и exact minimal doc/format checks                                                           |
| Verification | Bounded current text/hash check и owned-report checks. Original six dimensions/source/v40/other scopes proofs переиспользованы; Parent metadata validator PASS не запускается повторно            |
| Work map     | C45 next step + §243 media invariants → B01; raw preservation/seven verdicts/current scoped hashes/root-pin/doccheck → актуальный отчёт                                                           |
| Stop         | Этот отчёт записан/проверен. Parent выполняет bounded corrections/recheck/probe/planning и execution source rebind                                                                                |

ROOT — `/Users/kdvornichenko/.codex/worktrees/phase-24-google-calendar-preparation/dv-lab`. SOURCE — `/Volumes/T7/personal/ielts`, pin `df57b7000c6adc60f35071065b4423d426d263a0`, read-only. Target source baseline `913fc5ae9286aca9a48b5ce4272699c846849874`; `81a1175` — docs snapshot по ARCH:4. Утверждение о текущей неизменности всего параллельного target code не делается.

A1 — final24/25/22/23 schemas/interfaces/installed props и target runtime требуют execution rebind, по UI-SPEC:5,32,358,434; missing future source не считается текущей implementation bug. A2 — crosswalk/counts/media checksums/quiescence/parity не наблюдались, по CONTEXT D-04…06 и UI-SPEC:34,247–264. Их отсутствие закрывает enable/rollout; не заменяется допущением. A3 — Source6.2 VERIFICATION:4 имеет `human_needed`, значит chart/theme/device UAT не переносится как target PASS.

Workflow — typed native gsd-ui-checker через ранее прочитанный work-router, без побочных действий. AGENTS/EXECUTOR/config и native role имеют прежние fingerprints, правила переиспользованы. Local project skills отсутствуют; registry safety gate не отключён. Source/Target CodeGraph отсутствует, индексация не выполнялась. Source hosting-only constraints superseded принятой target adaptation; privacy/source behavior остаются. Разрешение записать единственный отчёт — явное исключение задания из read-only/no-file-creation native роли.

## Dimension Results

Dimension1 — current B01 recheck. Dimensions2–7 и их refs — исходный full-check proof reuse; Color/Spacing flags остаются неблокирующими. Полный новый round не выполнялся.

| Dimension               | Verdict | Доказательство                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Copywriting           | PASS    | Current UI-SPEC:337 C45 называет Choose the audio file again; :243 связывает recovery с existing Choose file, explicit teacher selection, original identity/dedup и confirmed-duration Give gate. B01 RESOLVED. Остальное copy proof переиспользовано.                                                                           |
| 2 Visuals / composition | PASS    | Teacher Home lesson-first с primary Start lesson/actual Lessons (:133); ExamFrame content/panes/timer/nav hierarchy (:153); source statistics order/marker/table/reason и focus/status/layers (:206–224,270–283). Icon controls наследуют Notes/Options/navigation labels и accessible question/toggle names.                    |
| 3 Color                 | FLAG    | :94,214,268,280 наследуют neutral v40 и semantic skill/correctness/author colours с markers/words; multiple hues justified, не декоративные accents. Link accent reservation из Principles сохранён; 60/30/10 явно не записан. Destructive есть в source-bound approved system.                                                  |
| 4 Typography            | PASS    | :268: local content 13/16/14/20; shared AppShell app display22 и ExamFrame display/heading tokens — approved inherited frame styles, не пятая новая локальная ступень. Body13/20 и exam16/28 явны. Source pane zoom остаётся supported interaction, не новая шкала или повод менять v40. Новых weights сверх adopted system нет. |
| 5 Spacing               | FLAG    | :153,268–281 наследуют existing frames/layout/grids/fades. Явная phase spacing scale отсутствует; approved v40 component paddings/gaps не становятся новым BLOCK. Header56/nav64/hit area44/min pane30%/viewport breakpoints/coordinates/line-height — geometry/interaction, не spacing scale.                                   |
| 6 Registry Safety       | PASS    | :94: manual v40/Base UI, no new third-party block/install/Radix/cmdk. Target Base UI manifest1.8.0 совпадает с research stack. Future Markdoc/CodeMirror/dnd/chart packages — отдельный dependency gate, не third-party UI registry access или разрешение install.                                                               |
| 7 Inventory Provenance  | PASS    | :38–60 и D26 table перечисляют referenced design input/phase-use; M01–12/F01–10 — semantic owners/proposed operations. Available DS export inventory/closed allowlist не объявлен. Count33 README/preview pairs — provenance input references, не recalled component availability. Enumeration command не запускался.            |

## Исходный B01 — raw evidence, RESOLVED

Следующая исходная запись сохранена без изменений. Её BLOCK/ref/line numbers относятся к baseline SHA `697aff2b71bd9a092c900926213f2c00adfec3d4a0c9139b06f807f22b734186`, а не к current source. Required property сохраняет силу; фактическое исправление оценивается по свойству, не по буквальному fix hint.

### B01 — Dimension 1: recording-length error требует recovery path

- **Required property:** error state содержит specific safe solution path. Native Dimension1 BLOCK при error copy без solution path.
- **Actual UI evidence:** :335, C45: `The recording length could not be measured.` / `Length unknown`. Текст заканчивается ошибкой. :79 различает measurement/metadata и section-save ACK; :237 допускает ready file с unknown duration, которая может блокировать Give. :239–240 требуют actual safe next step, но не называют его для этой ошибки. `Retry recording` в C29:319 — playback failure; `Check upload status` в C44:334 — uncertain upload. :340 прямо различает эти retries; они не являются автоматической заменой recording-length recovery.
- **Exact source evidence:** Source `src/app/teacher/tasks/recording-dialog.tsx:97–100` переводит failed bounded measurement в failed state; :182–183 показывает `The length of this recording could not be measured. Upload the file again.` У source error есть next step, у changed target C45 он потерян. `tasks-view.tsx:48` также называет unknown-length readiness reason и open section/measure/save path. Это проверка конкретного port seam, не новый audit Source media engine.
- **Counterexample / observable failure:** файл byte-verified/ready, но metadata measurement возвращает null или unsupported duration. Teacher видит Length unknown/ошибку, section не ready to Give, а текущая copy не определяет допустимое следующее действие. Нельзя объявлять failed upload/playback, придумывать duration или считать transfer100% полной готовностью.
- **SC/F/P/M/D/J:** SC2/SC3, IELTS-02/03; F01/F04/F07; P02/P10; M04/M08/M09; D26-02/08; J26-04, E26-02/04. Это incompleteness failure UI contract, не claim о target runtime bug.
- **Expected observable outcome:** unknown length сохраняется как unknown; teacher получает конкретный путь через существующий Recording/MediaDialog. Только explicit allowed action; current media/part identity, draft и stored object сохраняются. Новые bytes проходят reservation/verification, measurement/metadata/section ACK не смешиваются. No auto-upload/physical deletion/guessed time/false ready.
- **Минимальная коррекция — пример, не обязательный механизм:** дополнить C45 и соответствующую ветку существующего диалога текстом вроде `Choose another supported recording using Upload or Library.` Это использует уже approved tabs/Choose file/library selection, без нового teacher screen. Другой recovery допустим, если bound к actual authorized recording/measurement owner и не обещает успех или resume, которых source не доказывает. Не требуется буквальный re-upload hint Source и не требуется новый control/provider/tool.
- **Proposed owner/public seam:** M09 Recording/MediaDialog source adapter и source duration helpers; M04 section draft/save, M08 media policy/status/metadata. Source `measureUrlDurationMs`/`boundedDuration` и `setMediaDurationAction` существуют; target adapter/signature binding остаётся PROPOSED. Новую wire schema этот отчёт не вводит.
- **Minimum proof:** дополнить existing J26-04 failed/unknown duration branch: видимый error + named existing action, preserved identity/draft, no guessed duration/false readiness/automatic new upload; успешная metadata/section save подтверждается по своему ACK. Runtime/public E2E/device — NOT RUN.

## Bounded recheck — B01 RESOLVED

- **Required property:** failed recording-length measurement имеет specific safe solution path.
- **Actual current evidence:** C45:337 — `The recording length could not be measured. Choose the audio file again.`; :243 — keep Length unknown, show C45 beside **existing Choose file** in Recording/MediaDialog, teacher explicit selection, owner checks original identity/dedup before retry; Give stays blocked until required duration confirmed.
- **Affected invariants:** :235–240 сохраняют reservation/verified ready/unknown original status lookup, no auto upload from refresh, no ready at100% transfer, explicit recovery if browser buffer lost. :245–247 сохраняют retained storage/reference checks и session/own-readable-snapshot GET/HEAD/Range authorization. Новый текст не обещает гарантированную успешную measurement, playback, byte resume или freed space.
- **Observable outcome:** teacher видит error рядом с существующим actionable control; выбор файла — отдельное explicit действие. Unknown duration не становится invented value или готовностью Give. Original identity/dedup и server ACK контролируют повтор; no new control/action/surface, automatic upload, guessed duration, false ready или physical deletion.
- **Owner/binding:** original M04 section draft/save, M08 media identity/status/metadata и M09 Recording/MediaDialog adapter; F01/F04/F07, P02/P10, D26-02/08 и J26-04/E26-02/04 сохранены. Source helper/metadata/section ACK scopes из original proof переиспользованы; target symbols и final24/25/22/23 execution rebind остаются PROPOSED.
- **Disposition:** RESOLVED конкретной changed copy + bound behavior. Hint предлагал одну возможность; parent выбрал smaller existing-control correction, которая достигает того же required property. Remaining affected finding отсутствует. E2E/runtime/device/actual media behavior NOT RUN.

## Recommendations — неблокирующие

- **Dimension3:** кратко записать inherited accent reservation и ориентир60/30/10; semantic skill/status/author colours и approved v40 не менять.
- **Dimension5:** явно сослаться на existing spacing scale и justified inherited component exceptions; не нормализовать pixels/grids/fades заново.

Source action labels вроде Play/Grade/Notes/Why? сохранены при неизменном поведении (:287), это не новые generic Submit/Save/Cancel. C23 Saved и C33 Grade — status/source entry, а новые writes имеют Save section/Save grade/Update grade/Submit section/Submit essays. Functional exam part labels не eyebrow. Source review/visibility semantics overrides устаревшие DS blanket restrictions, не physical design.

## C1: SC/P/M/D/F/J/E bindings — baseline proof reuse

Таблица и её ссылки ниже сохраняют исходный snapshot full check. Старый B01 reference закрыт текущим disposition выше; C1 и остальные semantic claims не проверяются повторно и не расширяют recheck.

| Критерий          | Source-bound design proof                                                                                                                                                                                                                                                                                 | Failure path / owner / gate                                                                                                                                                                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC1 / IELTS-01    | :98–112: separate student /ielts route/shell/landing, direct API role and own object,401/403/foreign404; account UUID distinct from optional card; generated/manual/reset/deactivate/reactivate, same auth epoch                                                                                          | P01/M01/M02/M09/D26-01/F02/J26-01/06. No teacher flash/sidebar/private DTO; M02 ARCH-A1 сохраняет shared scrypt/session profile и unlinked lifecycle, no second auth engine/name binding.                                                                                                                           |
| SC2 / IELTS-02    | :116–129: compiler/local+server validation, explicit replacement/reorder/removal/draft/stale guard; current edits не rewrite historical snapshots. :228–245: server bytes/hash/reservation/journal/ready/retired; auth before GET/HEAD/Range and own readable snapshot                                    | P02/P03/P10/M04/M08/M09/D26-02/05/08/F01/F04/J26-04. Unknown/read failure не empty; retire не physical freed bytes. ARCH-A3/A4 absorbed, current source50MB/Blob examples superseded by actual80MiB/5MiB/900MiB. B01 — duration recovery copy only.                                                                 |
| SC3 / IELTS-03/04 | :133–176 Give waits/open starts once, exact working set/step, same-key adjust receipt, grace8s/sequential ACK/held/submit/reload. :184–224 listening fallback, own non-Writing review notes/highlights vs read-only answers, inline teacher grades/separate task bands/manual Speaking/visibility/full6.2 | P04–P09/M03/M05/M06/M07/M09/D26-03–07/F05/F06/F07/J26-02/03/05. ARCH-A2 receipt required; no daily mean/hidden student values/no-band0/AI exam/mirror. Source6.2 UAT human_needed remains.                                                                                                                          |
| SC4 / IELTS-05    | :249–264,434: private explicit crosswalk/count/key/ref/payload/media checksum; same batch/digest/checkpoint, no recompile/recheck/session import; real active-room observation+freeze/delta, not zero rows; after-target-writes rollback needs reconciliation                                             | P11/P12/M02/M08/M10/M12/F03/F08/J26-06. E26-03 packet/crosswalk, E26-04 disk/restore/candidate, E26-05 activity/parity, E26-06 explicit teacher shutdown after parity. Actual students not enabled before proof. Old Vercel/Neon/Blob stays absent specific teacher confirmation. General autonomy не этот consent. |
| SC5 / IELTS-06    | :81–94,266–283: variant A light/dark, shared limited student/fullscreen frame, exact question/IME/drag/select/touch, readable lock/nav, GradeForm and charts/table/markers/access; original interactions retained                                                                                         | All D26-01–08/M09/F07/F10/same J26. E26-01 final seams/installed props; E26-02 independent final UI binding. No fresh palette/native alert/select/font fork/eyebrows/approved pixel redesign.                                                                                                                       |

P01–P12:66–77, D26-01–08:85–92, M01–M12:362–373, F01–F10:381–390, J26-01–06:398–403 объявлены полностью. E26-01–06 именованы в PATTERNS:676–681 и transitive UI readiness/shutdown clauses; UI не создаёт новую Registry projection. Source-pattern pending UI/E26-02 text описывает предшествующий snapshot, не missing future implementation defect. Parent отдельно закроет native/probe gate.

## C2: narrow independent Source checks — baseline evidence

- Source `stats/series.ts:48–71`: latest timestamp per skill/local day, >= tie follows source order, counts/hollow retained. Это подтверждает UI:213/224 и исправляет generic averaging wording research; не daily mean.
- Source `tests/results.ts:114–116`: publishedAt OR showAnswers+everySubmitted. UI:202/204 правильно допускает practice review после hide, teacher unpublished и student-safe projection.
- Source `tasks/store.ts:791–804`: own attempt lookup, non-active review and studentMarks with notes, без answer/score/teacher-mark mutation. UI:186 сохраняет own annotations; Writing remains source plain review.
- Source listening-gate:133–143 содержит failure recovery и Continue without the recording warning; UI:184/319–320 сохраняет readable-own-attempt restriction и explicit timer/checking consequence. Отдельного success playback claim нет.
- Source recording-dialog:87–110/182–183 и task-editor measurement ACK path различают null duration/local metadata/section save. Current target C45 теряет next step — B01.
- Target Base UI package1.8.0 прочитан из actual manifest; proposed auth account/deactivation/media/timer seams приняты в ARCH-A1…4. Их missing implemented paths не manufacture дополнительных UI findings.

Source/Target CodeGraph отсутствуют, read-only rg/snippets ограничены указанными seams. Старые Source server/DB/reset tests не запускались. Target metrics/code readiness не проверяются этим UI report.

## C3: baseline fingerprints и ограничения evidence

| Input                                           | SHA-256                                                          |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| ROOT26 UI-SPEC                                  | 697aff2b71bd9a092c900926213f2c00adfec3d4a0c9139b06f807f22b734186 |
| ROOT26 CONTEXT                                  | 772d1a4b045076258fe4d0ff4431692356cf763700491ef0d5c415fec886a53a |
| ROOT26 RESEARCH                                 | 3c63a4d7b59e3bcc9a04ffffdbd98e2d5b3604d7476023b19cd69478adf6d2cc |
| ROOT26 ARCH                                     | 0d8fc6412f856a3825c900de21959e26f7607514d82aa7194f6b7b54e9601d8c |
| ROOT26 PATTERNS                                 | 8adeb621d2c514b891e54a1e982193674c4db9ba622f6fec7775189ceb4a46c2 |
| ROADMAP26 scoped heading before next level2/3   | b33a64472ad2938e5fd3b53d4a869f6b8b992095984b5229a1ec468b945c5d85 |
| Six IELTS original requirement lines, LF joined | 6533242e606edd897773fe3cc982be1b12fc2e10bb05f6c9dad887e0e38e27c5 |
| VERSION                                         | bf022ec33f714d073548153e496277fee35e01749059b7139c34f35294f208cf |
| Source42 research group                         | eda58433660d56bc3c12ab5abc682f79b3d6a0f88de93e5a70da2bb10d0ddf5a |
| Source24 UI/helper group                        | ecd4ee3a7271ce755af2e3d47436d375948209ed493b6332ee37546b78f52093 |
| v40 project224 files                            | 3aded9546709152cfe203c0b585f4dbad643891baa086c61ce0e30ea60bfa1ff |
| SOURCE stats/series.ts                          | d8780cf90715aade98d76a87e930086a77bae07b0a8e0f48ca1e3d7bacfc5741 |
| SOURCE tests/results.ts                         | e6f4266b1fd3256be0b256b0ddc246bf199fa2d93677e901185e919ea95fc50c |
| SOURCE tasks/store.ts                           | a204ba89230f6033c6f9ad81807fb4855ee78945586ec0d3b549571da442d400 |
| SOURCE recording-dialog.tsx                     | e0cafa546cd6111747582a19fdb13ab9ae1c2c552cf3bdb5bcfd384addbe05c8 |
| SOURCE use-media-upload.ts                      | 9e2e069c6ed22656a820d2ef260858855c940f805ce74cdbec6d2c91e56e0d66 |
| SOURCE6.2 VERIFICATION                          | f061e9a7765db207087df2fdcd6090beb3a43c26067ff78d3669638d4ccf9acd |

Этот section сохраняет baseline full-check metadata. Group method/paths — existing private validator и baseline UI:411. ROADMAP26 scope использует точный validator delimiter `\n#{2,3} `: preceding newline delimiter исключён из bytes. Первый ручной hash check включил лишний newline и завершился exit1; после применения существующего validator scope — exit0, `ROADMAP26_HASH_OK`, hash совпал. Source drift не обнаружен. Checked metadata: source pin df57…,66 unique Source code files,224 design files; Source untouched, untracked AGENTS preserved. Validator проверяет five captured other-spec inputs, не утверждает полную неизменность concurrent ROOT22/23/24/25 implementation. Source/v40/spec fingerprints matched declared protected inputs на исходном full-check snapshot; это не новый check этих inputs. Source6.2 human UAT, actual private counts/crosswalk/media/quiescence/device/parity и E26 gates **UNVERIFIED**. Teacher shutdown confirmation **NOT OBSERVED**.

Metadata validator PASS не отменяет independent B01:80 semantic substring checks не доказывают каждый error solution path. Ни browser/player/range/auth interaction, ни migration/device/Production PASS не заявлен. No provider/model/paid call. Final report self-hash возвращается в stdout/final после formatting.

## Current recheck fingerprints

| Input                        | SHA-256                                                          |
| ---------------------------- | ---------------------------------------------------------------- |
| Authoritative ROOT26 UI-SPEC | af71092c2ccd26dd2e34e1b88a6e2f00c6acc8be57b6b0ecc39949a7a26fc8e8 |
| ROOT26 CONTEXT, unchanged    | 772d1a4b045076258fe4d0ff4431692356cf763700491ef0d5c415fec886a53a |
| ROOT26 RESEARCH, unchanged   | 3c63a4d7b59e3bcc9a04ffffdbd98e2d5b3604d7476023b19cd69478adf6d2cc |
| ROADMAP26 selective scope    | b33a64472ad2938e5fd3b53d4a869f6b8b992095984b5229a1ec468b945c5d85 |
| 26-UI-CHECK до recheck       | fa8727888545d6c5284dc6f4bce0f7afcb4ad1f182b352ef32712a9f3c3b8d54 |
| Original raw B01 block       | 17e5b957a2be4076c27c76ad44380468e8675767c0ba6caa5443973990d71ff4 |

Phase24 ROADMAP formatting изменён parent; **whole ROADMAP hash/unchanged claim не делается**. Вычислен только Phase26 selective prefix до следующего delimiter `\n#{2,3} `, без delimiter bytes; он совпал с baseline. Source/ARCH/PATTERNS/v40 full checks не повторялись.

Parent уже выполнил existing validator для current source: exit0 PASS,436 lines/72links/16fps/80semantic, Source66/v40=224 preserved. Этот result переиспользован и явно не выдаётся за повторный validator run checker. Source/runtime/DB/media/provider/Git не запускались в recheck. Current source copy и original raw B01 проверяются после formatter; report SHA возвращается только в stdout/final.

## Exact checks / structured return

- `bash scripts/gsd/root-pin.sh /Users/kdvornichenko/.codex/worktrees/phase-24-google-calendar-preparation/dv-lab` — exit0, `ROOT_PIN_OK`, до first write.
- Baseline full-check command `python3 /private/tmp/dv-lab-phase22-ui-20261012/verify_phase26_ui_spec.py /Users/kdvornichenko/.codex/worktrees/phase-24-google-calendar-preparation/dv-lab/.planning/phases/26-ielts-section/26-UI-SPEC.md` — exit0, PASS,434 lines/72 links/16 fingerprints/80 semantic checks; Source66/v40=224 preserved. Это исходный run до recheck; в текущем bounded recheck validator/Git не повторялся.
- Scoped report format/doccheck и current26 hashes — после записи, exact commands ниже; numeric exit/short output/final SHA возвращаются parent. Source/spec/research/ARCH/PATTERNS/other phase files checker не меняет.

```sh
yarn prettier --check .planning/phases/26-ielts-section/26-UI-CHECK.md
python3 -c 'from pathlib import Path; import re; s=Path(".planning/phases/26-ielts-section/26-UI-CHECK.md").read_text(); rows=re.findall(r"^\|\s+([1-7]) .*?\|\s+(PASS|FLAG|BLOCK)\s+\|",s,re.M); assert rows==list(zip("1234567",["PASS","PASS","FLAG","PASS","FLAG","PASS","PASS"])); assert "**Статус:** APPROVED" in s; assert all(x in s for x in ["## Bounded recheck — B01 RESOLVED","NOT RUN"]); print("DOC_CHECK_OK dimensions=7 resolved=1")'
python3 -c 'from pathlib import Path; import hashlib; p=Path(".planning/phases/26-ielts-section"); s=(p/"26-UI-CHECK.md").read_text(); raw=s[s.index("### B01 — Dimension"):s.index("## Bounded recheck")]; assert hashlib.sha256(raw.encode()).hexdigest()=="17e5b957a2be4076c27c76ad44380468e8675767c0ba6caa5443973990d71ff4"; assert hashlib.sha256((p/"26-UI-SPEC.md").read_bytes()).hexdigest()=="af71092c2ccd26dd2e34e1b88a6e2f00c6acc8be57b6b0ecc39949a7a26fc8e8"; print("RAW_B01_AND_SOURCE_OK after_format=1")'
shasum -a 256 .planning/phases/26-ielts-section/{26-UI-SPEC.md,26-CONTEXT.md,26-RESEARCH.md,26-UI-CHECK.md}
```

**Ready for Planning:** UI-SPEC APPROVED, B01 RESOLVED; Color/Spacing flags неблокирующие, шесть прежних dimensions/source proofs переиспользованы. Parent выполняет native post-approval probe/planning/binding. Checker не меняет UI-SPEC/frontmatter/source/protected inputs/другие артефакты и не запускает phase execution. Structured return: status approved; reviewed_at назначает parent writer. Final source/model/storage/auth/installed props/media/quiescence/parity/device gates остаются PROPOSED/UNVERIFIED; specific teacher shutdown confirmation NOT OBSERVED. Approval относится к design contract, не functional/source readiness.
