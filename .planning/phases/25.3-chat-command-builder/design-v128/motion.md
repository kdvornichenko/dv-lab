# Motion

Motion in variant A is small, quick and quiet. It confirms that the interface heard the user and keeps spatial context; it never decorates. All values below come from the lab (`src/lib/springs.ts` and the components that use it); Emil Kowalski's design-engineering rules were used only to word the rules and to flag cautions.

Motion is a section and not a token family because a spring is a set of parameters, not one value. The plain numbers it uses are in `tokens.json` as `duration-*`, `exit-*`, `stagger-step` and `tooltip-*`; the shapes below say how to combine them.

## The three tiers

Springs from `framer-motion`, used through one shared `spring` object. The app loads the library under `LazyMotion` (`domMin`), so every animated element is `m.*` (`m.div`, `m.span`) imported from `framer-motion`; importing `motion` from it is forbidden by an ESLint rule. Bounce is zero except on the slow tier.

| Tier | Duration | Bounce | Exit | Use for |
|---|---|---|---|---|
| `fast` | 0.08s | 0 | 0.06s | Select and dropdown popups, the hover preview and focus ring that follow the pointer between tabs |
| `moderate` | 0.16s | 0 | 0.12s | Messages and blocks entering, tab selection, list rows, the switch thumb, change prompts |
| `slow` | 0.24s | 0.12 | 0.16s | Dialogs and their backdrop, the banner |

Colour, stroke and font-weight changes on hover use CSS at `duration-fast` (80ms). The sidebar fades with CSS opacity at 160ms closing and 240ms opening.

## Entrance shapes

| Element | From | To | Tier |
|---|---|---|---|
| Chat message (user or assistant) | opacity 0, y 8 | opacity 1, y 0 | moderate |
| Blocks under an assistant message | opacity 0, y 6 | opacity 1, y 0 | moderate |
| Dialog | opacity 0, scale 0.97 (y 0 when top-aligned) | opacity 1, scale 1 | slow, backdrop on slow |
| Offline or loading pill | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Offline or loading pill | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Offline or loading pill | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Offline or loading pill | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Assistant star, reply ready | y 0 | y −14, then back | moderate (one hop and a wink) |
| Chat block over the star's field | opacity 0, y 8 | opacity 1, y 0 | moderate, exit fast, opacity only |
| Chat panel beside the page | wrapper width 0, the 416px card at x 100% | width 416, x 0 | slow, exit slow exit; reduced motion: none |
| Offline or loading pill | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Chat panel beside the page | wrapper width 0, the 416px card at x 100% | width 416, x 0 | slow, exit slow exit; reduced motion: none |
| Offline or loading pill | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Chat panel beside the page | wrapper width 0, the 416px card at x 100% | width 416, x 0 | slow, exit slow exit; reduced motion: none |
| Offline or loading pill | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Chat panel beside the page | wrapper width 0, the 416px card at x 100% | width 416, x 0 | slow, exit slow exit; reduced motion: none |
| Offline or loading pill | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Chat panel beside the page | wrapper width 0, the 416px card at x 100% | width 416, x 0 | slow, exit slow exit; reduced motion: none |
| Offline or loading pill | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Chat panel beside the page | wrapper width 0, the 416px card at x 100% | width 416, x 0 | slow, exit slow exit; reduced motion: none |
| Offline or loading pill | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Chat panel beside the page | wrapper width 0, the 416px card at x 100% | width 416, x 0 | slow, exit slow exit; reduced motion: none |
| Offline or loading pill | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Chat panel beside the page | wrapper width 0, the 416px card at x 100% | width 416, x 0 | slow, exit slow exit; reduced motion: none |
| Offline or loading pill | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Chat panel beside the page | wrapper width 0, the 416px card at x 100% | width 416, x 0 | slow, exit slow exit; reduced motion: none |
| Offline or loading pill | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Chat panel beside the page | wrapper width 0, the 416px card at x 100% | width 416, x 0 | slow, exit slow exit; reduced motion: none |
| Offline or loading pill | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Chat panel beside the page | wrapper width 0, the 416px card at x 100% | width 416, x 0 | slow, exit slow exit; reduced motion: none |
| Offline or loading pill | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Chat panel beside the page | wrapper width 0, the 416px card at x 100% | width 416, x 0 | slow, exit slow exit; reduced motion: none |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Update notice (toast) | opacity 0, y 8 (y −8 from above on a phone) | opacity 1, y 0 | moderate, exit fast, opacity only |
| Dialog on a phone (full screen) or a bottom sheet | y 100% | y 0 | slow, exit fast; reduced motion: opacity only |
| Edge zone band and chevron (carrying a frame) | opacity 0 | opacity 1 | fast, exit fast, opacity only |
| Touch frame after the long press | opacity 0, scale 0.96 | opacity 1, scale 1 | fast |
| Select or dropdown popup | opacity 0, scaleY 0.96, small y offset toward the trigger | opacity 1, scaleY 1, y 0 | fast, exit fast |
| Change prompt | opacity 0, y -4, scale 0.98 | opacity 1, y 0, scale 1 | moderate |
| Dialog list sliding over the conversation (chat page and chat panel) | opacity 0, y -12 | opacity 1, y 0 | moderate |
| List row in that list | opacity 0, y -6 | opacity 1, y 0 | moderate, delay `min(index, 8) * stagger-step` |
| Tab selection pill | travels between tabs | lands without overshoot | moderate, opacity 60 to 80ms |
| Switch thumb | slides and snaps | | moderate |
| Phone week page (swipe, arrows) | the strip follows the finger 1:1 with no resistance | settles on the next or previous week with no overshoot; 25% of the width or 0.3px/ms commits, less springs back | slow duration (0.24s) with bounce 0, started from the release velocity, interruptible mid-way |

