# Phase 9: Implement website pet widget - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning

> 2026-05-02 update: the current asset direction supersedes earlier sprite-sheet notes. The pet uses standalone animated WebP files rendered through a native `img`; runtime code moves the `img` element and switches `src` by pose only when needed. Do not implement manual frame switching, sheet coordinates, CSS `background-position`, canvas rendering, or SVG sprites.

<domain>
## Phase Boundary

Add an animated website pet overlay to the existing Teacher CRM web app. The pet should feel like a small companion inside the operational app shell: it can walk around the viewport, occasionally show interest in the cursor, jump to explicitly marked page elements, rest on those elements, and expose user controls for turning the feature down or off.

This phase does not create a full game, pet care system, unlock system, student-facing feature, or external widget platform. It clarifies and implements the in-app pet overlay capability only.

</domain>

<decisions>
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
- The asset format should be standalone animated WebP files, not SVG symbols and not manual sprite sheets. SVG generation was attempted but does not produce acceptable pet sprites; a test animated `cat-sleep.webp` in the sidebar works correctly.
- Visual style should be a tiny pixel-art cat, readable around 64-120px, with neutral coloring that does not fight the Warm Ledger CRM palette.
- The first asset set should include at least animated sleep and walk WebP files. Other poses may temporarily reuse existing animated WebP files through explicit manifest metadata until dedicated art exists.
- The manifest should be deterministic so code can switch animated WebP `src` by pose; animated WebP owns the internal frame loop.

### Controls, accessibility, and privacy

- The user needs an explicit settings toggle to enable or disable the pet. The setting should persist.
- Reduced motion should show a static or near-static sleeping pet instead of walking and jumping.
- Ambient sounds are desired, but they must not surprise the user in a work CRM. They should be controlled by an explicit sound setting and respect browser audio restrictions.
- Privacy mode needs a distinct pet state/sprite: the pet remains visible but changes into a privacy pose where it covers its eyes with a paw.

### Claude's Discretion

- Exact timing values for movement, jump arcs, rest duration, and idle randomness.
- Exact settings placement, provided it is discoverable and does not clutter the main CRM workflow.
- Exact technical split between provider, engine, sprite renderer, and target registration.
- Exact manifest metadata for temporary pose-to-asset mappings, as long as runtime rendering remains native animated WebP `img` movement without manual frame switching.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project and frontend rules

- `.planning/ROADMAP.md` — Phase 9 scope and dependency on Phase 8.
- `.planning/PROJECT.md` — Product purpose, stack, and Teacher CRM constraints.
- `.planning/REQUIREMENTS.md` — Existing v1 requirements and out-of-scope boundaries.
- `.planning/STATE.md` — Current project decisions, especially private teacher CRM workflow context.
- `apps/web/AGENTS.md` — Frontend design, motion, scroll, and operational UI rules.

### Existing app integration

- `apps/web/app/layout.tsx` — Root layout where global providers wrap the app.
- `apps/web/app/providers.tsx` — Existing app-wide provider composition and likely integration point for a pet provider.
- `apps/web/app/(workspace)/layout.tsx` — Workspace shell, sidebar, scroll surface, and operational viewport structure.
- `apps/web/app/globals.css` — Global reduced-motion rules and privacy-mode CSS.
- `apps/web/components/PrivacyModeProvider.tsx` — Existing privacy mode state and shortcut behavior that pet privacy state should observe.
- `apps/web/components/calendar/CalendarViewStage.tsx` — Existing `motion/react` and reduced-motion usage pattern.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `apps/web/app/providers.tsx`: app-wide providers already wrap the application; a `PetProvider` or `WebsitePetProvider` can fit alongside `PrivacyModeProvider` without page-level wiring.
- `apps/web/components/PrivacyModeProvider.tsx`: privacy mode is currently represented by a document class; the pet can observe the same state indirectly through DOM class or a shared provider if planning chooses to refactor.
- `apps/web/components/calendar/CalendarViewStage.tsx`: uses `motion/react` and `useReducedMotion`, providing an existing pattern for motion that respects accessibility.
- `apps/web/app/globals.css`: already contains global `prefers-reduced-motion` handling and `privacy-mode` styles.

### Established Patterns

- Frontend code is React 19 + Next.js App Router + Tailwind CSS 4 + shadcn/ui.
- App shell uses provider composition rather than page-local global behavior.
- Workspace layout uses `SidebarProvider`, `SidebarInset`, and shadcn `ScrollArea`; pet overlay should not introduce raw scroll containers.
- Motion should be short, purposeful, interruptible, and respectful of `prefers-reduced-motion`.
- UI should remain calm and operational; the pet is a companion layer, not a marketing mascot or dashboard card.

### Integration Points

- Global render point: root `ThemeProviders` in `apps/web/app/providers.tsx`.
- Workspace target zones: future implementation can add `data-pet-target` to broad surfaces in workspace pages/components.
- Privacy integration: document class `privacy-mode` currently controls private data masking and should also trigger the pet privacy pose.
- Settings integration: existing settings areas/providers can host the pet enable/sound controls during planning.

</code_context>

<specifics>
## Specific Ideas

- User asked for a pet such as a cat that walks around the screen, jumps on elements, and lies down.
- User initially requested a sprite-generation prompt with explicit SVG sprite parameters, frames, and poses, but then clarified that SVG generation is not acceptable. The selected direction is now a WebP sprite sheet with a deterministic frame manifest.
- The pet privacy state should be visually specific: a sprite where the pet covers its eyes with a paw.
- The first pet should be implemented through a generic API but the concrete initial asset can be a cat.

</specifics>

<deferred>
## Deferred Ideas

- Multiple selectable pet species beyond the first cat are supported by the API shape but not required as complete user-facing content in this phase.
- Full game/pet-care mechanics, unlockable pets, feeding, stats, or progression belong to future phases.
- Student-facing or public embeddable pet widget behavior is out of scope for this teacher CRM phase.

</deferred>

---

_Phase: 09-implement-website-pet-widget_
_Context gathered: 2026-05-02_
