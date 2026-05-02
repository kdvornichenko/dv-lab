import type { PetAnimationAsset, PetPose } from './pet-manifest'

export type PetPosition = {
	x: number
	y: number
}

export type PetViewport = {
	width: number
	height: number
}

export type PetImageBounds = Pick<PetAnimationAsset, 'width' | 'height'>

export type SelectPetPoseInput = {
	privacyMode: boolean
	reducedMotion: boolean
	requestedPose: PetPose
}

export type PetActivityLevel = 'reduced' | 'normal' | 'playful'

export type PetTarget = {
	id?: string
	x: number
	y: number
	width: number
	height: number
}

const SIDEBAR_FOOTER_TARGET_ID = 'sidebar-footer'
const SURFACE_OVERLAP = 4

export type PetEngineOptions = {
	viewport: PetViewport
	image: PetImageBounds
	activityLevel?: PetActivityLevel
	initialPosition?: PetPosition
	random?: () => number
	settleAfterMs?: number
}

export type PetEnginePhase = 'walk' | 'sleep'

export type PetEngineSnapshot = {
	position: PetPosition
	pose: PetPose
	facing: 'left' | 'right'
	phase: PetEnginePhase
	targetId: string | null
}

type ActivityConfig = {
	speed: number
	settleAfterMinMs: number
	settleAfterMaxMs: number
}

const ACTIVITY_CONFIG: Record<PetActivityLevel, ActivityConfig> = {
	reduced: {
		speed: 18,
		settleAfterMinMs: 18000,
		settleAfterMaxMs: 26000,
	},
	normal: {
		speed: 34,
		settleAfterMinMs: 14000,
		settleAfterMaxMs: 22000,
	},
	playful: {
		speed: 54,
		settleAfterMinMs: 10000,
		settleAfterMaxMs: 18000,
	},
}

const BOTTOM_OFFSET = 18

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max)
}

function bottomY(viewport: PetViewport, image: PetImageBounds) {
	return Math.max(0, viewport.height - image.height - BOTTOM_OFFSET)
}

function clampX(x: number, viewport: PetViewport, image: PetImageBounds, target: PetTarget | null = null) {
	if (!target) {
		return clamp(x, 0, Math.max(0, viewport.width - image.width))
	}

	const minX = clamp(target.x, 0, Math.max(0, viewport.width - image.width))
	const maxX = clamp(target.x + target.width - image.width, minX, Math.max(minX, viewport.width - image.width))

	return clamp(x, minX, maxX)
}

function trackY(viewport: PetViewport, image: PetImageBounds, target: PetTarget | null) {
	if (!target) {
		return bottomY(viewport, image)
	}

	return clamp(target.y - image.height + SURFACE_OVERLAP, 0, Math.max(0, viewport.height - image.height))
}

function settleDelay(config: ActivityConfig, random: () => number) {
	return config.settleAfterMinMs + (config.settleAfterMaxMs - config.settleAfterMinMs) * random()
}

function chooseDepartureDirection(position: PetPosition, viewport: PetViewport, image: PetImageBounds) {
	const centerX = position.x + image.width / 2

	if (centerX < viewport.width * 0.35) {
		return 1
	}

	if (centerX > viewport.width * 0.65) {
		return -1
	}

	return centerX < viewport.width / 2 ? 1 : -1
}

export function clampPetPosition(position: PetPosition, viewport: PetViewport, image: PetImageBounds): PetPosition {
	return {
		x: clampX(position.x, viewport, image),
		y: clamp(position.y, 0, Math.max(0, viewport.height - image.height)),
	}
}

export function shouldUseReducedPetMotion(reducedMotion: boolean, coarsePointer: boolean) {
	return reducedMotion || coarsePointer
}

export function selectPetPose({ privacyMode, reducedMotion, requestedPose }: SelectPetPoseInput): PetPose {
	if (privacyMode) {
		return 'privacy'
	}

	if (reducedMotion) {
		return 'sleep'
	}

	return requestedPose
}

