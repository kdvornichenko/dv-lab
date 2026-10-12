import { writeFileSync } from 'node:fs'
import { IncomingMessage, type ClientRequest } from 'node:http'
import https, { type RequestOptions } from 'node:https'
import { syncBuiltinESMExports } from 'node:module'
import { dirname, resolve } from 'node:path'
import { urlToHttpOptions } from 'node:url'

import { verifyCalendarFaultRuntime } from '../../apps/api/src/tools/calendar-fault-runtime.ts'
import { calendarFaultAuth } from './calendar-fault-auth.ts'
import {
	calendarFaultIdentity,
	readRuntimeControl,
	recordCalendarFault,
	type CalendarFaultManifest,
	type CalendarFaultRule,
} from './calendar-fault-protocol.ts'

type ResponseCallback = (response: IncomingMessage) => void
type RequestInput = string | URL | RequestOptions
const originalRequest = https.request
const used = new Set<string>()

function options(input: RequestInput, extra?: RequestOptions | ResponseCallback): RequestOptions {
	const base = typeof input === 'string' || input instanceof URL ? urlToHttpOptions(new URL(input)) : input
	return { ...base, ...(typeof extra === 'object' ? extra : {}) }
}

function calendarPath(manifest: CalendarFaultManifest, input: RequestOptions): URL | null {
	if (input.hostname !== 'www.googleapis.com' && input.hostname !== 'calendar.googleapis.com') return null
	const path = new URL(input.path ?? '/', 'https://www.googleapis.com')
	const calendar = /^\/calendar\/v3\/calendars\/([^/]+)\/events(?:\/[^/]+)?$/.exec(path.pathname)
	if (calendar && decodeURIComponent(calendar[1]) === manifest.primaryCalendarId) return path
	return path.pathname === '/calendar/v3/users/me/calendarList' ? path : null
}

function match(rule: CalendarFaultRule, input: RequestOptions) {
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

function install(manifest: CalendarFaultManifest, refreshSha256: string) {
	const identity = calendarFaultIdentity(manifest)
	const auth = calendarFaultAuth(refreshSha256)
	function request(
		input: RequestInput,
		extra?: RequestOptions | ResponseCallback,
		callback?: ResponseCallback
	): ClientRequest {
		const requestOptions = options(input, extra)
		const path = calendarPath(manifest, requestOptions)
		if (!path || !auth.matches(requestOptions)) {
			const result = originalRequest(requestOptions, typeof extra === 'function' ? extra : callback)
			auth.observe(requestOptions, result)
			return result
		}
		const current = readRuntimeControl(false)
		if (calendarFaultIdentity(current) !== identity) throw new Error('Calendar fault process ownership changed')
		if (Date.parse(current.expiresAt) <= Date.now())
			return originalRequest(requestOptions, typeof extra === 'function' ? extra : callback)
		if (
			current.rule?.pageSize !== undefined &&
			(requestOptions.method ?? 'GET').toUpperCase() === 'GET' &&
			/\/events$/.test(path.pathname)
		) {
			path.searchParams.set('maxResults', String(current.rule.pageSize))
			requestOptions.path = `${path.pathname}${path.search}`
		}
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

if (process.env.E2E_CALENDAR_FAULTS) {
	const manifest = readRuntimeControl()
	const refreshSha256 = await verifyCalendarFaultRuntime(manifest)
	install(manifest, refreshSha256)
	writeFileSync(
		resolve(dirname(process.env.E2E_CALENDAR_FAULTS), `calendar-fault-ready-${manifest.runId}.json`),
		JSON.stringify({ runId: manifest.runId, identitySha256: calendarFaultIdentity(manifest) }),
		{ mode: 0o600, flag: 'wx' }
	)
}
