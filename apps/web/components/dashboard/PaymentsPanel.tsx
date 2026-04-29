'use client'

import { useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'

import { enUS } from 'date-fns/locale'
import { ArrowDownToLineIcon, ArrowUpDown, CalendarRange, FilterIcon, Search, Trash2, UserRound, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { FacetedFilter, type FacetedFilterOption } from '@/components/filters/FacetedFilter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrencyAmount } from '@/lib/crm/model'
import { cn } from '@/lib/utils'

import type { Currency, Payment, PaymentMethod, Student, StudentBalance } from '@teacher-crm/api-types'

type PaymentsPanelProps = {
	payments: Payment[]
	students: Student[]
	studentBalances: StudentBalance[]
	now: Date
	onDeletePayment: (paymentId: string) => Promise<void>
	previewMode?: boolean
}

type PaymentStatus = 'paid' | 'open' | 'overdue'
type SortMode = 'date_desc' | 'date_asc' | 'student_asc' | 'student_desc' | 'amount_desc'
type CurrencyFilter = 'all' | Currency

type PaymentRow = {
	payment: Payment
	student?: Student
	balance?: StudentBalance
	currency: Currency
	studentName: string
	issued: Date
	monthKey: string
	monthLabel: string
	status: PaymentStatus
}

const ALL_CURRENCIES = 'all'

const STATUS: Record<PaymentStatus, { label: string; className: string; dot: string }> = {
	paid: {
		label: 'Paid',
		className: 'border-success-line bg-success-soft text-success',
		dot: 'bg-success',
	},
	open: {
		label: 'Open',
		className: 'border-warning-line bg-warning-soft text-warning',
		dot: 'bg-warning',
	},
	overdue: {
		label: 'Overdue',
		className: 'border-danger-line bg-danger-soft text-danger',
		dot: 'bg-danger',
	},
}

function paymentNumber(payment: Payment) {
	return `PAY-${payment.id.slice(-6).toUpperCase()}`
}

function formatDate(value: string | Date) {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: '2-digit',
	}).format(new Date(value))
}

function formatMonth(value: string | Date) {
	return new Intl.DateTimeFormat('en-US', {
		month: 'long',
		year: 'numeric',
	}).format(new Date(value))
}

function formatDateRange(range: DateRange) {
	if (!range.from) return 'Date range'
	if (!range.to) return formatDate(range.from)
	return `${formatDate(range.from)} - ${formatDate(range.to)}`
}

function monthKey(value: Date) {
	return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
}

function methodLabel(value: PaymentMethod) {
	return value.replace('_', ' ')
}

function paymentStatus(balance?: StudentBalance): PaymentStatus {
	if (!balance) return 'paid'
	if (balance.overdue) return 'overdue'
	if (balance.balance > 0) return 'open'
	return 'paid'
}

function paymentRows(payments: Payment[], students: Student[], balances: StudentBalance[]) {
	const studentsById = new Map(students.map((student) => [student.id, student]))
	const balancesByStudentId = new Map(balances.map((balance) => [balance.studentId, balance]))

	return payments.map((payment): PaymentRow => {
		const student = studentsById.get(payment.studentId)
		const balance = balancesByStudentId.get(payment.studentId)
		const issued = new Date(payment.paidAt)
		return {
			payment,
			student,
			balance,
			currency: student?.currency ?? 'RUB',
			studentName: student?.fullName ?? 'Unknown student',
			issued,
			monthKey: monthKey(issued),
			monthLabel: formatMonth(issued),
			status: paymentStatus(balance),
		}
	})
}

function currencyTotals(rows: PaymentRow[]) {
	return rows.reduce(
		(acc, row) => {
			acc[row.currency] = (acc[row.currency] ?? 0) + row.payment.amount
			return acc
		},
		{} as Record<Currency, number>
	)
}

function formatTotals(totals: Record<Currency, number>) {
	const entries = (Object.entries(totals) as [Currency, number][]).filter(([, amount]) => amount > 0)
	if (entries.length === 0) return formatCurrencyAmount(0, 'RUB')
	return entries.map(([currency, amount]) => formatCurrencyAmount(amount, currency)).join(' · ')
}

