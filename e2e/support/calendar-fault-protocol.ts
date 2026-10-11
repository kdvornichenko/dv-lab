import { createHash, randomUUID } from 'node:crypto'
import {
	closeSync,
	constants,
	fstatSync,
	openSync,
	readFileSync,
	realpathSync,
	renameSync,
	statSync,
	writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { z } from 'zod'

export const FAULT_SCOPE = 'prelaunch-main-synthetic-fixtures-test-google-primary'
const digest = z.string().regex(/^[a-f0-9]{64}$/)
export const faultRule = z
	.strictObject({
		id: z.uuid(),
		method: z.enum(['GET', 'POST', 'PATCH']),
		resource: z.enum(['events', 'event', 'calendarList']),
		page: z.enum(['first', 'next', 'any']),
		action: z.enum(['drop_response', 'delay_response', 'stop_before_request', 'stop_after_response']),
		delayMs: z.number().int().min(0).max(15000),
		pageSize: z.number().int().min(1).max(100).optional(),
	})
	.refine((rule) => rule.pageSize === undefined || (rule.method === 'GET' && rule.resource === 'events'))
export const faultManifest = z.strictObject({
	schema: z.literal('dv-lab-calendar-fault-v1'),
	runId: z.uuid(),
	pid: z.number().int().positive(),
	processStartTicks: z.string().regex(/^\d+$/),
	apiBuildSha: z.string().regex(/^[a-f0-9]{40}$/),
	entrySha256: digest,
	loaderSha256: digest,
	origin: z.literal('https://dv-lab.dev'),
	persistenceFingerprint: digest,
	authorizationScope: z.literal(FAULT_SCOPE),
	accountId: z.uuid(),
	connectionId: z.uuid(),
	connectionGeneration: z.number().int().nonnegative().safe(),
	primaryCalendarId: z
		.string()
		.min(1)
		.max(1024)
		.refine((value) => value !== 'primary'),
	calendarFaultsAuthorized: z.literal(true),
	exclusiveSyntheticProcess: z.literal(true),
	runtimeRoot: z.string().min(1),
	expiresAt: z.iso.datetime(),
	rule: faultRule.nullable(),
})
export const faultObservation = z.strictObject({
	runId: z.uuid(),
	ruleId: z.uuid(),
	identitySha256: digest,
	at: z.iso.datetime(),
	phase: z.enum(['request_matched', 'response_held', 'response_released', 'response_dropped', 'process_stopping']),
	status: z.number().int().min(100).max(599).nullable(),
})
export const faultClient = z.strictObject({
	schema: z.literal('dv-lab-calendar-fault-ssh-v1'),
	runId: z.uuid(),
	identitySha256: digest,
	controlFile: z.string().regex(/^\/[A-Za-z0-9_./-]+$/),
	operatorSha256: digest,
})
export const faultOperation = z.discriminatedUnion('action', [
	z.strictObject({ action: z.literal('arm'), rule: faultRule }),
	z.strictObject({ action: z.literal('disarm'), ruleId: z.uuid() }),
	z.strictObject({ action: z.literal('evidence'), ruleId: z.uuid() }),
	z.strictObject({ action: z.literal('inspect') }),
])
export const faultRequest = z.strictObject({
	runId: z.uuid(),
	identitySha256: digest,
	binding: z.strictObject({
		origin: z.literal('https://dv-lab.dev'),
		apiBuildSha: z.string().regex(/^[a-f0-9]{40}$/),
		persistenceFingerprint: digest,
		authorizationScope: z.literal(FAULT_SCOPE),
	}),
	operation: faultOperation,
})
export type CalendarFaultRule = z.infer<typeof faultRule>
export type CalendarFaultManifest = z.infer<typeof faultManifest>
export type CalendarFaultObservation = z.infer<typeof faultObservation>
export type CalendarFaultOperation = z.infer<typeof faultOperation>

export function hash(value: string | Buffer): string {
	return createHash('sha256').update(value).digest('hex')
}

export function calendarFaultIdentity(manifest: CalendarFaultManifest): string {
	const { rule: _rule, ...identity } = manifest
	return hash(JSON.stringify(identity))
}

export function privatePath(file: string, root: string): string {
	if (!isAbsolute(file) || resolve(file) !== file || realpathSync(file) !== file)
		throw new Error('Invalid private path')
	const workspace = realpathSync(root)
	const within = relative(workspace, file)
	if (within === '' || (!isAbsolute(within) && within !== '..' && !within.startsWith('../')))
		throw new Error('Private file is inside the workspace')
	return file
}

export function readFaultJson(file: string, root: string): unknown {
	const path = privatePath(file, root)
	const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
	try {
		const stat = fstatSync(fd)
		if (!stat.isFile() || (stat.mode & 0o777) !== 0o600 || stat.size > 65536 || stat.uid !== process.getuid?.())
			throw new Error('Invalid private file permissions or size')
		const value: unknown = JSON.parse(readFileSync(fd, 'utf8'))
		return value
	} finally {
		closeSync(fd)
	}
}

export function readRuntimeControl(requireLiveLease = true): CalendarFaultManifest {
	const file = process.env.E2E_CALENDAR_FAULTS
	if (!file) throw new Error('Missing private fault control')
	const manifest = faultManifest.parse(readFaultJson(file, process.cwd()))
	const directory = statSync(dirname(file))
	if (!directory.isDirectory() || (directory.mode & 0o777) !== 0o700 || directory.uid !== process.getuid?.())
		throw new Error('Invalid private control directory')
	if (realpathSync(manifest.runtimeRoot) !== realpathSync(process.cwd())) throw new Error('Invalid runtime root')
	if (requireLiveLease && Date.parse(manifest.expiresAt) <= Date.now()) throw new Error('Calendar fault lease expired')
	return manifest
}

export function writeRuntimeControl(manifest: CalendarFaultManifest): void {
	const file = process.env.E2E_CALENDAR_FAULTS
	if (!file) throw new Error('Missing private fault control')
	const path = privatePath(file, manifest.runtimeRoot)
	const directory = statSync(dirname(path))
	if (!directory.isDirectory() || (directory.mode & 0o777) !== 0o700) throw new Error('Invalid private directory')
	const temporary = `${path}.${randomUUID()}.pending`
	writeFileSync(temporary, JSON.stringify(faultManifest.parse(manifest)), { mode: 0o600, flag: 'wx' })
	renameSync(temporary, path)
}

export function recordCalendarFault(
	manifest: CalendarFaultManifest,
	rule: CalendarFaultRule,
	phase: CalendarFaultObservation['phase'],
	status: number | null = null
): void {
	const file = process.env.E2E_CALENDAR_FAULTS
	if (!file) throw new Error('Missing private fault control')
	privatePath(file, manifest.runtimeRoot)
	const directory = statSync(dirname(file))
	if (!directory.isDirectory() || (directory.mode & 0o777) !== 0o700) throw new Error('Invalid private directory')
	const observation = faultObservation.parse({
		runId: manifest.runId,
		ruleId: rule.id,
		identitySha256: calendarFaultIdentity(manifest),
		at: new Date().toISOString(),
		phase,
		status,
	})
	writeFileSync(resolve(dirname(file), `calendar-fault-${rule.id}-${randomUUID()}.json`), JSON.stringify(observation), {
		mode: 0o600,
		flag: 'wx',
	})
}