export function createPetEngine(options: PetEngineOptions) {
	let viewport = options.viewport
	let image = options.image
	let activityLevel = options.activityLevel ?? 'normal'
	let config = ACTIVITY_CONFIG[activityLevel]
	let position = {
		x: clampX(options.initialPosition?.x ?? 24, viewport, image),
		y: bottomY(viewport, image),
	}
	let requestedPose: PetPose = activityLevel === 'playful' ? 'run' : 'walk'
	let phase: PetEnginePhase = 'walk'
	let facing: PetEngineSnapshot['facing'] = 'right'
	let direction = 1
	let privacyMode = false
	let reducedMotion = false
	let walkElapsedMs = 0
	let activeTarget: PetTarget | null = null
	const random = options.random ?? Math.random
	const fixedSettleAfterMs = options.settleAfterMs
	let nextSettleAfterMs = fixedSettleAfterMs ?? settleDelay(config, random)

	function updateConfig(nextActivityLevel: PetActivityLevel) {
		activityLevel = nextActivityLevel
		config = ACTIVITY_CONFIG[activityLevel]
		nextSettleAfterMs = fixedSettleAfterMs ?? Math.min(nextSettleAfterMs, settleDelay(config, random))
		if (phase === 'walk') requestedPose = activityLevel === 'playful' ? 'run' : 'walk'
	}

	function pinToFloor() {
		position = {
			x: clampX(position.x, viewport, image, activeTarget),
			y: trackY(viewport, image, activeTarget),
		}
	}

	function startSettling() {
		phase = 'sleep'
		requestedPose = 'sleep'
		pinToFloor()
	}

	function startWalking() {
		phase = 'walk'
		walkElapsedMs = 0
		nextSettleAfterMs = fixedSettleAfterMs ?? settleDelay(config, random)
		direction = chooseDepartureDirection(position, viewport, image)
		facing = direction >= 0 ? 'right' : 'left'
		requestedPose = activityLevel === 'playful' ? 'run' : 'walk'
		pinToFloor()
	}

	function stepWalk(deltaMs: number) {
		walkElapsedMs += deltaMs
		position = {
			x: clampX(position.x + direction * config.speed * (deltaMs / 1000), viewport, image, activeTarget),
			y: trackY(viewport, image, activeTarget),
		}

		const minX = activeTarget ? clampX(activeTarget.x, viewport, image, activeTarget) : 0
		const maxX = activeTarget
			? clampX(activeTarget.x + activeTarget.width - image.width, viewport, image, activeTarget)
			: Math.max(0, viewport.width - image.width)

		if (position.x <= minX) {
			direction = 1
		} else if (position.x >= maxX) {
			direction = -1
		}

		facing = direction >= 0 ? 'right' : 'left'
		requestedPose = activityLevel === 'playful' ? 'run' : 'walk'

		if (walkElapsedMs >= nextSettleAfterMs) {
			startSettling()
		}
	}

	function step(deltaMs: number) {
		const safeDeltaMs = clamp(deltaMs, 0, 64)
		pinToFloor()

		if (privacyMode || reducedMotion || safeDeltaMs === 0) {
			return snapshot()
		}

		if (phase === 'walk') {
			stepWalk(safeDeltaMs)
		} else {
			requestedPose = 'sleep'
			pinToFloor()
		}

		return snapshot()
	}

	function wake() {
		if (phase !== 'sleep' || privacyMode || reducedMotion) {
			return snapshot()
		}

		startWalking()
		return snapshot()
	}

	function snapshot(): PetEngineSnapshot {
		return {
			position,
			pose: selectPetPose({ privacyMode, reducedMotion, requestedPose }),
			facing,
			phase,
			targetId: activeTarget?.id ?? null,
		}
	}

	return {
		step,
		snapshot,
		wake,
		setActivityLevel(nextActivityLevel: PetActivityLevel) {
			updateConfig(nextActivityLevel)
		},
		setCursor(_position: PetPosition | null) {
			// Cursor tracking must not steer the cat; waking is explicit via click.
		},
		setPrivacyMode(enabled: boolean) {
			privacyMode = enabled
		},
		setReducedMotion(enabled: boolean) {
			reducedMotion = enabled
		},
		setTargets(nextTargets: PetTarget[]) {
			activeTarget = nextTargets.find((target) => target.id === SIDEBAR_FOOTER_TARGET_ID) ?? null
			pinToFloor()
		},
		setViewport(nextViewport: PetViewport) {
			viewport = nextViewport
			pinToFloor()
		},
		setImageBounds(nextImage: PetImageBounds) {
			image = nextImage
			pinToFloor()
		},
	}
}
