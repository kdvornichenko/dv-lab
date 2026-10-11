import { ENV_TEST, ROOT, quote as quoteIO, sql as sqlIO } from './api.mjs'

export { ENV_TEST, ROOT }

export type SqlProbe = {
	error?: { code?: unknown; constraint?: unknown } | null
}

export type MigrationOutput = { migrations?: unknown }

export const quote = quoteIO as unknown as (value: string) => string
export const sql = sqlIO as unknown as (text: string) => { rows: Record<string, unknown>[] }
