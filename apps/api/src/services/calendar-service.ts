import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

import {
	GOOGLE_CALENDAR_REQUIRED_SCOPES,
	type CalendarBusyInterval,
	type CalendarBusyQuery,
	type CalendarBlock,
	type CalendarConnection,
	type CalendarConnectionStatus,
	type CalendarListEntry,
	type CalendarSyncRecord,
	type CalendarSyncStatus,
	type CreateCalendarBlockInput,
	type Lesson,
	type UpdateCalendarBlockInput,
} from '@teacher-crm/api-types'
import {
	deleteCalendarBlockRow,
	getCalendarLessonContext,
	getCalendarConnectionRow,
	getCalendarSyncEventRow,
	insertCalendarBlockRow,
	lessonExistsForTeacher,
	listCalendarBlockRows,
	listCalendarSyncEventRows,
	selectCalendarConnectionRow,
	updateCalendarBlockRow,
	updateLessonRow,
	upsertCalendarConnectionRow,
	upsertCalendarSyncEventRow,
	type CalendarBlockRow,
	type CalendarLessonContext,
	type CalendarConnectionRow,
	type CalendarSyncEventRow,
	type LessonUpdateValues,
} from '@teacher-crm/db'

import { serverEnv } from '../config/env'
import { getDb, teacherProfileId } from './db-context'
import { GoogleCalendarRequestError, googleJson } from './google-calendar-client'
import { getMemoryStore } from './storage-context'
import type { StoreScope } from './store-scope'

type ProviderTokenInput = {
	email: string
	providerToken: string
	providerRefreshToken?: string | null
	expiresAt?: string
}

type GoogleCalendarListResponse = {
	items?: {
		id?: string
		summary?: string
		summaryOverride?: string
		primary?: boolean
		accessRole?: string
		deleted?: boolean
	}[]
}

type GoogleCalendarEventResponse = GoogleEventListItem

type CalendarSyncOptions = {
	repeatWeekly?: boolean
	singleOccurrence?: boolean
	occurrenceStartsAt?: string
	lessonOverride?: Lesson
}

type CalendarImportResult = {
	checked: number
	updated: number
}

type GoogleEventDate = {
	date?: string
	dateTime?: string
}

type GoogleEventListItem = {
	id?: string
	recurringEventId?: string
	summary?: string
	status?: string
	transparency?: string
	originalStartTime?: GoogleEventDate
	recurrence?: string[]
	start?: GoogleEventDate
	end?: GoogleEventDate
	creator?: {
		displayName?: string
		email?: string
	}
	organizer?: {
		displayName?: string
		email?: string
	}
	[key: string]: unknown
}

type GoogleEventsListResponse = {
	items?: GoogleEventListItem[]
}

type GoogleRefreshTokenResponse = {
	access_token?: string
	expires_in?: number
	error?: string
	error_description?: string
}

const now = () => new Date().toISOString()
const hasGoogleCalendarGrant = (grantedScopes: readonly string[], tokenAvailable: boolean) =>
	tokenAvailable && GOOGLE_CALENDAR_REQUIRED_SCOPES.every((scope) => grantedScopes.includes(scope))

function dateToIso(value: Date | string | null | undefined) {
	if (!value) return null
	return value instanceof Date ? value.toISOString() : value
}

function lessonOccurrences(input: CalendarBusyQuery) {
	const repeatCount = input.repeatWeekly ? input.repeatCount : 1
	const firstStart = new Date(input.startsAt)
	return Array.from({ length: repeatCount }, (_, index) => {
		const start = new Date(firstStart)
		start.setDate(start.getDate() + index * 7)
		const end = new Date(start.getTime() + input.durationMinutes * 60_000)
		return { start, end }
	})
}

function intervalsOverlap(a: { start: Date; end: Date }, b: { start: Date; end: Date }) {
	return a.start < b.end && a.end > b.start
}

function googleEventDate(value: GoogleEventDate | undefined) {
	const raw = value?.dateTime ?? value?.date
	if (!raw) return null
	const date = new Date(raw)
	return Number.isNaN(date.getTime()) ? null : date
}

function googleBusyEventTitle(event: GoogleEventListItem) {
	return (
		event.summary?.trim() ||
		event.organizer?.displayName?.trim() ||
		event.creator?.displayName?.trim() ||
		event.id?.trim() ||
		'Busy time'
	)
}

function googleEventLessonPatch(event: GoogleCalendarEventResponse): LessonUpdateValues | null {
	const start = googleEventDate(event.start)
	const end = googleEventDate(event.end)
	if (event.status === 'cancelled' && (!start || !end)) return { status: 'cancelled' }
	if (!start || !end || end <= start) return null

	const values: LessonUpdateValues = {
		startsAt: start,
		durationMinutes: Math.max(Math.round((end.getTime() - start.getTime()) / 60_000), 1),
	}
	if (event.recurrence?.some((rule) => rule.includes('FREQ=WEEKLY'))) values.repeatWeekly = true
	if (event.status === 'cancelled') values.status = 'cancelled'

	return values
}

function lessonMatchesGoogleEvent(context: CalendarLessonContext, values: LessonUpdateValues) {
	const startsAt =
		values.startsAt instanceof Date ? values.startsAt : values.startsAt ? new Date(values.startsAt) : null
	const localStartsAt = eventDate(context.lesson.startsAt)
	const sameStart = !startsAt || localStartsAt.getTime() === startsAt.getTime()
	const sameDuration = !values.durationMinutes || context.lesson.durationMinutes === values.durationMinutes
	const sameStatus = !values.status || context.lesson.status === values.status
	const sameRepeatWeekly = values.repeatWeekly === undefined || context.lesson.repeatWeekly === values.repeatWeekly
	return sameStart && sameDuration && sameStatus && sameRepeatWeekly
}

