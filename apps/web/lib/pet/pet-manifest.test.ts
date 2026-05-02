import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

import { catPetManifest, PET_POSES } from './pet-manifest'

for (const pose of PET_POSES) {
	const animation = catPetManifest.animations[pose]

	assert.ok(animation, `Missing animation for pose ${pose}`)
	assert.equal(animation.pose, pose, `Animation pose mismatch for ${pose}`)
	assert.match(animation.src, /^\/assets\/cat-widget\/cat-[a-z-]+\.webp$/, `Unexpected asset src for ${pose}`)
	assert.ok(animation.width > 0, `Animation ${pose} must define width`)
	assert.ok(animation.height > 0, `Animation ${pose} must define height`)
	assert.equal(animation.animated, true, `Animation ${pose} must be an animated WebP asset`)
	assert.equal(animation.loop, true, `Animation ${pose} must loop`)
}

assert.equal(catPetManifest.id, 'cat')
assert.equal(catPetManifest.animations.sleep.src, '/assets/cat-widget/cat-sleep.webp')
assert.equal(catPetManifest.animations.sleep.width, 208)
assert.equal(catPetManifest.animations.sleep.height, 151)
assert.equal(catPetManifest.animations.sleep.naturalFrameCount, 13)
assert.ok(catPetManifest.animations.sleep.loop)
assert.equal(catPetManifest.animations.walk.src, '/assets/cat-widget/cat-walk.webp')
assert.equal(catPetManifest.animations.walk.width, 370)
assert.equal(catPetManifest.animations.walk.height, 200)
assert.equal(catPetManifest.animations.walk.naturalFrameCount, 5)
assert.equal(catPetManifest.animations.lie.src, '/assets/cat-widget/cat-lay-down.webp')
assert.equal(catPetManifest.animations.lie.width, 370)
assert.equal(catPetManifest.animations.lie.height, 200)
assert.equal(catPetManifest.animations.lie.naturalFrameCount, 10)
assert.equal(catPetManifest.animations.stretch.src, '/assets/cat-widget/cat-stand-up.webp')
assert.equal(catPetManifest.animations.stretch.width, 370)
assert.equal(catPetManifest.animations.stretch.height, 200)
assert.equal(catPetManifest.animations.stretch.naturalFrameCount, 10)

for (const pose of PET_POSES) {
	if (pose === 'sleep' || pose === 'walk' || pose === 'lie' || pose === 'stretch') {
		continue
	}

	const animation = catPetManifest.animations[pose]
	assert.equal(animation.temporary, true, `Pose ${pose} should be marked temporary until matching animated art exists`)
	assert.ok(animation.sourcePose, `Pose ${pose} should record its source pose`)
}

function assertAnimatedWebp(publicSrc: string) {
	const filePath = path.join(process.cwd(), 'public', publicSrc.replace(/^\//, ''))
	const bytes = fs.readFileSync(filePath)
	assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', `${publicSrc} must be a RIFF file`)
	assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', `${publicSrc} must be a WebP file`)
	assert.ok(bytes.includes(Buffer.from('ANIM')), `${publicSrc} must contain an ANIM chunk`)
	assert.ok(bytes.includes(Buffer.from('ANMF')), `${publicSrc} must contain animated frame chunks`)
}

assertAnimatedWebp(catPetManifest.animations.sleep.src)
assertAnimatedWebp(catPetManifest.animations.walk.src)
assertAnimatedWebp(catPetManifest.animations.lie.src)
assertAnimatedWebp(catPetManifest.animations.stretch.src)
