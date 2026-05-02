'use client'

import { useMemo, useRef, useState } from 'react'
import type { FC } from 'react'
import type { DateRange } from 'react-day-picker'

import { enUS } from 'date-fns/locale'
import { ArrowDownToLineIcon, ArrowUpDown, CalendarRange, FilterIcon, Search, Trash2, UserRound, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { toast } from 'sonner'

import { FacetedFilter, type FacetedFilterOption } from '@/components/filters/FacetedFilter'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrencyAmount } from '@/lib/crm/model'
import {
	ALL_CURRENCIES,
	PAYMENT_STATUS,
	currentMonthPaymentCount,
	currencyTotals,
	filterPaymentRows,
	formatPaymentDate,
	formatPaymentDateRange,
	formatPaymentMonth,
	formatPaymentTotals,
	groupPaymentRows,
	paymentCurrencyCounts,
	paymentInitials,
	paymentMethodLabel,
	paymentNumber,
	paymentRows,
	paymentStudentCounts,
	type CurrencyFilter,
	type SortMode,
} from '@/lib/crm/payments-model'
import { cn } from '@/lib/utils'

import type {
	ActivePaymentFilter,
	PaymentMonthGroupProps,
	PaymentsPanelProps,
	PaymentTableRowProps,
} from './PaymentsPanel.types'

