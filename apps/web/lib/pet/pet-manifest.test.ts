import { strict as assert } from "node:assert"

import { catPetManifest, PET_POSES } from "./pet-manifest"

const seenFrameIds = new Set<string>()

for (const pose of PET_POSES) {
	const animation = catPetManifest.animations[pose]

	assert.ok(animation, `Missing animation for pose ${pose}`)
	assert.equal(animation.pose, pose, `Animation pose mismatch for ${pose}`)
	assert.ok(animation.frames.length > 0, `Missing frames for pose ${pose}`)

	animation.frames.forEach((frame, index) => {
		assert.equal(frame.id, `${pose}_${index}`, `Unexpected frame id for ${pose} frame ${index}`)
		assert.equal(frame.pose, pose, `Frame pose mismatch for ${pose} frame ${index}`)
		assert.equal(frame.index, index, `Frame index mismatch for ${pose} frame ${index}`)
		assert.ok(frame.x >= 0, `Frame ${frame.id} has negative x`)
		assert.ok(frame.y >= 0, `Frame ${frame.id} has negative y`)
		assert.ok(frame.x + frame.width <= catPetManifest.sheet.width, `Frame ${frame.id} overflows sheet width`)
		assert.ok(frame.y + frame.height <= catPetManifest.sheet.height, `Frame ${frame.id} overflows sheet height`)
		assert.equal(seenFrameIds.has(frame.id), false, `Duplicate frame id ${frame.id}`)
		seenFrameIds.add(frame.id)
	})
}

assert.equal(catPetManifest.id, "cat")
assert.equal(catPetManifest.imageSrc, "/assets/cat-widget/cat-sleep.webp")
assert.equal(catPetManifest.sheet.width, 1374)
assert.equal(catPetManifest.sheet.height, 1145)
assert.equal(catPetManifest.sheet.columns, 6)
assert.equal(catPetManifest.sheet.rows, 5)
assert.equal(catPetManifest.sheet.frameWidth, 229)
assert.equal(catPetManifest.sheet.frameHeight, 229)
assert.equal(catPetManifest.animations.sleep.frames.length, 30)
assert.ok(catPetManifest.animations.sleep.loop)
assert.ok(catPetManifest.animations.sleep.fps >= 6 && catPetManifest.animations.sleep.fps <= 8)

for (const pose of PET_POSES) {
	if (pose === "sleep") {
		continue
	}

	const animation = catPetManifest.animations[pose]
	assert.equal(animation.temporary, true, `Pose ${pose} should be marked temporary`)
	assert.equal(animation.sourcePose, "sleep", `Pose ${pose} should record sleep as its source pose`)
	assert.equal(animation.frames[0]?.temporary, true, `Pose ${pose} frame should be marked temporary`)
	assert.equal(animation.frames[0]?.sourcePose, "sleep", `Pose ${pose} frame should record sleep as source pose`)
}
