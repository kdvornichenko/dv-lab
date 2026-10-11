import { createHash } from 'node:crypto'
import { readFileSync, realpathSync } from 'node:fs'
import { IncomingMessage, type ClientRequest } from 'node:http'
import https, { type RequestOptions } from 'node:https'
import { syncBuiltinESMExports } from 'node:module'
import { resolve } from 'node:path'
import { urlToHttpOptions } from 'node:url'
import { z } from 'zod'

import { createDb } from '@dv-lab/db'

import { loadConfig } from '../../apps/api/src/config.ts'
import { ROOT } from '../../scripts/dev-checks/paths.mjs'
import {
	calendarFaultIdentity,
	readCalendarFaultControl,
	recordCalendarFault,
	type CalendarFaultManifest,
	type CalendarFaultRule,
} from './calendar-fault-control.ts'
import { DATABASE_IDENTITY_SQL } from './target.ts'

type ResponseCallback = (response: IncomingMessage) => void
type RequestInput = string | URL | RequestOptions
const originalRequest = https.request
const used = new Set<string>()

async function verifyProcess() {
	const manifest = readCalendarFaultControl()
	const entry = realpathSync(resolve(process.argv[1] ?? ''))
	if (
		manifest.pid !== process.pid ||
		entry !== realpathSync(resolve(ROOT, 'apps/api/dist/server.mjs')) ||
		createHash('sha256').update(readFileSync(entry)).digest('hex') !== manifest.entrySha256
	)
		throw new Error('Calendar fault process attestation mismatch')
	const config = loadConfig(process.env)
	if (config.GIT_SHA !== manifest.apiBuildSha || config.APP_ORIGIN !== manifest.origin || !config.calendar.enabled)
		throw new Error('Calendar fault runtime identity mismatch')
	const { pool } = createDb(config.databaseUrl)
	try {
		const result = await pool.query<Record<string, unknown>>(DATABASE_IDENTITY_SQL)
		const identity = z
			.array(z.strictObject({ database: z.string(), address: z.string(), port: z.number(), oid: z.string() }))
			.length(1)
			.safeParse(result.rows)
		if (
			!identity.success ||
			createHash('sha256').update(JSON.stringify(identity.data[0])).digest('hex') !== manifest.persistenceFingerprint
		)
			throw new Error('Calendar fault persistence identity mismatch')
	} finally {
		await pool.end()
	}
	return manifest
}

function options(input: RequestInput, extra?: RequestOptions | ResponseCallback): RequestOptions {
	const base = typeof input === 'string' || input instanceof URL ? urlToHttpOptions(new URL(input)) : input
	return { ...base, ...(typeof extra === 'object' ? extra : {}) }
}

function match(rule: CalendarFaultRule, input: RequestOptions) {
	if (input.hostname !== 'www.googleapis.com' && input.hostname !== 'calendar.googleapis.com') return false
	if ((input.method ?? 'GET').toUpperCase() !== rule.method) return false
	const path = new URL(input.path ?? '/', 'https://www.googleapis.com')
	const patterns = {
		events: /^\/calendar\/v3\/calendars\/[^/]+\/events$/,
		event: /^\/calendar\/v3\/calendars\/[^/]+\/events\/[^/]+$/,
		calendarList: /^\/calendar\/v3\/users\/me\/calendarList$/,
	}
	if (!patterns[rule.resource].test(path.pathname)) return false
	return rule.page === 'any' || path.searchParams.has('pageToken') === (rule.page === 'next')
}

function stop(manifest: CalendarFaultManifest, rule: CalendarFaultRule, status: number | null = null): never {
	recordCalendarFault(manifest, rule, 'process_stopping', status)
	process.exit(86)
}

function interceptResponse(request: ClientRequest, manifest: CalendarFaultManifest, rule: CalendarFaultRule) {
	const emit = request.emit
	request.emit = function (event: string | symbol, ...args: unknown[]): boolean {
		if (event !== 'response' || !(args[0] instanceof IncomingMessage)) return emit.call(this, event, ...args)
		const response = args[0]
		const status = response.statusCode ?? null
		if (rule.action === 'stop_after_response') stop(manifest, rule, status)
		if (rule.action === 'drop_response') {
			recordCalendarFault(manifest, rule, 'response_dropped', status)
			response.destroy()
			request.destroy(new Error('Calendar transport response dropped by owned fault control'))
			return true
		}
		response.pause()
		recordCalendarFault(manifest, rule, 'response_held', status)
		const timer = setTimeout(() => {
			if (request.destroyed) return
			recordCalendarFault(manifest, rule, 'response_released', status)
			emit.call(request, event, response)
			response.resume()
		}, rule.delayMs)
		request.once('close', () => clearTimeout(timer))
		return true
	}
}

function install(manifest: CalendarFaultManifest) {
	const identity = calendarFaultIdentity(manifest)
	function request(
		input: RequestInput,
		extra?: RequestOptions | ResponseCallback,
		callback?: ResponseCallback
	): ClientRequest {
		const requestOptions = options(input, extra)
		const current = readCalendarFaultControl()
		if (calendarFaultIdentity(current) !== identity) throw new Error('Calendar fault process ownership changed')
		const rule = current.rule
		const matches = rule !== null && match(rule, requestOptions)
		if (matches) recordCalendarFault(current, rule, 'request_matched')
		const armed = matches && !used.has(rule.id)
		if (armed) used.add(rule.id)
		if (armed && rule.action === 'stop_before_request') stop(current, rule)
		const result = originalRequest(requestOptions, typeof extra === 'function' ? extra : callback)
		if (armed) interceptResponse(result, current, rule)
		return result
	}
	https.request = request
	syncBuiltinESMExports()
}

if (process.env.E2E_CALENDAR_FAULTS) install(await verifyProcess())
