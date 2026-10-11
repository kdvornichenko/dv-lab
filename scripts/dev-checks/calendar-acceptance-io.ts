import { spawnSync } from 'node:child_process'
import {
	closeSync,
	constants,
	existsSync,
	fchmodSync,
	fstatSync,
	fsyncSync,
	lstatSync,
	openSync,
	readFileSync,
	realpathSync,
	writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

import { checkPages, REQUEST_TIMEOUT_MS } from './calendar-acceptance-pages.ts'
import {
	baselineRecord,
	contract,
	DAY8_SECONDS,
	day0Input,
	day8Input,
	day8Record,
	EvidenceError,
	fingerprint,
	ORIGIN,
	pagesInput,
	pagesRecord,
	requireEvidence,
	time,
	validateDay0,
	validateDay8,
	type Baseline,
} from './calendar-acceptance-records.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const TOOL_FILES = [
	'calendar-acceptance.mjs',
	'calendar-acceptance-io.ts',
	'calendar-acceptance-records.ts',
	'calendar-acceptance-pages.ts',
]
const BASELINE = 'calendar-day0.json'
const LIMITATION =
	'Records validated against declared observer/source fingerprints; observer authenticity and actual Google outcomes require independent external evidence. HTML checks cover server text/links, not browser visibility or runtime privacy implementation.'

function privateState(): string {
	const requested = process.env.STATE_DIR
	requireEvidence(requested !== undefined && isAbsolute(requested), 'existing_absolute_private_STATE_DIR_required')
	const stat = lstatSync(requested)
	requireEvidence(
		stat.isDirectory() && !stat.isSymbolicLink() && (stat.mode & 0o077) === 0 && stat.uid === process.getuid?.(),
		'private_STATE_DIR_required'
	)
	const state = realpathSync(requested)
	const within = relative(ROOT, state)
	requireEvidence(
		within === '..' || within.startsWith('../') || isAbsolute(within),
		'STATE_DIR_must_be_outside_repository'
	)
	const git = spawnSync('git', ['-C', state, 'rev-parse', '--show-toplevel'], { stdio: 'ignore' })
	requireEvidence(!git.error && git.status === 128, 'STATE_DIR_must_be_outside_Git')
	return state
}

function readPrivate(state: string, name: string): string {
	const descriptor = openSync(resolve(state, name), constants.O_RDONLY | constants.O_NOFOLLOW)
	try {
		const stat = fstatSync(descriptor)
		requireEvidence(
			stat.isFile() && stat.nlink === 1 && (stat.mode & 0o777) === 0o600 && stat.uid === process.getuid?.(),
			'evidence_file_must_be_private_regular_0600'
		)
		return readFileSync(descriptor, 'utf8')
	} finally {
		closeSync(descriptor)
	}
}

function parseRecord<Schema extends z.ZodType>(schema: Schema, text: string): z.output<Schema> {
	const value: unknown = JSON.parse(text)
	const parsed = schema.safeParse(value)
	requireEvidence(parsed.success, 'sanitized_record_missing_or_invalid_fields')
	return parsed.data
}

function writeNew(state: string, name: string, content: string) {
	const descriptor = openSync(
		resolve(state, name),
		constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
		0o600
	)
	try {
		fchmodSync(descriptor, 0o600)
		writeFileSync(descriptor, content, 'utf8')
		fsyncSync(descriptor)
	} finally {
		closeSync(descriptor)
	}
}

function serialize(value: z.infer<typeof pagesRecord> | Baseline | z.infer<typeof day8Record>) {
	return JSON.stringify(value, null, 2) + '\n'
}

function verifierFingerprint(): string {
	return fingerprint(
		TOOL_FILES.map(
			(path) => `${path}\0${fingerprint(readFileSync(resolve(ROOT, 'scripts/dev-checks', path), 'utf8'))}`
		).join('\n')
	)
}

async function pages(state: string, verifierSha256: string) {
	const input = parseRecord(pagesInput, readPrivate(state, 'calendar-pages-input.json'))
	const record = await checkPages(input, ROOT, verifierSha256)
	const content = serialize(record)
	const sha256 = fingerprint(content)
	writeNew(state, `calendar-pages-${sha256}.json`, content)
	return {
		evidenceSha256: sha256,
		checkedAt: record.checkedAt,
		pages: record.pages.length,
		deployedCommit: record.release.deployedCommit,
		sources: [record.source, record.release.source],
	}
}

function day0(state: string, verifierSha256: string) {
	requireEvidence(!existsSync(resolve(state, BASELINE)), 'immutable_day0_baseline_already_exists')
	const input = parseRecord(day0Input, readPrivate(state, 'calendar-day0-input.json'))
	const pageText = readPrivate(state, `calendar-pages-${input.pagesSha256}.json`)
	requireEvidence(fingerprint(pageText) === input.pagesSha256, 'pages_artifact_fingerprint_mismatch')
	const publicPages = parseRecord(pagesRecord, pageText)
	const recordedAt = new Date().toISOString()
	validateDay0(input, publicPages, recordedAt)
	const record = baselineRecord.parse({
		version: 1,
		kind: 'day0-baseline',
		recordedAt,
		earliestDay8: new Date(time(recordedAt) + DAY8_SECONDS * 1000).toISOString(),
		verifierSha256,
		observation: input,
		pages: publicPages,
	})
	const content = serialize(record)
	writeNew(state, BASELINE, content)
	return {
		evidenceSha256: fingerprint(content),
		recordedAt,
		earliestDay8: record.earliestDay8,
		deployedCommit: input.deployedCommit,
		sources: [
			input.source,
			input.production.source,
			input.branding.source,
			input.access.source,
			input.publicRead.source,
		],
	}
}