function sortRows(rows: PaymentRow[], sortMode: SortMode) {
	return [...rows].sort((a, b) => {
		if (sortMode === 'date_asc') return a.issued.getTime() - b.issued.getTime()
		if (sortMode === 'student_asc') return a.studentName.localeCompare(b.studentName)
		if (sortMode === 'student_desc') return b.studentName.localeCompare(a.studentName)
		if (sortMode === 'amount_desc') return b.payment.amount - a.payment.amount
		return b.issued.getTime() - a.issued.getTime()
	})
}

function isWithinDateRange(date: Date, range?: DateRange) {
	if (!range?.from) return true

	const from = new Date(range.from)
	const to = new Date(range.to ?? range.from)
	from.setHours(0, 0, 0, 0)
	to.setHours(23, 59, 59, 999)

	const time = date.getTime()
	return time >= from.getTime() && time <= to.getTime()
}

function paymentInitials(name: string) {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join('')
}

export function PaymentsPanel({
	payments,
	students,
	studentBalances,
	now,
	onDeletePayment,
	previewMode = false,
}: PaymentsPanelProps) {
	const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)
	const [studentFilter, setStudentFilter] = useState<string[]>([])
	const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>(ALL_CURRENCIES)
	const [query, setQuery] = useState('')
	const [sortMode, setSortMode] = useState<SortMode>('date_desc')
	const [dateRange, setDateRange] = useState<DateRange | undefined>()
	const [showFilters, setShowFilters] = useState(true)
	const shouldReduceMotion = useReducedMotion()

	const rows = useMemo(() => paymentRows(payments, students, studentBalances), [payments, studentBalances, students])
	const filteredRows = useMemo(() => {
		const normalizedQuery = query.trim().toLocaleLowerCase()
		return sortRows(
			rows.filter((row) => {
				if (studentFilter.length > 0 && !studentFilter.includes(row.payment.studentId)) return false
				if (currencyFilter !== ALL_CURRENCIES && row.currency !== currencyFilter) return false
				if (!isWithinDateRange(row.issued, dateRange)) return false
				if (!normalizedQuery) return true
				return [
					paymentNumber(row.payment),
					row.studentName,
					row.student?.email,
					row.payment.comment,
					row.payment.method,
				]
					.filter(Boolean)
					.some((value) => value!.toLocaleLowerCase().includes(normalizedQuery))
			}),
			sortMode
		)
	}, [currencyFilter, dateRange, query, rows, sortMode, studentFilter])

	const groupedRows = useMemo(() => {
		const groups = new Map<string, { label: string; rows: PaymentRow[]; totals: Record<Currency, number> }>()
		for (const row of filteredRows) {
			const group = groups.get(row.monthKey) ?? { label: row.monthLabel, rows: [], totals: { RUB: 0, KZT: 0 } }
			group.rows.push(row)
			group.totals[row.currency] += row.payment.amount
			groups.set(row.monthKey, group)
		}
		return Array.from(groups.entries()).map(([key, group]) => ({ key, ...group }))
	}, [filteredRows])

	const allTotals = currencyTotals(rows)
	const filteredTotals = currencyTotals(filteredRows)
	const currentMonthCount = rows.filter(
		(row) => row.issued.getMonth() === now.getMonth() && row.issued.getFullYear() === now.getFullYear()
	).length
	const studentCounts = useMemo(() => {
		return rows.reduce(
			(acc, row) => {
				acc[row.payment.studentId] = (acc[row.payment.studentId] ?? 0) + 1
				return acc
			},
			{} as Record<string, number>
		)
	}, [rows])
	const currencyCounts = useMemo(() => {
		return rows.reduce(
			(acc, row) => {
				acc[row.currency] = (acc[row.currency] ?? 0) + 1
				return acc
			},
			{} as Record<Currency, number>
		)
	}, [rows])
	const studentOptions = useMemo<FacetedFilterOption[]>(
		() =>
			students.map((student) => ({
				value: student.id,
				label: student.fullName,
				count: studentCounts[student.id] ?? 0,
				keywords: [student.email ?? '', student.phone ?? ''].filter(Boolean),
				leading: (
					<span className="grid size-5 place-content-center rounded-full bg-sage-soft font-mono text-[10px] text-sage">
						{paymentInitials(student.fullName) || 'ST'}
					</span>
				),
			})),
		[studentCounts, students]
	)
	const currencyOptions = useMemo<FacetedFilterOption[]>(
		() => [
			{ value: 'RUB', label: 'RUB', count: currencyCounts.RUB ?? 0 },
			{ value: 'KZT', label: 'KZT', count: currencyCounts.KZT ?? 0 },
		],
		[currencyCounts.KZT, currencyCounts.RUB]
	)
	const sortOptions = useMemo<FacetedFilterOption[]>(
		() => [
			{ value: 'date_desc', label: 'Newest first' },
			{ value: 'date_asc', label: 'Oldest first' },
			{ value: 'student_asc', label: 'Student A-Z' },
			{ value: 'student_desc', label: 'Student Z-A' },
			{ value: 'amount_desc', label: 'Highest amount' },
		],
		[]
	)
	const selectedStudents = students.filter((student) => studentFilter.includes(student.id))
	const activeFilters = [
		query.trim() ? { key: 'query', label: `Search: ${query.trim()}`, clear: () => setQuery('') } : null,
		...selectedStudents.map((student) => ({
			key: `student-${student.id}`,
			label: student.fullName,
			clear: () => setStudentFilter((current) => current.filter((id) => id !== student.id)),
		})),
		currencyFilter !== ALL_CURRENCIES
			? { key: 'currency', label: currencyFilter, clear: () => setCurrencyFilter(ALL_CURRENCIES) }
			: null,
		dateRange?.from ? { key: 'date', label: formatDateRange(dateRange), clear: () => setDateRange(undefined) } : null,
		sortMode !== 'date_desc'
			? {
					key: 'sort',
					label:
						sortMode === 'date_asc'
							? 'Oldest first'
							: sortMode === 'student_asc'
								? 'Student A-Z'
								: sortMode === 'student_desc'
									? 'Student Z-A'
									: 'Highest amount',
					clear: () => setSortMode('date_desc' as const),
				}
			: null,
	].filter((filter): filter is { key: string; label: string; clear: () => void } => Boolean(filter))

	function clearFilters() {
		setQuery('')
		setStudentFilter([])
		setCurrencyFilter(ALL_CURRENCIES)
		setDateRange(undefined)
		setSortMode('date_desc')
	}

	async function handleDeletePayment(paymentId: string) {
		setDeletingPaymentId(paymentId)
		try {
			await onDeletePayment(paymentId)
		} finally {
			setDeletingPaymentId((current) => (current === paymentId ? null : current))
		}
	}

	return (
		<section id="payments" className="space-y-4">
			<header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h1 className="font-heading text-xl font-semibold text-ink">Payments</h1>
					<p className="mt-1 text-sm text-ink-muted">
						{filteredRows.length} of {payments.length} · {formatMonth(now)} · {currentMonthCount} this month
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button type="button" size="sm" variant="outline" onClick={() => setShowFilters((current) => !current)}>
						<FilterIcon />
						Filters
						{activeFilters.length > 0 ? (
							<span className="ml-0.5 rounded bg-sage-soft px-1.5 font-mono text-[10px] text-sage">
								{activeFilters.length}
							</span>
						) : null}
					</Button>
					<Button type="button" size="sm" variant="outline" disabled>
						<ArrowDownToLineIcon />
						Export
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onClick={() => setSortMode((current) => (current === 'student_asc' ? 'student_desc' : 'student_asc'))}
					>
						<ArrowUpDown />
						Sort students
					</Button>
				</div>
			</header>

			<motion.div
				initial={false}
				animate={
					shouldReduceMotion
						? { height: showFilters ? 'auto' : 0, opacity: showFilters ? 1 : 0 }
						: {
								height: showFilters ? 'auto' : 0,
								opacity: showFilters ? 1 : 0,
								filter: showFilters ? 'blur(0px)' : 'blur(4px)',
								visibility: showFilters ? 'visible' : 'hidden',
							}
				}
				transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
				aria-hidden={!showFilters}
				className="overflow-hidden"
			>
				<div
					className={cn(
						'grid gap-2 rounded-lg border border-line bg-surface-muted p-2.5 md:grid-cols-[minmax(13rem,1.25fr)_repeat(4,minmax(8rem,0.8fr))]',
						!showFilters && 'pointer-events-none'
					)}
				>
					<div className="relative">
						<Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
						<Input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search payment, student, note"
							className="h-8.5 pl-8 text-xs"
						/>
					</div>
					<FacetedFilter
						label="Student"
						icon={<UserRound className="size-3.5" />}
						mode="multiple"
						value={studentFilter}
						options={studentOptions}
						searchPlaceholder="Search students"
						onValueChange={setStudentFilter}
					/>
					<FacetedFilter
						label="Currency"
						mode="single"
						value={currencyFilter === ALL_CURRENCIES ? [] : [currencyFilter]}
						options={currencyOptions}
						searchPlaceholder="Search currency"
						onValueChange={(value) => setCurrencyFilter((value[0] as CurrencyFilter | undefined) ?? ALL_CURRENCIES)}
						renderOption={(option) => (
							<>
								<span className="grid size-5 place-content-center rounded bg-surface-muted font-mono text-[10px] text-ink-muted">
									{option.label}
								</span>
								<span className="min-w-0 flex-1 truncate">{option.label}</span>
							</>
						)}
					/>
					<DateRangePicker
						range={dateRange}
						onSelect={setDateRange}
						placeholder="Date range"
						locale={enUS}
						fromYear={2020}
						toYear={2035}
						className="h-8.5 w-full px-3 text-xs"
					/>
					<FacetedFilter
						label="Sort"
						icon={<ArrowUpDown className="size-3.5" />}
						mode="single"
						value={[sortMode]}
						active={sortMode !== 'date_desc'}
						options={sortOptions}
						searchPlaceholder="Search sort modes"
						onValueChange={(value) => setSortMode((value[0] as SortMode | undefined) ?? 'date_desc')}
					/>
				</div>
			</motion.div>

			<AnimatePresence initial={false}>
				{activeFilters.length > 0 && (
					<motion.div
						key="payment-filter-chips"
						initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
						animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
						exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
						transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
						className="flex flex-wrap items-center gap-2"
					>
						<span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider text-ink-muted uppercase">
							<CalendarRange className="size-3" />
							Applied
						</span>
						{activeFilters.map((filter) => (
							<motion.button
								key={filter.key}
								type="button"
								layout
								initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
								animate={shouldReduceMotion ? undefined : { opacity: 1, scale: 1 }}
								exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
								transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
								className="inline-flex h-7 items-center gap-1.5 rounded-md border border-sage-line bg-sage-soft px-2.5 font-mono text-[11px] text-sage transition-colors hover:border-sage hover:bg-sage-soft/80"
								onClick={filter.clear}
							>
								{filter.label}
								<X className="size-3" />
							</motion.button>
						))}
						<Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={clearFilters}>
							Clear filters
						</Button>
					</motion.div>
				)}
			</AnimatePresence>

			<motion.div
				layout
				className="overflow-x-auto rounded-lg border border-line bg-card shadow-[0_18px_55px_-44px_var(--shadow-sage)]"
			>
				<Table className="min-w-230">
					<TableHeader>
						<TableRow>
							<TableHead className="ps-4">Payment</TableHead>
							<TableHead>Student</TableHead>
							<TableHead>Issued</TableHead>
							<TableHead>Method</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Balance</TableHead>
							<TableHead className="pe-4 text-right">Amount</TableHead>
							<TableHead className="w-11 pe-4" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{groupedRows.map((group) => (
							<PaymentMonthGroup
								key={group.key}
								label={group.label}
								rows={group.rows}
								totals={group.totals}
								deletingPaymentId={deletingPaymentId}
								previewMode={previewMode}
								onDeletePayment={handleDeletePayment}
							/>
						))}
						{filteredRows.length === 0 && (
							<TableRow>
								<TableCell colSpan={8} className="px-4 py-10 text-center">
									<p className="font-heading text-sm font-semibold text-ink">No payments match these filters</p>
									<p className="mt-1 text-xs text-ink-muted">Clear filters or record a new student payment.</p>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
					<TableFooter>
						<TableRow>
							<TableCell className="ps-4" colSpan={6}>
								Filtered total · All total {formatTotals(allTotals)}
							</TableCell>
							<TableCell className="pe-4 text-right font-mono tabular-nums" colSpan={2}>
								{formatTotals(filteredTotals)}
							</TableCell>
						</TableRow>
					</TableFooter>
				</Table>
			</motion.div>
		</section>
	)
}

function PaymentMonthGroup({
	label,
	rows,
	totals,
	deletingPaymentId,
	previewMode,
	onDeletePayment,
}: {
	label: string
	rows: PaymentRow[]
	totals: Record<Currency, number>
	deletingPaymentId: string | null
	previewMode: boolean
	onDeletePayment: (paymentId: string) => Promise<void>
}) {
	return (
		<>
			<TableRow className="bg-surface-muted hover:bg-surface-muted">
				<TableCell className="ps-4 font-heading text-sm font-semibold text-ink" colSpan={6}>
					{label}
				</TableCell>
				<TableCell className="pe-4 text-right font-mono text-sm font-semibold tabular-nums" colSpan={2}>
					{formatTotals(totals)}
				</TableCell>
			</TableRow>
			{rows.map((row) => (
				<PaymentTableRow
					key={row.payment.id}
					row={row}
					deletingPaymentId={deletingPaymentId}
					previewMode={previewMode}
					onDeletePayment={onDeletePayment}
				/>
			))}
		</>
	)
}

function PaymentTableRow({
	row,
	deletingPaymentId,
	previewMode,
	onDeletePayment,
}: {
	row: PaymentRow
	deletingPaymentId: string | null
	previewMode: boolean
	onDeletePayment: (paymentId: string) => Promise<void>
}) {
	const status = STATUS[row.status]
	return (
		<TableRow>
			<TableCell className="ps-4 font-mono text-sm text-ink">{paymentNumber(row.payment)}</TableCell>
			<TableCell>
				<div className="font-medium text-ink">{row.studentName}</div>
				<div className="text-xs text-ink-muted">{row.student?.email || row.payment.comment || 'No email'}</div>
			</TableCell>
			<TableCell className="font-mono text-sm text-ink-muted tabular-nums">{formatDate(row.issued)}</TableCell>
			<TableCell className="text-ink-muted capitalize">{methodLabel(row.payment.method)}</TableCell>
			<TableCell>
				<Badge variant="outline" className={cn('gap-1.5', status.className)}>
					<span className={cn('size-1.5 rounded-full', status.dot)} />
					{status.label}
				</Badge>
			</TableCell>
			<TableCell className="text-right font-mono text-sm text-ink-muted tabular-nums">
				{row.balance ? formatCurrencyAmount(row.balance.balance, row.currency) : '-'}
			</TableCell>
			<TableCell className="pe-4 text-right font-mono text-ink tabular-nums">
				{formatCurrencyAmount(row.payment.amount, row.currency)}
			</TableCell>
			<TableCell className="pe-4 text-right">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="text-ink-muted hover:bg-danger-soft hover:text-danger"
							aria-label={`Delete payment for ${row.studentName}`}
							disabled={previewMode || deletingPaymentId === row.payment.id}
							onClick={() => void onDeletePayment(row.payment.id).catch(() => undefined)}
						>
							<Trash2 className="h-4 w-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent sideOffset={6}>Delete payment</TooltipContent>
				</Tooltip>
			</TableCell>
		</TableRow>
	)
}
