'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { Banner, BannerAction, BannerActions, BannerDescription, BannerTitle } from '@/components/ui/banner'

interface ToastContent {
	title: string
	description: string
	status?: 'success' | 'error' | 'warning'
	sticky?: boolean
	action?: { label: string; href?: string; onClick?: () => void }
}

interface ToastItem extends ToastContent {
	id: number
}

interface ToastApi {
	show: (toast: ToastContent) => number
	dismiss: (id: number) => void
}

const AUTO_DISMISS_MS = 4000

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
	const api = useContext(ToastContext)
	if (!api) throw new Error('useToast must be used inside ToastProvider')
	return api
}

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<ToastItem[]>([])
	const nextId = useRef(0)
	const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

	const dismiss = useCallback((id: number) => {
		const timer = timers.current.get(id)
		if (timer) clearTimeout(timer)
		timers.current.delete(id)
		setToasts((current) => current.filter((toast) => toast.id !== id))
	}, [])

	const show = useCallback(
		(toast: ToastContent) => {
			nextId.current += 1
			const id = nextId.current
			setToasts((current) => [...current, { ...toast, id }])
			if (toast.sticky !== true)
				timers.current.set(
					id,
					setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
				)
			return id
		},
		[dismiss]
	)

	useEffect(() => {
		const pending = timers.current
		return () => {
			pending.forEach((timer) => clearTimeout(timer))
			pending.clear()
		}
	}, [])

	const api = useMemo(() => ({ show, dismiss }), [show, dismiss])

	return (
		<ToastContext.Provider value={api}>
			{children}
			<div className="pointer-events-none fixed inset-x-0 top-[calc(3.5rem+var(--safe-top))] z-50 mx-auto flex w-full max-w-md flex-col gap-2 px-4 md:top-auto md:bottom-[calc(1.5rem+var(--safe-bottom))]">
				{toasts.map((toast) => (
					<div key={toast.id} className="pointer-events-auto rounded-xl bg-background shadow-surface-3">
						<Banner
							status={toast.status ?? 'success'}
							size={toast.status === undefined || toast.status === 'success' ? undefined : 'compact'}
							dismissible
							dismissLabel="Dismiss"
							onDismiss={() => dismiss(toast.id)}
						>
							<BannerTitle>{toast.title}</BannerTitle>
							<BannerDescription className={toast.sticky ? 'text-muted-foreground' : undefined}>
								{toast.description}
							</BannerDescription>
							{toast.action ? (
								<BannerActions>
									<BannerAction
										variant="secondary"
										href={toast.action.href}
										onClick={() => {
											toast.action?.onClick?.()
											dismiss(toast.id)
										}}
									>
										{toast.action.label}
									</BannerAction>
								</BannerActions>
							) : null}
						</Banner>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	)
}