function occurrenceSearchWindow(value: Date | string) {
	const target = eventDate(value)
	const timeMin = new Date(target.getTime() - 36 * 60 * 60 * 1000)
	const timeMax = new Date(target.getTime() + 36 * 60 * 60 * 1000)
	return { target, timeMin, timeMax }
}

function occurrenceAnchor(event: GoogleEventListItem) {
	return googleEventDate(event.originalStartTime) ?? googleEventDate(event.start)
}

function closestGoogleOccurrence(events: GoogleEventListItem[], targetStartsAt: Date | string) {
	const { target } = occurrenceSearchWindow(targetStartsAt)
	return events
		.map((event) => ({ event, anchor: occurrenceAnchor(event) }))
		.filter((candidate): candidate is { event: GoogleEventListItem; anchor: Date } => Boolean(candidate.anchor))
		.sort(
			(a, b) => Math.abs(a.anchor.getTime() - target.getTime()) - Math.abs(b.anchor.getTime() - target.getTime())
		)[0]?.event
}

function tokenExpiry(value: string | undefined) {
	if (!value) return null
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? null : date
}

function encryptionSecret() {
	if (serverEnv.CALENDAR_TOKEN_ENCRYPTION_KEY) return serverEnv.CALENDAR_TOKEN_ENCRYPTION_KEY
	if (serverEnv.NODE_ENV === 'production') {
		throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY is required in production')
	}
	return 'teacher-crm-calendar-token-development-key'
}

function encryptSecret(value: string) {
	const key = createHash('sha256').update(encryptionSecret()).digest()
	const iv = randomBytes(12)
	const cipher = createCipheriv('aes-256-gcm', key, iv)
	const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
	const tag = cipher.getAuthTag()

	return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':')
}

function decryptSecret(value: string) {
	const [version, iv, tag, ciphertext] = value.split(':')
	if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Unsupported encrypted secret format')

	const key = createHash('sha256').update(encryptionSecret()).digest()
	const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
	decipher.setAuthTag(Buffer.from(tag, 'base64url'))

	return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8')
}

function eventDate(value: Date | string) {
	return value instanceof Date ? value : new Date(value)
}

function calendarEventPayload(context: CalendarLessonContext, options: CalendarSyncOptions = {}) {
	const lesson = options.lessonOverride ?? context.lesson
	const startsAt = eventDate(lesson.startsAt)
	const endsAt = new Date(startsAt.getTime() + lesson.durationMinutes * 60_000)

	return {
		summary: lesson.title,
		description: 'Created from Teacher CRM.',
		status: lesson.status === 'cancelled' ? 'cancelled' : 'confirmed',
		start: {
			dateTime: startsAt.toISOString(),
		},
		end: {
			dateTime: endsAt.toISOString(),
		},
		recurrence: options.repeatWeekly ? ['RRULE:FREQ=WEEKLY'] : undefined,
	}
}

function calendarBlockPayload(block: Pick<CalendarBlock, 'title' | 'startsAt' | 'durationMinutes'>) {
	const startsAt = eventDate(block.startsAt)
	const endsAt = new Date(startsAt.getTime() + block.durationMinutes * 60_000)

	return {
		summary: block.title,
		description: 'Busy time from Teacher CRM.',
		transparency: 'opaque',
		start: {
			dateTime: startsAt.toISOString(),
		},
		end: {
			dateTime: endsAt.toISOString(),
		},
	}
}

function emptyConnection(): CalendarConnection {
	return {
		id: 'cal_google',
		provider: 'google',
		email: null,
		status: 'not_connected',
		requiredScopes: [...GOOGLE_CALENDAR_REQUIRED_SCOPES],
		grantedScopes: [],
		tokenAvailable: false,
		selectedCalendarId: null,
		selectedCalendarName: null,
		connectedAt: null,
		updatedAt: now(),
	}
}

function mapConnectionRow(row: CalendarConnectionRow | null): CalendarConnection {
	if (!row) return emptyConnection()

	return {
		id: row.id,
		provider: row.provider,
		email: row.providerAccountEmail ?? null,
		status: row.status,
		requiredScopes: row.requiredScopes,
		grantedScopes: row.grantedScopes,
		tokenAvailable: row.tokenAvailable,
		selectedCalendarId: row.selectedCalendarId ?? null,
		selectedCalendarName: row.selectedCalendarName ?? null,
		connectedAt: dateToIso(row.connectedAt),
		updatedAt: dateToIso(row.updatedAt) ?? now(),
	}
}

function mapSyncEventRow(row: CalendarSyncEventRow): CalendarSyncRecord {
	return {
		id: row.id,
		lessonId: row.lessonId,
		provider: row.provider,
		externalEventId: row.externalEventId ?? null,
		status: row.status,
		lastSyncedAt: dateToIso(row.lastSyncedAt),
		lastError: row.lastError ?? null,
		updatedAt: dateToIso(row.updatedAt) ?? now(),
	}
}

