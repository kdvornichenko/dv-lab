'use client'

import { useMemo, useState } from 'react'

import { ArrowDownToLineIcon, ArrowUpDown, FilterIcon, Search, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
type SortMode = 'date_desc' | 'student_asc' | 'student_desc' | 'amount_desc'
type CurrencyFilter = 'all' | Currency
type MethodFilter = 'all' | PaymentMethod

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

const ALL_STUDENTS = 'all'
const ALL_CURRENCIES = 'all'
const ALL_METHODS = 'all'

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
		if (sortMode === 'student_asc') return a.studentName.localeCompare(b.studentName)
		if (sortMode === 'student_desc') return b.studentName.localeCompare(a.studentName)
		if (sortMode === 'amount_desc') return b.payment.amount - a.payment.amount
		return b.issued.getTime() - a.issued.getTime()
	})
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
	const [studentFilter, setStudentFilter] = useState(ALL_STUDENTS)
	const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>(ALL_CURRENCIES)
	const [methodFilter, setMethodFilter] = useState<MethodFilter>(ALL_METHODS)
	const [query, setQuery] = useState('')
	const [sortMode, setSortMode] = useState<SortMode>('date_desc')
	const [showFilters, setShowFilters] = useState(true)

	const rows = useMemo(() => paymentRows(payments, students, studentBalances), [payments, studentBalances, students])
	const filteredRows = useMemo(() => {
		const normalizedQuery = query.trim().toLocaleLowerCase()
		return sortRows(
			rows.filter((row) => {
				if (studentFilter !== ALL_STUDENTS && row.payment.studentId !== studentFilter) return false
				if (currencyFilter !== ALL_CURRENCIES && row.currency !== currencyFilter) return false
				if (methodFilter !== ALL_METHODS && row.payment.method !== methodFilter) return false
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
	}, [currencyFilter, methodFilter, query, rows, sortMode, studentFilter])

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
						Filter
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

			{showFilters && (
				<div className="grid gap-2 rounded-lg border border-line bg-surface-muted p-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
					<div className="relative">
						<Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted" />
						<Input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search payment, student, note"
							className="pl-9"
						/>
					</div>
					<Select value={studentFilter} onValueChange={setStudentFilter}>
						<SelectTrigger>
							<SelectValue placeholder="Student" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL_STUDENTS}>All students</SelectItem>
							{students.map((student) => (
								<SelectItem key={student.id} value={student.id}>
									{student.fullName}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select value={currencyFilter} onValueChange={(value) => setCurrencyFilter(value as CurrencyFilter)}>
						<SelectTrigger>
							<SelectValue placeholder="Currency" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL_CURRENCIES}>All currencies</SelectItem>
							<SelectItem value="RUB">RUB</SelectItem>
							<SelectItem value="KZT">KZT</SelectItem>
						</SelectContent>
					</Select>
					<Select value={methodFilter} onValueChange={(value) => setMethodFilter(value as MethodFilter)}>
						<SelectTrigger>
							<SelectValue placeholder="Method" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL_METHODS}>All methods</SelectItem>
							<SelectItem value="cash">Cash</SelectItem>
							<SelectItem value="bank_transfer">Bank transfer</SelectItem>
							<SelectItem value="card">Card</SelectItem>
							<SelectItem value="other">Other</SelectItem>
						</SelectContent>
					</Select>
					<Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
						<SelectTrigger>
							<SelectValue placeholder="Sort" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="date_desc">Newest first</SelectItem>
							<SelectItem value="student_asc">Student A-Z</SelectItem>
							<SelectItem value="student_desc">Student Z-A</SelectItem>
							<SelectItem value="amount_desc">Highest amount</SelectItem>
						</SelectContent>
					</Select>
				</div>
			)}

			<div className="overflow-x-auto rounded-lg border border-line bg-card shadow-[0_18px_55px_-44px_var(--shadow-sage)]">
				<Table className="min-w-[920px]">
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
			</div>
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
