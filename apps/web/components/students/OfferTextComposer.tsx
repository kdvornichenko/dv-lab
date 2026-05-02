import { type FC, useState } from 'react'

import { Copy } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatRubAmount } from '@/lib/crm/model'

import {
	DEFAULT_LESSON_DURATION_MINUTES,
	LESSON_PRICE_RUB,
	calculatePackageLessonCount,
	calculatePackageLessonPriceRub,
	calculatePackageTotalPriceRub,
} from '@teacher-crm/api-types'

import type { OfferInputProps, OfferPackageInputsProps } from './OfferTextComposer.types'

export const OfferTextComposer: FC = () => {
	const [baseLessonPrice, setBaseLessonPrice] = useState(String(LESSON_PRICE_RUB.default))
	const [lessonDurationMinutes, setLessonDurationMinutes] = useState(String(DEFAULT_LESSON_DURATION_MINUTES))
	const [threeLessonsPerWeek, setThreeLessonsPerWeek] = useState('2')
	const [fiveLessonsPerWeek, setFiveLessonsPerWeek] = useState('2')
	const [copied, setCopied] = useState(false)
	const offerText = buildOfferText({
		baseLessonPrice,
		lessonDurationMinutes,
		packages: [
			{ months: 3, lessonsPerWeek: threeLessonsPerWeek },
			{ months: 5, lessonsPerWeek: fiveLessonsPerWeek },
		],
	})

	async function copyOfferText() {
		await navigator.clipboard.writeText(offerText)
		setCopied(true)
		window.setTimeout(() => setCopied(false), 1600)
	}

	return (
		<section className="border-line bg-surface rounded-lg border p-4 shadow-[0_18px_55px_-46px_var(--shadow-sage)]">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="text-sage font-mono text-xs font-semibold uppercase">Offer text</p>
					<h3 className="text-ink mt-1 text-lg font-semibold">Package message</h3>
				</div>
				<Button type="button" size="sm" onClick={copyOfferText}>
					<Copy className="h-4 w-4" />
					{copied ? 'Copied' : 'Copy text'}
				</Button>
			</div>

			<div className="mt-4 grid gap-3">
				<OfferInput label="Base lesson price" value={baseLessonPrice} onChange={setBaseLessonPrice} />
				<OfferInput
					label="Lesson duration, minutes"
					value={lessonDurationMinutes}
					onChange={setLessonDurationMinutes}
				/>
				<OfferPackageInputs
					label="3-month package"
					baseLessonPrice={baseLessonPrice}
					lessonDurationMinutes={lessonDurationMinutes}
					months={3}
					lessonsPerWeek={threeLessonsPerWeek}
					onLessonsPerWeekChange={setThreeLessonsPerWeek}
				/>
				<OfferPackageInputs
					label="5-month package"
					baseLessonPrice={baseLessonPrice}
					lessonDurationMinutes={lessonDurationMinutes}
					months={5}
					lessonsPerWeek={fiveLessonsPerWeek}
					onLessonsPerWeekChange={setFiveLessonsPerWeek}
				/>
				<Textarea value={offerText} readOnly className="min-h-64 font-mono text-sm leading-6" aria-label="Offer text" />
			</div>
		</section>
	)
}

