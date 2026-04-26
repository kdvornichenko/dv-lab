import { useMemo, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'

import { Archive, Banknote, Plus, Search, Settings } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatUsdAmount, selectStudentLedgerProjection, STUDENT_FILTER_OPTIONS } from '@/lib/crm/model'
import { studentSettingsPath } from '@/lib/crm/student-route-id'
import type { StudentWithBalance } from '@/lib/crm/types'

import { type AttendanceRecord, type CreateStudentInput, type Lesson } from '@teacher-crm/api-types'

import { StudentFormDialog } from './StudentFormDialog'

type StudentsPanelProps = {
	visibleStudents: StudentWithBalance[]
	lessons: Lesson[]
	attendance: AttendanceRecord[]
	filter: 'all' | StudentWithBalance['status']
	now: Date
	onFilterChange: (value: 'all' | StudentWithBalance['status']) => void
	onAddStudent: (input: CreateStudentInput) => Promise<void>
	onArchiveStudent: (studentId: string) => Promise<void>
	onRecordPayment: (studentId: string) => Promise<void>
}

export function StudentsPanel({
	visibleStudents,
	lessons,
	attendance,
	filter,
	now,
	onFilterChange,
	onAddStudent,
	onArchiveStudent,
	onRecordPayment,
}: StudentsPanelProps) {
	const [search, setSearch] = useState('')
	const [isCreateOpen, setIsCreateOpen] = useState(false)

	const query = search.trim().toLowerCase()
	const studentIds = visibleStudents.map((student) => student.id)
	const filteredStudents = useMemo(
		() =>
			visibleStudents.filter((student) => {
				if (!query) return true
				return [student.fullName, student.email, student.phone, student.level, student.notes]
					.filter(Boolean)
					.some((value) => String(value).toLowerCase().includes(query))
			}),
		[query, visibleStudents]
	)

	return (
		<section id="students" className="grid gap-5">
			<div className="rounded-lg border border-line bg-surface p-4 shadow-[0_18px_55px_-44px_var(--shadow-sage)]">
				<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
					<div>
						<p className="font-mono text-xs font-semibold text-sage uppercase">Student ledger</p>
						<h2 className="mt-1 text-lg font-semibold text-ink">Students, packages, and payments</h2>
						<p className="mt-1 text-sm text-ink-muted">Select a student record, then use the action buttons.</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Badge tone="neutral" className="h-8 px-3 font-mono tabular-nums">
							{filteredStudents.length}/{visibleStudents.length} visible
						</Badge>
						<Button size="sm" onClick={() => setIsCreateOpen(true)}>
							<Plus className="h-4 w-4" />
							Add student
						</Button>
					</div>
				</div>

				<div className="mt-4 grid gap-3 rounded-lg border border-line-soft bg-surface-muted p-3 md:grid-cols-[minmax(0,1fr)_12rem]">
					<div className="relative">
						<Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-muted" />
						<Input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search students"
							className="bg-surface pl-10"
							aria-label="Search students"
						/>
					</div>
					<Select value={filter} onValueChange={(value) => onFilterChange(value as typeof filter)}>
						<SelectTrigger aria-label="Filter students by status" className="bg-surface">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{STUDENT_FILTER_OPTIONS.map((item) => (
								<SelectItem key={item} value={item}>
									{item}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			<ScrollArea className="max-h-[calc(100dvh-16rem)] pr-3">
				<div className="grid gap-3">
					{filteredStudents.map((student) => (
						<StudentLedgerItem
							key={student.id}
							student={student}
							lessons={lessons}
							attendance={attendance}
							now={now}
							settingsHref={studentSettingsPath(student.id, studentIds)}
							onRecordPayment={() => onRecordPayment(student.id)}
							onArchive={() => onArchiveStudent(student.id)}
						/>
					))}
					{filteredStudents.length === 0 && (
						<div className="rounded-lg border border-dashed border-line-strong bg-surface-muted p-8 text-center">
							<p className="font-semibold text-ink">No students match this ledger view</p>
							<p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
								Add a student or clear the search to bring the ledger back.
							</p>
							<Button className="mt-4" size="sm" onClick={() => setIsCreateOpen(true)}>
								<Plus className="h-4 w-4" />
								Add student
							</Button>
						</div>
					)}
				</div>
			</ScrollArea>

			<StudentFormDialog
				open={isCreateOpen}
				mode="create"
				onOpenChange={setIsCreateOpen}
				onSubmit={async (input) => {
					await onAddStudent(input)
					setIsCreateOpen(false)
				}}
			/>
		</section>
	)
}

function StudentLedgerItem({
	student,
	lessons,
	attendance,
	now,
	settingsHref,
	onRecordPayment,
	onArchive,
}: {
	student: StudentWithBalance
	lessons: Lesson[]
	attendance: AttendanceRecord[]
	now: Date
	settingsHref: string
	onRecordPayment: () => void
	onArchive: () => void
}) {
	const projection = selectStudentLedgerProjection(student, lessons, attendance, now)
	const contact = student.email || student.phone || 'No contact'

	return (
		<article className="rounded-lg border border-line bg-surface p-3 shadow-[0_14px_42px_-38px_var(--shadow-sage)]">
			<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
				<Link
					href={settingsHref}
					className="group min-w-0 rounded-lg text-left focus-visible:ring-[3px] focus-visible:ring-ring/35 focus-visible:outline-none"
				>
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="min-w-0">
							<p className="truncate font-semibold text-ink">{student.fullName}</p>
							<p className="mt-1 truncate text-xs text-ink-muted">{contact}</p>
						</div>
						<div className="flex flex-wrap gap-1.5">
							<Badge tone={projection.statusTone}>{student.status}</Badge>
							<Badge tone={projection.balanceTone} className="font-mono tabular-nums">
								{formatUsdAmount(student.balance.balance)}
							</Badge>
						</div>
					</div>
					<div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
						<StudentMetric label="Rate" value={formatUsdAmount(student.defaultLessonPrice)} />
						<StudentMetric label="Plan" value={projection.plan} />
						<StudentMetric label="Package" value={projection.lessonsLeft} />
						<StudentMetric label="Next payment" value={projection.nextPayment} />
					</div>
					<p className="mt-3 text-xs font-semibold text-sage group-hover:underline">Open settings</p>
				</Link>

				<div className="flex flex-wrap justify-end gap-1.5">
					<StudentIconLink label={`Open settings for ${student.fullName}`} href={settingsHref} variant="ghost">
						<Settings className="h-4 w-4" />
					</StudentIconLink>
					<StudentIconButton
						label={`Record payment for ${student.fullName}`}
						onClick={onRecordPayment}
						variant="secondary"
					>
						<Banknote className="h-4 w-4" />
					</StudentIconButton>
					<StudentIconButton
						label={`Archive ${student.fullName}`}
						onClick={onArchive}
						variant="ghost"
						disabled={student.status === 'archived'}
					>
						<Archive className="h-4 w-4" />
					</StudentIconButton>
				</div>
			</div>
		</article>
	)
}

function StudentMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border border-line-soft bg-surface-muted p-2.5">
			<p className="text-xs font-medium text-ink-muted">{label}</p>
			<p className="mt-1 truncate font-mono text-xs font-semibold text-ink tabular-nums">{value}</p>
		</div>
	)
}

function StudentIconButton({
	label,
	children,
	...props
}: Omit<ComponentProps<typeof Button>, 'size' | 'aria-label'> & {
	label: string
	children: ReactNode
}) {
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

function StudentIconLink({
	label,
	href,
	children,
	...props
}: Omit<ComponentProps<typeof Button>, 'size' | 'aria-label'> & {
	label: string
	href: string
	children: ReactNode
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button size="icon" aria-label={label} asChild {...props}>
					<Link href={href}>{children}</Link>
				</Button>
			</TooltipTrigger>
			<TooltipContent sideOffset={6}>{label}</TooltipContent>
		</Tooltip>
	)
}
