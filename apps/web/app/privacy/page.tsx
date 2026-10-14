import Link from 'next/link'

import { PageHeader } from '@/components/app/layout-parts'

const sections = [
	{
		title: 'Calendar access',
		body: 'dv-lab requests access to read your calendar list and to view and edit calendar events. It uses the list to offer the calendars in the connected Google account that you can write to. Your primary calendar is selected by default, and you can choose another one in Settings. Calendar views, lesson changes and overlap checks use the selected calendar.',
	},
	{
		title: 'Information sent to Google',
		body: "dv-lab sends the student's display name as the lesson event title, or the title you enter for any other event, with start and end times, the time zone, the weekly recurrence rule for repeating events and cancellation status to Google Calendar. When you set them, it also sends the event colour, description and location. It also writes private properties into each event it creates or assigns: internal lesson, series or event identifiers, the kind of record, and request identifiers and digests that keep updates linked to the right item. Assign writes the identifier of the lesson into the existing Google event. When dv-lab changes an existing event it sends that event's other settings back unchanged. Student notes, payment amounts, balances, passwords and lesson marks from local teaching records are not added to Google events. Changing a student's name in dv-lab does not automatically update Google Calendar.",
	},
	{
		title: 'Calendar information read and stored',
		body: "To show the schedule and find upcoming lessons without calling Google, the server keeps a copy of the selected calendar's events. For each event it stores identifiers, version markers and Google's update time, the title, description and location, the colour identifier, recurrence identifiers and original occurrence times, a summary of weekly repeat rules (weekday, frequency, interval and end date), start and end dates or times, time zones, event status, availability and event type, and the lesson identifier from dv-lab's private property when the event carries one. It also stores the calendar's colour, Google's event colour palette, links to existing lessons, students and calendar requests, and the identifiers of events you chose to ignore. dv-lab does not request attendee details, meeting links or attachments. Request records may retain supported event settings as described below.",
	},
	{
		title: 'Background updates from Google',
		body: 'For the selected calendar, dv-lab registers a notification channel with Google over HTTPS. When events change, Google calls the dv-lab server; the call carries the channel identifier and a secret token but no event content, and the server then reads the changes from Google using a sync token. A full reconcile runs every night to recover notifications that were not delivered. The server stores the channel identifier, resource identifier and expiry, a hash of the channel secret, the sync token and the sync position. Channels are renewed before they expire and are stopped when you disconnect or switch calendars.',
	},
	{
		title: 'Stored copy and retention',
		body: "The stored copy covers about eight weeks back and one year ahead of the current week. During a full reconcile, events outside that range or no longer present in Google are removed from it unless they are linked to a lesson. The copy remains stored after a server restart and after Disconnect, and the copy of a calendar you switch away from is not deleted. Previously stored data may remain in database backups under the service's operating policy. Clearing live connection credentials does not immediately remove data from backups.",
	},
	{
		title: 'Connection and request records',
		body: "The server stores connected calendar details, encrypted refresh credentials and temporary encrypted authorization-flow data. It keeps calendar request records, including the requested operation and input, reserved identifiers, expected event versions, event data sent to Google, confirmation and recovery steps, timestamps and safe error categories. To preserve event settings, these records can include validated event descriptions, locations, colours, reminder and guest-permission settings, visibility, availability, source references and other applications' extended properties. Attendee details, conference data and attachments are not kept in these supported snapshots; restoration is unavailable when those fields cannot be preserved safely. These records support confirmation and recovery after an interrupted request. Access tokens stay in server memory. Access and refresh tokens are not sent to the browser.",
	},
	{
		title: 'Local teaching records',
		body: 'Lesson marks, student notes, payments and balances remain local teaching records. Connecting Google Calendar does not automatically publish existing local lesson history.',
	},
	{
		title: 'Form recovery',
		body: "Unsaved form inputs stay only in the memory of the open tab. Keep that tab open while you reconnect in another tab. Reloading or closing it does not restore unsaved inputs. Browser session storage may keep only opaque request and command identifiers to recover a request's status; it does not store event titles, times or form inputs. Accepted requests are recorded on the server and are not automatically replayed as new changes.",
	},
	{
		title: 'Authorization',
		body: 'Google handles calendar authorization. dv-lab processes the result on the server to maintain the connection. Calendar authorization does not replace your dv-lab sign-in.',
	},
	{
		title: 'Data recipients',
		body: "Google processes authorization requests and calendar reads and writes, and sends change notifications to the dv-lab server. Anthropic processes the questions sent to the chat assistant, as described in Chat assistant. The dv-lab server, database and backups hold the records described here. The signed-in teacher's browser receives calendar views, request status and chat conversations. dv-lab does not add advertising or analytics recipients.",
	},
	{
		title: 'Operational records',
		body: 'Operational logs contain request identifiers, operation types, timing, status and sanitized error categories. They do not include authorization parameters, tokens, student names, calendar event titles, chat message text or full event responses. Stored server records may also be included in backups and handled through server operations.',
	},
	{
		title: 'Disconnecting',
		body: "Disconnecting stops calendar changes and notification channels and attempts to revoke Google access. After Google confirms revocation, live connection credentials are cleared. If revocation cannot be confirmed, Settings offers the allowed recovery actions. After you remove dv-lab's access in your Google Account, you can explicitly confirm that action in Settings; this records your confirmation and clears live credentials. Your local history, existing Google events, the stored copy, links and request records are kept. Reconnecting the same calendar checks earlier requests before new changes are allowed.",
	},
	{
		title: 'Changes made in Google',
		body: 'Opening a calendar view reads the stored copy and does not call Google. Changes made in Google reach dv-lab through the notification channel and the nightly reconcile. Events that are not linked to a lesson are ordinary calendar events: you can create, move, resize, edit and delete them, and they show their Google colour, description and location. An event whose title matches a student name is only suggested for that student; it is linked only when you choose Assign.',
	},
	{
		title: 'Chat assistant',
		body: 'Chat conversations and messages are stored in the dv-lab database on the server and in its backups. When you ask the assistant a question, the server sends Anthropic (Claude API) the text of the conversation and the student records the assistant reads for the answer: the name, gender, card sections, notes, comments, lessons and balance of the students you mention or the assistant looks up while answering. A search by name sends the names of up to six matching active students. A question about lessons over a period without a specific student sends the lessons of all students in that period with their names. The API key is kept only on the server. Marks, notes and comments that the assistant records for you become ordinary teaching records. Deleting a conversation erases its text, mentions and results in dv-lab and removes it from your list; the records made from it and the usage records (model, token counts and cost) remain, and the usage still counts toward the monthly limit. Data held by Anthropic is governed by the terms of the organization that owns the API key; dv-lab does not set or promise retention periods or deletion there.',
	},
]

export default function PrivacyPage() {
	return (
		<div className="min-h-dvh bg-surface-1 text-body text-foreground">
			<div className="mx-auto flex max-w-[720px] flex-col gap-6 px-4 py-8 sm:px-8">
				<nav aria-label="Public navigation" className="flex flex-wrap items-center justify-between gap-4">
					<Link href="/welcome" className="text-link">
						dv-lab
					</Link>
					<Link href="/login" className="text-link">
						Sign in
					</Link>
				</nav>
				<main className="flex flex-col gap-6">
					<PageHeader
						title="Privacy policy"
						description="This page explains how dv-lab uses Google Calendar data when a teacher connects a Google calendar, and how the chat assistant handles data."
					/>
					{sections.map(({ title, body }) => (
						<section key={title} className="flex flex-col gap-2">
							<h2 className="text-title font-semibold">{title}</h2>
							<p>{body}</p>
						</section>
					))}
				</main>
				<footer className="flex flex-wrap gap-4">
					<Link href="/welcome" className="text-link">
						Home
					</Link>
					<Link href="/privacy" className="text-link">
						Privacy policy
					</Link>
					<Link href="/terms" className="text-link">
						Terms
					</Link>
				</footer>
			</div>
		</div>
	)
}
