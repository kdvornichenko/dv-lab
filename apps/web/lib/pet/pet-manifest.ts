export const PET_POSES = [
	'idle',
	'walk',
	'run',
	'jump',
	'land',
	'sit',
	'lie',
	'sleep',
	'scratch',
	'stretch',
	'paw',
	'fall',
	'privacy',
] as const

export type PetPose = (typeof PET_POSES)[number]

export type PetAnimationAsset = {
	pose: PetPose
	src: `/assets/cat-widget/${string}.webp`
	width: number
	height: number
	animated: true
	loop: boolean
	naturalFrameCount?: number
	motionRole: 'idle' | 'travel' | 'jump' | 'rest' | 'privacy'
	sourcePose?: PetPose
	temporary?: boolean
}

export type PetAssetManifest = {
	id: 'cat'
	animations: Record<PetPose, PetAnimationAsset>
}

function createAnimationAsset(
	pose: PetPose,
	src: PetAnimationAsset['src'],
	width: number,
	height: number,
	motionRole: PetAnimationAsset['motionRole'],
	options: Partial<Pick<PetAnimationAsset, 'loop' | 'naturalFrameCount' | 'sourcePose' | 'temporary'>> = {}
): PetAnimationAsset {
	return {
		pose,
		src,
		width,
		height,
		animated: true,
		loop: options.loop ?? true,
		motionRole,
		...options,
	}
}

function createTemporarySleepAsset(pose: PetPose, motionRole: PetAnimationAsset['motionRole']): PetAnimationAsset {
	return createAnimationAsset(pose, '/assets/cat-widget/cat-sleep.webp', 370, 200, motionRole, {
		naturalFrameCount: 5,
		sourcePose: 'sleep',
		temporary: true,
	})
}

function createLayDownAsset(
	pose: PetPose,
	options: Pick<PetAnimationAsset, 'sourcePose' | 'temporary'> = {}
): PetAnimationAsset {
	return createAnimationAsset(pose, '/assets/cat-widget/cat-walk-to-lay.webp', 370, 200, 'rest', {
		loop: false,
		naturalFrameCount: 6,
		...options,
	})
}

function createStandUpAsset(
	pose: PetPose,
	options: Pick<PetAnimationAsset, 'sourcePose' | 'temporary'> = {}
): PetAnimationAsset {
	return createAnimationAsset(pose, '/assets/cat-widget/cat-lay-to-walk.webp', 370, 200, 'rest', {
		loop: false,
		naturalFrameCount: 6,
		...options,
	})
}

export const catPetManifest: PetAssetManifest = {
	id: 'cat',
	animations: {
		idle: createTemporarySleepAsset('idle', 'idle'),
		walk: createAnimationAsset('walk', '/assets/cat-widget/cat-walk.webp', 370, 200, 'travel', {
			naturalFrameCount: 5,
		}),
		run: createAnimationAsset('run', '/assets/cat-widget/cat-walk.webp', 370, 200, 'travel', {
			naturalFrameCount: 5,
			sourcePose: 'walk',
			temporary: true,
		}),
		jump: createTemporarySleepAsset('jump', 'jump'),
		land: createTemporarySleepAsset('land', 'jump'),
		sit: createLayDownAsset('sit', { sourcePose: 'lie', temporary: true }),
		lie: createLayDownAsset('lie'),
		sleep: createAnimationAsset('sleep', '/assets/cat-widget/cat-sleep.webp', 370, 200, 'rest', {
			naturalFrameCount: 5,
		}),
		scratch: createTemporarySleepAsset('scratch', 'rest'),
		stretch: createStandUpAsset('stretch', { sourcePose: 'lie' }),
		paw: createTemporarySleepAsset('paw', 'idle'),
		fall: createTemporarySleepAsset('fall', 'jump'),
		privacy: createTemporarySleepAsset('privacy', 'privacy'),
	},
}
