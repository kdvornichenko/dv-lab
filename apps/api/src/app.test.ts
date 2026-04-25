import assert from 'node:assert/strict'

import { app } from './app'

const health = await app.request('/healthz')
assert.equal(health.status, 200)

const unauthenticated = await app.request('/students')
assert.equal(unauthenticated.status, 401)

const unauthenticatedMe = await app.request('/auth/me')
assert.equal(unauthenticatedMe.status, 401)

const demoAuthenticated = await app.request('/students', {
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(demoAuthenticated.status, 200)

const demoMe = await app.request('/auth/me', {
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(demoMe.status, 200)

const calendarConnection = await app.request('/calendar/connections', {
	method: 'POST',
	headers: {
		'x-demo-user': 'demo-teacher',
		'x-demo-email': 'teacher.google@example.com',
	},
})
assert.equal(calendarConnection.status, 200)
const calendarConnectionBody = await calendarConnection.json()
assert.equal(calendarConnectionBody.connection.email, 'teacher.google@example.com')
assert.equal(calendarConnectionBody.connection.status, 'authorization_required')
assert.equal((await app.request('/calendar/connection', { headers: { 'x-demo-user': 'demo-teacher' } })).status, 200)
