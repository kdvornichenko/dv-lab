import { strict as assert } from "node:assert"

import { clampPetPosition, selectPetPose, shouldUseReducedPetMotion } from "./pet-engine"

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
