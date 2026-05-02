import { type FC, useMemo, useState } from 'react'

import { Plus, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { STUDENT_FILTER_OPTIONS } from '@/lib/crm/model'
import { studentSettingsPath } from '@/lib/crm/student-route-id'
import type { StudentWithBalance } from '@/lib/crm/types'

import { PaymentFormDialog } from './PaymentFormDialog'
import { StudentLedgerItem } from './StudentLedgerItem'
import { StudentFormDialog } from './StudentFormDialog'
import type { StudentsPanelProps } from './StudentsPanel.types'

export const StudentsPanel: FC<StudentsPanelProps> = ({
	visibleStudents,
	lessons,
	filter,
	now,
	onFilterChange,
	onAddStudent,
	onArchiveStudent,
	onRecordPayment,
	previewMode = false,
}) => {
	const [search, setSearch] = useState('')
	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const [paymentStudent, setPaymentStudent] = useState<StudentWithBalance | null>(null)

	const query = search.trim().toLowerCase()
	const studentIds = visibleStudents.map((student) => student.id)
	const filteredStudents = useMemo(
		() =>
			visibleStudents.filter((student) => {
				if (!query) return true
				return [student.firstName, student.lastName, student.fullName, student.level, student.special, student.notes]
					.filter(Boolean)
					.some((value) => String(value).toLowerCase().includes(query))
			}),
		[query, visibleStudents]
	)

	return (
		<section id="students" className="grid gap-5">
			<div className="border-line bg-surface rounded-lg border p-4 shadow-[0_18px_55px_-44px_var(--shadow-sage)]">
				<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
					<div>
						<p className="text-sage font-mono text-xs font-semibold uppercase">Student ledger</p>
						<h2 className="text-ink mt-1 text-lg font-semibold">Students, packages, and payments</h2>
						<p className="text-ink-muted mt-1 text-sm">Select a student record, then use the action buttons.</p>
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

				<div className="border-line-soft bg-surface-muted mt-4 grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_12rem]">
					<div className="relative">
						<Search className="text-ink-muted pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
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

			<div className="grid gap-3">
				{filteredStudents.map((student) => (
					<StudentLedgerItem
						key={student.id}
						student={student}
						lessons={lessons}
						now={now}
						settingsHref={studentSettingsPath(student.id, studentIds)}
						onRecordPayment={() => setPaymentStudent(student)}
						onArchive={() => onArchiveStudent(student.id)}
						previewMode={previewMode}
					/>
				))}
				{filteredStudents.length === 0 && (
					<div className="border-line-strong bg-surface-muted rounded-lg border border-dashed p-8 text-center">
						<p className="font-heading text-ink font-semibold">No students match this ledger view</p>
						<p className="text-ink-muted mx-auto mt-1 max-w-sm text-sm">
							Add a student or clear the search to bring the ledger back.
						</p>
						<Button className="mt-4" size="sm" onClick={() => setIsCreateOpen(true)}>
							<Plus className="h-4 w-4" />
							Add student
						</Button>
					</div>
				)}
			</div>

			<StudentFormDialog
				open={isCreateOpen}
				mode="create"
				onOpenChange={setIsCreateOpen}
				onSubmit={async (input) => {
					await onAddStudent(input)
					setIsCreateOpen(false)
				}}
			/>
			<PaymentFormDialog
				open={Boolean(paymentStudent)}
				student={paymentStudent}
				onOpenChange={(open) => {
					if (!open) setPaymentStudent(null)
				}}
				onSubmit={onRecordPayment}
			/>
		</section>
	)
}
