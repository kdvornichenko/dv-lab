import {
	BILLABLE_ATTENDANCE_STATUSES,
	DEFAULT_LESSON_DURATION_MINUTES,
	calculatePackageLessonPriceRub,
	calculatePackageTotalPriceRub,
	getLessonDurationUnits,
	type AttendanceRecord,
	type Currency,
	type Lesson,
	type LessonCharge,
	type PackageInstanceStatus,
	type Student,
	type StudentBalance,
	type StudentCurrencyBalance,
	type StudentPackage,
} from '@teacher-crm/api-types'
import {
	calculateStudentBalances,
	clearLessonChargePackageRows,
	insertStudentPackageRow,
	listAttendanceRows,
	listLessonChargeRows,
	listLessonRows,
	listPaymentRows,
	listStudentPackageRows,
	listStudentRows,
	updateStudentPackageRow,
	upsertLessonChargeRow,
	voidLessonChargeRow,
	type AttendanceRecordRow,
	type LessonChargeRow,
	type LessonRowWithStudents,
	type StudentPackageRow,
	type StudentRow,
} from '@teacher-crm/db'

import { getDb, teacherProfileId } from './db-context'
import { memoryStore } from './memory-store'
import type { StoreScope } from './store-scope'

const BILLABLE_STATUSES = BILLABLE_ATTENDANCE_STATUSES as readonly string[]

function dateToIso(value: Date | string | null | undefined) {
	if (!value) return new Date().toISOString()
	if (value instanceof Date) return value.toISOString()
	return value.includes('T') ? value : `${value}T00:00:00.000Z`
}

function dateOnly(value: Date | string | null | undefined) {
	return dateToIso(value).slice(0, 10)
}

function numeric(value: string | number | null | undefined) {
	if (typeof value === 'number') return value
	if (!value) return 0
	return Number(value)
}

function isBillableAttendance(record: Pick<AttendanceRecord, 'status' | 'billable'>) {
	return record.billable && BILLABLE_STATUSES.includes(record.status)
}

function mapStudent(row: StudentRow): Student {
	return {
		id: row.id,
		firstName: row.firstName,
		lastName: row.lastName,
		fullName: row.fullName,
		email: row.email ?? undefined,
		phone: row.phone ?? undefined,
		level: row.level ?? undefined,
		special: row.special ?? undefined,
		status: row.status,
		notes: row.notes ?? undefined,
		defaultLessonPrice: numeric(row.defaultLessonPrice),
		defaultLessonDurationMinutes: row.defaultLessonDurationMinutes,
		packageMonths: row.packageMonths,
		packageLessonsPerWeek: row.packageLessonsPerWeek,
		packageLessonCount: row.packageLessonCount,
		packageTotalPrice: numeric(row.packageTotalPrice),
		currency: row.currency,
		billingMode: row.billingMode,
		createdAt: dateToIso(row.createdAt),
		updatedAt: dateToIso(row.updatedAt),
	}
}

function mapLesson(row: LessonRowWithStudents): Lesson {
	return {
		id: row.id,
		title: row.title,
		startsAt: dateToIso(row.startsAt),
		durationMinutes: row.durationMinutes,
		repeatWeekly: row.repeatWeekly,
		topic: row.topic ?? undefined,
		notes: row.notes ?? undefined,
		status: row.status,
		studentIds: row.studentIds,
		createdAt: dateToIso(row.createdAt),
		updatedAt: dateToIso(row.updatedAt),
	}
}

function mapPackage(row: StudentPackageRow): StudentPackage {
	return {
		id: row.id,
		studentId: row.studentId,
		status: row.status,
		startsAt: row.startsAt,
		paidAt: row.paidAt ?? undefined,
		packageMonths: row.packageMonths,
		lessonsPerWeek: row.lessonsPerWeek,
		purchasedLessonCount: row.purchasedLessonCount,
		purchasedLessonUnits: numeric(row.purchasedLessonUnits),
		lessonPrice: numeric(row.lessonPrice),
		totalPrice: numeric(row.totalPrice),
		currency: row.currency,
		exhaustedAt: row.exhaustedAt ? dateToIso(row.exhaustedAt) : undefined,
		createdAt: dateToIso(row.createdAt),
	}
}

function mapCharge(row: LessonChargeRow): LessonCharge {
	return {
		id: row.id,
		lessonId: row.lessonId,
		studentId: row.studentId,
		attendanceRecordId: row.attendanceRecordId,
		packageId: row.packageId ?? undefined,
		amount: numeric(row.amount),
		currency: row.currency,
		lessonUnits: numeric(row.lessonUnits),
		attendanceStatus: row.attendanceStatus,
		voidedAt: row.voidedAt ? dateToIso(row.voidedAt) : undefined,
		createdAt: dateToIso(row.createdAt),
		updatedAt: dateToIso(row.updatedAt),
	}
}

