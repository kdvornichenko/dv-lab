'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { LoaderCircle, RefreshCw, X } from 'lucide-react'

import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { apiRequest } from '@/lib/api-client'
import { spring } from '@/lib/springs'

const CHECK_INTERVAL_MS = 10 * 60 * 1000
const RELOAD_GIVE_UP_MS = 5000
const UNKNOWN = 'unknown'
const TEXT_INPUTS = new Set(['text', 'email', 'url', 'tel', 'number'])

type CheckMoment = 'visible' | 'tick'

function holdsText(element: Element): boolean {
	if (element instanceof HTMLTextAreaElement) return element.value.trim() !== ''
	if (element instanceof HTMLInputElement) return TEXT_INPUTS.has(element.type) && element.value.trim() !== ''
	if (element instanceof HTMLElement && element.isContentEditable) return (element.textContent ?? '').trim() !== ''
	return false
}

function useTypedText() {
	const edited = useRef(new Set<Element>())

	useEffect(() => {
		const fields = edited.current
		const record = (event: Event) => {
			if (event.target instanceof Element) fields.add(event.target)
		}
		document.addEventListener('input', record, true)
		return () => document.removeEventListener('input', record, true)
	}, [])

	return useCallback(() => {
		let found = false
		for (const element of edited.current) {
			if (!element.isConnected) edited.current.delete(element)
			else if (holdsText(element)) found = true
		}
		return found
	}, [])
}

export function VersionWatch({ version }: { version: string }) {
	const [outdated, setOutdated] = useState<string | null>(null)
	const dismissed = useRef<string | null>(null)
	const checking = useRef(false)

	useEffect(() => {
		if (version === UNKNOWN) return
		const check = async (moment: CheckMoment) => {
			if (checking.current || document.visibilityState !== 'visible') return
			checking.current = true
			const result = await apiRequest<{ sha?: unknown }>('GET', '/healthz')
			checking.current = false
			if (!result.ok) return
			const sha = result.data.sha
			if (typeof sha !== 'string' || sha === '' || sha === UNKNOWN) return
			if (sha === version) {
				setOutdated(null)
				return
			}
			if (moment === 'tick' && dismissed.current === sha) return
			dismissed.current = null
			setOutdated(sha)
		}
		const onVisibility = () => {
			if (document.visibilityState === 'visible') void check('visible')
		}
		void check('visible')
		const timer = setInterval(() => void check('tick'), CHECK_INTERVAL_MS)
		document.addEventListener('visibilitychange', onVisibility)
		return () => {
			clearInterval(timer)
			document.removeEventListener('visibilitychange', onVisibility)
		}
	}, [version])

	return (
		<UpdateNotice
			open={outdated !== null}
			onDismiss={() => {
				dismissed.current = outdated
				setOutdated(null)
			}}
		/>
	)
}

function UpdateNotice({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
	const phone = useIsMobile()
	const reduceMotion = useReducedMotion() ?? false
	const typedText = useTypedText()
	const [confirming, setConfirming] = useState(false)
	const [reloading, setReloading] = useState(false)
	const giveUp = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(
		() => () => {
			if (giveUp.current) clearTimeout(giveUp.current)
		},
		[]
	)

	function reload() {
		setReloading(true)
		if (giveUp.current) clearTimeout(giveUp.current)
		giveUp.current = setTimeout(() => setReloading(false), RELOAD_GIVE_UP_MS)
		window.location.reload()
	}

	function press() {
		if (typedText()) setConfirming(true)
		else reload()
	}

	return (
		<>
			<AnimatePresence>
				{open ? (
					<m.div
						key="update-notice"
						role="status"
						aria-live="polite"
						className="fixed inset-x-4 top-14 z-40 flex flex-col gap-0.5 rounded-xl bg-surface-4 px-4 py-3 text-foreground shadow-surface-4 md:inset-x-auto md:top-auto md:right-4 md:bottom-4 md:w-[340px]"
						initial={{ opacity: 0, y: reduceMotion ? 0 : phone ? -8 : 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, transition: { duration: spring.fast.exit.duration } }}
						transition={{ type: 'spring', duration: spring.moderate.duration, bounce: 0 }}
					>
						<div className="flex items-center gap-2">
							<RefreshCw size={16} className="shrink-0 text-info" aria-hidden />
							<p className="text-body font-semibold">A new version is available</p>
							<button
								type="button"
								aria-label="Dismiss"
								onClick={onDismiss}
								className="-mt-0.5 -mr-1.5 ml-auto flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-80 outline-none hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]"
							>
								<X size={16} aria-hidden />
							</button>
						</div>
						<p className="pl-6 text-caption text-muted-foreground">Reload to get the latest changes.</p>
						<div className="mt-1.5 pl-6">
							<Button
								type="button"
								variant="secondary"
								size="compact"
								className="-ml-2 px-2"
								disabled={reloading}
								onClick={press}
							>
								{reloading ? (
									<span className="inline-flex items-center gap-1">
										<LoaderCircle size={14} className="animate-spin" aria-hidden />
										Reloading…
									</span>
								) : (
									'Reload'
								)}
							</Button>
						</div>
					</m.div>
				) : null}
			</AnimatePresence>
			{confirming ? (
				<ConfirmDialog
					title="Reload now?"
					body="Changes you have not saved will be lost."
					cancelLabel="Stay"
					confirmLabel="Reload"
					pendingLabel="Reloading…"
					tone="destructive"
					failureText="Could not reload. Try again."
					onConfirm={async () => {
						reload()
						return true
					}}
					onClose={() => setConfirming(false)}
				/>
			) : null}
		</>
	)
}