const OfferPackageInputs: FC<OfferPackageInputsProps> = ({
	label,
	baseLessonPrice,
	lessonDurationMinutes,
	months,
	lessonsPerWeek,
	onLessonsPerWeekChange,
}) => {
	const lessonCount = calculatePackageLessonCount({
		packageMonths: months,
		packageLessonsPerWeek: Math.max(Math.floor(safeNumber(lessonsPerWeek)), 0),
	})
	const lessonPrice = calculatePackageLessonPriceRub({
		defaultLessonPrice: safeNumber(baseLessonPrice),
		defaultLessonDurationMinutes: safeNumber(lessonDurationMinutes),
		packageMonths: months,
	})
	const packageTotal = calculatePackageTotalPriceRub({
		defaultLessonPrice: safeNumber(baseLessonPrice),
		defaultLessonDurationMinutes: safeNumber(lessonDurationMinutes),
		packageMonths: months,
		packageLessonCount: lessonCount,
	})

	return (
		<div className="border-line-soft bg-surface-muted rounded-lg border p-3">
			<div className="mb-3 flex items-center justify-between gap-3">
				<p className="font-heading text-ink text-sm font-semibold">{label}</p>
				<Badge tone="neutral" className="font-mono tabular-nums">
					{formatRubAmount(lessonPrice)} / lesson
				</Badge>
			</div>
			<div className="space-y-1">
				<OfferInput label="Lessons per week" value={lessonsPerWeek} onChange={onLessonsPerWeekChange} />
				<div className="grid grid-cols-2 items-center gap-2">
					<p className="text-ink-muted text-sm font-medium">Lessons in package</p>
					<p className="text-ink font-mono text-sm font-semibold tabular-nums">{lessonCount}</p>
				</div>
				<div className="grid grid-cols-2 items-center gap-2">
					<p className="text-ink-muted text-sm font-medium">Package payment</p>
					<p className="text-ink font-mono text-sm font-semibold tabular-nums">{formatRubAmount(packageTotal)}</p>
				</div>
			</div>
		</div>
	)
}

const OfferInput: FC<OfferInputProps> = ({ label, value, onChange }) => {
	return (
		<div className="grid grid-cols-2 items-center gap-2">
			<Label className="text-ink-muted mb-1.5 block text-sm font-medium">{label}</Label>
			<Input
				type="number"
				inputMode="numeric"
				min="0"
				step="1"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="bg-surface font-mono tabular-nums"
			/>
		</div>
	)
}

function buildOfferText({
	baseLessonPrice,
	lessonDurationMinutes,
	packages,
}: {
	baseLessonPrice: string
	lessonDurationMinutes: string
	packages: { months: 3 | 5; lessonsPerWeek: string }[]
}) {
	const basePrice = safeNumber(baseLessonPrice)
	const [threeMonthPackage, fiveMonthPackage] = packages.map((item) => {
		const lessons = calculatePackageLessonCount({
			packageMonths: item.months,
			packageLessonsPerWeek: Math.max(Math.floor(safeNumber(item.lessonsPerWeek)), 0),
		})
		const lessonPrice = calculatePackageLessonPriceRub({
			defaultLessonPrice: basePrice,
			defaultLessonDurationMinutes: safeNumber(lessonDurationMinutes),
			packageMonths: item.months,
		})
		const packageTotal = calculatePackageTotalPriceRub({
			defaultLessonPrice: basePrice,
			defaultLessonDurationMinutes: safeNumber(lessonDurationMinutes),
			packageMonths: item.months,
			packageLessonCount: lessons,
		})
		const fullTotal =
			calculatePackageLessonPriceRub({
				defaultLessonPrice: basePrice,
				defaultLessonDurationMinutes: safeNumber(lessonDurationMinutes),
				packageMonths: 0,
			}) * lessons
		const savings = Math.max(fullTotal - packageTotal, 0)

		return [
			`• при оплате за ${formatMonths(item.months)} стоимость занятия составляет ${formatRubText(lessonPrice)} рублей`,
			`за ${formatMonths(item.months)} — ${formatLessons(lessons)} — ${formatRubText(packageTotal)} рублей`,
			`экономия — ${formatRubText(savings)} рублей`,
		].join('\n')
	})

	return [
		'До конца года также доступны варианты с пониженной стоимостью при оплате наперёд:',
		'',
		threeMonthPackage,
		'',
		fiveMonthPackage,
	].join('\n')
}

function safeNumber(value: string) {
	const next = Number(value)
	return Number.isFinite(next) ? next : 0
}

function formatRubText(value: number) {
	return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)
}

function formatMonths(value: number) {
	if (value % 10 === 1 && value % 100 !== 11) return `${value} месяц`
	if ([2, 3, 4].includes(value % 10) && ![12, 13, 14].includes(value % 100)) return `${value} месяца`
	return `${value} месяцев`
}

function formatLessons(value: number) {
	if (value % 10 === 1 && value % 100 !== 11) return `${value} занятие`
	if ([2, 3, 4].includes(value % 10) && ![12, 13, 14].includes(value % 100)) return `${value} занятия`
	return `${value} занятий`
}