function packageLessonPrice(student: Student | StudentRow, lesson?: Lesson | LessonRowWithStudents) {
	return calculatePackageLessonPriceRub({
		defaultLessonPrice: numeric(student.defaultLessonPrice),
		defaultLessonDurationMinutes: lesson?.durationMinutes ?? student.defaultLessonDurationMinutes,
		packageMonths: student.packageMonths,
	})
}

function lessonPrice(student: Student | StudentRow, lesson: Lesson | LessonRowWithStudents) {
	const durationUnits = getLessonDurationUnits(lesson.durationMinutes)
	const packagePrice = packageLessonPrice(student, lesson)
	return student.billingMode === 'package' && packagePrice > 0
		? packagePrice
		: numeric(student.defaultLessonPrice) * durationUnits
}

function packageTotal(student: Student | StudentRow) {
	return calculatePackageTotalPriceRub({
		defaultLessonPrice: numeric(student.defaultLessonPrice),
		defaultLessonDurationMinutes: student.defaultLessonDurationMinutes,
		packageMonths: student.packageMonths,
		packageLessonCount: student.packageLessonCount,
	})
}

function packageUnits(student: Student | StudentRow) {
	return student.packageLessonCount * getLessonDurationUnits(student.defaultLessonDurationMinutes)
}

function packageConsumedUnits(packageId: string, charges: LessonCharge[]) {
	return charges
		.filter((charge) => charge.packageId === packageId && !charge.voidedAt)
		.reduce((sum, charge) => sum + charge.lessonUnits, 0)
}

function findPackageForCharge(
	student: Student | StudentRow,
	lesson: Lesson | LessonRowWithStudents,
	packages: StudentPackage[],
	charges: LessonCharge[]
) {
	if (student.billingMode !== 'package') return undefined
	const requiredUnits = getLessonDurationUnits(lesson.durationMinutes)

	return packages
		.filter((studentPackage) => {
			if (studentPackage.studentId !== student.id) return false
			if (studentPackage.currency !== student.currency) return false
			if (studentPackage.status === 'cancelled') return false
			if (studentPackage.startsAt > dateOnly(lesson.startsAt)) return false
			const remainingUnits = studentPackage.purchasedLessonUnits - packageConsumedUnits(studentPackage.id, charges)
			return remainingUnits >= requiredUnits
		})
		.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.createdAt.localeCompare(b.createdAt))[0]
}

function packageProgress(
	student: Student,
	lessons: Lesson[],
	packages: StudentPackage[],
	charges: LessonCharge[],
	now: Date
): StudentBalance['packageProgress'] {
	if (student.billingMode !== 'package') return undefined
	const candidate = packages
		.filter(
			(studentPackage) =>
				studentPackage.studentId === student.id &&
				studentPackage.currency === student.currency &&
				studentPackage.status !== 'cancelled'
		)
		.map((studentPackage) => {
			const consumedUnits = packageConsumedUnits(studentPackage.id, charges)
			return {
				studentPackage,
				consumedUnits,
				remainingUnits: Math.max(studentPackage.purchasedLessonUnits - consumedUnits, 0),
			}
		})
		.filter((item) => item.remainingUnits > 0)
		.sort((a, b) => a.studentPackage.startsAt.localeCompare(b.studentPackage.startsAt))[0]

	if (!candidate) return undefined

	let scheduledUnits = 0
	let projectedPaymentDate: string | undefined
	let projectedPaymentLessonId: string | undefined
	const futureLessons = lessons
		.filter(
			(lesson) =>
				lesson.studentIds.includes(student.id) &&
				lesson.status === 'planned' &&
				new Date(lesson.startsAt).getTime() >= now.getTime()
		)
		.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

	for (const lesson of futureLessons) {
		scheduledUnits += getLessonDurationUnits(lesson.durationMinutes)
		if (scheduledUnits >= candidate.remainingUnits) {
			projectedPaymentDate = lesson.startsAt
			projectedPaymentLessonId = lesson.id
			break
		}
	}

	if (
		!projectedPaymentDate &&
		candidate.remainingUnits > scheduledUnits &&
		candidate.studentPackage.lessonsPerWeek > 0
	) {
		const weeklyUnits =
			candidate.studentPackage.lessonsPerWeek *
			getLessonDurationUnits(student.defaultLessonDurationMinutes || DEFAULT_LESSON_DURATION_MINUTES)
		if (weeklyUnits > 0) {
			const anchor = futureLessons.at(-1)?.startsAt ?? now.toISOString()
			const estimated = new Date(anchor)
			estimated.setDate(estimated.getDate() + Math.ceil((candidate.remainingUnits - scheduledUnits) / weeklyUnits) * 7)
			projectedPaymentDate = estimated.toISOString()
		}
	}

	const completedLessonIds = charges
		.filter((charge) => charge.packageId === candidate.studentPackage.id && !charge.voidedAt)
		.map((charge) => charge.lessonId)

	return {
		packageId: candidate.studentPackage.id,
		status: candidate.remainingUnits <= 0 ? 'exhausted' : candidate.studentPackage.status,
		totalUnits: candidate.studentPackage.purchasedLessonUnits,
		consumedUnits: candidate.consumedUnits,
		remainingUnits: candidate.remainingUnits,
		projectedPaymentDate,
		projectedPaymentLessonId,
		completedLessonIds,
	}
}