Exits mirror the entrance with the tier's exit duration and are always shorter than the entrance.

## Rules

1. **Animate to confirm or to keep context, never to decorate.** Every motion answers one of: the interface heard you (press, select), where did this come from (popup near its trigger, message from below), or what changed (row appears).
2. **Stay inside the tiers.** Nothing in the app takes longer than 240ms except the 4s countdown bar. A new surface picks the closest tier; do not add a fourth.
3. **Never animate from nothing.** Entrances start at opacity 0 with a small offset or scale of 0.96 or more, never `scale(0)`.
4. **Origin-aware popups, centred dialogs.** Dropdowns, selects, tooltips and the mention list scale from their trigger (`--transform-origin`). Dialogs stay centred.
5. **Exit faster than enter.** Use the tier's `exit` value. Slow where the user decides, fast where the system responds.
6. **Do not animate what is repeated all day.** Arrow-key movement in lists and menus, typing, and focus changes are instant. Toggling the ⌘K palette is the line to watch: it is a daily, keyboard-initiated action, so keep its open and close at `fast` or instant if it ever feels slow.
7. **Reduced motion keeps meaning, drops movement.** Every `m.*` path calls `useReducedMotion`; with it on, `y`, `scale` and stagger are removed and only opacity remains (`initial` skipped for list rows). Spinners and the streaming caret use `motion-safe`/`motion-reduce` classes.
8. **A shimmer passes left to right** (v114, owner: the chat text shimmer ran from the right). The light band of the running line of `ChatProgress` and of `Skeleton` travels with the reading direction, from the left end to the right, and each pass starts again at the left; it never runs back. With reduced motion it does not move.
8. **Animate `transform` and `opacity` only.** Do not animate height, width, padding or margin of anything that can sit in a list; let the layout jump or use the sidebar's `opacity` plus `display` transition.
9. **Stagger is capped and never blocks.** 30ms per row, at most 8 rows, content is clickable from the first frame.
10. **Tooltips.** Default delay 200ms with a 300ms skip window so moving across a toolbar is instant after the first. Status-dot tooltips open at 0ms because the dot has no other label.
11. **Hover is for pointers.** Addition, not in the lab: hover fills and previews apply only when `(hover: hover) and (pointer: fine)`, so touch devices do not get stuck hover states.
12. **Buttons have no press animation in the lab.** A `scale(0.97)` on `:active` is an open suggestion from the review, not a rule; ask the owner before adding it.
13. **Time-boxed states use a linear bar.** The change prompt closes four seconds after it is resolved; the bar shrinks linearly with `transform: scaleX`.
14. **Unmount after the exit.** A popup keeps its portal until its exit tween completes; a timer at the tier's exit duration plus 100ms (`exitFallbackMs`) force-unmounts it if the tab is throttled.
15. **A skeleton gives way by a crossfade, nothing else** (v67). Opacity only, in place: the skeleton out in 120ms, the content in 160ms, `ease-out`, no offset, no scale, no stagger, instant under reduced motion. It runs only where a skeleton is replaced, never on navigation itself and never on a page's first paint. See `SkeletonSwap`.

16. **Attention pulse on a balance dot** (v96). A ring behind the dot, `scale(1 to 2.6)` and `opacity` (peak 0.4, Owes 0.6, to 0) on `ease-out`, 1.2 to 1.8s a pulse, 2 or 3 pulses, 300ms after the view opens, once per view, under 5 seconds in all, none under `prefers-reduced-motion`. Table, `DueList` and the profile only. See `Table`.

## Notes for review

- Springs have no CSS equivalent. When a CSS fallback is needed use `ease-out` over the tier's duration; never `ease-in`.
- Framer Motion's `y` and `scale` shorthands run on the main thread. They are fine for the short, one-off entrances above; for anything that must stay smooth while the page loads, use a `transform` string or a CSS transition.
- The slow tier's bounce of 0.12 is the only overshoot in the system. Keep it to dialogs and the banner.

**Exception: the assistant star** (v126, owner). Its idle loop (float, breath, glances, blinks, the eyes following the pointer) is continuous and decorative, which rules 1 and 2 forbid everywhere else; it is the one exception, on the owner's request, and it stops under reduced motion, off screen and in a hidden tab. Its springs wobble and overshoot, which the notes below allow nowhere else; they are those of the owner's `FrostCloud.tsx`; every other motion of the star's field and block uses the tiers above.
