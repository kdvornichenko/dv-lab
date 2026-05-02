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

export type PetFrame = {
	id: `${PetPose}_${number}`
	pose: PetPose
	index: number
	x: number
	y: number
	width: number
	height: number
	durationMs: number
	anchor: {
		x: number
		y: number
	}
	sourcePose?: PetPose
	temporary?: boolean
}

export type PetAnimation = {
	pose: PetPose
	frames: readonly PetFrame[]
	fps: number
	loop: boolean
	sourcePose?: PetPose
	temporary?: boolean
}

export type PetSpriteManifest = {
	id: "cat"
	imageSrc: "/assets/cat-widget/cat-sleep.webp"
	sheet: {
		width: number
		height: number
		columns: number
		rows: number
		frameWidth: number
		frameHeight: number
	}
	animations: Record<PetPose, PetAnimation>
}

const SHEET = {
	width: 1374,
	height: 1145,
	columns: 6,
	rows: 5,
	frameWidth: 229,
	frameHeight: 229,
} as const

const SLEEP_FRAME_COUNT = SHEET.columns * SHEET.rows
const SLEEP_FPS = 7
const FRAME_DURATION_MS = Math.round(1000 / SLEEP_FPS)
const FRAME_ANCHOR = { x: 114.5, y: 206 }

function getSleepFrameCoordinates(frameIndex: number) {
	return {
		x: (frameIndex % SHEET.columns) * SHEET.frameWidth,
		y: Math.floor(frameIndex / SHEET.columns) * SHEET.frameHeight,
	}
}

function createFrame(pose: PetPose, index: number, sheetFrameIndex: number, temporary = false): PetFrame {
	const coordinates = getSleepFrameCoordinates(sheetFrameIndex)

	return {
		id: `${pose}_${index}`,
		pose,
		index,
		x: coordinates.x,
		y: coordinates.y,
		width: SHEET.frameWidth,
		height: SHEET.frameHeight,
		durationMs: FRAME_DURATION_MS,
		anchor: FRAME_ANCHOR,
		...(temporary ? { sourcePose: "sleep" as const, temporary: true } : {}),
	}
}

function createSleepAnimation(): PetAnimation {
	return {
		pose: "sleep",
		frames: Array.from({ length: SLEEP_FRAME_COUNT }, (_, index) => createFrame("sleep", index, index)),
		fps: SLEEP_FPS,
		loop: true,
	}
}

function createTemporarySleepFrameAnimation(pose: PetPose, sheetFrameIndex: number): PetAnimation {
	return {
		pose,
		frames: [createFrame(pose, 0, sheetFrameIndex, true)],
		fps: 1,
		loop: true,
		sourcePose: "sleep",
		temporary: true,
	}
}

export const catPetManifest: PetSpriteManifest = {
	id: "cat",
	imageSrc: "/assets/cat-widget/cat-sleep.webp",
	sheet: SHEET,
	animations: {
		idle: createTemporarySleepFrameAnimation("idle", 0),
		walk: createTemporarySleepFrameAnimation("walk", 1),
		run: createTemporarySleepFrameAnimation("run", 2),
		jump: createTemporarySleepFrameAnimation("jump", 3),
		land: createTemporarySleepFrameAnimation("land", 4),
		sit: createTemporarySleepFrameAnimation("sit", 5),
		lie: createTemporarySleepFrameAnimation("lie", 6),
		sleep: createSleepAnimation(),
		scratch: createTemporarySleepFrameAnimation("scratch", 8),
		stretch: createTemporarySleepFrameAnimation("stretch", 9),
		paw: createTemporarySleepFrameAnimation("paw", 10),
		fall: createTemporarySleepFrameAnimation("fall", 11),
		privacy: createTemporarySleepFrameAnimation("privacy", 12),
	},
}
