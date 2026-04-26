# apps/web Agent UI Rules

These rules apply to all work under `apps/web`. Follow the root `AGENTS.md` first, then this file for web UI and frontend behavior.

## Product Context

This app is a private English teacher CRM for daily lesson and payment control. It is for one teacher managing students, lesson attendance, manual payments, billing modes, Google Calendar sync, and payment risk.

The UI must feel like a calm operational teaching studio, not a SaaS landing page or a generic admin template. The first screen should quickly answer:

- What lessons happen today?
- Who needs payment or attendance attention?
- Which student/package is at risk?
- What quick action should the teacher take next?

## Design Direction

Use the **Warm Ledger / Teaching Studio** direction.

- Calm, precise, private, and work-focused.
- Warm paper-like canvas with white ledger surfaces.
- Medium density for summaries, medium-high density for tables.
- Financial and schedule data must scan quickly.
- Avoid marketing composition, decorative hero sections, oversized cards, and generic SaaS polish.

## Visual Tokens

Prefer these tokens when creating or redesigning components:

- Canvas: `#F7F5EF`
- Surface: `#FFFFFF`
- Muted surface: `#FBFAF6`
- Primary text: `#181713`
- Muted text: `#6F6B63`
- Border: `#E6E0D4`
- Accent: `#2F6F5E`
- Accent soft: `#E7F0EC`
- Warning: `#9A6A1F`
- Danger: `#A64235`
- Success: `#3F7A4D`

Use exactly one product accent: muted sage/teal. Do not introduce purple/blue AI gradients, neon glow, or sky-blue as the main brand color.

## Typography

- Use a premium sans stack such as `Geist Sans` or `Satoshi` for UI text.
- Use `Geist Mono` or `JetBrains Mono` for money, counts, dates, lesson balances, payment deadlines, and compact metadata.
- Use tabular numbers for all money and operational counters.
- Do not use Arial/Helvetica as the product style.
- Keep dashboard headings restrained. This is a working app, not a landing page.

## Layout Rules

- Keep the app shell operational: sidebar/top bar/main workspace.
- The top area should prioritize date, status, quick actions, and urgent attention.
- Main workspace should use a contained layout around `max-w-[1440px]`.
- On desktop, prefer a main content column plus a right attention rail.
- On mobile, collapse to one column in this order: today, attention/payment risk, students, secondary panels.
- Do not put cards inside cards. Use dividers, sections, and whitespace for grouping when elevation is not meaningful.
- Prefer CSS Grid for dashboard regions and tables over flexbox width math.
- Use `min-h-dvh` for full viewport surfaces, not `h-screen`.

## Dashboard Information Architecture

New dashboard components should support these zones:

1. **Today Control**
   - Lessons for today as a timeline or compact agenda.
   - Include time, student/group, topic, duration, attendance status, and calendar sync status.
   - Primary action is marking attendance. Calendar sync is secondary.

2. **Attention Queue**
   - Missing attendance.
   - Overdue payments.
   - Upcoming payment due soon.
   - Low remaining package lessons.
   - Calendar sync failures.

3. **Ledger Summary**
   - Active students.
   - Today lessons.
   - Missing marks.
   - Overdue students.
   - Month income.

4. **Quick Actions**
   - Add student.
   - Add lesson.
   - Record payment.
   - Mark attendance.

## Student Ledger

Student lists should behave like an operational ledger, not a contact directory.

Preferred table columns:

- Student
- Level
- Billing mode
- Package/monthly plan
- Lessons left
- Next payment
- Balance
- Status
- Actions

Current model fields include `billingMode`, `defaultLessonPrice`, `balance`, `unpaidLessonCount`, and `overdue`. Leave visual room for future package fields such as `packageMonths`, `lessonsPerMonth`, `packageTotalLessons`, `packageRemainingLessons`, `nextPaymentDueAt`, `packageStartsAt`, and `packageEndsAt`.

## Payments

Payment UI should feel like a ledger.

- Show month income, overdue total, and paid this week before recent transactions.
- Prioritize payment risk over simple recency.
- Use mono/tabular values for all amounts.
- Use restrained danger/warning treatments; do not flood entire cards with red.
- Labels should be concrete: `Payment due Apr 30`, `3 lessons unpaid`, `5 lessons left`.

## Student Profile

A student profile panel should answer:

- How many lessons were scheduled?
- How many were attended?
- How many lessons are left in the package?
- When is the next payment?
- How much is paid or owed?
- What billing mode or package is active?
- What were the latest payments and lessons?

Do not reduce the profile to contact details.

## Component Rules

