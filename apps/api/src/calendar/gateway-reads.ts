import { Auth, google } from 'googleapis'

import { googleCancelledInstance, googleCancelledEvent } from '@dv-lab/db'

import { familyReader } from './family-pages.ts'

export function calendarReadMethods(
	client: (signal: AbortSignal) => Auth.OAuth2Client,
	read: <T>(operation: () => Promise<T>) => Promise<T>
) {
	return {
		familyEvents: familyReader(async (token, calendarId, pageToken, signal) => {
			const oauth = client(signal)
			oauth.setCredentials({ access_token: token })
			const response = await read(() =>
				google.calendar({ version: 'v3', auth: oauth }).events.list(
					{
						calendarId,
						pageToken,
						singleEvents: false,
						showDeleted: true,
						maxResults: 2500,
						fields: 'nextPageToken,items(id,recurringEventId,originalStartTime,status)',
					},
					{ retry: false }
				)
			)
			return response.data
		}),
		async cancelledEvent(token: string, calendarId: string, eventId: string, signal: AbortSignal) {
			const oauth = client(signal)
			oauth.setCredentials({ access_token: token })
			const response = await read(() =>
				google
					.calendar({ version: 'v3', auth: oauth })
					.events.get({ calendarId, eventId, fields: 'id,etag,status' }, { retry: false })
			)
			return googleCancelledEvent.parse(response.data)
		},
		async cancelledInstance(token: string, calendarId: string, eventId: string, signal: AbortSignal) {
			const oauth = client(signal)
			oauth.setCredentials({ access_token: token })
			const response = await read(() =>
				google
					.calendar({ version: 'v3', auth: oauth })
					.events.get({ calendarId, eventId, fields: 'id,recurringEventId,originalStartTime,status' }, { retry: false })
			)
			return googleCancelledInstance.parse(response.data)
		},
	}
}
