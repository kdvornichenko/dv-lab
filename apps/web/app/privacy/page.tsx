import Link from 'next/link'

import { PageHeader } from '@/components/app/layout-parts'

const sections = [
	{
		title: 'Calendar access',
		body: 'dv-lab requests access to read your calendar list and to view and edit calendar events. It uses the list to find your primary calendar. Calendar views, lesson changes and overlap checks use that connected calendar.',
	},
	{
		title: 'Information sent to Google',
		body: "dv-lab sends the student's display name as the event title, lesson start and end times, the lesson time zone, recurrence details for weekly lessons and cancellation status to Google Calendar. It also sends internal identifiers to keep updates linked to the right lesson. Student notes, payment amounts, balances, passwords and lesson marks are not included in these events. Changing a student's name in dv-lab does not automatically update Google Calendar.",
	},
	{
		title: 'Calendar information read and stored',
		body: 'To display the last checked calendar and find upcoming lessons, the server stores event identifiers and update markers, permitted titles, recurrence identifiers and original occurrence times, start and end dates or times, time zones, event status, availability and event type. It also stores links to existing lessons, students and calendar requests. Event descriptions, attendee details, locations, meeting links and attachments are not stored or shown by this feature.',
	},
	{
		title: 'Calendar view metadata',
		body: 'The server records which account, connection and calendar a view belongs to, its date range and time zones, when it was fetched, its version and whether the range was fully checked. For next-lesson results, it records the result, the next lesson time when known, when it was checked and how much of the search was completed.',
	},
	{
		title: 'Last checked view and retention',
		body: "The last checked calendar view remains stored after a server restart and after Disconnect. A successful read of the same date range replaces that view. This feature does not automatically delete the cache or history after a fixed period. Previously stored data may remain in database backups under the service's operating policy. Clearing live connection credentials does not immediately remove data from backups.",
	},
	{
		title: 'Connection and request records',
		body: 'The server stores connected calendar details, encrypted refresh credentials and temporary encrypted authorization-flow data. It keeps calendar request records, including the requested operation and input, reserved identifiers, expected event versions, event data sent to Google, confirmation and recovery steps, timestamps and safe error categories. These records support confirmation and recovery after an interrupted request. Access tokens stay in server memory. Access and refresh tokens are not sent to the browser.',
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
		body: "Google processes authorization requests and calendar reads and writes. The dv-lab server, database and backups hold the records described here. The signed-in teacher's browser receives calendar views and request status. This feature does not add advertising or analytics recipients.",
	},
	{
		title: 'Operational records',
		body: 'Operational logs contain request identifiers, operation types, timing, status and sanitized error categories. They do not include authorization parameters, tokens, student names, calendar event titles or full event responses. Stored server records may also be included in backups and handled through server operations.',
	},
	{
		title: 'Disconnecting',
		body: "Disconnecting stops calendar changes and attempts to revoke Google access. After Google confirms revocation, live connection credentials are cleared. If revocation cannot be confirmed, Settings offers the allowed recovery actions. After you remove dv-lab's access in your Google Account, you can explicitly confirm that action in Settings; this records your confirmation and clears live credentials. Your local history, existing Google events, last checked view, links and request records are kept. Reconnecting the same calendar checks earlier requests before new changes are allowed.",
	},
	{
		title: 'Refreshing the view',
		body: 'Opening or refreshing a calendar view reads Google Calendar. This version does not provide automatic background delivery of changes made in Google. External events that are not linked to a lesson remain read-only calendar entries.',
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
						description="This page explains how dv-lab uses Google Calendar data when a teacher connects their primary calendar."
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
