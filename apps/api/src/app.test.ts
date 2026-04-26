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

const sidebarSettings = await app.request('/settings/sidebar', {
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(sidebarSettings.status, 200)
const sidebarSettingsBody = await sidebarSettings.json()
assert.equal(
	sidebarSettingsBody.items.some((item: { id: string }) => item.id === 'dashboard'),
	true
)

const updateSidebarSettings = await app.request('/settings/sidebar', {
	method: 'PUT',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({
		items: [
			...sidebarSettingsBody.items,
			{ id: 'nav-custom', title: 'Custom', href: '/custom', icon: 'Circle', visible: true },
		],
	}),
})
assert.equal(updateSidebarSettings.status, 200)
const updateSidebarSettingsBody = await updateSidebarSettings.json()
assert.equal(
	updateSidebarSettingsBody.items.some((item: { id: string }) => item.id === 'nav-custom'),
	true
)

const themeSettings = await app.request('/settings/theme', {
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(themeSettings.status, 200)
const themeSettingsBody = await themeSettings.json()
assert.equal(themeSettingsBody.theme.colors.primary, '#2f6f5e')

const updateThemeSettings = await app.request('/settings/theme', {
	method: 'PUT',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({
		...themeSettingsBody.theme,
		bodyFont: 'jetbrains-mono',
		numberFont: 'roboto-mono',
		colors: {
			...themeSettingsBody.theme.colors,
			primary: '#145f52',
		},
	}),
})
assert.equal(updateThemeSettings.status, 200)
const updateThemeSettingsBody = await updateThemeSettings.json()
assert.equal(updateThemeSettingsBody.theme.colors.primary, '#145f52')
assert.equal(updateThemeSettingsBody.theme.bodyFont, 'jetbrains-mono')
assert.equal(updateThemeSettingsBody.theme.numberFont, 'roboto-mono')

const createCrmError = await app.request('/errors', {
	method: 'POST',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({
		source: 'API smoke',
		message: 'Persisted CRM error smoke test',
	}),
})
assert.equal(createCrmError.status, 201)
const createCrmErrorBody = await createCrmError.json()
assert.equal(createCrmErrorBody.error.source, 'API smoke')

const listCrmErrors = await app.request('/errors', {
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(listCrmErrors.status, 200)
const listCrmErrorsBody = await listCrmErrors.json()
assert.equal(
	listCrmErrorsBody.errors.some((error: { id: string }) => error.id === createCrmErrorBody.error.id),
	true
)

const deleteCrmError = await app.request(`/errors/${createCrmErrorBody.error.id}`, {
	method: 'DELETE',
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(deleteCrmError.status, 200)

const clearCrmErrors = await app.request('/errors', {
	method: 'DELETE',
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(clearCrmErrors.status, 200)

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
		defaultLessonDurationMinutes: 60,
		packageMonths: 3,
		packageLessonsPerWeek: 2,
		packageLessonCount: 24,
		billingMode: 'package',
	}),
})
assert.equal(createStudent.status, 201)
const createStudentBody = await createStudent.json()
assert.equal(createStudentBody.student.fullName, 'Test Student')
assert.equal(createStudentBody.student.defaultLessonDurationMinutes, 60)
assert.equal(createStudentBody.student.packageLessonsPerWeek, 2)
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
		special: 'IELTS writing',
		defaultLessonPrice: 2400,
		defaultLessonDurationMinutes: 90,
		packageMonths: 5,
		packageLessonsPerWeek: 2,
	}),
})
assert.equal(updateStudent.status, 200)
const updateStudentBody = await updateStudent.json()
assert.equal(updateStudentBody.student.level, 'C1')
assert.equal(updateStudentBody.student.special, 'IELTS writing')
assert.equal(updateStudentBody.student.defaultLessonDurationMinutes, 90)
assert.equal(updateStudentBody.student.packageLessonCount, 40)
assert.equal(updateStudentBody.student.packageTotalPrice, 120000)

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
		packageLessonsPerWeek: 0,
		packageLessonCount: 0,
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

const repeatExistingLesson = await app.request(`/lessons/${createLessonBody.lesson.id}`, {
	method: 'PATCH',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({
		repeatWeekly: true,
		repeatCount: 3,
	}),
})
assert.equal(repeatExistingLesson.status, 200)
const repeatExistingLessonBody = await repeatExistingLesson.json()
assert.equal(repeatExistingLessonBody.lesson.repeatWeekly, true)

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
assert.equal(filteredLessonsBody.lessons.length >= 1, true)

const renameStudent = await app.request(`/students/${createStudentBody.student.id}`, {
	method: 'PATCH',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({
		firstName: 'Renamed',
		lastName: 'Learner',
	}),
})
assert.equal(renameStudent.status, 200)

const renamedStudentLessons = await app.request(`/lessons?studentId=${createStudentBody.student.id}&status=planned`, {
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(renamedStudentLessons.status, 200)
const renamedStudentLessonsBody = await renamedStudentLessons.json()
assert.equal(
	renamedStudentLessonsBody.lessons.every((lesson: { title: string }) => lesson.title === 'Renamed L.'),
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

const createDeletedLesson = await app.request('/lessons', {
	method: 'POST',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({
		title: 'Deleted lesson',
		startsAt: new Date(startsAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
		durationMinutes: 60,
		topic: 'Delete lesson smoke',
		notes: 'Should be removed from CRM database',
		status: 'planned',
		studentIds: [createStudentBody.student.id],
	}),
})
assert.equal(createDeletedLesson.status, 201)
const createDeletedLessonBody = await createDeletedLesson.json()
const deleteLesson = await app.request(`/lessons/${createDeletedLessonBody.lesson.id}`, {
	method: 'DELETE',
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(deleteLesson.status, 200)
const deleteLessonBody = await deleteLesson.json()
assert.equal(deleteLessonBody.lesson.id, createDeletedLessonBody.lesson.id)

const deleteMissingLesson = await app.request(`/lessons/${createDeletedLessonBody.lesson.id}`, {
	method: 'DELETE',
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(deleteMissingLesson.status, 404)

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

const calendarState = await app.request('/calendar/connection', { headers: { 'x-demo-user': 'demo-teacher' } })
assert.equal(calendarState.status, 200)
const calendarStateBody = await calendarState.json()
assert.equal(
	calendarStateBody.syncRecords.some((record: { lessonId: string }) => record.lessonId === createLessonBody.lesson.id),
	true
)

const importCalendarEvents = await app.request('/calendar/import-events', {
	method: 'POST',
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(importCalendarEvents.status, 200)
const importCalendarEventsBody = await importCalendarEvents.json()
assert.equal(importCalendarEventsBody.updated, 0)

const providerTokens = await app.request('/calendar/provider-tokens', {
	method: 'POST',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
		'x-demo-email': 'teacher.google@example.com',
	},
	body: JSON.stringify({
		email: 'teacher.google@example.com',
		providerToken: 'google-access-token',
		providerRefreshToken: 'google-refresh-token',
	}),
})
assert.equal(providerTokens.status, 200)
const providerTokensBody = await providerTokens.json()
assert.equal(providerTokensBody.connection.status, 'connected')
assert.equal(providerTokensBody.connection.tokenAvailable, true)
assert.equal(providerTokensBody.connection.selectedCalendarId, 'primary')

const calendarOptions = await app.request('/calendar/calendars', {
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(calendarOptions.status, 200)
const calendarOptionsBody = await calendarOptions.json()
assert.equal(calendarOptionsBody.calendars[0].id, 'primary')

const selectCalendar = await app.request('/calendar/connection', {
	method: 'PATCH',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({
		calendarId: 'teacher-calendar',
		calendarName: 'Teaching',
	}),
})
assert.equal(selectCalendar.status, 200)
const selectCalendarBody = await selectCalendar.json()
assert.equal(selectCalendarBody.connection.selectedCalendarId, 'teacher-calendar')

const syncLesson = await app.request('/calendar/sync-events', {
	method: 'POST',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({
		lessonId: createLessonBody.lesson.id,
		syncPolicy: 'sync',
	}),
})
assert.equal(syncLesson.status, 200)
const syncLessonBody = await syncLesson.json()
assert.equal(syncLessonBody.sync.status, 'synced')

const retrySyncLesson = await app.request('/calendar/sync-events', {
	method: 'POST',
	headers: {
		'content-type': 'application/json',
		'x-demo-user': 'demo-teacher',
	},
	body: JSON.stringify({
		lessonId: createLessonBody.lesson.id,
		syncPolicy: 'sync',
	}),
})
assert.equal(retrySyncLesson.status, 200)

const calendarStateAfterRetry = await app.request('/calendar/connection', {
	headers: {
		'x-demo-user': 'demo-teacher',
	},
})
assert.equal(calendarStateAfterRetry.status, 200)
const calendarStateAfterRetryBody = await calendarStateAfterRetry.json()
assert.equal(
	calendarStateAfterRetryBody.syncRecords.filter(
		(record: { lessonId: string }) => record.lessonId === createLessonBody.lesson.id
	).length,
	1
)
