import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

process.env.NODE_ENV = 'test'

const databaseUrl = process.env.TEACHER_CRM_TEST_DATABASE_URL
const requireDatabaseTests = process.env.TEACHER_CRM_REQUIRE_DB_TESTS === '1' || process.env.CI === 'true'

if (!databaseUrl) {
	if (requireDatabaseTests) {
		console.error('[teacher-crm] DB integration tests required but TEACHER_CRM_TEST_DATABASE_URL is not set')
		process.exit(1)
	}
	console.log('[teacher-crm] skipping DB integration tests: TEACHER_CRM_TEST_DATABASE_URL is not set')
	process.exit(0)
}

const { createApp } = await import('./app')

const app = createApp({ db: { databaseUrl } })
const demoUser = `db-integration-${randomUUID()}`
const demoHeaders = {
	'content-type': 'application/json',
	'x-demo-user': demoUser,
	'x-demo-email': `${demoUser}@example.test`,
}

const createStudent = await app.request('/students', {
	method: 'POST',
	headers: demoHeaders,
	body: JSON.stringify({
		fullName: 'DB Integration Student',
		email: 'db.integration@example.test',
		status: 'active',
		defaultLessonPrice: 2500,
		defaultLessonDurationMinutes: 60,
		packageMonths: 0,
		packageLessonsPerWeek: 0,
		packageLessonCount: 0,
		billingMode: 'per_lesson',
	}),
})
assert.equal(createStudent.status, 201)
const createStudentBody = await createStudent.json()

const duplicateStudentIdsLesson = await app.request('/lessons', {
	method: 'POST',
	headers: demoHeaders,
	body: JSON.stringify({
		title: 'Duplicate student ids',
		startsAt: new Date(Date.now() + 86_400_000).toISOString(),
		durationMinutes: 60,
		status: 'planned',
		studentIds: [createStudentBody.student.id, createStudentBody.student.id],
	}),
})
assert.equal(duplicateStudentIdsLesson.status, 400)

const missingStudentPayment = await app.request('/payments', {
	method: 'POST',
	headers: demoHeaders,
	body: JSON.stringify({
		studentId: randomUUID(),
		amount: 1000,
		paidAt: new Date().toISOString(),
		method: 'cash',
	}),
})
assert.equal(missingStudentPayment.status, 404)

const createPayment = await app.request('/payments', {
	method: 'POST',
	headers: demoHeaders,
	body: JSON.stringify({
		studentId: createStudentBody.student.id,
		amount: 1000,
		paidAt: new Date().toISOString(),
		method: 'cash',
		idempotencyKey: `db-payment-${randomUUID()}`,
	}),
})
assert.equal(createPayment.status, 201)
const createPaymentBody = await createPayment.json()

const deletePayment = await app.request(`/payments/${createPaymentBody.payment.id}`, {
	method: 'DELETE',
	headers: { 'x-demo-user': demoUser },
})
assert.equal(deletePayment.status, 200)
const deletePaymentBody = await deletePayment.json()
assert.ok(deletePaymentBody.payment.voidedAt)

const listPayments = await app.request('/payments', {
	headers: { 'x-demo-user': demoUser },
})
assert.equal(listPayments.status, 200)
const listPaymentsBody = await listPayments.json()
assert.equal(
	listPaymentsBody.payments.some((payment: { id: string }) => payment.id === createPaymentBody.payment.id),
	false
)
