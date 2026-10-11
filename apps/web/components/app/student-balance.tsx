import { StatusDot, type StatusTone } from '@/components/app/status-dot'
import { cn } from '@/lib/utils'

import { balancePhrase, balanceState, type BalanceState } from '@dv-lab/core'

export interface BalanceTone {
	tone: StatusTone
	label: string
}

const TONES: Record<Exclude<BalanceState, 'not_set'>, BalanceTone> = {
	plenty: { tone: 'green', label: 'Plenty left' },
	pays_soon: { tone: 'blue', label: 'Pays soon' },
	none_left: { tone: 'amber', label: 'No lessons left' },
	owes: { tone: 'red', label: 'Owes lessons' },
}

export function balanceTone(state: BalanceState): BalanceTone | null {
	return state === 'not_set' ? null : TONES[state]
}

type StudentBalanceProps = {
	minutes: number | null
	lessonMinutes: number
	className?: string
} & ({ dot: true; threshold: number } | { dot?: false })

export function StudentBalance(props: StudentBalanceProps) {
	const { minutes, lessonMinutes, className } = props
	const text = minutes === null ? 'Not set' : balancePhrase(minutes, lessonMinutes)
	const textClass = minutes === null ? 'text-muted-foreground' : 'text-foreground'
	if (!props.dot) {
		return <span className={cn('tabular-nums', textClass, className)}>{text}</span>
	}
	const tone = balanceTone(balanceState(minutes, lessonMinutes, props.threshold))
	return (
		<span className={cn('flex items-center gap-2 tabular-nums', className)}>
			{tone === null ? (
				<span aria-hidden className="w-2 shrink-0" />
			) : (
				<StatusDot tone={tone.tone} label={tone.label} />
			)}
			<span className={textClass}>{text}</span>
		</span>
	)
}
