'use client'

import { type PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react'

import {
	createPetEngine,
	shouldUseReducedPetMotion,
	type PetEngineSnapshot,
	type PetImageBounds,
	type PetViewport,
} from '@/lib/pet/pet-engine'
import { listPetTargets } from '@/lib/pet/pet-targets'
import {
	DEFAULT_PET_SETTINGS,
	loadPersistedPetSettings,
	subscribePetSettings,
	getPetSettingsSnapshot,
} from '@/lib/pet/pet-settings'

import { WebsitePetOverlay } from './WebsitePetOverlay'

import type { PetSettings } from '@teacher-crm/api-types'

const PET_IMAGE_BOUNDS: PetImageBounds = { width: 96, height: 72 }
const DEFAULT_VIEWPORT: PetViewport = { width: 1024, height: 768 }
const TARGET_REFRESH_MS = 1000

function readViewport(): PetViewport {
	if (typeof window === 'undefined') return DEFAULT_VIEWPORT

	return {
		width: window.innerWidth,
		height: window.innerHeight,
	}
}

function readReducedMotion() {
	if (typeof window === 'undefined') return false

	return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function readCoarsePointer() {
	if (typeof window === 'undefined') return false

	return window.matchMedia('(pointer: coarse)').matches
}

function readPrivacyMode() {
	if (typeof document === 'undefined') return false

	return document.documentElement.classList.contains('privacy-mode')
}

function readDocumentHidden() {
	if (typeof document === 'undefined') return false

	return document.hidden
}

export function WebsitePetProvider({ children }: PropsWithChildren) {
	const [settings, setSettings] = useState<PetSettings>(() => getPetSettingsSnapshot())
	const [privacyMode, setPrivacyMode] = useState(false)
	const [reducedMotion, setReducedMotion] = useState(false)
	const [documentHidden, setDocumentHidden] = useState(false)
	const engine = useMemo(
		() =>
			createPetEngine({
				viewport: readViewport(),
				image: PET_IMAGE_BOUNDS,
				activityLevel: settings.activityLevel,
			}),
		[]
	)
	const [snapshot, setSnapshot] = useState<PetEngineSnapshot>(() => engine.snapshot())
	const frameRef = useRef<number | null>(null)
	const lastFrameRef = useRef<number | null>(null)
	const lastTargetRefreshRef = useRef(0)

	useEffect(() => {
		let mounted = true

		void loadPersistedPetSettings()
			.then((nextSettings) => {
				if (mounted) setSettings(nextSettings)
			})
			.catch(() => {
				if (mounted) setSettings(getPetSettingsSnapshot())
			})

		return () => {
			mounted = false
		}
	}, [])

	useEffect(() => {
		return subscribePetSettings(() => {
			setSettings(getPetSettingsSnapshot())
		})
	}, [])

	useEffect(() => {
		engine.setActivityLevel(settings.activityLevel)
	}, [engine, settings.activityLevel])

	useEffect(() => {
		const updateViewport = () => {
			engine.setViewport(readViewport())
			engine.setTargets(listPetTargets())
			setSnapshot(engine.snapshot())
		}

		updateViewport()
		window.addEventListener('resize', updateViewport)
		window.addEventListener('scroll', updateViewport, { passive: true })
		return () => {
			window.removeEventListener('resize', updateViewport)
			window.removeEventListener('scroll', updateViewport)
		}
	}, [engine])

	useEffect(() => {
		const updateMotion = () => setReducedMotion(shouldUseReducedPetMotion(readReducedMotion(), readCoarsePointer()))
		const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
		const coarsePointerQuery = window.matchMedia('(pointer: coarse)')

		updateMotion()
		reducedMotionQuery.addEventListener('change', updateMotion)
		coarsePointerQuery.addEventListener('change', updateMotion)
		return () => {
			reducedMotionQuery.removeEventListener('change', updateMotion)
			coarsePointerQuery.removeEventListener('change', updateMotion)
		}
	}, [])

	useEffect(() => {
		const updatePrivacyMode = () => setPrivacyMode(readPrivacyMode())
		const observer = new MutationObserver(updatePrivacyMode)

		updatePrivacyMode()
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
		return () => observer.disconnect()
	}, [])

	useEffect(() => {
		const updateVisibility = () => setDocumentHidden(readDocumentHidden())

		updateVisibility()
		document.addEventListener('visibilitychange', updateVisibility)
		return () => document.removeEventListener('visibilitychange', updateVisibility)
	}, [])

	useEffect(() => {
		const updateCursor = (event: PointerEvent) => {
			engine.setCursor({ x: event.clientX, y: event.clientY })
		}
		const clearCursor = () => engine.setCursor(null)

		window.addEventListener('pointermove', updateCursor, { passive: true })
		window.addEventListener('pointerleave', clearCursor)
		return () => {
			window.removeEventListener('pointermove', updateCursor)
			window.removeEventListener('pointerleave', clearCursor)
		}
	}, [engine])

	useEffect(() => {
		engine.setPrivacyMode(privacyMode)
		engine.setReducedMotion(reducedMotion)
		setSnapshot(engine.snapshot())
	}, [engine, privacyMode, reducedMotion])

	useEffect(() => {
		if (!settings.enabled || documentHidden) {
			if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
			frameRef.current = null
			lastFrameRef.current = null
			return
		}

		const tick = (timestamp: number) => {
			const previousTimestamp = lastFrameRef.current ?? timestamp
			lastFrameRef.current = timestamp

			if (timestamp - lastTargetRefreshRef.current > TARGET_REFRESH_MS) {
				engine.setTargets(listPetTargets())
				lastTargetRefreshRef.current = timestamp
			}

			setSnapshot(engine.step(timestamp - previousTimestamp))
			frameRef.current = requestAnimationFrame(tick)
		}

		frameRef.current = requestAnimationFrame(tick)
		return () => {
			if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
			frameRef.current = null
			lastFrameRef.current = null
		}
	}, [documentHidden, engine, settings.enabled, settings.soundEnabled, settings.activityLevel])

	return (
		<>
			{children}
			{settings.enabled && <WebsitePetOverlay snapshot={snapshot} image={PET_IMAGE_BOUNDS} />}
		</>
	)
}
