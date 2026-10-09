import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import type { ScryptOptions } from 'node:crypto'

const SCRYPT_PROFILE = Object.freeze({ N: 2 ** 15, r: 8, p: 3 })
const SCRYPT_KEY_BYTES = 32
const SCRYPT_SALT_BYTES = 16
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024
const HASH_PATTERN = /^scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{43})$/

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		scrypt(password.normalize('NFKC'), salt, SCRYPT_KEY_BYTES, options, (error, key) => {
			if (error) reject(error)
			else resolve(key)
		})
	})
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(SCRYPT_SALT_BYTES)
	const { N, r, p } = SCRYPT_PROFILE
	const key = await derive(password, salt, { N, r, p, maxmem: SCRYPT_MAX_MEMORY })
	return `scrypt$N=${N},r=${r},p=${p}$${salt.toString('base64url')}$${key.toString('base64url')}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	const match = HASH_PATTERN.exec(storedHash)
	if (!match) return false
	const [N, r, p] = [Number(match[1]), Number(match[2]), Number(match[3])]
	const sane = N >= 2 ** 14 && (N & (N - 1)) === 0 && r >= 8 && p >= 1 && p <= 16 && 128 * N * r < SCRYPT_MAX_MEMORY
	if (!sane) return false
	const salt = Buffer.from(match[4] ?? '', 'base64url')
	const expected = Buffer.from(match[5] ?? '', 'base64url')
	const actual = await derive(password, salt, { N, r, p, maxmem: SCRYPT_MAX_MEMORY })
	return timingSafeEqual(actual, expected)
}
