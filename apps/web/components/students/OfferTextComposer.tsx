import { useState } from 'react'

import { Copy } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatUsdAmount } from '@/lib/crm/model'

import { LESSON_PRICE_RUB } from '@teacher-crm/api-types'

export function OfferTextComposer() {
	const [baseLessonPrice, setBaseLessonPrice] = useState(String(LESSON_PRICE_RUB.default))
	const [threeMonths, setThreeMonths] = useState('3')
	const [threeLessonCount, setThreeLessonCount] = useState('24')
	const [threePackageTotal, setThreePackageTotal] = useState(String(LESSON_PRICE_RUB.package3Months * 24))
	const [fiveMonths, setFiveMonths] = useState('5')
	const [fiveLessonCount, setFiveLessonCount] = useState('40')
	const [fivePackageTotal, setFivePackageTotal] = useState(String(LESSON_PRICE_RUB.package5Months * 40))
	const [copied, setCopied] = useState(false)
	const offerText = buildOfferText({
		baseLessonPrice,
		packages: [
			{ months: threeMonths, lessonCount: threeLessonCount, packageTotal: threePackageTotal },
			{ months: fiveMonths, lessonCount: fiveLessonCount, packageTotal: fivePackageTotal },
		],
	})

	async function copyOfferText() {
		await navigator.clipboard.writeText(offerText)
		setCopied(true)
		window.setTimeout(() => setCopied(false), 1600)
	}

	return (
		<section className="rounded-lg border border-line bg-surface p-4 shadow-[0_18px_55px_-46px_var(--shadow-sage)]">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="font-mono text-xs font-semibold text-sage uppercase">Offer text</p>
					<h3 className="mt-1 text-lg font-semibold text-ink">Package message</h3>
				</div>
				<Button type="button" size="sm" onClick={copyOfferText}>
					<Copy className="h-4 w-4" />
					{copied ? 'Copied' : 'Copy text'}
				</Button>
			</div>

			<div className="mt-4 grid gap-3">
				<OfferInput label="Base lesson price" value={baseLessonPrice} onChange={setBaseLessonPrice} />
				<OfferPackageInputs
					label="3-month package"
					months={threeMonths}
					lessonCount={threeLessonCount}
					packageTotal={threePackageTotal}
					onMonthsChange={setThreeMonths}
					onLessonCountChange={setThreeLessonCount}
					onPackageTotalChange={setThreePackageTotal}
				/>
				<OfferPackageInputs
					label="5-month package"
					months={fiveMonths}
					lessonCount={fiveLessonCount}
					packageTotal={fivePackageTotal}
					onMonthsChange={setFiveMonths}
					onLessonCountChange={setFiveLessonCount}
					onPackageTotalChange={setFivePackageTotal}
				/>
				<Textarea value={offerText} readOnly className="min-h-64 font-mono text-sm leading-6" aria-label="Offer text" />
			</div>
		</section>
	)
}

function OfferPackageInputs({
	label,
	months,
	lessonCount,
	packageTotal,
	onMonthsChange,
	onLessonCountChange,
	onPackageTotalChange,
}: {
	label: string
	months: string
	lessonCount: string
	packageTotal: string
	onMonthsChange: (value: string) => void
	onLessonCountChange: (value: string) => void
	onPackageTotalChange: (value: string) => void
}) {
	const lessonPrice = safeNumber(lessonCount) > 0 ? safeNumber(packageTotal) / safeNumber(lessonCount) : 0

	return (
		<div className="rounded-lg border border-line-soft bg-surface-muted p-3">
			<div className="mb-3 flex items-center justify-between gap-3">
				<p className="text-sm font-semibold text-ink">{label}</p>
				<Badge tone="neutral" className="font-mono tabular-nums">
					{formatUsdAmount(lessonPrice)} / lesson
				</Badge>
			</div>
			<div className="space-y-1">
				<OfferInput label="Months" value={months} onChange={onMonthsChange} />
				<OfferInput label="Lessons" value={lessonCount} onChange={onLessonCountChange} />
				<OfferInput label="Package payment" value={packageTotal} onChange={onPackageTotalChange} />
			</div>
		</div>
	)
}

function OfferInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
	return (
		<div className="grid grid-cols-2 items-center gap-2">
			<Label className="mb-1.5 block text-sm font-medium text-ink-muted">{label}</Label>
			<Input
				type="number"
				inputMode="numeric"
				min="0"
				step="1"
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="bg-surface"
			/>
		</div>
	)
}

function buildOfferText({
	baseLessonPrice,
	packages,
}: {
	baseLessonPrice: string
	packages: { months: string; lessonCount: string; packageTotal: string }[]
}) {
	const basePrice = safeNumber(baseLessonPrice)
	const [threeMonthPackage, fiveMonthPackage] = packages.map((item) => {
		const months = Math.max(Math.floor(safeNumber(item.months)), 0)
		const lessons = Math.max(Math.floor(safeNumber(item.lessonCount)), 0)
		const packageTotal = safeNumber(item.packageTotal)
		const lessonPrice = lessons > 0 ? packageTotal / lessons : 0
		const savings = Math.max(basePrice * lessons - packageTotal, 0)

		return [
			`• при оплате за ${formatMonths(months)} стоимость занятия составляет ${formatRubText(lessonPrice)} рублей`,
			`за ${formatMonths(months)} — ${formatLessons(lessons)} — ${formatRubText(packageTotal)} рублей`,
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
