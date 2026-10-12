import Link from 'next/link'

import { PageHeader } from '@/components/app/layout-parts'
import { Button } from '@/components/ui/button'

export default function WelcomePage() {
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
						title="dv-lab"
						description="A private workspace for managing lessons, student records and lesson payments."
					/>
					<p>
						View your Google Calendar, plan lessons and recurring schedules, and keep local lesson records and payment
						balances.
					</p>
					<section aria-labelledby="calendar-heading" className="flex flex-col gap-2">
						<h2 id="calendar-heading" className="text-title font-semibold">
							Google Calendar
						</h2>
						<p>
							Connect your primary Google Calendar to use the calendar in dv-lab. Calendar changes are saved only after
							Google confirms them. If Google is unavailable, the last checked calendar view stays available for
							reading.
						</p>
						<p>
							Existing local lesson history is kept. Connecting does not automatically send those records to Google.
						</p>
					</section>
					<div className="flex flex-col items-start gap-4">
						<p>Sign in with your dv-lab account to use the workspace.</p>
						<Button asChild>
							<Link href="/login">Sign in</Link>
						</Button>
					</div>
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