- Buttons: 8px radius.
- Hover styling is allowed only on buttons, links, and table rows/cells. Do not add hover movement, color shifts, shadows, or reveal effects to cards, static panels, metrics, inputs, selects, scrollbars, badges, or non-clickable list items.
- Badges: compact, muted backgrounds, semantic but quiet colors.
- Inputs: label above, optional helper below, error below.
- Tables: stable row height around 44-52px, subtle hover background, no heavy borders.
- All app scroll must use the local shadcn `ScrollArea` component from `@/components/ui/scroll-area`, including root/workspace page scroll, panels, lists, dialogs, and table overflow areas.
- Do not use raw `overflow-auto`, `overflow-x-auto`, or `overflow-y-auto` for app surfaces outside the ScrollArea implementation itself.
- Table horizontal scroll must be implemented with shadcn `ScrollArea` or an existing project wrapper built on it, not a bare `div` with `overflow-x-auto`.
- Dialogs: acceptable for create/edit flows. Prefer inline or side-panel interactions for frequent routine actions.
- Icons: `lucide-react` is allowed because it already exists, but icons must stay secondary and use consistent sizing/stroke.
- Loading: use skeletons matching the real layout, not generic spinners.
- Empty states: provide a single next action, not just `No data`.
- Errors: inline and specific, with retry when applicable.

## Motion and Polish Rules

Motion should make the teacher's work feel responsive, not theatrical.

- Before adding animation, ask how often the user will see it. Repeated daily actions should be instant or nearly instant.
- Never animate keyboard-driven actions such as command shortcuts or rapid table navigation.
- Button press feedback should be immediate: 100-160ms, transform-only, usually `scale(0.97)` or `scale(0.98)`.
- Tooltips and small popovers should stay around 125-200ms.
- Dropdowns and selects should stay around 150-250ms.
- Modals and drawers may use 200-300ms, rarely more.
- Avoid UI animations over 300ms unless they are rare onboarding or explanatory moments.
- Use custom curves instead of weak default easing:
  - `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`
  - `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`
  - `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`
- Do not use `ease-in` for UI entry or feedback. It feels slow at the exact moment the user expects a response.
- Do not use `transition-all`. Transition exact properties such as `transform`, `opacity`, `background-color`, `border-color`, and `color`.
- Animate only `transform` and `opacity` for movement. Do not animate `height`, `width`, `top`, `left`, `padding`, or `margin` in routine UI.
- Do not animate from `scale(0)`. Entry states should start around `scale(0.95)` plus `opacity: 0`.
- Popovers should scale from their trigger using Radix transform-origin variables when available. Centered modals are the exception and should keep center origin.
- Prefer CSS transitions for dynamic UI that can be rapidly interrupted. Use keyframes only for predetermined, non-interruptible effects.
- Gate hover motion with `@media (hover: hover) and (pointer: fine)` so touch devices do not get sticky hover states.
- Respect `prefers-reduced-motion`: keep helpful opacity/color transitions, remove movement-heavy transforms.
- For lists that enter together, use short stagger delays of 30-80ms. Never block interaction while stagger animations play.
- If using Motion/Framer for a necessary dynamic interaction, avoid main-thread-heavy shorthand under load; prefer full `transform` strings for critical movement.

## Copy Rules

Use concrete operational copy:

- `Mark attendance`
- `Record payment`
- `3 lessons left`
- `Payment due Apr 30`
- `Calendar sync failed`

Do not use marketing or AI-generic copy such as `seamless`, `elevate`, `next-gen`, `unlock`, `powerful`, or similar filler.

## Login Page

The login page should feel like a private tool entrance.

- Keep it minimal and calm.
- It may show a compact preview of today's operational state.
- Do not turn it into a landing page.
- Do not use stock imagery, hero gradients, or marketing claims.

## Current Implementation Caveat

The web app is still in progress. Do not treat the unfinished dashboard in the dev server as final visual evidence. If visual verification is needed before the dashboard is ready, verify only the login page or explicitly requested surfaces.

## Acceptance Checklist

Before finishing a frontend task under `apps/web`, verify:

- The UI makes today's required actions visible quickly.
- Payment risk is visible without opening every student profile.
- Package/lesson balance and next payment have a clear place in the design.
- Student tables read as a ledger.
- All app scroll regions, including root/workspace page scroll and horizontally scrollable tables, use shadcn `ScrollArea`.
- Numbers, money, and dates use tabular/mono styling.
- The palette stays warm neutral with a single muted sage/teal accent.
- The design does not drift into generic blue SaaS/admin aesthetics.
- Mobile keeps the same operational priorities in a single-column order.
- Motion is purposeful, short, interruptible, and disabled or softened for reduced-motion users.
