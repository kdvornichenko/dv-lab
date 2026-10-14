import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { CalendarFault, GoogleWriteFault } from '../src/calendar/gateway.ts'
import { syncFault } from '../src/calendar/sync-fault.ts'

const SECRET = 'Lesson with Secret Student token=abc'
const idle = { stopped: new AbortController().signal, pass: new AbortController().signal }

function databaseError() {
	const cause = Object.assign(new Error(SECRET), {
		code: '23514',
		constraint: 'google_calendar_events_range_ck',
		detail: SECRET,
	})
	return new Error(`Failed query: ${SECRET}`, { cause })
}

describe('syncFault', () => {
	it('keeps the error class, codes and abort state without the message', () => {
		const zod = z.object({ id: z.string() }).safeParse({ id: SECRET.length })
		const cases = [
			new CalendarFault('invalid_provider_data'),
			new GoogleWriteFault(403, null, true),
			zod.success ? new Error(SECRET) : zod.error,
			databaseError(),
			new Error(SECRET),
			SECRET,
		]
		for (const error of cases) expect(JSON.stringify(syncFault(error, idle))).not.toContain('Secret')

		expect(syncFault(new GoogleWriteFault(403, null, true), idle)).toEqual({
			errorName: 'CalendarFault',
			code: 'provider_unavailable',
			httpStatus: 403,
			rateLimited: true,
			aborted: null,
		})
		expect(syncFault(databaseError(), idle)).toEqual({
			errorName: 'Error',
			causeName: 'Error',
			code: '23514',
			constraint: 'google_calendar_events_range_ck',
			aborted: null,
		})
		expect(syncFault(SECRET, idle)).toEqual({ errorName: 'string', aborted: null })
	})

	it('tells the pass budget from a stop', () => {
		const stop = new AbortController()
		const pass = AbortSignal.any([stop.signal, AbortSignal.abort()])
		expect(syncFault(new Error(SECRET), { stopped: stop.signal, pass }).aborted).toBe('timeout')
		stop.abort()
		expect(syncFault(new Error(SECRET), { stopped: stop.signal, pass }).aborted).toBe('stop')
	})
})
