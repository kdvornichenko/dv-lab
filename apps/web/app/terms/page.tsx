import Link from 'next/link'

import { PageHeader } from '@/components/app/layout-parts'

const sections = [
	{
		title: 'Access',
		body: 'dv-lab is a private teaching workspace. Use the account provided to you and keep your sign-in details private.',
	},
	{
		title: 'Records',
		body: 'Use the workspace to manage teaching records you are authorized to access. Check lesson dates, times and payment entries before saving changes.',
	},
	{
		title: 'Google Calendar',
		body: 'A working connection to your primary Google Calendar is required to change the calendar. A change is saved only after Google confirms it and dv-lab updates the confirmed view. A pending or unknown result is not a saved change.',
	},
	{
		title: 'Availability',
		body: 'When Google is unavailable, you can read the last checked calendar view. New offline calendar changes are not accepted. Check unresolved request status before trying another change.',
	},
	{
		title: 'Limits of this version',
		body: 'Refresh the calendar to read changes made in Google. Review overlap warnings before saving. External events are read-only unless they are already linked to a lesson.',
	},
]

export default function TermsPage() {
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
					<PageHeader title="Terms" />
					{sections.map(({ title, body }) => (
						<section key={title} className="flex flex-col gap-2">
							<h2 className="text-title font-semibold">{title}</h2>
							<p>{body}</p>
						</section>
					))}
					<section className="flex flex-col gap-2">
						<h2 className="text-title font-semibold">Data information</h2>
						<p>
							Read the{' '}
							<Link href="/privacy" className="text-link">
								Privacy policy
							</Link>{' '}
							for information about Google Calendar data.
						</p>
					</section>
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