function mapCalendarBlockRow(row: CalendarBlockRow): CalendarBlock {
	return {
		id: row.id,
		title: row.title,
		startsAt: dateToIso(row.startsAt) ?? new Date().toISOString(),
		durationMinutes: row.durationMinutes,
		externalEventId: row.externalEventId ?? null,
		externalCalendarId: row.externalCalendarId ?? null,
		syncStatus: row.syncStatus,
		lastError: row.lastError ?? null,
		createdAt: dateToIso(row.createdAt) ?? now(),
		updatedAt: dateToIso(row.updatedAt) ?? now(),
	}
}

function memoryCalendarOptions(connection: CalendarConnection): CalendarListEntry[] {
	if (connection.status !== 'connected' || !connection.tokenAvailable) return []
	return [
		{
			id: connection.selectedCalendarId ?? 'primary',
			name: connection.selectedCalendarName ?? 'Primary',
			primary: (connection.selectedCalendarId ?? 'primary') === 'primary',
			accessRole: 'owner',
		},
	]
}

async function googleRecurringInstances(
	calendarId: string,
	externalEventId: string,
	targetStartsAt: Date | string,
	accessToken: string
) {
	const { timeMin, timeMax } = occurrenceSearchWindow(targetStartsAt)
	const query = new URLSearchParams({
		timeMin: timeMin.toISOString(),
		timeMax: timeMax.toISOString(),
		showDeleted: 'true',
	})
	const response = await googleJson<GoogleEventsListResponse>(
		`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalEventId)}/instances?${query.toString()}`,
		accessToken
	)
	return response.items ?? []
}

async function refreshGoogleAccessToken(connection: CalendarConnectionRow) {
	if (!connection.encryptedRefreshToken) throw new Error('Google refresh token is not available')
	if (!serverEnv.GOOGLE_CLIENT_ID || !serverEnv.GOOGLE_CLIENT_SECRET) {
		throw new Error('Google OAuth client credentials are not configured')
	}

	const response = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			client_id: serverEnv.GOOGLE_CLIENT_ID,
			client_secret: serverEnv.GOOGLE_CLIENT_SECRET,
			refresh_token: decryptSecret(connection.encryptedRefreshToken),
			grant_type: 'refresh_token',
		}),
	})
	const payload = (await response.json().catch(() => null)) as GoogleRefreshTokenResponse | null

	if (!response.ok || !payload?.access_token) {
		throw new Error(payload?.error_description ?? payload?.error ?? 'Google token refresh failed')
	}

	return {
		accessToken: payload.access_token,
		expiresAt: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000) : null,
	}
}

async function withGoogleAccessToken<T>(
	connection: CalendarConnectionRow,
	run: (accessToken: string, connection: CalendarConnectionRow) => Promise<T>,
	persistRefreshedToken: (accessToken: string, expiresAt: Date | null) => Promise<CalendarConnectionRow>
): Promise<T> {
	if (!connection.encryptedAccessToken) throw new Error('Google access token is not available')

	const shouldRefresh =
		connection.tokenExpiresAt instanceof Date && connection.tokenExpiresAt.getTime() <= Date.now() + 60_000
	if (shouldRefresh && connection.encryptedRefreshToken) {
		const refreshed = await refreshGoogleAccessToken(connection)
		const refreshedConnection = await persistRefreshedToken(refreshed.accessToken, refreshed.expiresAt)
		return run(refreshed.accessToken, refreshedConnection)
	}

	const accessToken = decryptSecret(connection.encryptedAccessToken)
	try {
		return await run(accessToken, connection)
	} catch (error) {
		if (!(error instanceof GoogleCalendarRequestError) || error.status !== 401 || !connection.encryptedRefreshToken) {
			throw error
		}

		const refreshed = await refreshGoogleAccessToken(connection)
		const refreshedConnection = await persistRefreshedToken(refreshed.accessToken, refreshed.expiresAt)
		return run(refreshed.accessToken, refreshedConnection)
	}
}

function googleConnectionStatusForError(error: unknown): CalendarConnectionStatus | null {
	if (error instanceof GoogleCalendarRequestError && [401, 403].includes(error.status)) return 'expired'
	if (!(error instanceof Error)) return null

	const message = error.message.toLowerCase()
	if (message.includes('refresh token') || message.includes('invalid_grant')) return 'authorization_required'
	if (message.includes('access token') || message.includes('oauth client credentials')) return 'error'
	return null
}

async function markGoogleConnectionIssue(
	db: NonNullable<ReturnType<typeof getDb>>,
	teacherId: string,
	connection: CalendarConnectionRow,
	error: unknown
) {
	const status = googleConnectionStatusForError(error)
	if (!status) return false

	await upsertCalendarConnectionRow(db, {
		teacherId,
		provider: 'google',
		providerAccountEmail: connection.providerAccountEmail,
		requiredScopes: connection.requiredScopes,
		grantedScopes: connection.grantedScopes,
		tokenAvailable: false,
		selectedCalendarId: connection.selectedCalendarId,
		selectedCalendarName: connection.selectedCalendarName,
		status,
		connectedAt: connection.connectedAt,
	})

	console.warn('[teacher-crm] Google Calendar connection needs reconnect', {
		teacherId,
		status,
		message: error instanceof Error ? error.message : 'Unknown Google Calendar authorization error',
	})

	return true
}

