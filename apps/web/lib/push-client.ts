import { isTimeZone, type PushConfigResponse, type PushScreen, type PushSubscribeResponse } from '@dv-lab/contracts'

import { apiRequest } from './api-client'

export type PushStatus = 'on' | 'off' | 'blocked' | 'not_available' | 'server_off' | 'revoked'
export type PushSnapshot = { status: PushStatus; device: string }
export type PushOutcome = 'on' | 'declined' | 'blocked' | 'failed'

export const PUSH_CHANGED = 'dvlab:push-changed'

const DEVICE_ID_KEY = 'dv-lab.push.device-id'
const SECOND_ZONE_KEY = 'dv-lab.schedule.second-zone'
const DEFAULT_SECOND_ZONE = 'Europe/Moscow'
const NO_ZONE = 'none'

function readStored(key: string): string | null {
	try {
		return localStorage.getItem(key)
	} catch {
		return null
	}
}

function writeStored(key: string, value: string | null) {
	try {
		if (value === null) localStorage.removeItem(key)
		else localStorage.setItem(key, value)
	} catch {}
}

function announce() {
	window.dispatchEvent(new Event(PUSH_CHANGED))
}

function secondTimeZone(): string | undefined {
	const raw = readStored(SECOND_ZONE_KEY)
	if (raw === NO_ZONE) return undefined
	const zone = raw ?? DEFAULT_SECOND_ZONE
	return isTimeZone(zone) ? zone : undefined
}

export function deviceLabel(): string {
	const agent = navigator.userAgent
	const browser = /Edg\//.test(agent)
		? 'Edge'
		: /Firefox\/|FxiOS\//.test(agent)
			? 'Firefox'
			: /Chrome\/|CriOS\//.test(agent)
				? 'Chrome'
				: /Safari\//.test(agent)
					? 'Safari'
					: 'Browser'
	const system = /iPhone/.test(agent)
		? 'iPhone'
		: /iPad/.test(agent)
			? 'iPad'
			: /Android/.test(agent)
				? 'Android'
				: /Mac OS X|Macintosh/.test(agent)
					? navigator.maxTouchPoints > 1
						? 'iPad'
						: 'Mac'
					: /Windows/.test(agent)
						? 'Windows'
						: /Linux|X11/.test(agent)
							? 'Linux'
							: 'this device'
	return `${browser} on ${system}`
}

function isStandalone(): boolean {
	const nav = navigator as Navigator & { standalone?: boolean }
	return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

function isApple(): boolean {
	return (
		/iPhone|iPad|iPod/.test(navigator.userAgent) ||
		(/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
	)
}

export function pushSupport(): 'supported' | 'not_available' {
	if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
		return 'not_available'
	if (isApple() && !isStandalone()) return 'not_available'
	return 'supported'
}

export async function registerWorker(): Promise<ServiceWorkerRegistration> {
	await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
	return navigator.serviceWorker.ready
}

async function existingSubscription(): Promise<PushSubscription | null> {
	if (pushSupport() !== 'supported' || Notification.permission !== 'granted') return null
	const registration = await navigator.serviceWorker.getRegistration('/')
	return registration ? registration.pushManager.getSubscription() : null
}

function keyBytes(value: string): Uint8Array<ArrayBuffer> {
	const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
	return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

async function readConfig(): Promise<PushConfigResponse | null> {
	const result = await apiRequest<PushConfigResponse>('GET', '/push/config')
	return result.ok ? result.data : null
}

async function save(subscription: PushSubscription): Promise<boolean> {
	const { endpoint, keys } = subscription.toJSON()
	if (!endpoint || !keys?.p256dh || !keys.auth) return false
	const zone = secondTimeZone()
	const result = await apiRequest<PushSubscribeResponse>('POST', '/push/subscriptions', {
		endpoint,
		keys: { p256dh: keys.p256dh, auth: keys.auth },
		deviceLabel: deviceLabel(),
		...(zone === undefined ? {} : { secondTimeZone: zone }),
	})
	if (!result.ok) return false
	writeStored(DEVICE_ID_KEY, result.data.id)
	return true
}

export async function resync(): Promise<void> {
	try {
		if (pushSupport() !== 'supported' || Notification.permission !== 'granted') return
		const registration = await registerWorker()
		const subscription = await registration.pushManager.getSubscription()
		if (subscription && (await save(subscription))) announce()
	} catch {}
}

export async function currentState(): Promise<PushSnapshot> {
	const device = deviceLabel()
	try {
		if (pushSupport() === 'not_available') return { status: 'not_available', device }
		const config = await readConfig()
		if (config !== null && !config.enabled) return { status: 'server_off', device }
		if (Notification.permission === 'denied') return { status: 'blocked', device }
		const storedId = readStored(DEVICE_ID_KEY)
		const known = storedId === null ? undefined : config?.devices.find((entry) => entry.id === storedId)
		const subscription = await existingSubscription()
		if (known?.revoked) return { status: 'revoked', device }
		return { status: subscription === null ? 'off' : 'on', device }
	} catch {
		return { status: 'off', device }
	}
}

export async function subscribe(renew = false): Promise<PushOutcome> {
	try {
		if (pushSupport() !== 'supported') return 'failed'
		let permission = Notification.permission
		if (permission === 'default') permission = await Notification.requestPermission()
		if (permission === 'denied') return 'blocked'
		if (permission !== 'granted') return 'declined'
		const config = await readConfig()
		if (config === null || !config.enabled || config.publicKey === null) return 'failed'
		const registration = await registerWorker()
		const previous = await registration.pushManager.getSubscription()
		if (previous && renew) await previous.unsubscribe()
		const subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: keyBytes(config.publicKey),
		})
		if (!(await save(subscription))) {
			await subscription.unsubscribe().catch(() => false)
			return 'failed'
		}
		announce()
		return 'on'
	} catch {
		return 'failed'
	}
}

export async function unsubscribe(): Promise<void> {
	try {
		const subscription = await existingSubscription()
		writeStored(DEVICE_ID_KEY, null)
		if (subscription) {
			const endpoint = subscription.endpoint
			await subscription.unsubscribe()
			await apiRequest('DELETE', '/push/subscriptions', { endpoint })
		}
	} catch {}
	announce()
}

export async function sendPresence(screen: PushScreen, studentId?: string): Promise<void> {
	try {
		const subscription = await existingSubscription()
		if (subscription === null) return
		const zone = secondTimeZone()
		await apiRequest('POST', '/push/presence', {
			endpoint: subscription.endpoint,
			screen,
			...(studentId === undefined ? {} : { studentId }),
			...(zone === undefined ? {} : { secondTimeZone: zone }),
		})
	} catch {}
}
