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
