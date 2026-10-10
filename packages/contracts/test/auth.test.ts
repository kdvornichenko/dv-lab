import { describe, expect, test } from 'vitest'

import { changePasswordRequest, createStudentRequest, errorCodes, signInRequest } from '../src/auth.ts'

describe('signInRequest', () => {
	test('trims and lowercases the login', () => {
		const parsed = signInRequest.parse({ login: '  Anna.K@Example.COM ', password: 'secret' })
		expect(parsed.login).toBe('anna.k@example.com')
	})

	test('keeps the password untouched', () => {
		const parsed = signInRequest.parse({ login: 'anna', password: '  spaced  ' })
		expect(parsed.password).toBe('  spaced  ')
	})

	test('rejects an empty login', () => {
		expect(signInRequest.safeParse({ login: '   ', password: 'secret' }).success).toBe(false)
	})

	test('rejects a login longer than 254 characters', () => {
		expect(signInRequest.safeParse({ login: 'a'.repeat(255), password: 'secret' }).success).toBe(false)
	})

	test('rejects an empty password', () => {
		expect(signInRequest.safeParse({ login: 'anna', password: '' }).success).toBe(false)
	})

	test('rejects a password longer than 1024 characters', () => {
		expect(signInRequest.safeParse({ login: 'anna', password: 'a'.repeat(1025) }).success).toBe(false)
	})

	test('accepts a password of exactly 1024 characters', () => {
		expect(signInRequest.safeParse({ login: 'anna', password: 'a'.repeat(1024) }).success).toBe(true)
	})
})

describe('createStudentRequest', () => {
	test('normalizes the login and the display name', () => {
		const parsed = createStudentRequest.parse({ login: '  Anna.K ', displayName: '  Anna   Karenina ' })
		expect(parsed.login).toBe('anna.k')
		expect(parsed.displayName).toBe('Anna Karenina')
	})

	test('turns a missing password into null', () => {
		expect(createStudentRequest.parse({ login: 'anna', displayName: 'Anna' }).password).toBeNull()
	})

	test('turns an empty password into null', () => {
		expect(createStudentRequest.parse({ login: 'anna', displayName: 'Anna', password: '' }).password).toBeNull()
	})

	test('keeps a manual password as typed', () => {
		const parsed = createStudentRequest.parse({ login: 'anna', displayName: 'Anna', password: 'correct horse' })
		expect(parsed.password).toBe('correct horse')
	})

	test('rejects a login with a space after normalization', () => {
		expect(createStudentRequest.safeParse({ login: 'Anna K', displayName: 'Anna' }).success).toBe(false)
	})

	test('rejects a login shorter than three characters', () => {
		expect(createStudentRequest.safeParse({ login: 'ab', displayName: 'Anna' }).success).toBe(false)
	})

	test('rejects a display name made of whitespace only', () => {
		expect(createStudentRequest.safeParse({ login: 'anna', displayName: '   ' }).success).toBe(false)
	})

	test('rejects a display name longer than 80 characters', () => {
		expect(createStudentRequest.safeParse({ login: 'anna', displayName: 'a'.repeat(81) }).success).toBe(false)
	})

	test('accepts a display name of exactly 80 characters', () => {
		expect(createStudentRequest.safeParse({ login: 'anna', displayName: 'a'.repeat(80) }).success).toBe(true)
	})

	test('rejects a manual password shorter than 10 code points', () => {
		expect(
			createStudentRequest.safeParse({ login: 'anna', displayName: 'Anna', password: 'a'.repeat(9) }).success
		).toBe(false)
	})

	test('accepts a manual password of exactly 10 code points', () => {
		expect(
			createStudentRequest.safeParse({ login: 'anna', displayName: 'Anna', password: 'a'.repeat(10) }).success
		).toBe(true)
	})

	test('accepts a manual password of exactly 128 code points', () => {
		expect(
			createStudentRequest.safeParse({ login: 'anna', displayName: 'Anna', password: 'a'.repeat(128) }).success
		).toBe(true)
	})

	test('rejects a manual password longer than 128 code points', () => {
		expect(
			createStudentRequest.safeParse({ login: 'anna', displayName: 'Anna', password: 'a'.repeat(129) }).success
		).toBe(false)
	})

	test('counts a manual password in code points, not UTF-16 units', () => {
		expect(
			createStudentRequest.safeParse({ login: 'anna', displayName: 'Anna', password: '😀'.repeat(10) }).success
		).toBe(true)
	})
})

describe('changePasswordRequest', () => {
	test('accepts a current password and a new password of 10 code points', () => {
		expect(
			changePasswordRequest.safeParse({ currentPassword: 'old secret', newPassword: 'n'.repeat(10) }).success
		).toBe(true)
	})

	test('rejects an empty current password', () => {
		expect(changePasswordRequest.safeParse({ currentPassword: '', newPassword: 'n'.repeat(10) }).success).toBe(false)
	})

	test('rejects a current password longer than 1024 characters', () => {
		expect(
			changePasswordRequest.safeParse({ currentPassword: 'a'.repeat(1025), newPassword: 'n'.repeat(10) }).success
		).toBe(false)
	})

	test('rejects a new password shorter than 10 code points', () => {
		expect(changePasswordRequest.safeParse({ currentPassword: 'old', newPassword: 'n'.repeat(9) }).success).toBe(false)
	})

	test('rejects a new password longer than 128 code points', () => {
		expect(changePasswordRequest.safeParse({ currentPassword: 'old', newPassword: 'n'.repeat(129) }).success).toBe(
			false
		)
	})

	test('accepts a new password of exactly 128 code points', () => {
		expect(changePasswordRequest.safeParse({ currentPassword: 'old', newPassword: 'n'.repeat(128) }).success).toBe(true)
	})
})

describe('errorCodes', () => {
	test('lists every code the api answers with', () => {
		expect([...errorCodes]).toEqual([
			'invalid_request',
			'unauthenticated',
			'invalid_credentials',
			'forbidden',
			'forbidden_origin',
			'not_found',
			'login_taken',
			'wrong_current_password',
			'password_unchanged',
			'card_has_account',
			'account_already_linked',
			'term_exists',
			'payment_already_assigned',
			'lesson_changed',
			'series_ends_before_new_day',
			'lesson_in_past',
			'target_in_past',
			'series_today_passed',
			'locked',
			'busy',
			'unavailable',
			'internal_error',
		])
	})
})
