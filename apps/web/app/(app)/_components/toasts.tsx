'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { Banner, BannerDescription, BannerTitle } from '@/components/ui/banner'

interface ToastContent {
	title: string
	description: string
}

interface ToastItem extends ToastContent {
	id: number
}

interface ToastApi {
	show: (toast: ToastContent) => void
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
			timers.current.set(
				id,
				setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
			)
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

	const api = useMemo(() => ({ show }), [show])

	return (
		<ToastContext.Provider value={api}>
			{children}
			<div className="pointer-events-none fixed inset-x-0 top-14 z-50 mx-auto flex w-full max-w-md flex-col gap-2 px-4 md:top-auto md:bottom-6">
				{toasts.map((toast) => (
					<div key={toast.id} className="pointer-events-auto rounded-xl bg-background shadow-surface-3">
						<Banner status="success" dismissible dismissLabel="Dismiss" onDismiss={() => dismiss(toast.id)}>
							<BannerTitle>{toast.title}</BannerTitle>
							<BannerDescription>{toast.description}</BannerDescription>
						</Banner>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	)
}
