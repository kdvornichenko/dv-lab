---
phase: 9
slug: implement-website-pet-widget
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-02
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Existing TypeScript, ESLint, API smoke tests via `node --import tsx`; Wave 0 adds pet-focused `tsx` tests for web |
| **Config file**        | `apps/web/tsconfig.json`, `apps/web/eslint.config.mjs`, `apps/api/src/app.test.ts`                                |
| **Quick run command**  | `yarn --cwd apps/web test:pet && yarn --cwd apps/web typecheck`                                                   |
| **Full suite command** | `yarn test`                                                                                                       |
| **Estimated runtime**  | ~45 seconds for quick checks, project-dependent for full suite                                                    |

---

## Sampling Rate

- **After every task commit:** Run `yarn --cwd apps/web test:pet && yarn --cwd apps/web typecheck`
- **After API/settings tasks:** Also run `yarn --cwd apps/api test`
- **After every plan wave:** Run `yarn test`
- **Before `$gsd-verify-work`:** Full suite must be green and manual browser checks completed
- **Max feedback latency:** 60 seconds for pet-focused checks

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type                 | Automated Command                                                                                                                                                                                                                                                                                                                                                                            | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 09-01-01 | 01   | 0    | API-05      | unit/static               | `test -f apps/web/public/assets/cat-widget/cat-sleep.webp && test -f apps/web/public/assets/cat-widget/cat-walk.webp && rg -n "export const PET_POSES\|catPetManifest\|/assets/cat-widget/cat-sleep.webp\|/assets/cat-widget/cat-walk.webp\|animated: true\|privacy" apps/web/lib/pet/pet-manifest.ts && ! rg -n "backgroundPosition\|frameWidth\|frames:" apps/web/lib/pet/pet-manifest.ts` | ❌ W0       | ⬜ pending |
| 09-01-02 | 01   | 0    | API-05      | unit/typecheck            | `yarn --cwd apps/web test:pet && yarn --cwd apps/web typecheck`                                                                                                                                                                                                                                                                                                                              | ❌ W0       | ⬜ pending |
| 09-02-01 | 02   | 1    | API-05      | integration               | `yarn --cwd apps/api test`                                                                                                                                                                                                                                                                                                                                                                   | ❌ W1       | ⬜ pending |
| 09-02-02 | 02   | 1    | API-05      | typecheck/live-store      | `rg -n "subscribePetSettings\|setPetSettingsSnapshot" apps/web/lib/pet/pet-settings-store.ts apps/web/app/(workspace)/settings/pet/PetSettingsClient.tsx && yarn --cwd apps/web typecheck`                                                                                                                                                                                                   | ❌ W1       | ⬜ pending |
| 09-03-01 | 03   | 2    | API-05      | unit/static               | `yarn --cwd apps/web test:pet` verifies walk, explicit-target jump arc, landing clamp, timed rest, privacy, and reduced-motion states                                                                                                                                                                                                                                                        | ❌ W2       | ⬜ pending |
| 09-03-02 | 03   | 2    | API-05      | unit/typecheck/live-store | `rg -n "subscribePetSettings" apps/web/components/pet/WebsitePetProvider.tsx apps/web/lib/pet/pet-settings.ts && yarn --cwd apps/web test:pet && yarn --cwd apps/web typecheck`                                                                                                                                                                                                              | ❌ W2       | ⬜ pending |
| 09-04-01 | 04   | 3    | API-05      | static/typecheck          | `rg -n "data-pet-target" apps/web/components apps/web/app && ! rg -n "<button[^\\n]*data-pet-target\|data-private[^\\n]*data-pet-target\|data-pet-target[^\\n]*data-private" apps/web/components apps/web/app && yarn --cwd apps/web typecheck`                                                                                                                                              | ❌ W3       | ⬜ pending |
| 09-04-02 | 04   | 3    | API-05      | static/typecheck          | `! rg -n "autoplay\|loop=\\{true\\}" apps/web/components/pet/WebsitePetProvider.tsx && rg -n "soundEnabled" apps/web/components/pet/WebsitePetProvider.tsx apps/web/app/(workspace)/settings/pet/PetSettingsClient.tsx && yarn --cwd apps/web typecheck`                                                                                                                                     | ❌ W3       | ⬜ pending |
| 09-04-03 | 04   | 3    | API-05      | smoke/full/manual         | Fast smoke: `yarn --cwd apps/web test:pet`; final gate: `yarn --cwd apps/web test:pet && yarn --cwd apps/web typecheck && yarn --cwd apps/api test && yarn test`                                                                                                                                                                                                                             | ❌ W3       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/web/lib/pet/pet-manifest.test.ts` — validates required poses, frame IDs, duplicate IDs, and WebP sheet frame bounds.
- [ ] `apps/web/lib/pet/pet-engine.test.ts` — validates reduced-motion mode, privacy override priority, target-only jump policy, delta clamping, and viewport clamping.
- [ ] `apps/web/package.json` — contains `test:pet` script that runs pet tests without watch mode.
- [ ] `apps/web` dev dependencies include `tsx` if no existing command can run standalone TypeScript pet tests.

---

## Manual-Only Verifications

| Behavior                                | Requirement | Why Manual                                                                  | Test Instructions                                                                                                             |
| --------------------------------------- | ----------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Pet overlay does not block clicks       | API-05      | Click-through overlay is a browser behavior over real CRM UI                | Enable pet, move/force pet over a button or link, click the underlying CRM control, confirm the control receives the click.   |
| WebP sprite frame is visually nonblank  | API-05      | Pixel/frame correctness is visual unless a browser screenshot test is added | Confirm representative `idle`, `walk`, `jump`, `sleep`, and `privacy` frames render visible pixels from `/pets/cat/cat.webp`. |
| Reduced motion disables active movement | API-05      | Requires browser media emulation                                            | Emulate `prefers-reduced-motion: reduce`; confirm no walking/jumping and sleeper frame stays visible.                         |
| Privacy mode forces privacy pose        | API-05      | Depends on existing browser shortcut/class behavior                         | Toggle privacy mode; confirm current pet pose changes to eyes-covered privacy frame and overrides active behavior.            |
| Mobile reduced behavior                 | API-05      | Responsive viewport behavior needs layout inspection                        | Test mobile viewport; confirm fewer targets/lower-edge behavior and no touch workflow obstruction.                            |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
