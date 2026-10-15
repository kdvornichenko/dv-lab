'use client'

import { useRouter } from 'next/navigation'

import { DotShape } from '@/components/app/status-dot'
import { Banner, BannerAction, BannerActions, BannerDescription, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { dollars, toCents } from '@/lib/usd-text'

import type { BudgetSnapshot } from '@dv-lab/contracts'

const RESET_FORMAT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

const SETTINGS_HREF = '/settings?tab=assistant'

function resetLabel(resetOn: string): string {
	return RESET_FORMAT.format(new Date(`${resetOn}T00:00:00Z`))
}

function usedPercent(budget: BudgetSnapshot): number {
	const cap = toCents(budget.capUsd, false)
	if (cap === 0n) return 100
	const used = toCents(budget.spentUsd, true) + toCents(budget.heldUsd, true)
	return Math.min(Number((used * 100n) / cap), 99)
}

export function BudgetNotice({ budget }: { budget: BudgetSnapshot }) {
	const router = useRouter()
	if (budget.state === 'ok') return null
	if (budget.state === 'warning') {
		const used = dollars(toCents(budget.spentUsd, true) + toCents(budget.heldUsd, true))
		return (
			<div className="flex items-center gap-2 px-1" data-slot="budget-warning">
				<DotShape tone="amber" />
				<p role="status" className="min-w-0 flex-1 text-caption text-muted-foreground">
					{usedPercent(budget)}% of the monthly budget is used. {used} of {dollars(toCents(budget.capUsd, false), true)}
					.
				</p>
				<Button type="button" variant="secondary" size="compact" onClick={() => router.push(SETTINGS_HREF)}>
					Budget
				</Button>
			</div>
		)
	}
	return (
		<Banner status="warning" data-slot="budget-reached">
			<BannerTitle>Monthly budget reached</BannerTitle>
			<BannerDescription>
				The assistant answers again on {resetLabel(budget.resetOn)}, or raise the cap in Settings.
			</BannerDescription>
			<BannerActions>
				<BannerAction href={SETTINGS_HREF}>Open settings</BannerAction>
			</BannerActions>
		</Banner>
	)
}
