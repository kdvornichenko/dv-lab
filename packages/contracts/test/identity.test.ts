import { describe, expect, test } from 'vitest'

import {
	isStudentLogin,
	isTeacherLogin,
	normalizeDisplayName,
	normalizeLogin,
	passwordLength,
} from '../src/identity.ts'
import { SESSION_COOKIE, SESSION_TOKEN_PATTERN } from '../src/session.ts'

describe('normalizeLogin', () => {
	test('trims surrounding whitespace and lowercases', () => {
		expect(normalizeLogin('  Anna.K@Example.COM \t')).toBe('anna.k@example.com')
	})
})

describe('normalizeDisplayName', () => {
	test('trims and collapses whitespace runs into one space', () => {
		expect(normalizeDisplayName('  Anna \t  Karenina\n')).toBe('Anna Karenina')
	})
})

describe('isStudentLogin', () => {
	test('accepts letters, digits, dot, underscore and hyphen', () => {
		expect(isStudentLogin('anna.k_1-x')).toBe(true)
	})

	test('accepts the shortest and the longest allowed length', () => {
		expect(isStudentLogin('abc')).toBe(true)
		expect(isStudentLogin('a'.repeat(32))).toBe(true)
	})

	test('rejects a login shorter than three characters', () => {
		expect(isStudentLogin('ab')).toBe(false)
	})

	test('rejects a login longer than 32 characters', () => {
		expect(isStudentLogin('a'.repeat(33))).toBe(false)
	})

	test('rejects uppercase letters', () => {
		expect(isStudentLogin('Anna')).toBe(false)
	})

	test('rejects whitespace inside the login', () => {
		expect(isStudentLogin('an na')).toBe(false)
	})
})

describe('isTeacherLogin', () => {
	test('accepts an address with exactly one at sign', () => {
		expect(isTeacherLogin('t@x.y')).toBe(true)
	})

	test('rejects two at signs', () => {
		expect(isTeacherLogin('a@b@c')).toBe(false)
	})

	test('rejects an empty local part', () => {
		expect(isTeacherLogin('@x')).toBe(false)
	})

	test('rejects an empty domain', () => {
		expect(isTeacherLogin('x@')).toBe(false)
	})

	test('rejects whitespace', () => {
		expect(isTeacherLogin('a b@c')).toBe(false)
	})

	test('rejects an address longer than 254 characters', () => {
		expect(isTeacherLogin(`${'a'.repeat(250)}@x.yz`)).toBe(false)
	})
})

describe('passwordLength', () => {
	test('counts code points, not UTF-16 units', () => {
		expect(passwordLength('😀'.repeat(10))).toBe(10)
	})

	test('counts ASCII characters one by one', () => {
		expect(passwordLength('abcdef')).toBe(6)
	})
})

describe('session contract', () => {
	test('cookie name carries the host prefix', () => {
		expect(SESSION_COOKIE).toBe('__Host-dvlab_session')
	})

	test('token pattern accepts 43 base64url characters', () => {
		expect(SESSION_TOKEN_PATTERN.test('A'.repeat(43))).toBe(true)
		expect(SESSION_TOKEN_PATTERN.test('a-_Z0'.repeat(8) + 'abc')).toBe(true)
	})

	test('token pattern rejects 42 and 44 characters', () => {
		expect(SESSION_TOKEN_PATTERN.test('A'.repeat(42))).toBe(false)
		expect(SESSION_TOKEN_PATTERN.test('A'.repeat(44))).toBe(false)
	})

	test('token pattern rejects a plus sign', () => {
		expect(SESSION_TOKEN_PATTERN.test(`${'A'.repeat(42)}+`)).toBe(false)
	})
})