function day8(state: string, verifierSha256: string) {
	const baselineText = readPrivate(state, BASELINE)
	const baseline = parseRecord(baselineRecord, baselineText)
	const input = parseRecord(day8Input, readPrivate(state, 'calendar-day8-input.json'))
	const checkedAt = new Date().toISOString()
	validateDay8(input, baseline, fingerprint(baselineText), checkedAt)
	const elapsedSeconds = (time(checkedAt) - time(baseline.recordedAt)) / 1000
	const record = day8Record.parse({
		version: 1,
		kind: 'day8-validation',
		checkedAt,
		verifierSha256,
		elapsedSeconds,
		validation: 'RECORD_VALIDATED',
		externalProof: 'UNVERIFIED',
		observation: input,
	})
	const content = serialize(record)
	const sha256 = fingerprint(content)
	writeNew(state, `calendar-day8-${sha256}.json`, content)
	return {
		evidenceSha256: sha256,
		baselineSha256: input.baselineSha256,
		checkedAt,
		elapsedSeconds,
		deployedCommit: input.deployedCommit,
		sources: [
			input.source,
			input.continuity.source,
			input.refresh.source,
			input.refresh.priorAccess.source,
			input.publicRead.source,
		],
	}
}

function help() {
	return {
		usage: 'node scripts/dev-checks/calendar-acceptance.mjs pages|day0|day8|--help|--schema',
		environment: {
			APP_ORIGIN: ORIGIN,
			STATE_DIR: 'Existing approved absolute directory outside every Git checkout; private owner-only permissions',
		},
		inputs: { pages: 'calendar-pages-input.json', day0: 'calendar-day0-input.json', day8: 'calendar-day8-input.json' },
		outputs: { pages: 'calendar-pages-<sha256>.json', day0: BASELINE, day8: 'calendar-day8-<sha256>.json' },
		files:
			'Regular files owned by the current user, mode0600, no symlinks/hardlinks. Outputs use exclusive create; never overwritten or deleted.',
		pages:
			'Only pages makes network requests: anonymous GET of /welcome, /privacy, /terms, no redirects/cookies. Declared reviewed copy source hashes must match checkout before requests.',
		requestTimeoutMs: REQUEST_TIMEOUT_MS,
		timeoutReason:
			'Bound each public request and response body read to ten seconds; unavailable responses remain UNVERIFIED.',
		evidence:
			'Create inputs from actual sanitized observations. --schema prints strict source-owned contracts. No raw tokens, codes, OAuth states, email, calendarId or payload fields are accepted.',
		generations:
			'connectionGeneration identifies the stable consent/revocation epoch; credentialGeneration changes after each successful persisted refresh. Day8 allows intermediate refreshes.',
		ordering:
			'Production, Branding and pages precede accepted consent. Day8 refresh starts after baseline+691200 seconds and prior actual expiry, then committed CAS precedes providerReadAt. Continuity source covers the full baseline-to-read interval.',
		status:
			'Exit0 RECORD_VALIDATED is record consistency only. Missing/invalid/unavailable evidence returns exit2 UNVERIFIED. No test clock or synthetic evidence mode.',
		limitation: LIMITATION,
	}
}

export async function main(): Promise<void> {
	try {
		requireEvidence(process.argv.length === 3, 'one_command_required')
		const command = process.argv[2]
		if (command === '--help') {
			console.log(JSON.stringify(help(), null, 2))
			return
		}
		if (command === '--schema') {
			console.log(JSON.stringify(contract(), null, 2))
			return
		}
		requireEvidence(['pages', 'day0', 'day8'].includes(command), 'unknown_command')
		requireEvidence(process.env.APP_ORIGIN === ORIGIN, 'fixed_APP_ORIGIN_required')
		const state = privateState()
		const verifierSha256 = verifierFingerprint()
		const result =
			command === 'pages'
				? await pages(state, verifierSha256)
				: command === 'day0'
					? day0(state, verifierSha256)
					: day8(state, verifierSha256)
		console.log(
			JSON.stringify({
				status: 'RECORD_VALIDATED',
				externalProof: 'UNVERIFIED',
				verifierSha256,
				...result,
				limitation: LIMITATION,
			})
		)
	} catch (error) {
		console.log(
			JSON.stringify({
				status: 'UNVERIFIED',
				reason: error instanceof EvidenceError ? error.message : 'evidence_unavailable_or_malformed',
			})
		)
		process.exitCode = 2
	}
}
