# Phase 9: Implement website pet widget - Research

**Researched:** 2026-05-02
**Domain:** Next.js/React fixed overlay animation, WebP sprite sheets, CRM settings persistence
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
## Implementation Decisions

### Pet behavior
- The pet should be playful active, not mostly idle: it can move enough to feel alive.
- Movement must still respect the CRM as a work tool: jumps happen sometimes, not constantly.
- The pet may occasionally show interest in the cursor, but it should not constantly chase the cursor like classic oneko.
- The pet should be able to jump to eligible targets, then lie or sleep on them for a short period.
- Resting on page targets is part of the expected behavior, not only a floor/edge behavior.

### Target element policy
- The pet may jump only to explicitly marked target zones, using a marker such as `data-pet-target`.
- Initial target zones should be existing workspace surfaces: sidebar/header/dashboard panels/calendar blocks and similar broad CRM surfaces.
- The pet must never block CRM clicks. The overlay behavior should allow clicks to pass through page UI even when the pet is visually over an element.
- Mobile behavior should be reduced: fewer targets, less movement, and safe lower-edge behavior so touch workflows are not obstructed.

### Pet model and visual asset contract
- The widget should expose a generic pet API so future pets can be swapped in, but the first shipped pet should be a cat unless a later phase changes the asset.
- The asset format should be a WebP sprite sheet, not SVG symbols. SVG generation was attempted but does not produce acceptable pet sprites.
- Visual style should be a tiny calm vector character, readable around 32-64px, with neutral/black-and-white coloring that does not fight the Warm Ledger CRM palette.
- The first sprite should include the full core pose set: idle, walk, run, jump, land, sit, lie, sleep, scratch, stretch, paw/wave, and fall/drop.
- The sprite sheet manifest should be deterministic so code can switch frames by state and index.

### Controls, accessibility, and privacy
- The user needs an explicit settings toggle to enable or disable the pet. The setting should persist.
- Reduced motion should show a static or near-static sleeping pet instead of walking and jumping.
- Ambient sounds are desired, but they must not surprise the user in a work CRM. They should be controlled by an explicit sound setting and respect browser audio restrictions.
- Privacy mode needs a distinct pet state/sprite: the pet remains visible but changes into a privacy pose where it covers its eyes with a paw.

### Claude's Discretion
- Exact timing values for movement, jump arcs, rest duration, and idle randomness.
- Exact settings placement, provided it is discoverable and does not clutter the main CRM workflow.
- Exact technical split between provider, engine, sprite renderer, and target registration.
- Whether the first implementation ships with a generated placeholder WebP sprite sheet or a final hand-tuned sheet, as long as the frame manifest contract is stable.

### Deferred Ideas (OUT OF SCOPE)
- Multiple selectable pet species beyond the first cat are supported by the API shape but not required as complete user-facing content in this phase.
- Full game/pet-care mechanics, unlockable pets, feeding, stats, or progression belong to future phases.
- Student-facing or public embeddable pet widget behavior is out of scope for this teacher CRM phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-05 | Web feature code follows container/model/presentation boundaries and keeps domain logic out of `components/ui`. | Use `apps/web/lib/pet/*` for engine/model/manifest, `apps/web/components/pet/*` for provider and renderer, `apps/web/app/(workspace)/settings/pet/*` for controls, and API/db settings modules for persistence. Do not put pet engine logic in `components/ui`. |
</phase_requirements>

## Summary

Implement the pet as a workspace-scoped, fixed, click-through overlay rendered by a client provider. The pet should not be a page component and should not be part of `components/ui`; it belongs in a dedicated pet feature boundary with a model/engine layer, a sprite renderer, settings API integration, and small target markers added to broad workspace surfaces.

The locked asset contract is now a WebP sprite sheet plus a deterministic TypeScript manifest. Use CSS sprite rendering with `background-position` as the standard path: it is the direct browser-supported sprite technique, it avoids per-frame image swaps, and it allows frame validation through manifest coordinates. Use `object-position` only as a fallback experiment if background rendering proves unsuitable.

