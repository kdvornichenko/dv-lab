import { StatusDot, type AttentionKind, type AttentionMode, type StatusTone } from '@/components/app/status-dot'
import { cn } from '@/lib/utils'

import { balancePhrase, balanceState, type BalanceState } from '@dv-lab/core'

export interface BalanceTone {
	tone: StatusTone
	label: string
	attention: AttentionKind | null
}

const TONES: Record<Exclude<BalanceState, 'plenty'>, BalanceTone> = {
	pays_soon: { tone: 'amber', label: 'Pays soon', attention: 'pays_soon' },
	none_left: { tone: 'amber-ringed', label: 'No lessons left', attention: 'none_left' },
	owes: { tone: 'red', label: 'Owes lessons', attention: 'owes' },
	not_set: { tone: 'hollow', label: 'Balance not set', attention: null },
}

export function balanceTone(state: BalanceState): BalanceTone | null {
	return state === 'plenty' ? null : TONES[state]
}

export const BALANCE_STATE_LABELS: Record<BalanceState, string> = {
	plenty: 'Plenty left',
	pays_soon: 'Pays soon',
	none_left: 'No lessons left',
	owes: 'Owes lessons',
	not_set: 'Not set',
}

export function balanceHint(state: BalanceState, threshold: number): string {
	const tone = balanceTone(state)
	if (tone === null) return BALANCE_STATE_LABELS.plenty
	if (state === 'pays_soon') return `${tone.label}: ${threshold === 1 ? '1 lesson' : `${threshold} lessons`} or fewer`
	return tone.label
}

type StudentBalanceProps = {
	minutes: number | null
	lessonMinutes: number
	short?: boolean
	className?: string
} & ({ dot: true; threshold: number; attention?: AttentionMode; attentionId?: string } | { dot?: false })

export function StudentBalance(props: StudentBalanceProps) {
	const { minutes, lessonMinutes, className } = props
	const text =
		minutes === null ? 'Not set' : balancePhrase(minutes, lessonMinutes, props.short ? { short: true } : undefined)
	const textClass = minutes === null ? 'text-muted-foreground' : 'text-foreground'
	if (!props.dot) {
		return <span className={cn('tabular-nums', textClass, className)}>{text}</span>
	}
	const state = balanceState(minutes, lessonMinutes, props.threshold)
	const tone = balanceTone(state)
	return (
		<span className={cn('flex items-center gap-2 tabular-nums', className)}>
			{tone === null ? (
				<span aria-hidden className="w-2 shrink-0" />
			) : (
				<StatusDot
					tone={tone.tone}
					label={tone.label}
					hint={balanceHint(state, props.threshold)}
					attention={
						props.attention !== undefined && tone.attention !== null
							? { kind: tone.attention, mode: props.attention, id: props.attentionId }
							: undefined
					}
				/>
			)}
			<span className={textClass}>{text}</span>
		</span>
	)
}
