## UI-SPEC VERIFIED

**Phase:** 25 — Google Calendar Two-Way Sync
**Status:** APPROVED для planning
**Reviewed_at:** 2026-10-11T20:45:04Z
**Blocking issues:** 0. B1 RESOLVED конкретной ревизией UI-SPEC.

### Scope Card

Outcome: bounded recheck единственного B1; текущие семь verdicts.
In scope: scope до Assign/Ignore, family representation, F01–F09 binding, related copy, Registry Safety. Неизменённые v40 dimensions переиспользованы.
Out of scope: UI-SPEC/research/source/Git/runtime/browser/DB/provider/env/deps/deletion/agents/sharedSTATE writes.
Acceptance: B1 доказан либо конкретно воспроизводим; семь verdicts привязаны к текущим inputs.
Assumption A1: final24 signatures ещё меняются — текущий запрос, UI-SPEC:26/182/193. Rebind до execution25; это не implementation proof.
Verification/work map: scope/copy/family → UI2/UI3/B1; F bindings → UI1–UI4/B1; fingerprints → reuse; root-pin → единственная разрешённая запись.
Write set: только 25-UI-CHECK.md. Stop: текущий verdict и decisive evidence опубликованы.

### Dimension Results

| Dimension              | Verdict | Evidence                                                                                                                                                                                                                                      |
| ---------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Copywriting          | FLAG    | UI-SPEC:154–169: P06/P07/P13/P17/P19 согласованы с exact full-name matching и scope. Unknown scope имеет Refresh event; toast отражает confirmed scope. Сохранён прежний неблокирующий FLAG для supporting Ignore/Refresh без noun (P08/P11). |
| 2 Visuals              | PASS    | Reuse UI-SPEC:55–72 и inherited R3. Изменение :61/103/105/167/169 — plain-text scope рядом с time до controls, без eyebrow/badge/modal. Прежняя иерархия сохранена.                                                                           |
| 3 Color                | PASS    | Reuse :59–72 и unchanged R3 §Color: 60/30/10, ограниченные link/focus, semantic warning/destructive. Scope не вводит accent.                                                                                                                  |
| 4 Typography           | PASS    | Reuse :59–62 и unchanged R3 §Typography: app 12/13/16/22, body 13/20, weights 400/600. Scope не вводит новой шкалы.                                                                                                                           |
| 5 Spacing              | PASS    | Reuse :55–66 и unchanged v40/R3; space-3=12px принят и кратен 4. Новый scope следует existing row wrap; новых spacing values нет.                                                                                                             |
| 6 Registry Safety      | PASS    | Исправлено :68: manual Base UI/variant A v40, no new third-party blocks; scope — текст existing row/details. Config ui_safety_gate отсутствует → gate включён.                                                                                |
| 7 Inventory Provenance | PASS    | Reuse: :30–41 — references; :57–66 — phase composition; :184–194 — semantic facts. Availability inventory не добавлен; R3 non-exhaustive list не closed allowlist.                                                                            |

### B1 RESOLVED — concrete fix

**Required property:** область решения видна до commit; series outcome означает family representation; F01–F09 связаны с research.

- UI-SPEC:103/105/107: Event / This occurrence / Series из safe versioned DTO показаны в row/details до Select/Ignore в visual/reading order. Scope не выводится из title/recurrence. P19 (:167) фиксирует copy.
- :105/123/165/169: unknown scope блокирует оба controls; P17 объясняет причину и предлагает Refresh event. Known unsupported Assign сохраняет отдельно разрешённый Ignore.
- :114/161/190/209: single/instance → один lesson без sibling changes; master → одна family representation с unique instances. P13 выбирается по confirmed decision scope.
- :99/154/189/207–208: весь normalizeDisplayName(displayName), CASE-SENSITIVE exact match среди active cards; no first-word/fuzzy/lowercasing; existing ID binding стабилен после rename/archive.
- :128/191/210–211: Ignore survives edits/410/same-target reconnect по identity/scope; master family/member различаются; новый identity — новый candidate. Immutable requestId/body + readDecision закрывают lost reply без replay.
- :186–194: все F01–F09 имеют research links, owners/operations, semantics и failure proof. :194/204 требует authenticated closed-page publication ДО открытия app/public GET.

Verdict изменён на основании этих конкретных fixes. Remaining B1 blockers: none.
Исходный BLOCKED report SHA-256 0631623c3d7af4322f730ac672b0e19a26bac83d41bfe77fdc869ac6332ed174 — исторический baseline для UI-SPEC:241; он не обязан совпадать с обновлённым report.

### Implementation binding F01–F09

Implementable означает planning contract, не source/runtime PASS. Неизменённая семантика research переиспользована по SHA-256.

