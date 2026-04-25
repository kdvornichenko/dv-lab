import assert from 'node:assert/strict'

import { postgresConnectionOptions } from './connection-url'

assert.deepEqual(postgresConnectionOptions('postgres://user:pass@example.test:5432/db'), {
	connectionString: 'postgres://user:pass@example.test:5432/db',
})

assert.deepEqual(postgresConnectionOptions('postgres://user:pass@example.test:5432/db?sslmode=disable'), {
	connectionString: 'postgres://user:pass@example.test:5432/db',
	ssl: false,
})

assert.deepEqual(postgresConnectionOptions('postgres://user:pass@example.test:5432/db?sslmode=require'), {
	connectionString: 'postgres://user:pass@example.test:5432/db',
	ssl: { rejectUnauthorized: false },
})

assert.deepEqual(postgresConnectionOptions('postgres://user:pass@example.test:5432/db?sslmode=verify-full'), {
	connectionString: 'postgres://user:pass@example.test:5432/db?sslmode=verify-full',
	ssl: true,
})