**Primary recommendation:** Build `WebsitePetProvider` inside `WorkspaceProviders`, persist `petSettings` through `/settings/pet`, render one `pointer-events-none fixed` overlay sprite from a WebP sheet/manifest, drive movement with a small `requestAnimationFrame` finite-state engine, and gate behavior by persisted settings, `prefers-reduced-motion`, mobile media queries, and `html.privacy-mode`.

## Standard Stack

### Core

| Library/API | Version | Purpose | Why Standard |
|-------------|---------|---------|--------------|
| Next.js App Router | 16.1.6 | Web app routing/layout and static asset serving | Existing app framework; `public` serves `/pets/...` WebP assets. |
| React | 19.2.4 | Provider composition and client renderer | Existing app stack; refs/effects fit browser API synchronization. |
| Tailwind CSS | 4.1.18 | Overlay and settings styling | Existing styling system and app tokens. |
| Motion for React | 12.23.26 | Existing reduced-motion hook and occasional UI transitions | Already used; `useReducedMotion` actively tracks the user motion preference. |
| Browser Web APIs | Baseline | `requestAnimationFrame`, `matchMedia`, `MutationObserver`, `ResizeObserver`, `getBoundingClientRect`, Page Visibility | Native, current, no extra runtime dependency. |
| CSS sprites | Baseline | WebP sprite frame rendering via `background-position` | MDN documents CSS sprites as a bandwidth/request-saving pattern using background position. |

### Supporting

| Library/API | Version | Purpose | When to Use |
|-------------|---------|---------|-------------|
| Hono | 4.10.7 | `/settings/pet` route | Persist pet enable/sound settings through existing authenticated settings API. |
| Zod | 3.24.3 | Shared pet settings and manifest validation | Add schema in `packages/api-types`; optionally validate manifest in tests. |
| Drizzle ORM | 0.45.1 | `pet_settings` table/repository | Match existing `sidebar_settings` and `theme_settings` persistence pattern. |
| Radix Switch via shadcn | 1.2.6 | Pet enable/sound toggles | Existing `Switch` component under `components/ui`. |
| `sonner` | 2.0.7 | Save/load error feedback | Existing settings providers use toast failures. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS `background-position` sprite | Cropped `<img>` with `object-fit: none` and `object-position` | More semantic image element, but cropping/negative offsets are clumsier; use background sprites for deterministic frame cells. |
| Small custom rAF engine | Motion animation controls for every movement | Motion is good for UI transitions, but a pet needs continuous target/path updates without React re-rendering every frame. |
| WebP sprite sheet | SVG symbols | Explicitly rejected by updated user decision; SVG generation did not produce acceptable pet sprites. |
| API/Postgres pet settings | `localStorage` only | Project state says non-session UI persistence must go through API/Postgres; local cache is acceptable only as optimistic hydration/fallback. |

**Installation:**

```bash
# No core runtime packages required.
# Wave 0 may add a package-local web test runner if automated manifest tests are introduced:
yarn --cwd apps/web add -D tsx
```

## Architecture Patterns

### Recommended Project Structure

```text
apps/web/
├── public/pets/cat/cat.webp
├── lib/pet/
│   ├── pet-manifest.ts          # generic manifest types + cat manifest
│   ├── pet-engine.ts            # finite-state movement model, no React
│   ├── pet-targets.ts           # data-pet-target discovery and rect helpers
│   └── pet-settings.ts          # defaults and client-side normalization
├── components/pet/
│   ├── WebsitePetProvider.tsx   # loads settings, creates engine, renders overlay
│   ├── WebsitePetOverlay.tsx    # fixed click-through overlay shell
│   └── PetSprite.tsx            # WebP sprite frame renderer
└── app/(workspace)/settings/pet/
    ├── page.tsx
    └── PetSettingsClient.tsx

packages/api-types/src/index.ts  # pet settings schema/response types
packages/db/src/schema.ts        # pet_settings table
packages/db/src/settings-repository.ts
apps/api/src/services/settings-service.ts
apps/api/src/routes/settings.ts  # GET/PUT /settings/pet
```