export const PaymentsPanel: FC<PaymentsPanelProps> = ({
	payments,
	students,
	studentBalances,
	now,
	onDeletePayment,
	previewMode = false,
}) => {
	const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)
	const [studentFilter, setStudentFilter] = useState<string[]>([])
	const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>(ALL_CURRENCIES)
	const [query, setQuery] = useState('')
	const [sortMode, setSortMode] = useState<SortMode>('date_desc')
	const [dateRange, setDateRange] = useState<DateRange | undefined>()
	const [showFilters, setShowFilters] = useState(true)
	const deletingPaymentIdsRef = useRef(new Set<string>())
	const shouldReduceMotion = useReducedMotion()

	const rows = useMemo(() => paymentRows(payments, students, studentBalances), [payments, studentBalances, students])
	const filteredRows = useMemo(
		() => filterPaymentRows(rows, { studentFilter, currencyFilter, dateRange, query, sortMode }),
		[currencyFilter, dateRange, query, rows, sortMode, studentFilter]
	)
	const groupedRows = useMemo(() => groupPaymentRows(filteredRows), [filteredRows])

	const filteredTotals = currencyTotals(filteredRows)
	const currentMonthCount = currentMonthPaymentCount(rows, now)
	const studentCounts = useMemo(() => paymentStudentCounts(rows), [rows])
	const currencyCounts = useMemo(() => paymentCurrencyCounts(rows), [rows])
	const studentOptions = useMemo<FacetedFilterOption[]>(
		() =>
			students.map((student) => ({
				value: student.id,
				label: student.fullName,
				count: studentCounts[student.id] ?? 0,
				keywords: [student.email ?? '', student.phone ?? ''].filter(Boolean),
				leading: (
					<span className="bg-sage-soft text-sage grid size-5 place-content-center rounded-full font-mono text-[10px]">
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
		dateRange?.from
			? { key: 'date', label: formatPaymentDateRange(dateRange), clear: () => setDateRange(undefined) }
			: null,
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
	].filter((filter): filter is ActivePaymentFilter => Boolean(filter))

	function clearFilters() {
		setQuery('')
		setStudentFilter([])
		setCurrencyFilter(ALL_CURRENCIES)
		setDateRange(undefined)
		setSortMode('date_desc')
	}

	async function handleDeletePayment(paymentId: string) {
		if (deletingPaymentIdsRef.current.has(paymentId)) return
		const row = rows.find((item) => item.payment.id === paymentId)
		if (!previewMode && row && !window.confirm(`Delete ${paymentNumber(row.payment)} for ${row.studentName}?`)) return
		deletingPaymentIdsRef.current.add(paymentId)
		setDeletingPaymentId(paymentId)
		try {
			await onDeletePayment(paymentId)
		} catch (error) {
			toast.error('Payment delete failed', {
				description: error instanceof Error ? error.message : 'Unable to delete payment',
			})
		} finally {
			deletingPaymentIdsRef.current.delete(paymentId)
			setDeletingPaymentId((current) => (current === paymentId ? null : current))
		}
	}

	return (
		<section id="payments" className="space-y-4">
			<header data-pet-target className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h1 className="font-heading text-ink text-xl font-semibold">Payments</h1>
					<p className="text-ink-muted mt-1 text-sm">
						{filteredRows.length} of {payments.length} · {formatPaymentMonth(now)} · {currentMonthCount} this month
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Button type="button" size="sm" variant="outline" onClick={() => setShowFilters((current) => !current)}>
						<FilterIcon />
						Filters
						{activeFilters.length > 0 ? (
							<span className="bg-sage-soft text-sage ml-0.5 rounded px-1.5 font-mono text-[10px]">
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
				inert={showFilters ? undefined : true}
				className="overflow-hidden"
			>
				<div
					className={cn(
						'border-line bg-surface-muted grid gap-2 rounded-lg border p-2.5 md:grid-cols-[minmax(4rem,0.6fr)_repeat(4,minmax(8rem,0.8fr))]',
						!showFilters && 'pointer-events-none'
					)}
				>
					<div className="relative">
						<Search className="text-ink-muted pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
						<Input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search payment, student, note"
							className="h-8.5 pl-8 text-xs"
						/>
					</div>
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
								<span className="bg-surface-muted text-ink-muted grid size-5 place-content-center rounded font-mono text-[10px]">
									{option.label}
								</span>
								<span className="min-w-0 flex-1 truncate">{option.label}</span>
							</>
						)}
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
						<span className="text-ink-muted inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider">
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
								className="border-sage-line bg-sage-soft text-sage hover:border-sage hover:bg-sage-soft/80 inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[11px] transition-colors"
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
				className="border-line bg-card rounded-lg border shadow-[0_18px_55px_-44px_var(--shadow-sage)]"
			>
				<ScrollArea className="w-full">
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
										<p className="font-heading text-ink text-sm font-semibold">No payments match these filters</p>
										<p className="text-ink-muted mt-1 text-xs">Clear filters or record a new student payment.</p>
									</TableCell>
								</TableRow>
							)}
						</TableBody>
						<TableFooter>
							<TableRow>
								<TableCell className="ps-4" colSpan={6}></TableCell>
								<TableCell className="pe-4 text-right font-mono tabular-nums" colSpan={2}>
									{formatPaymentTotals(filteredTotals)}
								</TableCell>
							</TableRow>
						</TableFooter>
					</Table>
				</ScrollArea>
			</motion.div>
		</section>
	)
}

const PaymentMonthGroup: FC<PaymentMonthGroupProps> = ({
	label,
	rows,
	totals,
	deletingPaymentId,
	previewMode,
	onDeletePayment,
}) => {
	return (
		<>
			<TableRow data-private className="bg-surface-muted hover:bg-surface-muted">
				<TableCell className="font-heading text-ink ps-4 text-sm font-semibold" colSpan={6}>
					{label}
				</TableCell>
				<TableCell className="pe-4 text-right font-mono text-sm font-semibold tabular-nums" colSpan={2}>
					{formatPaymentTotals(totals)}
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

const PaymentTableRow: FC<PaymentTableRowProps> = ({ row, deletingPaymentId, previewMode, onDeletePayment }) => {
	const status = PAYMENT_STATUS[row.status]
	return (
		<TableRow data-private>
			<TableCell className="text-ink ps-4 font-mono text-sm">{paymentNumber(row.payment)}</TableCell>
			<TableCell>
				<div className="text-ink font-medium">{row.studentName}</div>
				<div className="text-ink-muted text-xs">{row.student?.email || row.payment.comment || 'No email'}</div>
			</TableCell>
			<TableCell className="text-ink-muted font-mono text-sm tabular-nums">{formatPaymentDate(row.issued)}</TableCell>
			<TableCell className="text-ink-muted capitalize">{paymentMethodLabel(row.payment.method)}</TableCell>
			<TableCell>
				<Badge variant="outline" className={cn('gap-1.5', status.className)}>
					<span className={cn('size-1.5 rounded-full', status.dot)} />
					{status.label}
				</Badge>
			</TableCell>
			<TableCell className="text-ink-muted text-right font-mono text-sm tabular-nums">
				{row.balance ? formatCurrencyAmount(row.balance.balance, row.balance.currency) : '-'}
			</TableCell>
			<TableCell className="text-ink pe-4 text-right font-mono tabular-nums">
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
							onClick={() => void onDeletePayment(row.payment.id)}
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
