import type { FC } from 'react'

import { Archive, Banknote } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrencyAmount, selectStudentLedgerProjection } from '@/lib/crm/model'

import type { StudentIconButtonProps, StudentLedgerItemProps, StudentMetricProps } from './StudentsPanel.types'

export const StudentLedgerItem: FC<StudentLedgerItemProps> = ({
	student,
	lessons,
	now,
	settingsHref,
	onRecordPayment,
	onArchive,
	previewMode,
}) => {
	const projection = selectStudentLedgerProjection(student, lessons, now)
	const subtitle = student.special || student.level || 'No special note'
	const secondaryBalances = (student.balance.otherCurrencyBalances ?? []).filter(
		(balance) => balance.balance !== 0 || balance.charged !== 0 || balance.paid !== 0
	)
	const ledgerContent = (
		<>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<p
						className="font-heading text-ink group-hover:text-sage truncate font-semibold transition-colors"
						data-private
					>
						{student.fullName}
					</p>
					<p className="text-ink-muted mt-1 truncate text-xs" data-private>
						{subtitle}
					</p>
				</div>
				<div className="flex flex-wrap gap-1.5">
					<Badge tone={projection.statusTone}>{student.status}</Badge>
					{student.packageLessonPriceOverride !== null && <Badge tone="neutral">custom plan</Badge>}
					<Badge tone={projection.balanceTone} className="font-mono tabular-nums">
						{formatCurrencyAmount(student.balance.balance, student.currency)}
					</Badge>
					{secondaryBalances.map((balance) => (
						<Badge
							key={balance.currency}
							tone={balance.overdue ? 'red' : 'neutral'}
							className="font-mono tabular-nums"
							title={`Historical ${balance.currency} balance`}
						>
							{formatCurrencyAmount(balance.balance, balance.currency)}
						</Badge>
					))}
				</div>
			</div>
			<div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
				<StudentMetric
					label="Rate"
					value={`${formatCurrencyAmount(student.defaultLessonPrice, student.currency)} / 60 min`}
				/>
				<StudentMetric label="Plan" value={projection.plan} />
				<StudentMetric label="Package" value={projection.lessonsLeft} />
				<StudentMetric label="Next payment" value={projection.nextPayment} />
			</div>
		</>
	)

	return (
		<article className="border-line bg-surface [&:has(a:hover)]:border-sage rounded-lg border p-3 transition-colors">
			<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
				{previewMode ? (
					<div className="min-w-0 rounded-lg text-left">{ledgerContent}</div>
				) : (
					<Link
						href={settingsHref}
						className="focus-visible:ring-ring/35 group min-w-0 rounded-lg text-left focus-visible:outline-none focus-visible:ring-[3px]"
					>
						{ledgerContent}
					</Link>
				)}

				<div className="flex flex-wrap justify-end gap-1.5">
					<StudentIconButton
						label={`Record payment for ${student.fullName}`}
						onClick={onRecordPayment}
						variant="secondary"
						disabled={previewMode}
					>
						<Banknote className="h-4 w-4" />
					</StudentIconButton>
					<StudentIconButton
						label={`Archive ${student.fullName}`}
						onClick={onArchive}
						variant="ghost"
						disabled={previewMode || student.status === 'archived'}
					>
						<Archive className="h-4 w-4" />
					</StudentIconButton>
				</div>
			</div>
		</article>
	)
}

const StudentMetric: FC<StudentMetricProps> = ({ label, value }) => {
	return (
		<div className="border-line-soft bg-surface-muted rounded-lg border p-2.5">
			<p className="text-ink-muted text-xs font-medium">{label}</p>
			<p className="text-ink mt-1 truncate font-mono text-xs font-semibold tabular-nums">{value}</p>
		</div>
	)
}

const StudentIconButton: FC<StudentIconButtonProps> = ({ label, children, ...props }) => {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button size="icon" aria-label={label} {...props}>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent sideOffset={6}>{label}</TooltipContent>
		</Tooltip>
	)
}
