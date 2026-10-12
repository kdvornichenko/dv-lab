import { createHash } from 'node:crypto'
import { z } from 'zod'

export const ORIGIN = 'https://dv-lab.dev'
export const DAY8_SECONDS = 8 * 24 * 60 * 60
export const PAGE_PATHS = ['/welcome', '/privacy', '/terms'] as const
export const sha256 = z.string().regex(/^[a-f0-9]{64}$/)
const commit = z.string().regex(/^[a-f0-9]{40}$/)
const utc = z.iso.datetime({ precision: 3 })
const generation = z.number().int().nonnegative()
const version = z.literal(1)
const origin = z.literal(ORIGIN)

const source = z.strictObject({
	kind: z.enum(['operator-release', 'google-auth-platform', 'application-runtime', 'public-http']),
	observerSha256: sha256,
	observerCodeSha256: sha256,
	artifactSha256: sha256,
	capturedAt: utc,
	clock: z.literal('system-utc'),
})
const runtimeSource = source.extend({ kind: z.literal('application-runtime') })
const consoleSource = source.extend({ kind: z.literal('google-auth-platform') })
const release = z.strictObject({
	deployedCommit: commit,
	privacyImplementationReviewed: z.literal(true),
	source: source.extend({ kind: z.literal('operator-release') }),
})
const copySources = z.strictObject({ welcome: sha256, privacy: sha256, terms: sha256 })
const identity = z.strictObject({
	connectionSha256: sha256,
	grantSha256: sha256,
	connectionGeneration: generation,
})
const production = z.strictObject({ status: z.literal('In production'), source: consoleSource })
const branding = z.strictObject({
	homepage: z.literal(`${ORIGIN}/welcome`),
	privacy: z.literal(`${ORIGIN}/privacy`),
	terms: z.literal(`${ORIGIN}/terms`),
	source: consoleSource,
})
const publicRead = z.strictObject({
	surface: z.literal('public-schedule-week'),
	deployedCommit: commit,
	identity,
	credentialGeneration: generation,
	requestedAt: utc,
	providerReadAt: utc,
	completedAt: utc,
	fresh: z.literal(true),
	coverage: z.literal('complete'),
	providerAcknowledged: z.literal(true),
	state: z.literal('connected'),
	reconnectRequired: z.literal(false),
	source: runtimeSource,
})
const access = z.strictObject({
	identity,
	credentialGeneration: generation,
	issuedAt: utc,
	expiresAt: utc,
	source: runtimeSource,
})

export const pagesInput = z.strictObject({ version, kind: z.literal('pages-input'), origin, release, copySources })
export const pagesRecord = z.strictObject({
	version,
	kind: z.literal('pages'),
	origin,
	release,
	copySources,
	checkedAt: utc,
	verifierSha256: sha256,
	source: source.extend({ kind: z.literal('public-http') }),
	pages: z
		.array(
			z.strictObject({
				path: z.enum(PAGE_PATHS),
				finalUrl: z.enum([`${ORIGIN}/welcome`, `${ORIGIN}/privacy`, `${ORIGIN}/terms`]),
				status: z.literal(200),
				contentType: z.literal('text/html'),
				bodySha256: sha256,
				copyVerified: z.literal(true),
				navigationVerified: z.literal(true),
			})
		)
		.length(PAGE_PATHS.length),
})
export const day0Input = z.strictObject({
	version,
	kind: z.literal('day0-observation'),
	origin,
	deployedCommit: commit,
	identity,
	production,
	branding,
	pagesSha256: sha256,
	consent: z.strictObject({ identity, acceptedAt: utc, source: runtimeSource }),
	access,
	publicRead,
	source: runtimeSource,
})
export const baselineRecord = z.strictObject({
	version,
	kind: z.literal('day0-baseline'),
	recordedAt: utc,
	earliestDay8: utc,
	verifierSha256: sha256,
	observation: day0Input,
	pages: pagesRecord,
})
export const day8Input = z.strictObject({
	version,
	kind: z.literal('day8-observation'),
	origin,
	baselineSha256: sha256,
	deployedCommit: commit,
	identity,
	source: runtimeSource,
	continuity: z.strictObject({
		identity,
		from: utc,
		through: utc,
		coverage: z.literal('complete'),
		consents: z.literal(0),
		revocations: z.literal(0),
		grantReplacements: z.literal(0),
		source: runtimeSource,
	}),
	refresh: z.strictObject({
		event: z.literal('google_access_refreshed'),
		identity,
		deployedCommit: commit,
		credentialGenerationBefore: generation,
		credentialGenerationAfter: generation,
		priorAccess: access,
		startedAt: utc,
		providerSucceededAt: utc,
		committedAt: utc,
		expiresAt: utc,
		providerSuccess: z.literal(true),
		generationCasCommitted: z.literal(true),
		source: runtimeSource,
	}),
	publicRead,
})

