import { strict as assert } from "node:assert"

import { clampPetPosition, createPetEngine, selectPetPose, shouldUseReducedPetMotion } from "./pet-engine"

assert.equal(selectPetPose({ privacyMode: true, reducedMotion: false, requestedPose: "walk" }), "privacy")
assert.equal(selectPetPose({ privacyMode: false, reducedMotion: true, requestedPose: "walk" }), "sleep")
assert.equal(selectPetPose({ privacyMode: false, reducedMotion: false, requestedPose: "walk" }), "walk")

assert.equal(shouldUseReducedPetMotion(true, false), true)
assert.equal(shouldUseReducedPetMotion(false, true), true)
assert.equal(shouldUseReducedPetMotion(false, false), false)

assert.deepEqual(
	clampPetPosition(
		{ x: 500, y: -20 },
		{ width: 320, height: 240 },
		{ width: 64, height: 80 },
	),
	{ x: 256, y: 0 },
)

assert.deepEqual(
	clampPetPosition(
		{ x: 10, y: 10 },
		{ width: 40, height: 40 },
		{ width: 64, height: 80 },
	),
	{ x: 0, y: 0 },
)

const viewport = { width: 640, height: 420 }
const image = { width: 64, height: 64 }

const walkingEngine = createPetEngine({
	viewport,
	image,
	activityLevel: "normal",
	initialPosition: { x: 40, y: 320 },
	random: () => 0.99,
})
const walkStart = walkingEngine.snapshot().position.x
for (let index = 0; index < 12; index += 1) walkingEngine.step(64)
assert.ok(walkingEngine.snapshot().position.x > walkStart, "walking should change x-position over time")
assert.equal(walkingEngine.snapshot().phase, "travel")

const jumpEngine = createPetEngine({
	viewport,
	image,
	activityLevel: "playful",
	initialPosition: { x: 24, y: 320 },
	random: () => 0,
})
jumpEngine.setTargets([{ id: "dashboard-card", x: 320, y: 260, width: 160, height: 80 }])
for (let index = 0; index < 72 && jumpEngine.snapshot().phase !== "jump"; index += 1) jumpEngine.step(64)
assert.equal(jumpEngine.snapshot().phase, "jump", "explicit target should start a jump")
assert.equal(jumpEngine.snapshot().targetId, "dashboard-card")

const jumpStartY = jumpEngine.snapshot().position.y
for (let index = 0; index < 6; index += 1) jumpEngine.step(64)
assert.ok(jumpEngine.snapshot().position.y < jumpStartY, "jump arc should lift y-position")

for (let index = 0; index < 20 && jumpEngine.snapshot().phase !== "rest"; index += 1) jumpEngine.step(64)
assert.equal(jumpEngine.snapshot().phase, "rest", "jump should land into rest phase")
assert.deepEqual(jumpEngine.snapshot().position, { x: 368, y: 208 }, "landing should clamp to the target and viewport")
assert.equal(jumpEngine.snapshot().pose, "sit")

for (let index = 0; index < 20; index += 1) jumpEngine.step(64)
assert.equal(jumpEngine.snapshot().pose, "lie", "rest should transition from sit to lie")
for (let index = 0; index < 22; index += 1) jumpEngine.step(64)
assert.equal(jumpEngine.snapshot().pose, "sleep", "rest should transition from lie to sleep")

const privacyEngine = createPetEngine({ viewport, image, initialPosition: { x: 40, y: 320 }, random: () => 0.99 })
privacyEngine.setReducedMotion(true)
privacyEngine.setPrivacyMode(true)
privacyEngine.step(64)
assert.equal(privacyEngine.snapshot().pose, "privacy", "privacy should override reduced-motion sleep")

const reducedMotionEngine = createPetEngine({ viewport, image, initialPosition: { x: 40, y: 320 }, random: () => 0 })
reducedMotionEngine.setTargets([{ id: "target", x: 320, y: 260, width: 160, height: 80 }])
reducedMotionEngine.setReducedMotion(true)
const reducedMotionStart = reducedMotionEngine.snapshot().position
for (let index = 0; index < 100; index += 1) reducedMotionEngine.step(64)
assert.equal(reducedMotionEngine.snapshot().pose, "sleep", "reduced motion should force sleeper pose")
assert.equal(reducedMotionEngine.snapshot().phase, "travel", "reduced motion should not start target behavior")
assert.deepEqual(reducedMotionEngine.snapshot().position, reducedMotionStart)

const emptyTargetsEngine = createPetEngine({
	viewport,
	image,
	activityLevel: "playful",
	initialPosition: { x: 40, y: 320 },
	random: () => 0,
})
emptyTargetsEngine.setTargets([])
for (let index = 0; index < 160; index += 1) emptyTargetsEngine.step(64)
assert.notEqual(emptyTargetsEngine.snapshot().phase, "jump", "empty targets should never start jump/rest behavior")
