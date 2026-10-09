import { formatLessons, formatMoney, lessonsPhrase } from '@dv-lab/core'

interface MoneyTextProps {
	amountMinor: number
	currency: string | null
}

export function MoneyText({ amountMinor, currency }: MoneyTextProps) {
	if (currency === null) {
		return (
			<span className="tabular-nums">
				{formatMoney(amountMinor, null)}
				<span className="text-muted-foreground"> No currency</span>
			</span>
		)
	}
	return <span className="tabular-nums">{formatMoney(amountMinor, currency)}</span>
}

interface LessonsTextProps {
	minutes: number
	lessonMinutes: number
	phrase?: boolean
}

export function LessonsText({ minutes, lessonMinutes, phrase = false }: LessonsTextProps) {
	return (
		<span className="tabular-nums">
			{phrase ? lessonsPhrase(minutes, lessonMinutes) : formatLessons(minutes, lessonMinutes)}
		</span>
	)
}
