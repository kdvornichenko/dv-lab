import type { PetAnimationAsset, PetPose } from "./pet-manifest"

export type PetPosition = {
	x: number
	y: number
}

export type PetViewport = {
	width: number
	height: number
}

export type PetImageBounds = Pick<PetAnimationAsset, "width" | "height">

export type SelectPetPoseInput = {
	privacyMode: boolean
	reducedMotion: boolean
	requestedPose: PetPose
}

export type PetActivityLevel = "reduced" | "normal" | "playful"

export type PetTarget = {
	id?: string
	x: number
	y: number
	width: number
	height: number
}

export type PetEngineOptions = {
	viewport: PetViewport
	image: PetImageBounds
	activityLevel?: PetActivityLevel
	initialPosition?: PetPosition
	random?: () => number
}

export type PetEnginePhase = "travel" | "jump" | "rest"

export type PetEngineSnapshot = {
	position: PetPosition
	pose: PetPose
	facing: "left" | "right"
	phase: PetEnginePhase
	targetId: string | null
}

type ActivityConfig = {
	speed: number
	jumpIntervalMs: number
	jumpChance: number
	jumpDurationMs: number
	restDurationMs: number
}

type JumpState = {
	target: PetTarget
	from: PetPosition
	to: PetPosition
	elapsedMs: number
	durationMs: number
}

type RestState = {
	target: PetTarget
	elapsedMs: number
	durationMs: number
}

const ACTIVITY_CONFIG: Record<PetActivityLevel, ActivityConfig> = {
	reduced: {
		speed: 24,
		jumpIntervalMs: 12000,
		jumpChance: 0.08,
		jumpDurationMs: 920,
		restDurationMs: 4200,
	},
	normal: {
		speed: 42,
		jumpIntervalMs: 7000,
		jumpChance: 0.18,
		jumpDurationMs: 820,
		restDurationMs: 5200,
	},
	playful: {
		speed: 68,
		jumpIntervalMs: 4500,
		jumpChance: 0.28,
		jumpDurationMs: 720,
		restDurationMs: 4800,
	},
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max)
}

export function clampPetPosition(position: PetPosition, viewport: PetViewport, image: PetImageBounds): PetPosition {
	const maxX = Math.max(0, viewport.width - image.width)
	const maxY = Math.max(0, viewport.height - image.height)

	return {
		x: clamp(position.x, 0, maxX),
		y: clamp(position.y, 0, maxY),
	}
}

export function shouldUseReducedPetMotion(reducedMotion: boolean, coarsePointer: boolean) {
	return reducedMotion || coarsePointer
}

export function selectPetPose({ privacyMode, reducedMotion, requestedPose }: SelectPetPoseInput): PetPose {
	if (privacyMode) {
		return "privacy"
	}

	if (reducedMotion) {
		return "sleep"
	}

	return requestedPose
}

function clampTarget(target: PetTarget, viewport: PetViewport): PetTarget {
	const left = clamp(target.x, 0, viewport.width)
	const top = clamp(target.y, 0, viewport.height)
	const right = clamp(target.x + target.width, left, viewport.width)
	const bottom = clamp(target.y + target.height, top, viewport.height)

	return {
		...target,
		x: left,
		y: top,
		width: Math.max(0, right - left),
		height: Math.max(0, bottom - top),
	}
}

function landingPositionForTarget(target: PetTarget, viewport: PetViewport, image: PetImageBounds): PetPosition {
	const safeTarget = clampTarget(target, viewport)

	return clampPetPosition(
		{
			x: safeTarget.x + safeTarget.width / 2 - image.width / 2,
			y: safeTarget.y - image.height + Math.min(12, safeTarget.height / 3),
		},
		viewport,
		image,
	)
}

function restPoseForElapsed(elapsedMs: number): PetPose {
	if (elapsedMs < 1200) {
		return "sit"
	}

	if (elapsedMs < 2600) {
		return "lie"
	}

	return "sleep"
}

