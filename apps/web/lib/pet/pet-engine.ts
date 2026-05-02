import type { PetFrame, PetPose } from "./pet-manifest"

export type PetPosition = {
	x: number
	y: number
}

export type PetViewport = {
	width: number
	height: number
}

export type PetFrameBounds = Pick<PetFrame, "width" | "height">

export type SelectPetPoseInput = {
	privacyMode: boolean
	reducedMotion: boolean
	requestedPose: PetPose
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max)
}

export function clampPetPosition(position: PetPosition, viewport: PetViewport, frame: PetFrameBounds): PetPosition {
	const maxX = Math.max(0, viewport.width - frame.width)
	const maxY = Math.max(0, viewport.height - frame.height)

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