function nextPayment(
	student: Student,
	lessons: Lesson[],
	balance: Omit<StudentBalance, 'packageProgress' | 'nextPayment'>,
	progress: StudentBalance['packageProgress']
): StudentBalance['nextPayment'] {
	if (balance.overdue) {
		return {
			status: 'due_now',
			dueNow: true,
			amount: Math.abs(balance.balance),
			currency: balance.currency as Currency,
		}
	}

	if (student.billingMode === 'package') {
		const amount = packageTotal(student)
		if (student.packageLessonCount <= 0 || student.packageLessonsPerWeek <= 0) {
			return { status: 'not_configured', dueNow: false, amount: 0, currency: student.currency }
		}
		if (!progress || progress.remainingUnits <= 0) {
			return { status: 'due_now', dueNow: true, amount, currency: student.currency }
		}
		if (progress.projectedPaymentDate) {
			return {
				status: progress.projectedPaymentLessonId ? 'after_projected_lesson' : 'estimated_after',
				dueNow: false,
				projectedDate: progress.projectedPaymentDate,
				amount,
				currency: student.currency,
			}
		}
		return { status: 'not_scheduled', dueNow: false, amount, currency: student.currency }
	}

	const nextLesson = lessons
		.filter(
			(lesson) =>
				lesson.studentIds.includes(student.id) &&
				lesson.status === 'planned' &&
				new Date(lesson.startsAt).getTime() >= Date.now()
		)
		.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0]

	if (!nextLesson) return { status: 'not_scheduled', dueNow: false, amount: 0, currency: student.currency }

	return {
		status: 'after_next_lesson',
		dueNow: false,
		projectedDate: nextLesson.startsAt,
		amount: lessonPrice(student, nextLesson),
		currency: student.currency,
	}
}

function normalizeCurrencyBalance(balance: {
	studentId: string
	currency: string
	charged: number
	paid: number
	balance: number
	unpaidLessonCount: number
	overdue: boolean
}): StudentCurrencyBalance {
	return { ...balance, currency: balance.currency as Currency }
}

function balanceForStudents(
	students: Student[],
	lessons: Lesson[],
	payments: { studentId: string; amount: number; currency: Currency }[],
	charges: LessonCharge[],
	packages: StudentPackage[],
	now = new Date()
): StudentBalance[] {
	const ledgerBalances = calculateStudentBalances(
		charges.map((charge) => ({
			studentId: charge.studentId,
			amount: charge.amount,
			currency: charge.currency,
			billable: !charge.voidedAt,
		})),
		payments
	)
	const balanceKey = (studentId: string, currency: string) => `${studentId}:${currency}`
	const byStudentCurrency = new Map(
		ledgerBalances.map((balance) => [balanceKey(balance.studentId, balance.currency), balance])
	)

	return students.map((student) => {
		const base = byStudentCurrency.get(balanceKey(student.id, student.currency)) ?? {
			studentId: student.id,
			currency: student.currency,
			charged: 0,
			paid: 0,
			balance: 0,
			unpaidLessonCount: 0,
			overdue: false,
		}
		const normalizedBase = normalizeCurrencyBalance(base)
		const otherCurrencyBalances = ledgerBalances
			.filter((balance) => balance.studentId === student.id && balance.currency !== student.currency)
			.map(normalizeCurrencyBalance)
		const nextPaymentBalance =
			[normalizedBase, ...otherCurrencyBalances].find((balance) => balance.overdue) ?? normalizedBase
		const progress = packageProgress(student, lessons, packages, charges, now)
		return {
			...normalizedBase,
			packageProgress: progress,
			nextPayment: nextPayment(student, lessons, nextPaymentBalance, progress),
			otherCurrencyBalances,
		}
	})
}