export function createPetEngine(options: PetEngineOptions) {
	let viewport = options.viewport
	let image = options.image
	let activityLevel = options.activityLevel ?? "normal"
	let config = ACTIVITY_CONFIG[activityLevel]
	let position = clampPetPosition(
		options.initialPosition ?? { x: 24, y: Math.max(0, viewport.height - image.height - 24) },
		viewport,
		image,
	)
	let requestedPose: PetPose = "idle"
	let phase: PetEnginePhase = "travel"
	let facing: PetEngineSnapshot["facing"] = "right"
	let direction = 1
	let privacyMode = false
	let reducedMotion = false
	let targets: PetTarget[] = []
	let cursor: PetPosition | null = null
	let jump: JumpState | null = null
	let rest: RestState | null = null
	let targetTimerMs = config.jumpIntervalMs * 0.85
	const random = options.random ?? Math.random

	function updateConfig(nextActivityLevel: PetActivityLevel) {
		activityLevel = nextActivityLevel
		config = ACTIVITY_CONFIG[activityLevel]
		targetTimerMs = Math.min(targetTimerMs, config.jumpIntervalMs)
	}

	function startJump(target: PetTarget) {
		const to = landingPositionForTarget(target, viewport, image)
		jump = {
			target,
			from: position,
			to,
			elapsedMs: 0,
			durationMs: config.jumpDurationMs,
		}
		rest = null
		phase = "jump"
		requestedPose = "jump"
		facing = to.x >= position.x ? "right" : "left"
	}

	function chooseTarget() {
		if (targets.length === 0) {
			return null
		}

		const index = Math.min(targets.length - 1, Math.floor(random() * targets.length))
		return targets[index] ?? null
	}

	function stepTravel(deltaMs: number) {
		targetTimerMs += deltaMs

		if (cursor) {
			facing = cursor.x >= position.x + image.width / 2 ? "right" : "left"
			if (Math.abs(cursor.x - position.x) < 160 && random() < 0.18) {
				direction = facing === "right" ? 1 : -1
			}
		}

		if (targetTimerMs >= config.jumpIntervalMs) {
			targetTimerMs = 0
			const target = chooseTarget()
			if (target && random() < config.jumpChance) {
				startJump(target)
				return
			}
		}

		position = clampPetPosition({ x: position.x + direction * config.speed * (deltaMs / 1000), y: position.y }, viewport, image)

		if (position.x <= 0) {
			direction = 1
		} else if (position.x >= Math.max(0, viewport.width - image.width)) {
			direction = -1
		}

		facing = direction >= 0 ? "right" : "left"
		requestedPose = activityLevel === "playful" ? "run" : "walk"
	}

	function stepJump(deltaMs: number) {
		if (!jump) {
			phase = "travel"
			return
		}

		jump.elapsedMs = Math.min(jump.durationMs, jump.elapsedMs + deltaMs)
		const progress = jump.elapsedMs / jump.durationMs
		const lineX = jump.from.x + (jump.to.x - jump.from.x) * progress
		const lineY = jump.from.y + (jump.to.y - jump.from.y) * progress
		const arcHeight = Math.max(48, Math.min(140, viewport.height * 0.18))
		position = clampPetPosition(
			{
				x: lineX,
				y: lineY - Math.sin(progress * Math.PI) * arcHeight,
			},
			viewport,
			image,
		)
		requestedPose = progress > 0.82 ? "land" : "jump"

		if (jump.elapsedMs >= jump.durationMs) {
			position = jump.to
			rest = {
				target: jump.target,
				elapsedMs: 0,
				durationMs: config.restDurationMs,
			}
			phase = "rest"
			requestedPose = "sit"
			jump = null
		}
	}

	function stepRest(deltaMs: number) {
		if (!rest) {
			phase = "travel"
			return
		}

		rest.elapsedMs += deltaMs
		requestedPose = restPoseForElapsed(rest.elapsedMs)

		if (rest.elapsedMs >= rest.durationMs) {
			rest = null
			phase = "travel"
			targetTimerMs = 0
			direction = facing === "right" ? 1 : -1
			requestedPose = "walk"
		}
	}

	function step(deltaMs: number) {
		const safeDeltaMs = clamp(deltaMs, 0, 64)
		position = clampPetPosition(position, viewport, image)

		if (privacyMode || reducedMotion || safeDeltaMs === 0) {
			return snapshot()
		}

		if (phase === "jump") {
			stepJump(safeDeltaMs)
		} else if (phase === "rest") {
			stepRest(safeDeltaMs)
		} else {
			stepTravel(safeDeltaMs)
		}

		return snapshot()
	}

	function snapshot(): PetEngineSnapshot {
		return {
			position,
			pose: selectPetPose({ privacyMode, reducedMotion, requestedPose }),
			facing,
			phase,
			targetId: jump?.target.id ?? rest?.target.id ?? null,
		}
	}

	return {
		step,
		snapshot,
		setActivityLevel(nextActivityLevel: PetActivityLevel) {
			updateConfig(nextActivityLevel)
		},
		setCursor(position: PetPosition | null) {
			cursor = position
		},
		setPrivacyMode(enabled: boolean) {
			privacyMode = enabled
		},
		setReducedMotion(enabled: boolean) {
			reducedMotion = enabled
		},
		setTargets(nextTargets: PetTarget[]) {
			targets = nextTargets.map((target) => clampTarget(target, viewport)).filter((target) => target.width > 0 && target.height > 0)
		},
		setViewport(nextViewport: PetViewport) {
			viewport = nextViewport
			position = clampPetPosition(position, viewport, image)
		},
		setImageBounds(nextImage: PetImageBounds) {
			image = nextImage
			position = clampPetPosition(position, viewport, image)
		},
	}
}