### Pattern 1: Provider Integration

**What:** Mount pet behavior in `WorkspaceProviders`, not `ThemeProviders`, so the pet appears only inside the authenticated CRM shell.

**When to use:** Phase 9 is a workspace feature, not login/auth UI. `WorkspaceLayout` already wraps the sidebar and scroll surface in `WorkspaceProviders`.

**Example:**

```tsx
// Source: existing apps/web/app/providers.tsx provider composition.
export function WorkspaceProviders({ children }: { children: React.ReactNode }) {
	return (
		<SidebarSettingsProvider>
			<WebsitePetProvider>{children}</WebsitePetProvider>
		</SidebarSettingsProvider>
	)
}
```

**Impact note:** Before editing `WorkspaceProviders` or `PrivacyModeProvider`, implementation agents must run GitNexus impact analysis on the symbol and report direct callers. Expected risk is low for `WorkspaceProviders` because it only composes workspace providers, but verify first.

### Pattern 2: WebP Sprite Manifest

**What:** Store the WebP in `apps/web/public/pets/cat/cat.webp` and pair it with a typed deterministic manifest in `apps/web/lib/pet/pet-manifest.ts`.

**When to use:** Always. The manifest is the contract the engine uses; frame lookup must not depend on fragile filename parsing.

**Example:**

```ts
// Source: MDN CSS sprite/background-position docs + Next public static asset docs.
export type PetPose =
	| 'idle'
	| 'walk'
	| 'run'
	| 'jump'
	| 'land'
	| 'sit'
	| 'lie'
	| 'sleep'
	| 'scratch'
	| 'stretch'
	| 'paw'
	| 'fall'
	| 'privacy'

export type PetFrame = {
	id: `${PetPose}_${number}`
	x: number
	y: number
	width: number
	height: number
	durationMs: number
	anchor: { x: number; y: number }
}

export type PetSpriteManifest = {
	id: 'cat'
	imageSrc: '/pets/cat/cat.webp'
	sheet: { width: number; height: number; frameWidth: number; frameHeight: number }
	states: Record<PetPose, readonly PetFrame[]>
}
```

**Recommended defaults:** use a uniform grid if possible, e.g. 64x64 frame cells, 12 columns, transparent WebP. Keep the first implementation readable at 32-64 CSS px. Include a `privacy` pose even if it is a single frame.

### Pattern 3: Sprite Rendering

**What:** Render a single fixed-size decorative element with a WebP background. Change frame by setting `backgroundPosition` from the manifest.

**When to use:** Every rendered pet frame. Avoid changing `src` per frame.

**Example:**

```tsx
// Source: MDN CSS sprites/background-position docs.
export function PetSprite({ manifest, frame }: { manifest: PetSpriteManifest; frame: PetFrame }) {
	return (
		<span
			aria-hidden="true"
			className="block bg-no-repeat"
			style={{
				width: frame.width,
				height: frame.height,
				backgroundImage: `url(${manifest.imageSrc})`,
				backgroundSize: `${manifest.sheet.width}px ${manifest.sheet.height}px`,
				backgroundPosition: `-${frame.x}px -${frame.y}px`,
			}}
		/>
	)
}
```

### Pattern 4: rAF Engine Outside React Render

**What:** Keep continuous position, velocity, timers, current target, and frame clock in a small engine object or refs. Use React state only for coarse UI/settings changes or low-frequency frame index changes.

**When to use:** Movement, jumps, idle timers, target rest behavior, cursor interest.

**Example:**

