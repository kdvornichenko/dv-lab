import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const envFile = fileURLToPath(new URL('../../.env.test', import.meta.url))

if (existsSync(envFile)) process.loadEnvFile(envFile)

export default defineConfig({
	test: {
		include: ['test/**/*.test.ts'],
		testTimeout: 15000,
		fileParallelism: false,
		globalSetup: 'test/global-setup.ts',
	},
})
