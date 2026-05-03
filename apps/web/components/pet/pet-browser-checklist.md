# Website Pet Browser Checklist

Run this after the app is available in a browser with an authenticated workspace session.

## Settings

- [ ] Open `/settings/pet`.
- [ ] Turn `Show pet` on and confirm the pet overlay appears without a page refresh.
- [ ] Turn `Show pet` off and confirm the pet overlay hides without a page refresh.
- [ ] Refresh the workspace and confirm the persisted enabled/disabled state is restored.
- [ ] Confirm `Sound` is off by default and no audio starts on page load.

## Scope

- [ ] Confirm the pet appears inside authenticated workspace routes.
- [ ] Open `/login` and confirm the pet is not rendered there.

## Interaction

- [ ] Confirm the pet is rendered at the smaller sidebar size.
- [ ] Confirm the pet walks only along the top edge of the sidebar footer.
- [ ] Confirm the pet plays the walk-to-lay transition before sleeping on the sidebar footer.
- [ ] Click the sleeping pet and confirm it plays the lay-to-walk transition before walking.
- [ ] Click CRM UI beneath or near the pet and confirm clicks pass through normally outside the pet image.

## Motion And Privacy

- [ ] Emulate `prefers-reduced-motion: reduce` and confirm active walking stops in favor of sleeper behavior.
- [ ] Toggle privacy mode and confirm the pet switches to the privacy pose.
- [ ] Test a mobile viewport and confirm movement remains reduced and does not obstruct touch workflows.

## Animated WebP Assets

- [ ] Confirm the walking animated WebP is visible and nonblank.
- [ ] Confirm the walk-to-lay animated WebP is visible and nonblank.
- [ ] Confirm the lay-to-walk animated WebP is visible and nonblank.
- [ ] Confirm the sleeping animated WebP is visible and nonblank.
- [ ] Confirm temporary mapped poses render a visible animated WebP asset.
- [ ] Do not manually step frames; animated WebP owns its internal frame loop.
