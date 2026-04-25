import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'

const { app } = await import('./app')

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

const createStudent = await app.request('/students', {
	method: 'POST',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({
		fullName: 'Test Student',
		email: 'test.student@example.com',
		phone: '+1 555 0199',
		level: 'B2',
		status: 'active',
		notes: 'Phase 4 registry smoke test',
		defaultLessonPrice: 45,
		billingMode: 'per_lesson',
	}),
})
assert.equal(createStudent.status, 201)
const createStudentBody = await createStudent.json()
assert.equal(createStudentBody.student.fullName, 'Test Student')

const filteredStudents = await app.request('/students?status=active&search=Test%20Student', {
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(filteredStudents.status, 200)
const filteredStudentsBody = await filteredStudents.json()
assert.equal(
	filteredStudentsBody.students.some((student: { id: string }) => student.id === createStudentBody.student.id),
	true
)

const updateStudent = await app.request(`/students/${createStudentBody.student.id}`, {
	method: 'PATCH',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({
		level: 'C1',
		defaultLessonPrice: 50,
	}),
})
assert.equal(updateStudent.status, 200)
const updateStudentBody = await updateStudent.json()
assert.equal(updateStudentBody.student.level, 'C1')

const archiveStudent = await app.request(`/students/${createStudentBody.student.id}`, {
	method: 'PATCH',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({
		status: 'archived',
	}),
})
assert.equal(archiveStudent.status, 200)
const archiveStudentBody = await archiveStudent.json()
assert.equal(archiveStudentBody.student.status, 'archived')

const emptyUpdate = await app.request(`/students/${createStudentBody.student.id}`, {
	method: 'PATCH',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({}),
})
assert.equal(emptyUpdate.status, 400)

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