```ts
// Source: MDN requestAnimationFrame + React useRef/useEffect guidance.
let frameId = 0
let previous = performance.now()

function tick(now: number) {
	const deltaMs = Math.min(now - previous, 64)
	previous = now
	engine.step(deltaMs)
	renderTransform(engine.snapshot())
	frameId = window.requestAnimationFrame(tick)
}

frameId = window.requestAnimationFrame(tick)
return () => window.cancelAnimationFrame(frameId)
```

**Rules:** clamp large deltas after background-tab pauses, pause or sleep when `document.hidden`, and use `transform: translate3d(...)` instead of animating `top`/`left`.

### Pattern 5: Explicit Target Discovery

**What:** Discover only `[data-pet-target]` elements. Read `getBoundingClientRect()` immediately before choosing or landing on a target, then clamp the rest position to the viewport.

**When to use:** Jump target selection, rest positions, and mobile target filtering.

**Example:**

```ts
// Source: MDN querySelectorAll, getBoundingClientRect, MutationObserver, ResizeObserver.
export function listPetTargets() {
	return Array.from(document.querySelectorAll<HTMLElement>('[data-pet-target]'))
		.map((element) => ({ element, rect: element.getBoundingClientRect() }))
		.filter(({ rect }) => rect.width >= 96 && rect.height >= 40 && rect.bottom > 0 && rect.top < window.innerHeight)
}
```

**Target placement:** Start with broad existing surfaces: dashboard summary/focus panels, lesson/calendar panels, sidebar surface, settings headers, and calendar blocks. Do not mark buttons, inputs, table cells, dialogs, or private text as targets.

### Pattern 6: Privacy and Reduced Motion

**What:** Observe `html.privacy-mode` for privacy pose; use `useReducedMotion()` and `matchMedia('(pointer: coarse)')`/mobile width queries to reduce behavior.

**When to use:** Always. Reduced motion should short-circuit walking/jumping into a static or near-static sleeper frame.

**Example:**

```ts
// Source: existing PrivacyModeProvider uses html.privacy-mode; MDN MutationObserver.
const observer = new MutationObserver(() => {
	engine.setPrivacyMode(document.documentElement.classList.contains('privacy-mode'))
})

observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
```

**Recommendation:** Do not refactor `PrivacyModeProvider` unless implementation needs a public toggle API. Observing the class is enough for this phase and avoids expanding the blast radius.

### Anti-Patterns to Avoid

- **Pet logic in `components/ui`:** violates API-05 and pollutes shared primitives.
- **React state updates every animation frame:** causes unnecessary app re-renders. Use refs/direct style updates for movement.
- **Raw `top`/`left` animation:** app rules require transform-based movement.
- **Global overlay with `pointer-events-auto`:** risks blocking CRM work. Overlay and sprite must default to `pointer-events-none`.
- **Jumping to unmarked elements:** violates explicit target policy and can land on controls/private data.
- **Sound autoplay on load:** browser restrictions and CRM context both require explicit user intent.
- **Pet on login page:** phase is CRM shell only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sprite frame coordinates | Filename parsing or DOM scanning | Typed manifest + compile/runtime invariant tests | Deterministic, future-pet compatible, easy to validate. |
| Click-through behavior | Manual event forwarding | CSS `pointer-events: none` on overlay/sprite | Native browser behavior and less failure-prone. |
| Target discovery | Heuristic "interesting element" detection | `[data-pet-target]` only | Prevents blocking controls and private CRM data. |
| Reduced-motion detection | Custom OS/browser sniffing | `useReducedMotion()`/`matchMedia('(prefers-reduced-motion: reduce)')` | Existing app pattern and official browser API. |
| Privacy detection | Duplicated keyboard shortcut/state | Existing `html.privacy-mode` class observed by the pet | Maintains one privacy source of truth. |
| Audio permission handling | Autoplay unlock hacks | Explicit sound toggle plus play only after user gesture | Browsers may reject autoplay; surprise audio is not acceptable. |
| Persistence | Browser-only localStorage setting | `/settings/pet` + Postgres/memory fallback | Matches project state and existing settings pattern. |

