import { strict as assert } from 'node:assert'

import { clampPetPosition, createPetEngine, selectPetPose, shouldUseReducedPetMotion } from './pet-engine'

assert.equal(selectPetPose({ privacyMode: true, reducedMotion: false, requestedPose: 'walk' }), 'privacy')
assert.equal(selectPetPose({ privacyMode: false, reducedMotion: true, requestedPose: 'walk' }), 'sleep')
assert.equal(selectPetPose({ privacyMode: false, reducedMotion: false, requestedPose: 'walk' }), 'walk')

assert.equal(shouldUseReducedPetMotion(true, false), true)
assert.equal(shouldUseReducedPetMotion(false, true), true)
assert.equal(shouldUseReducedPetMotion(false, false), false)

assert.deepEqual(clampPetPosition({ x: 500, y: -20 }, { width: 320, height: 240 }, { width: 64, height: 80 }), {
	x: 256,
	y: 0,
})

assert.deepEqual(clampPetPosition({ x: 10, y: 10 }, { width: 40, height: 40 }, { width: 64, height: 80 }), {
	x: 0,
	y: 0,
})

const viewport = { width: 640, height: 420 }
const image = { width: 64, height: 64 }
const floorY = 420 - 64 - 18

const walkingEngine = createPetEngine({
	viewport,
	image,
	activityLevel: 'normal',
	initialPosition: { x: 40, y: 120 },
	random: () => 0.99,
	settleAfterMs: 10_000,
})
const walkStart = walkingEngine.snapshot().position.x
for (let index = 0; index < 12; index += 1) walkingEngine.step(64)
assert.ok(walkingEngine.snapshot().position.x > walkStart, 'walking should change x-position over time')
assert.equal(walkingEngine.snapshot().position.y, floorY, 'walking should stay pinned to the bottom of the viewport')
assert.equal(walkingEngine.snapshot().phase, 'walk')
assert.equal(walkingEngine.snapshot().targetId, null)

const cursorEngine = createPetEngine({
	viewport,
	image,
	activityLevel: 'normal',
	initialPosition: { x: 120, y: 320 },
	random: () => 0,
	settleAfterMs: 10_000,
})
cursorEngine.setCursor({ x: 40, y: 320 })
for (let index = 0; index < 20; index += 1) cursorEngine.step(64)
assert.ok(cursorEngine.snapshot().position.x > 120, 'cursor interest should not reverse walking direction every frame')

const sleepEngine = createPetEngine({
	viewport,
	image,
	activityLevel: 'normal',
	initialPosition: { x: 40, y: 120 },
	random: () => 0,
	settleAfterMs: 128,
})
sleepEngine.step(64)
sleepEngine.step(64)
assert.equal(sleepEngine.snapshot().phase, 'sleep', 'cat should switch to sleep without a transition animation')
assert.equal(sleepEngine.snapshot().pose, 'sleep')
const sleepPosition = sleepEngine.snapshot().position
for (let index = 0; index < 80; index += 1) sleepEngine.step(64)
assert.equal(sleepEngine.snapshot().phase, 'sleep', 'sleep should continue until the pet is clicked')
assert.deepEqual(sleepEngine.snapshot().position, sleepPosition, 'sleep should not drift from its sleep position')

sleepEngine.wake()
assert.equal(
	sleepEngine.snapshot().phase,
	'walk',
	'clicking the sleeping cat should resume walking without a transition'
)
assert.equal(sleepEngine.snapshot().pose, 'walk')
const afterWakeX = sleepEngine.snapshot().position.x
sleepEngine.step(64)
assert.notEqual(sleepEngine.snapshot().position.x, afterWakeX, 'walking should resume after waking')

const targetsEngine = createPetEngine({
	viewport,
	image,
	activityLevel: 'playful',
	initialPosition: { x: 24, y: 120 },
	random: () => 0,
	settleAfterMs: 10_000,
})
targetsEngine.setTargets([{ id: 'dashboard-card', x: 320, y: 260, width: 160, height: 80 }])
for (let index = 0; index < 40; index += 1) targetsEngine.step(64)
assert.equal(targetsEngine.snapshot().phase, 'walk', 'targets should not trigger jumps anymore')
assert.equal(targetsEngine.snapshot().targetId, null)
assert.equal(targetsEngine.snapshot().position.y, floorY)

const footerEngine = createPetEngine({
	viewport,
	image,
	activityLevel: 'normal',
	initialPosition: { x: 10, y: 120 },
	random: () => 0,
	settleAfterMs: 10_000,
})
footerEngine.setTargets([
	{ id: 'dashboard-card', x: 320, y: 260, width: 160, height: 80 },
	{ id: 'sidebar-footer', x: 120, y: 300, width: 180, height: 64 },
])
assert.equal(footerEngine.snapshot().targetId, 'sidebar-footer')
assert.deepEqual(
	footerEngine.snapshot().position,
	{ x: 120, y: 240 },
	'footer target should pin the cat to the footer top edge'
)
for (let index = 0; index < 140; index += 1) footerEngine.step(64)
assert.equal(footerEngine.snapshot().position.y, 240, 'footer walking should stay on the footer top edge')
assert.ok(footerEngine.snapshot().position.x >= 120, 'footer walking should stay inside the footer left edge')
assert.ok(footerEngine.snapshot().position.x <= 236, 'footer walking should stay inside the footer right edge')

const privacyEngine = createPetEngine({ viewport, image, initialPosition: { x: 40, y: 120 }, random: () => 0.99 })
privacyEngine.setReducedMotion(true)
privacyEngine.setPrivacyMode(true)
privacyEngine.step(64)
assert.equal(privacyEngine.snapshot().pose, 'privacy', 'privacy should override reduced-motion sleep')

const reducedMotionEngine = createPetEngine({ viewport, image, initialPosition: { x: 40, y: 120 }, random: () => 0 })
reducedMotionEngine.setTargets([{ id: 'target', x: 320, y: 260, width: 160, height: 80 }])
reducedMotionEngine.setReducedMotion(true)
const reducedMotionStart = reducedMotionEngine.snapshot().position
for (let index = 0; index < 100; index += 1) reducedMotionEngine.step(64)
assert.equal(reducedMotionEngine.snapshot().pose, 'sleep', 'reduced motion should force sleeper pose')
assert.equal(reducedMotionEngine.snapshot().phase, 'walk', 'reduced motion should not start transition behavior')
assert.deepEqual(reducedMotionEngine.snapshot().position, reducedMotionStart)