| Fact | Verdict                       | Current UI-SPEC binding                                                                                                                                                            |
| ---- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01  | Implementable                 | :186, R9 P2/P3 — GoogleSyncSnapshot/CalendarSync.readStatus/acceptNotification; delivery/coverage/commands отдельно, safe visible polling без browser writer.                      |
| F02  | Implementable                 | :187, R9 P1/P3 — run/applyInboundProjection/transaction publication; terminal-page commit, logical410 reset, full-check отдельно от incremental. 90s только test budget.           |
| F03  | Implementable                 | :188 — GoogleReviewList/DecisionRequest/Snapshot, CalendarReview.list/decide/readDecision; teacher-only safe metadata, revision cursor/end proof.                                  |
| F04  | Implementable                 | :189 и :99 — exact whole displayName, ID-first, active eligibility, duplicate ambiguity, stable rename/archive binding.                                                            |
| F05  | Implementable                 | :190 и :103–126 — visible scope/capability до commit; instance/family outcome, unsupported Assign и unknown-scope gate. B1 закрыт.                                                 |
| F06  | Implementable                 | :191 и :128 — identity-lifetime Ignore, explicit family/member scope, immutable decision/status recovery.                                                                          |
| F07  | Implementable                 | :192, R9 P6/P7 — exact command evidence, ordered publication, mirror epochs/frozen history/current marks; partial remains unresolved, no false Saved.                              |
| F08  | Implementable; rebind gate    | :182/193/196 — contracts sole DTO owner; teacher/session/no-store/Origin; independent channel auth. Proposed symbols требуют final24 rebind.                                       |
| F09  | Implementable acceptance path | :194/196/204/217, R9:467–516 — publication before app/GET; existing real harness/reruns, zero matches/fixture skip не acceptance. Actual410/grant/TTL/nightly остаются UNVERIFIED. |

Текущий запрос сообщает actual source24 seam aa3ceb6: CalendarEventView.binding при kind=lesson требует studentId UUID. Это user-provided fact; source не читался. Final24 rebind должен сохранить required UUID, без fake identifier. Этот факт не выдаётся за проверку реализации Phase25.

### Recommendations

Dimension 1: прежняя рекомендация noun-specific supporting labels остаётся неблокирующей. Approved v40 vocabulary сохраняется; новый copy redesign не требуется.
Dimension 6: прежняя рекомендация закрыта UI-SPEC:68. Новых findings нет.

### Evidence / current inputs

| Input          | SHA-256                                                          |
| -------------- | ---------------------------------------------------------------- |
| 25-UI-SPEC.md  | 0e8acc184ea953362a3462f9bf22f45cfb79f248ec5a0b5cbdbbecd05b8ae2d0 |
| 25-CONTEXT.md  | 902f8a89a636bdcd3176cfc6b75908e3ca5b4df3d8a0b7c506fcbf5524eba527 |
| 25-RESEARCH.md | ade7728c70345e879476c6f2dd2ba684e267b789c537afaee3ece49c56d50828 |

Точная выполненная команда из ROOT, exit 0: revision_sha/research_links/bound_facts=true; 13 valid research links; F01–F09 присутствуют. Link check доказывает существование/range; семантика B1 проверена вручную.

```sh
python3 -c 'from pathlib import Path; import hashlib,json,re; p=Path(".planning/phases/25-google-calendar-two-way-sync"); s=(p/"25-UI-SPEC.md").read_text(); links=re.findall(r"\]\(([^)]+25-RESEARCH\.md:\d+)\)",s); n=len((p/"25-RESEARCH.md").read_bytes().splitlines()); checks={"revision_sha":hashlib.sha256((p/"25-UI-SPEC.md").read_bytes()).hexdigest()=="0e8acc184ea953362a3462f9bf22f45cfb79f248ec5a0b5cbdbbecd05b8ae2d0","research_links":len(links)==13 and all(Path(x.rsplit(":",1)[0]).is_file() and 1<=int(x.rsplit(":",1)[1])<=n for x in links),"bound_facts":all(re.search(r"^\| F0"+str(i)+r" \|",s,re.M) for i in range(1,10))}; print(json.dumps({"checks":checks,"inputs":{k:hashlib.sha256((p/k).read_bytes()).hexdigest() for k in ["25-UI-SPEC.md","25-CONTEXT.md","25-RESEARCH.md"]},"research_links":len(links),"baseline_check":hashlib.sha256((p/"25-UI-CHECK.md").read_bytes()).hexdigest()})); raise SystemExit(0 if all(checks.values()) else 1)'
```

`shasum -a 256 /Users/kdvornichenko/dv-lab-design/VERSION /Users/kdvornichenko/dv-lab-design/project/tokens.json /Users/kdvornichenko/dv-lab-design/project/components/SettingsCalendar/README.md .planning/phases/24-google-calendar-connection-and-outbound-sync/24-UI-SPEC.md .planning/config.json`: exit 0. VERSION/tokens/SettingsCalendar/24-UI-SPEC совпали с baseline: bf022ec3…, 407e3594…, 300ce9a3…, 94edd423… соответственно. Config: 96efe8c9224af4dcd6883de8104787005a34d274a90a0561526d3cc7dc6ac068. Полные design hashes есть в UI-SPEC:225–240.

`sed -n '105,171p' .planning/phases/25-google-calendar-two-way-sync/25-UI-SPEC.md`: exit 0; восстановлена область изменённого copy/scope, обрезанная первым выводом. Остальные primary inputs неизменны, повторного широкого audit не было.

`bash scripts/gsd/root-pin.sh ~/.claude/worktrees/phase-24-google-calendar-preparation/dv-lab`: exit 0, ROOT_PIN_OK непосредственно перед записью.

### Ready for Planning / limitations

UI-SPEC approved как design context для planning25. Structured return для владельца UI-SPEC: status: approved; reviewed_at: 2026-10-11T20:45:04Z. UI-SPEC/RESEARCH/CONTEXT не редактировались.

Runtime/source/browser/DB/provider/env/build/E2E/renewal/nightly/Production: NOT RUN. Final24 source binding: UNVERIFIED до execution rebind. Phase24 остаётся active; STATE и Git не менялись. Unreviewed defaults не требуют повторного user approval.

Изменён только этот report — текущий verdict и evidence закрытия B1.