**Key insight:** The custom part is the pet state machine, not the browser plumbing. Keep the engine small and deterministic, but rely on native browser APIs for animation timing, layout measurement, media preferences, target observation, and click-through behavior.

## Common Pitfalls

### Pitfall 1: Overlay Blocks CRM Work

**What goes wrong:** The pet visually sits over a button or calendar event and absorbs clicks.

**Why it happens:** A fixed overlay or sprite defaults to receiving pointer events.

**How to avoid:** Apply `pointer-events-none` to the overlay container and sprite. Do not attach click handlers to the pet in this phase.

**Warning signs:** Buttons under the pet cannot be clicked; Playwright/manual test clicks hit the overlay.

### Pitfall 2: Layout Thrashing From Target Reads

**What goes wrong:** The app feels slow because every animation frame calls `querySelectorAll()` and `getBoundingClientRect()`.

**Why it happens:** DOM discovery and layout reads are mixed into the rAF loop.

**How to avoid:** Mark target cache dirty on mutation/resize/scroll, then read rects only before selecting a target or landing. For scroll, a capture listener can mark dirty without adding new scroll containers.

**Warning signs:** rAF frame budget spikes, target list is rebuilt every tick, or scroll stutters in the calendar.

### Pitfall 3: Sprite Frame Drift

**What goes wrong:** State `walk_3` renders the wrong body part or a blank cell.

**Why it happens:** Manifest coordinates do not match the WebP sheet dimensions or exported grid.

**How to avoid:** Add manifest invariant tests: every frame is inside sheet bounds, each required pose exists, frame IDs match `${pose}_${index}`, no duplicate IDs, and a browser check confirms visible pixels for representative poses.

**Warning signs:** Negative/overflow coordinates, inconsistent frame sizes, blank screenshot for a required pose.

### Pitfall 4: Reduced Motion Still Moves

**What goes wrong:** Users with reduced motion still see walking, jumps, or cursor interest.

**Why it happens:** CSS media query exists, but JS engine continues to move the sprite.

**How to avoid:** Reduced motion must disable active engine states, not only CSS transitions. Render sleep/privacy static frame with only tiny or no frame changes.

**Warning signs:** rAF loop continues active movement while `prefers-reduced-motion: reduce` is emulated.

### Pitfall 5: Privacy Pose Competes With Privacy Masking

**What goes wrong:** Pet keeps playful states while CRM data is blurred.

**Why it happens:** Pet state has no signal from `PrivacyModeProvider`.

**How to avoid:** Observe `html.privacy-mode` and force `privacy` pose over every other state. Do not let cursor interest or target jumps override privacy.

**Warning signs:** `html.privacy-mode` is present but the current pet frame ID is not `privacy_0` or another privacy frame.

### Pitfall 6: Settings Drift From Project Persistence Rule

**What goes wrong:** Pet appears enabled on one browser but not another, or setting disappears after clearing browser data.

**Why it happens:** Implementation uses only `localStorage`.

**How to avoid:** Add `/settings/pet` to the existing settings route/service/repository pattern, with memory fallback for local/test mode.

**Warning signs:** No shared schema in `packages/api-types`, no API test coverage, no DB/memory fallback.

## Code Examples

Verified patterns from official/current sources and repo patterns:

### CSS Sprite Frame

```tsx
// Source: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Images/Implementing_image_sprites
const style = {
	width: frame.width,
	height: frame.height,
	backgroundImage: `url(${manifest.imageSrc})`,
	backgroundSize: `${manifest.sheet.width}px ${manifest.sheet.height}px`,
	backgroundPosition: `-${frame.x}px -${frame.y}px`,
}
```

### Reduced Motion Hook

```tsx
// Source: https://motion.dev/docs/react-use-reduced-motion
const shouldReduceMotion = useReducedMotion()
const mode = shouldReduceMotion ? 'sleep' : settings.enabled ? 'active' : 'off'
```

