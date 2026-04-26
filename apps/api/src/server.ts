import { serve } from '@hono/node-server'

import { app } from './app'
import { serverEnv } from './config/env'

const server = serve({
	fetch: app.fetch,
	port: serverEnv.PORT,
})

console.log(`Teacher CRM API listening on http://localhost:${serverEnv.PORT}`)

process.on('SIGINT', () => {
	server.close()
	process.exit(0)
})

process.on('SIGTERM', () => {
	server.close((error) => {
		if (error) {
			console.error(error)
			process.exit(1)
		}
		process.exit(0)
	})
})
