import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	dialect: 'postgresql',
	schema: [
		'./src/schema.ts',
		'./src/calendar-schema.ts',
		'./src/calendar-read-schema.ts',
		'./src/calendar-sync-schema.ts',
		'./src/chat-schema.ts',
	],
	out: './drizzle',
})