export const billingService = {
	packageTotal,
	packageUnits,

	async createPackageForPayment(scope: StoreScope, student: StudentRow, paidAt: string) {
		const db = getDb()
		if (!db) return memoryStore.createPackageForPayment(scope, mapStudent(student), paidAt)

		const teacherId = await teacherProfileId(db, scope)
		return mapPackage(
			await insertStudentPackageRow(db, {
				teacherId,
				studentId: student.id,
				status: 'active',
				startsAt: dateOnly(paidAt),
				paidAt: dateOnly(paidAt),
				packageMonths: student.packageMonths,
				lessonsPerWeek: student.packageLessonsPerWeek,
				purchasedLessonCount: student.packageLessonCount,
				purchasedLessonUnits: packageUnits(student).toFixed(2),
				lessonPrice: packageLessonPrice(student).toFixed(2),
				totalPrice: packageTotal(student).toFixed(2),
				currency: student.currency,
				exhaustedAt: null,
			})
		)
	},

	async cancelPackage(scope: StoreScope, packageId: string) {
		const db = getDb()
		if (!db) return memoryStore.cancelPackage(scope, packageId)

		const teacherId = await teacherProfileId(db, scope)
		await clearLessonChargePackageRows(db, teacherId, packageId)
		return updateStudentPackageRow(db, teacherId, packageId, {
			status: 'cancelled',
			exhaustedAt: new Date(),
		})
	},

	async syncLessonChargesForLesson(scope: StoreScope, lessonId?: string) {
		const db = getDb()
		if (!db) return memoryStore.syncLessonChargesForLesson(scope, lessonId)

		const teacherId = await teacherProfileId(db, scope)
		const [attendance, students, lessons, packageRows, chargeRows] = await Promise.all([
			listAttendanceRows(db, teacherId),
			listStudentRows(db, teacherId, { status: 'all' }),
			listLessonRows(db, teacherId, { status: 'all' }),
			listStudentPackageRows(db, teacherId),
			listLessonChargeRows(db, teacherId),
		])
		const studentsById = new Map(students.map((student) => [student.id, student]))
		const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]))
		const packages = packageRows.map(mapPackage)
		const syncedCharges = chargeRows.map(mapCharge)
		const scopedAttendance = lessonId ? attendance.filter((record) => record.lessonId === lessonId) : attendance

		for (const record of scopedAttendance) {
			const student = studentsById.get(record.studentId)
			const lesson = lessonsById.get(record.lessonId)
			if (!student || !lesson) continue
			if (!isBillableAttendance(record)) {
				await voidLessonChargeRow(db, teacherId, record.id)
				continue
			}

			const existing = syncedCharges.find((charge) => charge.attendanceRecordId === record.id)
			const existingPackage = existing?.packageId
				? packages.find(
						(item) =>
							item.id === existing.packageId && item.status !== 'cancelled' && item.currency === student.currency
					)
				: undefined
			const studentPackage = existingPackage ?? findPackageForCharge(student, lesson, packages, syncedCharges)
			const charge = await upsertLessonChargeRow(db, {
				teacherId,
				attendanceRecordId: record.id,
				lessonId: record.lessonId,
				studentId: record.studentId,
				packageId: studentPackage?.id ?? null,
				amount: lessonPrice(student, lesson).toFixed(2),
				currency: student.currency,
				lessonUnits: getLessonDurationUnits(lesson.durationMinutes).toFixed(2),
				attendanceStatus: record.status,
				voidedAt: null,
			})
			const mappedCharge = mapCharge(charge)
			const existingIndex = syncedCharges.findIndex((item) => item.id === mappedCharge.id)
			if (existingIndex >= 0) syncedCharges[existingIndex] = mappedCharge
			else syncedCharges.push(mappedCharge)
		}
	},

	async listStudentBalances(scope: StoreScope): Promise<StudentBalance[]> {
		const db = getDb()
		if (!db) return memoryStore.listStudentBalances(scope)

		const teacherId = await teacherProfileId(db, scope)
		await billingService.syncLessonChargesForLesson(scope)
		const [students, lessons, payments, packages, charges] = await Promise.all([
			listStudentRows(db, teacherId, { status: 'all' }),
			listLessonRows(db, teacherId, { status: 'all' }),
			listPaymentRows(db, teacherId),
			listStudentPackageRows(db, teacherId),
			listLessonChargeRows(db, teacherId),
		])

		return balanceForStudents(
			students.map(mapStudent),
			lessons.map(mapLesson),
			payments.map((payment) => ({
				studentId: payment.studentId,
				amount: numeric(payment.amount),
				currency: payment.currency,
			})),
			charges.map(mapCharge),
			packages.map(mapPackage)
		)
	},
}