### Visibility Pause

```ts
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
document.addEventListener('visibilitychange', () => {
	engine.setPaused(document.hidden)
})
```

### Pet Settings Schema

```ts
// Source: existing packages/api-types settings schemas.
export const petSettingsSchema = z.object({
	enabled: z.boolean().default(true),
	soundEnabled: z.boolean().default(false),
	activityLevel: z.enum(['reduced', 'normal', 'playful']).default('normal'),
})

export const petSettingsResponseSchema = z.object({
	ok: z.literal(true),
	settings: petSettingsSchema,
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SVG `<symbol>` frames | WebP sprite sheet + deterministic frame manifest | 2026-05-02 user clarification | Planner must remove SVG-symbol work and validate raster frame coordinates instead. |
| GIF-like animated asset | Single WebP sheet controlled by JS/CSS | Current recommendation | Enables privacy/reduced-motion state overrides and deterministic tests. |
| Animation library drives every movement | rAF engine + transform style updates | Current React/browser practice | Avoids React re-rendering every frame while keeping provider state declarative. |
| Heuristic DOM target selection | Explicit `[data-pet-target]` zones | Phase decision | Keeps pet non-blocking and privacy-compatible. |

**Deprecated/outdated:**

- SVG symbol sprite contract: out of scope after user clarification.
- Autoplay ambient sound: not acceptable; sound must be explicitly enabled and user-gesture initiated.
- Browser-only CRM setting persistence: conflicts with current project decision for non-session UI persistence.

## Open Questions

1. **Should ambient sound ship in Phase 9 or be represented only by a disabled persisted setting?**
   - What we know: User wants ambient sounds eventually, but not surprising audio.
   - What's unclear: Whether an actual audio asset exists or should be generated now.
   - Recommendation: Implement persisted `soundEnabled` defaulting false and only play if an audio asset is present and the toggle is changed by user gesture.

2. **Should the first WebP sheet be final art or placeholder art?**
   - What we know: Claude has discretion if the manifest contract is stable.
   - What's unclear: Asset quality may require external generation/tuning.
   - Recommendation: Ship a placeholder WebP if needed, but make manifest/frame IDs final and include the privacy pose.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Existing: TypeScript `tsc`, ESLint, API smoke tests via `node --import tsx`; web has no browser/unit test runner yet |
| Config file | `apps/web/tsconfig.json`, `apps/web/eslint.config.mjs`, `apps/api/src/app.test.ts` |
| Quick run command | `yarn --cwd apps/web test` |
| Full suite command | `yarn test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| API-05 | Pet engine/manifest logic lives under `apps/web/lib/pet`, renderer/provider under `components/pet`, settings UI under `app/(workspace)/settings/pet`, and no pet logic lands in `components/ui` | architecture/static | `rg -n "pet|Pet" apps/web/components/ui apps/web/lib/pet apps/web/components/pet` plus `yarn --cwd apps/web typecheck` | ❌ Wave 0 |
| API-05 | Pet settings persist through API/Postgres/memory fallback | integration | `yarn --cwd apps/api test` after adding `/settings/pet` smoke assertions | ❌ Wave 0 |
| API-05 | Manifest includes all required poses and valid in-bounds frame coordinates | unit | `yarn --cwd apps/web test:pet` | ❌ Wave 0 |
| API-05 | Overlay never blocks clicks and only targets `[data-pet-target]` | browser/manual | Manual browser check or Playwright if added | ❌ Wave 0 |
| API-05 | Reduced motion renders static/near-static sleeper and privacy mode forces privacy frame | browser/manual | Manual browser check with reduced-motion emulation and `html.privacy-mode` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `yarn --cwd apps/web test` for frontend-only tasks; `yarn --cwd apps/api test` when settings API/db changes are touched.
- **Per wave merge:** `yarn test`.
- **Phase gate:** Full suite green plus manual browser verification at desktop and mobile viewport sizes.

### Wave 0 Gaps

