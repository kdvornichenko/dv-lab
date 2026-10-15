const ownPath = (value) =>
	typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
		? value
		: '/'

self.addEventListener('install', () => {
	self.skipWaiting()
})

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
	let payload = {}
	try {
		payload = event.data ? event.data.json() : {}
	} catch {
		payload = {}
	}
	if (payload === null || typeof payload !== 'object') payload = {}
	const title = typeof payload.title === 'string' && payload.title !== '' ? payload.title : 'dv-lab'
	const options = { icon: '/icon-192.png', data: { url: ownPath(payload.url) } }
	if (typeof payload.body === 'string') options.body = payload.body
	if (typeof payload.tag === 'string' && payload.tag !== '') options.tag = payload.tag
	event.waitUntil(self.registration.showNotification(title, options))
})

const keyBytes = (value) => {
	const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
	return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

const sendJson = (method, body) =>
	fetch('/api/push/subscriptions', {
		method,
		credentials: 'same-origin',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	})

async function resubscribe(event) {
	try {
		const previous = event.oldSubscription ?? null
		let next = event.newSubscription ?? null
		if (!next) {
			let key = previous && previous.options ? previous.options.applicationServerKey : null
			if (!key) {
				const response = await fetch('/api/push/config', { credentials: 'same-origin' })
				if (!response.ok) return
				const config = await response.json()
				if (typeof config.publicKey !== 'string') return
				key = keyBytes(config.publicKey)
			}
			next = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
		}
		const { endpoint, keys } = next.toJSON()
		if (!keys || !keys.p256dh || !keys.auth) return
		const saved = await sendJson('POST', { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } })
		if (saved.ok && previous && previous.endpoint !== endpoint)
			await sendJson('DELETE', { endpoint: previous.endpoint })
	} catch {}
}

self.addEventListener('pushsubscriptionchange', (event) => {
	event.waitUntil(resubscribe(event))
})

self.addEventListener('notificationclick', (event) => {
	event.notification.close()
	const target = new URL(ownPath(event.notification.data && event.notification.data.url), self.location.origin).href
	event.waitUntil(
		(async () => {
			const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
			const open = windows.find((client) => new URL(client.url).origin === self.location.origin)
			if (open) {
				try {
					await open.focus()
					await open.navigate(target)
					return
				} catch {}
			}
			await self.clients.openWindow(target)
		})()
	)
})