export const day8Record = z.strictObject({
	version,
	kind: z.literal('day8-validation'),
	checkedAt: utc,
	verifierSha256: sha256,
	elapsedSeconds: z.number().nonnegative(),
	validation: z.literal('RECORD_VALIDATED'),
	externalProof: z.literal('UNVERIFIED'),
	observation: day8Input,
})

export type PagesInput = z.infer<typeof pagesInput>
export type PagesRecord = z.infer<typeof pagesRecord>
export type Day0 = z.infer<typeof day0Input>
export type Baseline = z.infer<typeof baselineRecord>
export type Day8 = z.infer<typeof day8Input>
type Source = z.infer<typeof source>
type Identity = z.infer<typeof identity>
type PublicRead = z.infer<typeof publicRead>

export class EvidenceError extends Error {}

export const fingerprint = (value: string) => createHash('sha256').update(value).digest('hex')

export function requireEvidence(condition: boolean, code: string): asserts condition {
	if (!condition) throw new EvidenceError(code)
}

export function time(value: string): number {
	const result = Date.parse(value)
	requireEvidence(Number.isFinite(result) && new Date(result).toISOString() === value, 'invalid_utc_timestamp')
	return result
}

function ordered(values: string[], code: string) {
	for (let index = 1; index < values.length; index++)
		requireEvidence(time(values[index - 1]) <= time(values[index]), code)
}

function sameIdentity(left: Identity, right: Identity) {
	requireEvidence(
		left.connectionSha256 === right.connectionSha256 &&
			left.grantSha256 === right.grantSha256 &&
			left.connectionGeneration === right.connectionGeneration,
		'grant_or_connection_changed'
	)
}

function sourcedAfter(value: Source, event: string, now: string) {
	ordered([event, value.capturedAt, now], 'source_timestamp_order_invalid')
}

function validateRead(read: PublicRead, expected: Identity, deployedCommit: string, now: string) {
	sameIdentity(read.identity, expected)
	requireEvidence(read.deployedCommit === deployedCommit, 'public_read_release_mismatch')
	ordered([read.requestedAt, read.providerReadAt, read.completedAt], 'public_read_order_invalid')
	sourcedAfter(read.source, read.completedAt, now)
}

export function validatePages(pages: PagesRecord, deployedCommit: string, now: string) {
	requireEvidence(pages.release.deployedCommit === deployedCommit, 'pages_release_mismatch')
	requireEvidence(
		pages.source.observerSha256 === pages.verifierSha256 && pages.source.observerCodeSha256 === pages.verifierSha256,
		'pages_observer_fingerprint_mismatch'
	)
	requireEvidence(
		pages.source.artifactSha256 ===
			fingerprint(JSON.stringify(pages.pages.map((page) => [page.path, page.bodySha256]))),
		'page_body_fingerprints_mismatch'
	)
	requireEvidence(new Set(pages.pages.map((page) => page.path)).size === PAGE_PATHS.length, 'public_pages_incomplete')
	for (const page of pages.pages) requireEvidence(page.finalUrl === `${ORIGIN}${page.path}`, 'public_page_url_mismatch')
	ordered([pages.release.source.capturedAt, pages.checkedAt], 'release_must_precede_page_check')
	sourcedAfter(pages.source, pages.checkedAt, now)
}

export function validateDay0(record: Day0, pages: PagesRecord, now: string) {
	validatePages(pages, record.deployedCommit, now)
	sameIdentity(record.consent.identity, record.identity)
	sameIdentity(record.access.identity, record.identity)
	requireEvidence(
		record.pagesSha256 === fingerprint(JSON.stringify(pages, null, 2) + '\n'),
		'pages_record_fingerprint_mismatch'
	)
	const consentAt = record.consent.acceptedAt
	ordered([record.production.source.capturedAt, consentAt], 'production_must_precede_consent')
	ordered([record.branding.source.capturedAt, consentAt], 'branding_must_precede_consent')
	ordered([pages.checkedAt, consentAt, record.publicRead.requestedAt], 'day0_public_evidence_order_invalid')
	sourcedAfter(record.consent.source, consentAt, now)
	ordered([consentAt, record.access.issuedAt, record.publicRead.providerReadAt], 'day0_access_order_invalid')
	requireEvidence(time(record.publicRead.completedAt) < time(record.access.expiresAt), 'day0_access_expired')
	requireEvidence(time(now) < time(record.access.expiresAt), 'day0_access_expired_before_baseline')
	sourcedAfter(record.access.source, record.access.issuedAt, now)
	validateRead(record.publicRead, record.identity, record.deployedCommit, now)
	requireEvidence(
		record.publicRead.credentialGeneration === record.access.credentialGeneration,
		'day0_credential_generation_mismatch'
	)
	const latest = [
		record.consent.source.capturedAt,
		record.access.source.capturedAt,
		record.publicRead.source.capturedAt,
	]
		.sort()
		.at(-1)
	requireEvidence(latest !== undefined, 'day0_sources_missing')
	sourcedAfter(record.source, latest, now)
}

