export const PET_POSES = [
	"idle",
	"walk",
	"run",
	"jump",
	"land",
	"sit",
	"lie",
	"sleep",
	"scratch",
	"stretch",
	"paw",
	"fall",
	"privacy",
] as const

export type PetPose = (typeof PET_POSES)[number]

export type PetAnimationAsset = {
	pose: PetPose
	src: `/assets/cat-widget/${string}.webp`
	width: number
	height: number
	animated: true
	loop: true
	naturalFrameCount?: number
	motionRole: "idle" | "travel" | "jump" | "rest" | "privacy"
	sourcePose?: PetPose
	temporary?: boolean
}

export type PetAssetManifest = {
	id: "cat"
	animations: Record<PetPose, PetAnimationAsset>
}

function createAnimationAsset(
	pose: PetPose,
	src: PetAnimationAsset["src"],
	width: number,
	height: number,
	motionRole: PetAnimationAsset["motionRole"],
	options: Pick<PetAnimationAsset, "naturalFrameCount" | "sourcePose" | "temporary"> = {},
): PetAnimationAsset {
	return {
		pose,
		src,
		width,
		height,
		animated: true,
		loop: true,
		motionRole,
		...options,
	}
}

function createTemporarySleepAsset(pose: PetPose, motionRole: PetAnimationAsset["motionRole"]): PetAnimationAsset {
	return createAnimationAsset(
		pose,
		"/assets/cat-widget/cat-sleep.webp",
		208,
		151,
		motionRole,
		{ naturalFrameCount: 13, sourcePose: "sleep", temporary: true },
	)
}

export const catPetManifest: PetAssetManifest = {
	id: "cat",
	animations: {
		idle: createTemporarySleepAsset("idle", "idle"),
		walk: createAnimationAsset("walk", "/assets/cat-widget/cat-walk.webp", 370, 200, "travel", {
			naturalFrameCount: 5,
		}),
		run: createAnimationAsset("run", "/assets/cat-widget/cat-walk.webp", 370, 200, "travel", {
			naturalFrameCount: 5,
			sourcePose: "walk",
			temporary: true,
		}),
		jump: createTemporarySleepAsset("jump", "jump"),
		land: createTemporarySleepAsset("land", "jump"),
		sit: createTemporarySleepAsset("sit", "rest"),
		lie: createTemporarySleepAsset("lie", "rest"),
		sleep: createAnimationAsset("sleep", "/assets/cat-widget/cat-sleep.webp", 208, 151, "rest", {
			naturalFrameCount: 13,
		}),
		scratch: createTemporarySleepAsset("scratch", "rest"),
		stretch: createTemporarySleepAsset("stretch", "rest"),
		paw: createTemporarySleepAsset("paw", "idle"),
		fall: createTemporarySleepAsset("fall", "jump"),
		privacy: createTemporarySleepAsset("privacy", "privacy"),
	},
}
