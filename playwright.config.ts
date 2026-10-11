import { defineConfig } from '@playwright/test'

import { existsSync } from 'node:fs'

import { AUTH_FILE, BASE, prepareState, RESULTS_DIR } from './e2e/support/data.ts'

prepareState()
if (existsSync(RESULTS_DIR)) throw new Error('E2E output directory must be new for this run')

export default defineConfig({
	globalSetup: './e2e/support/calendar.ts',
	testDir: './e2e',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 90000,
	expect: { timeout: 10000 },
	reporter: 'list',
	outputDir: RESULTS_DIR,
	use: {
		baseURL: BASE,
		trace: 'off',
		video: 'off',
		screenshot: 'only-on-failure',
		navigationTimeout: 60000,
		viewport: { width: 1280, height: 800 },
		timezoneId: 'Asia/Ho_Chi_Minh',
	},
	projects: [
		{ name: 'setup', testMatch: 'auth.setup.ts', teardown: 'cleanup' },
		{ name: 'cleanup', testMatch: 'cleanup.teardown.ts' },
		{
			name: 'light',
			testMatch: '*.spec.ts',
			dependencies: ['setup'],
			use: { colorScheme: 'light', storageState: AUTH_FILE },
		},
		{
			name: 'dark',
			testMatch: '*.spec.ts',
			dependencies: ['setup'],
			use: { colorScheme: 'dark', storageState: AUTH_FILE },
		},
	],
})