function validateRefresh(record: Day8, baseline: Baseline, now: string) {
	const refresh = record.refresh
	sameIdentity(refresh.identity, baseline.observation.identity)
	sameIdentity(refresh.priorAccess.identity, refresh.identity)
	requireEvidence(refresh.deployedCommit === record.deployedCommit, 'refresh_release_mismatch')
	requireEvidence(
		refresh.credentialGenerationBefore >= baseline.observation.access.credentialGeneration &&
			refresh.credentialGenerationBefore === refresh.priorAccess.credentialGeneration &&
			refresh.credentialGenerationAfter === refresh.credentialGenerationBefore + 1,
		'refresh_credential_generation_invalid'
	)
	if (refresh.credentialGenerationBefore === baseline.observation.access.credentialGeneration) {
		requireEvidence(
			refresh.priorAccess.issuedAt === baseline.observation.access.issuedAt &&
				refresh.priorAccess.expiresAt === baseline.observation.access.expiresAt,
			'same_credential_expiry_changed'
		)
	}
	requireEvidence(
		time(refresh.priorAccess.issuedAt) < time(refresh.priorAccess.expiresAt),
		'prior_access_expiry_invalid'
	)
	ordered(
		[
			baseline.observation.access.issuedAt,
			refresh.priorAccess.issuedAt,
			refresh.priorAccess.expiresAt,
			refresh.startedAt,
			refresh.providerSucceededAt,
			refresh.committedAt,
		],
		'refresh_must_follow_actual_expiry'
	)
	ordered([baseline.earliestDay8, refresh.startedAt], 'refresh_before_day8')
	sourcedAfter(refresh.priorAccess.source, refresh.priorAccess.issuedAt, now)
	sourcedAfter(refresh.source, refresh.committedAt, now)
	ordered(
		[refresh.committedAt, record.publicRead.providerReadAt, record.publicRead.completedAt],
		'public_read_must_follow_refresh'
	)
	requireEvidence(time(record.publicRead.completedAt) < time(refresh.expiresAt), 'refreshed_access_expired')
	requireEvidence(
		record.publicRead.credentialGeneration === refresh.credentialGenerationAfter,
		'public_read_credential_generation_mismatch'
	)
}

export function validateDay8(record: Day8, baseline: Baseline, baselineSha256: string, now: string) {
	requireEvidence(record.baselineSha256 === baselineSha256, 'immutable_baseline_fingerprint_mismatch')
	const earliest = new Date(time(baseline.recordedAt) + DAY8_SECONDS * 1000).toISOString()
	requireEvidence(baseline.earliestDay8 === earliest, 'baseline_interval_invalid')
	validateDay0(baseline.observation, baseline.pages, baseline.recordedAt)
	requireEvidence(time(now) >= time(earliest), 'eight_real_days_not_elapsed')
	sameIdentity(record.identity, baseline.observation.identity)
	sameIdentity(record.continuity.identity, record.identity)
	requireEvidence(record.continuity.from === baseline.recordedAt, 'continuity_does_not_start_at_baseline')
	ordered([record.publicRead.completedAt, record.continuity.through], 'continuity_does_not_cover_public_read')
	sourcedAfter(record.continuity.source, record.continuity.through, now)
	validateRead(record.publicRead, record.identity, record.deployedCommit, now)
	validateRefresh(record, baseline, now)
	const latest = [
		record.refresh.source.capturedAt,
		record.publicRead.source.capturedAt,
		record.continuity.source.capturedAt,
	]
		.sort()
		.at(-1)
	requireEvidence(latest !== undefined, 'day8_sources_missing')
	sourcedAfter(record.source, latest, now)
}

export function contract() {
	return {
		version: 1,
		pagesInput: z.toJSONSchema(pagesInput),
		day0Input: z.toJSONSchema(day0Input),
		day8Input: z.toJSONSchema(day8Input),
		day8Record: z.toJSONSchema(day8Record),
		pagesRecord: z.toJSONSchema(pagesRecord),
		baselineRecord: z.toJSONSchema(baselineRecord),
		limitations:
			'Strict sanitized record validation. Source hashes identify declared evidence; they do not authenticate observers or prove provider facts. No injected clock. Stable connectionGeneration differs from refresh credentialGeneration. Day8 refresh starts after real baseline+691200 seconds and prior access expiry; the acknowledged provider read follows committed refresh.',
	}
}
