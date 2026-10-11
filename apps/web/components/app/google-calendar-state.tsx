'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useRouter } from 'next/navigation'

import { apiRequest } from '@/lib/api-client'

import { googleConnectionSnapshot, type GoogleConnectionSnapshot } from '@dv-lab/contracts'

type ConnectionAction = GoogleConnectionSnapshot['allowedActions'][number]
type ConnectionView =
	{ status: 'loading' | 'failed'; snapshot: null } | { status: 'ready'; snapshot: GoogleConnectionSnapshot }

const CONNECT_ERROR = 'Could not connect Google Calendar. Try again from Settings.'
const DISCONNECT_ERROR = 'Could not confirm the disconnect request. Refresh the connection status before trying again.'

function callbackMessage(reason: string | null): string | null {
	switch (reason) {
		case null:
		case 'connected':
			return null
		case 'denied':
			return 'Google Calendar was not connected. You can try again when you are ready.'
		case 'permission_required':
			return 'Calendar access was not granted. Allow the requested calendar permissions to connect.'
		case 'invalid_state':
			return 'This connection request could not be verified. Start again from Settings.'
		case 'wrong_primary':
			return 'This Google account does not match the connected calendar. Reconnect with the original account.'
		default:
			return CONNECT_ERROR
	}
}

function authorizationUrl(value: unknown): string | null {
	if (typeof value !== 'object' || value === null || !('url' in value) || typeof value.url !== 'string') return null
	try {
		const url = new URL(value.url)
		if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth') return null
		if (url.username || url.password || url.hash) return null
		if (['access_token', 'refresh_token', 'id_token'].some((key) => url.searchParams.has(key))) return null
		return url.href
	} catch {
		return null
	}
}

function disconnectObserved(action: ConnectionAction, snapshot: GoogleConnectionSnapshot): boolean {
	if (action === 'confirm_revoked')
		return snapshot.state === 'not_connected' && snapshot.disconnectResolution === 'operator_confirmed'
	return (
		snapshot.state === 'disconnecting' ||
		snapshot.state === 'disconnect_failed' ||
		(snapshot.state === 'not_connected' && snapshot.disconnectResolution !== 'none')
	)
}

export function useGoogleConnection(callbackOutcome: string | null = null) {
	const router = useRouter()
	const [view, setView] = useState<ConnectionView>({ status: 'loading', snapshot: null })
	const [pending, setPending] = useState<ConnectionAction | null>(null)
	const [notice, setNotice] = useState(() => callbackMessage(callbackOutcome))
	const initialCallback = useRef(callbackOutcome)
	const mounted = useRef(false)
	const sequence = useRef(0)
	const inflight = useRef(false)

	const denied = useCallback(
		(status: number) => {
			if (status !== 401 && status !== 403) return false
			setView({ status: 'failed', snapshot: null })
			router.replace(status === 401 ? '/login?reason=expired' : '/')
			return true
		},
		[router]
	)

	const read = useCallback((): Promise<GoogleConnectionSnapshot | null> => {
		const request = ++sequence.current
		return apiRequest<unknown>('GET', '/google/connection').then((result) => {
			if (!mounted.current || request !== sequence.current) return null
			if (!result.ok) {
				denied(result.status)
				setView({ status: 'failed', snapshot: null })
				return null
			}
			const parsed = googleConnectionSnapshot.safeParse(result.data)
			if (!parsed.success) {
				setView({ status: 'failed', snapshot: null })
				return null
			}
			setView({ status: 'ready', snapshot: parsed.data })
			setNotice((current) => (current === DISCONNECT_ERROR ? null : current))
			return parsed.data
		})
	}, [denied])

	const refresh = useCallback(() => {
		setView({ status: 'loading', snapshot: null })
		return read()
	}, [read])

	useEffect(() => {
		mounted.current = true
		void read()
		if (initialCallback.current !== null) router.replace('/settings?tab=calendar', { scroll: false })
		function returned() {
			if (!inflight.current && document.visibilityState === 'visible') void refresh()
		}
		window.addEventListener('focus', returned)
		document.addEventListener('visibilitychange', returned)
		return () => {
			mounted.current = false
			sequence.current += 1
			window.removeEventListener('focus', returned)
			document.removeEventListener('visibilitychange', returned)
		}
	}, [read, refresh, router])

	useEffect(() => {
		if (view.snapshot?.state !== 'disconnecting') return
		const timer = window.setTimeout(() => {
			if (!inflight.current && document.visibilityState === 'visible') void refresh()
		}, 2000)
		return () => window.clearTimeout(timer)
	}, [view, refresh])

	async function connect() {
		const result = await apiRequest<unknown>('POST', '/google/connect', {})
		if (!mounted.current) return false
		if (!result.ok) {
			if (denied(result.status)) return false
			setNotice(CONNECT_ERROR)
			await refresh()
			return false
		}
		const url = authorizationUrl(result.data)
		if (!url) {
			setNotice(CONNECT_ERROR)
			return false
		}
		window.location.assign(url)
		return true
	}

	async function disconnect(action: ConnectionAction) {
		const confirmation = action === 'confirm_revoked'
		const result = await apiRequest<unknown>(
			'POST',
			confirmation ? '/google/disconnect/confirm-revoked' : '/google/disconnect',
			confirmation ? { confirmed: true } : {}
		)
		if (!mounted.current) return false
		if (!result.ok && denied(result.status)) return false
		const current = await refresh()
		if (!mounted.current) return false
		if (current && disconnectObserved(action, current)) return true
		setNotice(DISCONNECT_ERROR)
		return false
	}

	async function act(action: ConnectionAction, generation: number): Promise<boolean> {
		if (inflight.current) return false
		inflight.current = true
		setPending(action)
		setNotice(null)
		try {
			const fresh = await refresh()
			if (!fresh || fresh.generation !== generation || !fresh.allowedActions.includes(action)) return false
			return action === 'connect' || action === 'reconnect' ? await connect() : await disconnect(action)
		} finally {
			inflight.current = false
			if (mounted.current) setPending(null)
		}
	}

	return { view, pending, notice, refresh, act }
}