- [ ] `apps/web/lib/pet/pet-manifest.test.ts` - validates required poses, deterministic IDs, frame bounds, duplicate frame IDs, and selected frame coordinates.
- [ ] `apps/web/lib/pet/pet-engine.test.ts` - validates reduced-motion mode, privacy override priority, target-only jump policy, delta clamping, and viewport clamping.
- [ ] `apps/web/package.json` - add `test:pet` script, likely `node --import tsx lib/pet/pet-manifest.test.ts && node --import tsx lib/pet/pet-engine.test.ts`; add package-local `tsx` devDependency if needed.
- [ ] `apps/api/src/app.test.ts` - add `/settings/pet` GET/PUT smoke coverage matching existing sidebar/theme settings tests.
- [ ] Browser verification checklist - because WebP frame correctness and click-through behavior are visual/DOM outcomes:
  - Enable pet in settings, refresh, confirm it remains enabled.
  - Confirm the pet appears only in workspace routes, not `/login`.
  - Click CRM buttons/links underneath the pet; clicks must pass through.
  - Add `data-pet-target` to broad panels only; verify jumps never choose unmarked controls.
  - Emulate `prefers-reduced-motion: reduce`; verify no walking/jumping and sleeper frame displays.
  - Toggle privacy mode with existing shortcut; verify privacy frame replaces active pose.
  - Mobile viewport: verify reduced movement and lower-edge safe behavior.
  - Browser devtools image check: WebP sheet loads, representative `idle`, `walk`, `jump`, `sleep`, and `privacy` frames show nonblank pixels.

## Sources

### Primary (HIGH confidence)

- Existing repo files: `apps/web/app/providers.tsx`, `apps/web/app/(workspace)/layout.tsx`, `apps/web/components/PrivacyModeProvider.tsx`, `apps/web/components/calendar/CalendarViewStage.tsx`, `apps/web/app/globals.css`, `apps/api/src/services/settings-service.ts`, `apps/api/src/routes/settings.ts`, `packages/db/src/settings-repository.ts`, `packages/api-types/src/index.ts`.
- GitNexus repo index `dv-lab` - provider/layout/settings/privacy symbols and generated local codebase skills.
- MDN `requestAnimationFrame` - https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- MDN `pointer-events` - https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events
- MDN CSS image sprites - https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Images/Implementing_image_sprites
- MDN `background-position` - https://developer.mozilla.org/docs/Web/CSS/background-position
- MDN image format guide/WebP - https://developer.mozilla.org/docs/Web/Media/Guides/Formats/Image_types
- MDN `getBoundingClientRect` - https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect
- MDN `querySelectorAll` - https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelectorAll
- MDN `MutationObserver` - https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
- MDN `ResizeObserver` - https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
- MDN Page Visibility API - https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- MDN `matchMedia` - https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia
- React `useRef` - https://react.dev/reference/react/useRef
- React `useEffect` - https://react.dev/reference/react/useEffect
- Motion `useReducedMotion` - https://motion.dev/docs/react-use-reduced-motion
- Next.js public static assets - https://nextjs.org/docs/app/building-your-application/optimizing/static-assets

### Secondary (MEDIUM confidence)

- None needed; primary sources and repo inspection were sufficient.

### Tertiary (LOW confidence)

- None used for recommendations.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - verified from `package.json`, repo files, and official docs.
- Architecture: HIGH - based on existing provider/settings patterns and API-05 boundary requirement.
- WebP sprite contract: HIGH - user decision is locked; rendering pattern verified by MDN CSS sprite/background-position docs.
- Pitfalls: HIGH - derived from browser API behavior, app rules, and existing privacy/reduced-motion implementation.
- Validation: MEDIUM - existing automated web testing is thin; browser/manual checks are required unless Wave 0 adds a runner.

**Research date:** 2026-05-02
**Valid until:** 2026-06-01 for browser/React patterns; re-check package versions before implementation if dependency updates land.