function persistRefreshedGoogleToken(
	db: NonNullable<ReturnType<typeof getDb>>,
	teacherId: string,
	connection: CalendarConnectionRow
) {
	return (accessToken: string, expiresAt: Date | null) =>
		upsertCalendarConnectionRow(db, {
			teacherId,
			provider: 'google',
			providerAccountEmail: connection.providerAccountEmail,
			requiredScopes: connection.requiredScopes,
			grantedScopes: connection.grantedScopes,
			tokenAvailable: true,
			encryptedAccessToken: encryptSecret(accessToken),
			encryptedRefreshToken: connection.encryptedRefreshToken,
			tokenExpiresAt: expiresAt,
			selectedCalendarId: connection.selectedCalendarId,
			selectedCalendarName: connection.selectedCalendarName,
			status: 'connected',
			connectedAt: connection.connectedAt ?? new Date(),
		})
}

async function syncCalendarBlockToGoogle(
	db: NonNullable<ReturnType<typeof getDb>>,
	teacherId: string,
	block: CalendarBlockRow
) {
	const connection = await getCalendarConnectionRow(db, teacherId)
	if (!connection || !hasGoogleCalendarGrant(connection.grantedScopes, connection.tokenAvailable)) {
		return block
	}

	const calendarId = block.externalCalendarId ?? connection.selectedCalendarId ?? 'primary'
	const payload = calendarBlockPayload(mapCalendarBlockRow(block))

	try {
		const event = await withGoogleAccessToken(
			connection,
			async (accessToken) => {
				if (block.externalEventId) {
					try {
						return await googleJson<GoogleCalendarEventResponse>(
							`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(block.externalEventId)}`,
							accessToken,
							{
								method: 'PATCH',
								body: JSON.stringify(payload),
							}
						)
					} catch (error) {
						if (!(error instanceof GoogleCalendarRequestError) || error.status !== 404) throw error
					}
				}

				return googleJson<GoogleCalendarEventResponse>(
					`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
					accessToken,
					{
						method: 'POST',
						body: JSON.stringify(payload),
					}
				)
			},
			persistRefreshedGoogleToken(db, teacherId, connection)
		)

		return (
			(await updateCalendarBlockRow(db, teacherId, block.id, {
				externalEventId: event.id ?? block.externalEventId,
				externalCalendarId: calendarId,
				syncStatus: 'synced',
				lastError: null,
			})) ?? block
		)
	} catch (error) {
		await markGoogleConnectionIssue(db, teacherId, connection, error)
		return (
			(await updateCalendarBlockRow(db, teacherId, block.id, {
				externalCalendarId: calendarId,
				syncStatus: 'failed',
				lastError: error instanceof Error ? error.message : 'Google Calendar block sync failed',
			})) ?? block
		)
	}
}

async function deleteCalendarBlockFromGoogle(
	db: NonNullable<ReturnType<typeof getDb>>,
	teacherId: string,
	block: CalendarBlockRow
) {
	if (!block.externalEventId) return
	const connection = await getCalendarConnectionRow(db, teacherId)
	if (!connection || !hasGoogleCalendarGrant(connection.grantedScopes, connection.tokenAvailable)) return

	const calendarId = block.externalCalendarId ?? connection.selectedCalendarId ?? 'primary'
	try {
		await withGoogleAccessToken(
			connection,
			(accessToken) =>
				googleJson<null>(
					`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(block.externalEventId!)}`,
					accessToken,
					{ method: 'DELETE' }
				),
			persistRefreshedGoogleToken(db, teacherId, connection)
		)
	} catch (error) {
		if (error instanceof GoogleCalendarRequestError && [404, 410].includes(error.status)) return
		await markGoogleConnectionIssue(db, teacherId, connection, error)
		throw error
	}
}

export const calendarService = {
	async getCalendarConnection(scope: StoreScope) {
		const db = getDb()
		if (!db) return getMemoryStore().getCalendarConnection(scope)

		const teacherId = await teacherProfileId(db, scope)
		return mapConnectionRow(await getCalendarConnectionRow(db, teacherId))
	},

	async listCalendarSyncRecords(scope: StoreScope) {
		const db = getDb()
		if (!db) return getMemoryStore().listCalendarSyncRecords(scope)

		const teacherId = await teacherProfileId(db, scope)
		return (await listCalendarSyncEventRows(db, teacherId)).map(mapSyncEventRow)
	},

	async getCalendarState(scope: StoreScope) {
		const db = getDb()
		if (!db) {
			return {
				connection: getMemoryStore().getCalendarConnection(scope),
				syncRecords: getMemoryStore().listCalendarSyncRecords(scope),
				blocks: getMemoryStore().listCalendarBlocks(scope),
			}
		}

		const teacherId = await teacherProfileId(db, scope)
		const [connection, syncRecords, blocks] = await Promise.all([
			getCalendarConnectionRow(db, teacherId),
			listCalendarSyncEventRows(db, teacherId),
			listCalendarBlockRows(db, teacherId),
		])
		return {
			connection: mapConnectionRow(connection),
			syncRecords: syncRecords.map(mapSyncEventRow),
			blocks: blocks.map(mapCalendarBlockRow),
		}
	},

	async listCalendarBlocks(scope: StoreScope) {
		const db = getDb()
		if (!db) return getMemoryStore().listCalendarBlocks(scope)

		const teacherId = await teacherProfileId(db, scope)
		return (await listCalendarBlockRows(db, teacherId)).map(mapCalendarBlockRow)
	},

	async createCalendarBlock(scope: StoreScope, input: CreateCalendarBlockInput) {
		const db = getDb()
		if (!db) return getMemoryStore().createCalendarBlock(scope, input)

		const teacherId = await teacherProfileId(db, scope)
		const block = await insertCalendarBlockRow(db, {
			teacherId,
			title: input.title.trim(),
			startsAt: new Date(input.startsAt),
			durationMinutes: input.durationMinutes,
			externalEventId: null,
			externalCalendarId: null,
			syncStatus: 'not_synced',
			lastError: null,
		})

		return mapCalendarBlockRow(await syncCalendarBlockToGoogle(db, teacherId, block))
	},

	async updateCalendarBlock(scope: StoreScope, blockId: string, input: UpdateCalendarBlockInput) {
		const db = getDb()
		if (!db) return getMemoryStore().updateCalendarBlock(scope, blockId, input)

		const teacherId = await teacherProfileId(db, scope)
		const block = await updateCalendarBlockRow(db, teacherId, blockId, {
			...(input.title !== undefined ? { title: input.title.trim() } : {}),
			...(input.startsAt !== undefined ? { startsAt: new Date(input.startsAt) } : {}),
			...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
			syncStatus: 'not_synced',
			lastError: null,
		})
		if (!block) return null

		return mapCalendarBlockRow(await syncCalendarBlockToGoogle(db, teacherId, block))
	},

	async deleteCalendarBlock(scope: StoreScope, blockId: string) {
		const db = getDb()
		if (!db) return getMemoryStore().deleteCalendarBlock(scope, blockId)

		const teacherId = await teacherProfileId(db, scope)
		const block = await deleteCalendarBlockRow(db, teacherId, blockId)
		if (!block) return null
		await deleteCalendarBlockFromGoogle(db, teacherId, block)
		return mapCalendarBlockRow(block)
	},

	async connectCalendar(scope: StoreScope, email: string) {
		const db = getDb()
		if (!db) return getMemoryStore().connectCalendar(scope, email)

		const teacherId = await teacherProfileId(db, scope)
		const existing = await getCalendarConnectionRow(db, teacherId)
		if (existing && hasGoogleCalendarGrant(existing.grantedScopes, existing.tokenAvailable)) {
			return mapConnectionRow(existing)
		}

		const connection = await upsertCalendarConnectionRow(db, {
			teacherId,
			provider: 'google',
			providerAccountEmail: email,
			requiredScopes: [...GOOGLE_CALENDAR_REQUIRED_SCOPES],
			grantedScopes: existing?.grantedScopes ?? [],
			tokenAvailable: existing?.tokenAvailable ?? false,
			selectedCalendarId: existing?.selectedCalendarId ?? null,
			selectedCalendarName: existing?.selectedCalendarName ?? null,
			status: 'authorization_required',
			connectedAt: existing?.connectedAt ?? null,
		})

		return mapConnectionRow(connection)
	},

	async saveProviderTokens(scope: StoreScope, input: ProviderTokenInput) {
		const db = getDb()
		if (!db) {
			return getMemoryStore().connectCalendar(scope, input.email, {
				grantedScopes: [...GOOGLE_CALENDAR_REQUIRED_SCOPES],
				tokenAvailable: true,
			})
		}

		const teacherId = await teacherProfileId(db, scope)
		const existing = await getCalendarConnectionRow(db, teacherId)
		const connection = await upsertCalendarConnectionRow(db, {
			teacherId,
			provider: 'google',
			providerAccountEmail: input.email,
			requiredScopes: [...GOOGLE_CALENDAR_REQUIRED_SCOPES],
			grantedScopes: [...GOOGLE_CALENDAR_REQUIRED_SCOPES],
			tokenAvailable: true,
			encryptedAccessToken: encryptSecret(input.providerToken),
			encryptedRefreshToken: input.providerRefreshToken
				? encryptSecret(input.providerRefreshToken)
				: (existing?.encryptedRefreshToken ?? null),
			tokenExpiresAt: tokenExpiry(input.expiresAt),
			selectedCalendarId: existing?.selectedCalendarId ?? 'primary',
			selectedCalendarName: existing?.selectedCalendarName ?? 'Primary',
			status: 'connected',
			connectedAt: existing?.connectedAt ?? new Date(),
		})

		return mapConnectionRow(connection)
	},

	async selectCalendar(scope: StoreScope, calendarId: string, calendarName: string) {
		const db = getDb()
		if (!db) return getMemoryStore().selectCalendar(scope, calendarId, calendarName)

		const teacherId = await teacherProfileId(db, scope)
		const existing = await selectCalendarConnectionRow(db, teacherId, calendarId, calendarName)
		if (existing) return mapConnectionRow(existing)

		return mapConnectionRow(
			await upsertCalendarConnectionRow(db, {
				teacherId,
				provider: 'google',
				providerAccountEmail: scope.email,
				requiredScopes: [...GOOGLE_CALENDAR_REQUIRED_SCOPES],
				grantedScopes: [],
				tokenAvailable: false,
				selectedCalendarId: calendarId,
				selectedCalendarName: calendarName,
				status: 'authorization_required',
			})
		)
	},

	async listCalendars(scope: StoreScope): Promise<CalendarListEntry[]> {
		const db = getDb()
		if (!db) return memoryCalendarOptions(getMemoryStore().getCalendarConnection(scope))

		const teacherId = await teacherProfileId(db, scope)
		const connection = await getCalendarConnectionRow(db, teacherId)
		if (!connection || !hasGoogleCalendarGrant(connection.grantedScopes, connection.tokenAvailable)) return []

		const persistRefreshedToken = (accessToken: string, expiresAt: Date | null) =>
			upsertCalendarConnectionRow(db, {
				teacherId,
				provider: 'google',
				providerAccountEmail: connection.providerAccountEmail,
				requiredScopes: connection.requiredScopes,
				grantedScopes: connection.grantedScopes,
				tokenAvailable: true,
				encryptedAccessToken: encryptSecret(accessToken),
				encryptedRefreshToken: connection.encryptedRefreshToken,
				tokenExpiresAt: expiresAt,
				selectedCalendarId: connection.selectedCalendarId,
				selectedCalendarName: connection.selectedCalendarName,
				status: 'connected',
				connectedAt: connection.connectedAt ?? new Date(),
			})

		try {
			return await withGoogleAccessToken(
				connection,
				async (accessToken) => {
					const response = await googleJson<GoogleCalendarListResponse>(
						'https://www.googleapis.com/calendar/v3/users/me/calendarList',
						accessToken
					)

					return (response.items ?? [])
						.filter((calendar) => !calendar.deleted)
						.filter((calendar) => calendar.accessRole === 'writer' || calendar.accessRole === 'owner')
						.filter((calendar): calendar is typeof calendar & { id: string; summary: string } => Boolean(calendar.id))
						.map((calendar) => ({
							id: calendar.id,
							name: calendar.summaryOverride ?? calendar.summary ?? calendar.id,
							primary: Boolean(calendar.primary),
							accessRole: calendar.accessRole ?? 'reader',
						}))
				},
				persistRefreshedToken
			)
		} catch (error) {
			if (await markGoogleConnectionIssue(db, teacherId, connection, error)) return []
			throw error
		}
	},

	async listBusyIntervals(scope: StoreScope, input: CalendarBusyQuery): Promise<CalendarBusyInterval[]> {
		const db = getDb()
		if (!db) return []

		const teacherId = await teacherProfileId(db, scope)
		const connection = await getCalendarConnectionRow(db, teacherId)
		if (!connection || !hasGoogleCalendarGrant(connection.grantedScopes, connection.tokenAvailable)) return []

		const occurrences = lessonOccurrences(input)
		if (occurrences.length === 0) return []
		const timeMin = new Date(Math.min(...occurrences.map((occurrence) => occurrence.start.getTime()))).toISOString()
		const timeMax = new Date(Math.max(...occurrences.map((occurrence) => occurrence.end.getTime()))).toISOString()
		const calendarId = connection.selectedCalendarId ?? 'primary'
		const calendarName = connection.selectedCalendarName ?? 'Primary'
		const excludedSync = input.excludeLessonId
			? await getCalendarSyncEventRow(db, teacherId, input.excludeLessonId)
			: null
		const excludedExternalEventId = excludedSync?.externalEventId ?? null
		const persistRefreshedToken = (accessToken: string, expiresAt: Date | null) =>
			upsertCalendarConnectionRow(db, {
				teacherId,
				provider: 'google',
				providerAccountEmail: connection.providerAccountEmail,
				requiredScopes: connection.requiredScopes,
				grantedScopes: connection.grantedScopes,
				tokenAvailable: true,
				encryptedAccessToken: encryptSecret(accessToken),
				encryptedRefreshToken: connection.encryptedRefreshToken,
				tokenExpiresAt: expiresAt,
				selectedCalendarId: connection.selectedCalendarId,
				selectedCalendarName: connection.selectedCalendarName,
				status: 'connected',
				connectedAt: connection.connectedAt ?? new Date(),
			})

		const query = new URLSearchParams({
			timeMin,
			timeMax,
			singleEvents: 'true',
			orderBy: 'startTime',
			showDeleted: 'false',
		})

		let response: GoogleEventsListResponse
		try {
			response = await withGoogleAccessToken(
				connection,
				(accessToken) =>
					googleJson<GoogleEventsListResponse>(
						`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${query.toString()}`,
						accessToken
					),
				persistRefreshedToken
			)
		} catch (error) {
			if (await markGoogleConnectionIssue(db, teacherId, connection, error)) return []
			throw error
		}
		const events = response.items ?? []

		return events
			.filter((event) => event.status !== 'cancelled')
			.filter((event) => event.transparency !== 'transparent')
			.filter(
				(event) =>
					!excludedExternalEventId ||
					(event.id !== excludedExternalEventId && event.recurringEventId !== excludedExternalEventId)
			)
			.map((event) => ({
				calendarId,
				calendarName,
				event,
				title: googleBusyEventTitle(event),
				start: googleEventDate(event.start),
				end: googleEventDate(event.end),
			}))
			.filter(
				(
					interval
				): interval is {
					calendarId: string
					calendarName: string
					event: GoogleEventListItem
					title: string
					start: Date
					end: Date
				} => Boolean(interval.start && interval.end)
			)
			.filter((interval) => occurrences.some((occurrence) => intervalsOverlap(occurrence, interval)))
			.map((interval) => {
				return {
					calendarId: interval.calendarId,
					calendarName: interval.calendarName,
					title: interval.title,
					startsAt: interval.start.toISOString(),
					endsAt: interval.end.toISOString(),
				}
			})
	},

	async importSyncedLessonsFromCalendar(scope: StoreScope): Promise<CalendarImportResult> {
		const db = getDb()
		if (!db) return { checked: 0, updated: 0 }

		const teacherId = await teacherProfileId(db, scope)
		const connection = await getCalendarConnectionRow(db, teacherId)
		if (!connection || !hasGoogleCalendarGrant(connection.grantedScopes, connection.tokenAvailable)) {
			return { checked: 0, updated: 0 }
		}

		const syncRows = (await listCalendarSyncEventRows(db, teacherId))
			.filter((sync) => sync.status !== 'disabled' && Boolean(sync.externalEventId))
			.slice(0, 25)
		const persistRefreshedToken = (accessToken: string, expiresAt: Date | null) =>
			upsertCalendarConnectionRow(db, {
				teacherId,
				provider: 'google',
				providerAccountEmail: connection.providerAccountEmail,
				requiredScopes: connection.requiredScopes,
				grantedScopes: connection.grantedScopes,
				tokenAvailable: true,
				encryptedAccessToken: encryptSecret(accessToken),
				encryptedRefreshToken: connection.encryptedRefreshToken,
				tokenExpiresAt: expiresAt,
				selectedCalendarId: connection.selectedCalendarId,
				selectedCalendarName: connection.selectedCalendarName,
				status: 'connected',
				connectedAt: connection.connectedAt ?? new Date(),
			})

		let checked = 0
		let updated = 0

		for (const sync of syncRows) {
			const lessonContext = await getCalendarLessonContext(db, teacherId, sync.lessonId)
			if (!lessonContext || !sync.externalEventId) continue

			checked += 1
			const calendarId = sync.externalCalendarId ?? connection.selectedCalendarId ?? 'primary'
			const externalEventId = sync.externalEventId

			try {
				const event = await withGoogleAccessToken(
					connection,
					async (accessToken) => {
						const masterEvent = await googleJson<GoogleCalendarEventResponse>(
							`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalEventId)}`,
							accessToken
						)
						if (!lessonContext.lesson.repeatWeekly && !masterEvent.recurrence?.length) return masterEvent

						const instances = await googleRecurringInstances(
							calendarId,
							externalEventId,
							lessonContext.lesson.startsAt,
							accessToken
						)
						const occurrence = closestGoogleOccurrence(instances, lessonContext.lesson.startsAt)
						return occurrence ? { ...occurrence, recurrence: masterEvent.recurrence } : masterEvent
					},
					persistRefreshedToken
				)
				const values = googleEventLessonPatch(event)
				if (!values) continue
				if (event.status !== 'cancelled' && lessonContext.lesson.status === 'cancelled') {
					values.status = 'planned'
				}

				if (!lessonMatchesGoogleEvent(lessonContext, values)) {
					await updateLessonRow(db, teacherId, sync.lessonId, values)
					updated += 1
				}

				await upsertCalendarSyncEventRow(db, {
					teacherId,
					lessonId: sync.lessonId,
					provider: 'google',
					externalEventId,
					externalCalendarId: calendarId,
					status: 'synced',
					lastSyncedAt: new Date(),
					lastError: null,
				})
			} catch (error) {
				const connectionNeedsReconnect = await markGoogleConnectionIssue(db, teacherId, connection, error)
				await upsertCalendarSyncEventRow(db, {
					teacherId,
					lessonId: sync.lessonId,
					provider: 'google',
					externalEventId,
					externalCalendarId: calendarId,
					status: 'failed',
					lastError: error instanceof Error ? error.message : 'Google Calendar import failed',
				})
				if (connectionNeedsReconnect) break
			}
		}

		return { checked, updated }
	},

	async ensureCalendarSyncRecord(
		scope: StoreScope,
		lessonId: string,
		status: CalendarSyncStatus = 'not_synced'
	): Promise<CalendarSyncRecord | null> {
		const db = getDb()
		if (!db) return getMemoryStore().ensureCalendarSyncRecord(scope, lessonId, status)

		const teacherId = await teacherProfileId(db, scope)
		if (!(await lessonExistsForTeacher(db, teacherId, lessonId))) return null

		return mapSyncEventRow(
			await upsertCalendarSyncEventRow(db, {
				teacherId,
				lessonId,
				provider: 'google',
				status,
				lastError: null,
			})
		)
	},

	async deleteLessonFromCalendar(
		scope: StoreScope,
		lessonId: string,
		options: Pick<CalendarSyncOptions, 'singleOccurrence' | 'occurrenceStartsAt'> = {}
	): Promise<void> {
		const db = getDb()
		if (!db) {
			if (!options.singleOccurrence) getMemoryStore().deleteCalendarSyncRecord(scope, lessonId)
			return
		}

		const teacherId = await teacherProfileId(db, scope)
		const sync = await getCalendarSyncEventRow(db, teacherId, lessonId)
		if (!sync?.externalEventId) return

		const connection = await getCalendarConnectionRow(db, teacherId)
		if (!connection || !hasGoogleCalendarGrant(connection.grantedScopes, connection.tokenAvailable)) return

		const calendarId = sync.externalCalendarId ?? connection.selectedCalendarId ?? 'primary'
		const persistRefreshedToken = (accessToken: string, expiresAt: Date | null) =>
			upsertCalendarConnectionRow(db, {
				teacherId,
				provider: 'google',
				providerAccountEmail: connection.providerAccountEmail,
				requiredScopes: connection.requiredScopes,
				grantedScopes: connection.grantedScopes,
				tokenAvailable: true,
				encryptedAccessToken: encryptSecret(accessToken),
				encryptedRefreshToken: connection.encryptedRefreshToken,
				tokenExpiresAt: expiresAt,
				selectedCalendarId: connection.selectedCalendarId,
				selectedCalendarName: connection.selectedCalendarName,
				status: 'connected',
				connectedAt: connection.connectedAt ?? new Date(),
			})

		try {
			await withGoogleAccessToken(
				connection,
				async (accessToken) => {
					if (options.singleOccurrence) {
						const instances = await googleRecurringInstances(
							calendarId,
							sync.externalEventId!,
							options.occurrenceStartsAt ?? new Date().toISOString(),
							accessToken
						)
						const occurrence = closestGoogleOccurrence(
							instances,
							options.occurrenceStartsAt ?? new Date().toISOString()
						)
						if (occurrence?.id) {
							await googleJson<null>(
								`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(occurrence.id)}`,
								accessToken,
								{ method: 'DELETE' }
							)
						}
						return
					}

					await googleJson<null>(
						`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(sync.externalEventId!)}`,
						accessToken,
						{ method: 'DELETE' }
					)
				},
				persistRefreshedToken
			)
		} catch (error) {
			if (error instanceof GoogleCalendarRequestError && [404, 410].includes(error.status)) return
			await markGoogleConnectionIssue(db, teacherId, connection, error)
			await upsertCalendarSyncEventRow(db, {
				teacherId,
				lessonId,
				provider: 'google',
				externalCalendarId: calendarId,
				status: 'failed',
				lastError: error instanceof Error ? error.message : 'Google Calendar event delete failed',
			})
			throw error
		}
	},

	async syncLessonToCalendar(
		scope: StoreScope,
		lessonId: string,
		options: CalendarSyncOptions = {}
	): Promise<CalendarSyncRecord | null> {
		const db = getDb()
		if (!db) return getMemoryStore().syncLessonToCalendar(scope, lessonId)

		const teacherId = await teacherProfileId(db, scope)
		const lessonContext = await getCalendarLessonContext(db, teacherId, lessonId)
		if (!lessonContext) return null

		const connection = await getCalendarConnectionRow(db, teacherId)
		if (!connection || !hasGoogleCalendarGrant(connection.grantedScopes, connection.tokenAvailable)) {
			return mapSyncEventRow(
				await upsertCalendarSyncEventRow(db, {
					teacherId,
					lessonId,
					provider: 'google',
					status: 'failed',
					lastError: 'Google Calendar is not connected',
				})
			)
		}

		try {
			const existingSync = await getCalendarSyncEventRow(db, teacherId, lessonId)
			const targetCalendarId = existingSync?.externalCalendarId ?? connection.selectedCalendarId ?? 'primary'
			const shouldPatchSingleOccurrence = Boolean(options.singleOccurrence && existingSync?.externalEventId)
			const payload = calendarEventPayload(lessonContext, {
				repeatWeekly: shouldPatchSingleOccurrence ? false : options.repeatWeekly,
			})
			const persistRefreshedToken = (accessToken: string, expiresAt: Date | null) =>
				upsertCalendarConnectionRow(db, {
					teacherId,
					provider: 'google',
					providerAccountEmail: connection.providerAccountEmail,
					requiredScopes: connection.requiredScopes,
					grantedScopes: connection.grantedScopes,
					tokenAvailable: true,
					encryptedAccessToken: encryptSecret(accessToken),
					encryptedRefreshToken: connection.encryptedRefreshToken,
					tokenExpiresAt: expiresAt,
					selectedCalendarId: connection.selectedCalendarId,
					selectedCalendarName: connection.selectedCalendarName,
					status: 'connected',
					connectedAt: connection.connectedAt ?? new Date(),
				})

			const event = await withGoogleAccessToken(
				connection,
				async (accessToken) => {
					if (existingSync?.externalEventId) {
						try {
							if (shouldPatchSingleOccurrence) {
								const instances = await googleRecurringInstances(
									targetCalendarId,
									existingSync.externalEventId,
									options.occurrenceStartsAt ?? lessonContext.lesson.startsAt,
									accessToken
								)
								const occurrence = closestGoogleOccurrence(
									instances,
									options.occurrenceStartsAt ?? lessonContext.lesson.startsAt
								)
								if (occurrence?.id) {
									return await googleJson<GoogleCalendarEventResponse>(
										`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events/${encodeURIComponent(occurrence.id)}`,
										accessToken,
										{
											method: 'PATCH',
											body: JSON.stringify(payload),
										}
									)
								}
							}

							return await googleJson<GoogleCalendarEventResponse>(
								`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events/${encodeURIComponent(existingSync.externalEventId)}`,
								accessToken,
								{
									method: 'PATCH',
									body: JSON.stringify(payload),
								}
							)
						} catch (error) {
							if (!(error instanceof GoogleCalendarRequestError) || error.status !== 404) throw error
						}
					}

					return googleJson<GoogleCalendarEventResponse>(
						`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events`,
						accessToken,
						{
							method: 'POST',
							body: JSON.stringify(payload),
						}
					)
				},
				persistRefreshedToken
			)

			return mapSyncEventRow(
				await upsertCalendarSyncEventRow(db, {
					teacherId,
					lessonId,
					provider: 'google',
					externalEventId: shouldPatchSingleOccurrence
						? (existingSync?.externalEventId ?? null)
						: (event.id ?? existingSync?.externalEventId ?? null),
					externalCalendarId: targetCalendarId,
					status: 'synced',
					lastSyncedAt: new Date(),
					lastError: null,
				})
			)
		} catch (error) {
			await markGoogleConnectionIssue(db, teacherId, connection, error)
			return mapSyncEventRow(
				await upsertCalendarSyncEventRow(db, {
					teacherId,
					lessonId,
					provider: 'google',
					externalCalendarId: connection.selectedCalendarId,
					status: 'failed',
					lastError: error instanceof Error ? error.message : 'Google Calendar event sync failed',
				})
			)
		}
	},
}
