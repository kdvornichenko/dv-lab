import { test as cleanup, type APIRequestContext } from '@playwright/test'

import { existsSync } from 'node:fs'

import { api, teacherId } from './support/api.ts'
import {
	AUTH_FILE,
	BASE,
	cleanupFixtures,
	restoreTeacherSettings,
	scrubAuth,
	settingsRecoveryState,
} from './support/data.ts'

async function attempt(failures: Error[], operation: string, run: () => void | Promise<void>): Promise<void> {
	try {
		await run()
	} catch {
		failures.push(new Error(`E2E cleanup operation failed: ${operation}`))
	}
}

cleanup('owned fixtures and teacher settings are restored', async ({ playwright }) => {
	const failures: Error[] = []
	let fixtures = 0
	let request: APIRequestContext | null = null
	try {
		await attempt(failures, 'fixtures', () => {
			fixtures = cleanupFixtures()
		})
	} finally {
		try {
			await attempt(failures, 'auth context', async () => {
				request = await playwright.request.newContext({
					baseURL: BASE,
					storageState: existsSync(AUTH_FILE) ? AUTH_FILE : undefined,
				})
			})
			await attempt(failures, 'settings restore', async () => {
				const recovery = settingsRecoveryState()
				if (recovery === 'pending') {
					if (!request) throw new Error('Authentication context is unavailable')
					restoreTeacherSettings(await teacherId(request))
				} else if (recovery !== 'restored') throw new Error('Settings snapshot is missing')
			})
		} finally {
			try {
				await attempt(failures, 'sign-out', async () => {
					if (!request) throw new Error('Authentication context is unavailable')
					await api(request, 'POST', '/auth/sign-out')
				})
			} finally {
				try {
					await attempt(failures, 'auth scrub', scrubAuth)
				} finally {
					await attempt(failures, 'request dispose', async () => {
						if (request) await request.dispose()
					})
				}
			}
		}
	}
	if (failures.length > 0) throw new AggregateError(failures, 'E2E cleanup failed; operation names only')
	console.log(`E2E_CLEANUP_OK fixtures=${fixtures} settings=restored`)
})
