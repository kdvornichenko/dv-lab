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
		defaultLessonPrice: 2300,
		packageMonths: 3,
		packageLessonCount: 24,
		packageTotalPrice: 50400,
		billingMode: 'package',
	}),
})
assert.equal(createStudent.status, 201)
const createStudentBody = await createStudent.json()
assert.equal(createStudentBody.student.fullName, 'Test Student')
assert.equal(createStudentBody.student.packageTotalPrice, 50400)

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

const createPayment = await app.request('/payments', {
	method: 'POST',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({
		studentId: createStudentBody.student.id,
		amount: 1234,
		paidAt: new Date().toISOString(),
		method: 'cash',
		comment: 'Delete payment smoke test',
	}),
})
assert.equal(createPayment.status, 201)
const createPaymentBody = await createPayment.json()
assert.equal(createPaymentBody.payment.amount, 1234)

const deletePayment = await app.request(`/payments/${createPaymentBody.payment.id}`, {
	method: 'DELETE',
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(deletePayment.status, 200)
const deletePaymentBody = await deletePayment.json()
assert.equal(deletePaymentBody.payment.id, createPaymentBody.payment.id)

const deleteMissingPayment = await app.request(`/payments/${createPaymentBody.payment.id}`, {
	method: 'DELETE',
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(deleteMissingPayment.status, 404)

const updateStudent = await app.request(`/students/${createStudentBody.student.id}`, {
	method: 'PATCH',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({
		level: 'C1',
		defaultLessonPrice: 2400,
		packageMonths: 5,
		packageLessonCount: 40,
		packageTotalPrice: 76000,
	}),
})
assert.equal(updateStudent.status, 200)
const updateStudentBody = await updateStudent.json()
assert.equal(updateStudentBody.student.level, 'C1')
assert.equal(updateStudentBody.student.packageLessonCount, 40)

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

const createDeleteStudent = await app.request('/students', {
	method: 'POST',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({
		fullName: 'Delete Student',
		email: 'delete.student@example.com',
		phone: '',
		level: 'A1',
		status: 'active',
		notes: 'Delete smoke test',
		defaultLessonPrice: 2300,
		packageMonths: 0,
		packageLessonCount: 0,
		packageTotalPrice: 0,
		billingMode: 'per_lesson',
	}),
})
assert.equal(createDeleteStudent.status, 201)
const createDeleteStudentBody = await createDeleteStudent.json()
const deleteStudent = await app.request(`/students/${createDeleteStudentBody.student.id}`, {
	method: 'DELETE',
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(deleteStudent.status, 200)
const deleteMissingStudent = await app.request(`/students/${createDeleteStudentBody.student.id}`, {
	method: 'DELETE',
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(deleteMissingStudent.status, 404)

const emptyUpdate = await app.request(`/students/${createStudentBody.student.id}`, {
	method: 'PATCH',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({}),
})
assert.equal(emptyUpdate.status, 400)

const startsAt = new Date()
startsAt.setDate(startsAt.getDate() + 2)
startsAt.setHours(17, 30, 0, 0)

const createLesson = await app.request('/lessons', {
	method: 'POST',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({
		title: 'Test lesson',
		startsAt: startsAt.toISOString(),
		durationMinutes: 60,
		topic: 'API contracts',
		notes: 'Phase 5 lesson smoke test',
		status: 'planned',
		studentIds: [createStudentBody.student.id],
	}),
})
assert.equal(createLesson.status, 201)
const createLessonBody = await createLesson.json()
assert.equal(createLessonBody.lesson.studentIds[0], createStudentBody.student.id)

const filteredLessons = await app.request(`/lessons?studentId=${createStudentBody.student.id}&status=planned`, {
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(filteredLessons.status, 200)
const filteredLessonsBody = await filteredLessons.json()
assert.equal(
	filteredLessonsBody.lessons.some((lesson: { id: string }) => lesson.id === createLessonBody.lesson.id),
	true
)

const updateLesson = await app.request(`/lessons/${createLessonBody.lesson.id}`, {
	method: 'PATCH',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({
		status: 'cancelled',
		notes: 'Cancelled by smoke test',
	}),
})
assert.equal(updateLesson.status, 200)
const updateLessonBody = await updateLesson.json()
assert.equal(updateLessonBody.lesson.status, 'cancelled')

const markAttendance = await app.request('/lessons/attendance', {
	method: 'POST',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({
		lessonId: createLessonBody.lesson.id,
		records: [
			{
				studentId: createStudentBody.student.id,
				status: 'cancelled',
				billable: false,
				note: 'Smoke test mark',
			},
		],
	}),
})
assert.equal(markAttendance.status, 200)
const markAttendanceBody = await markAttendance.json()
assert.equal(markAttendanceBody.attendance[0].billable, false)

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
