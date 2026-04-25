import { useMemo, useState } from 'react'

import { Archive, Banknote, Edit3, Plus, Search, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import type { AttendanceRecord, CreateStudentInput, Lesson, UpdateStudentInput } from '@teacher-crm/api-types'

import { StudentFormDialog } from './StudentFormDialog'
import { StudentProfilePane } from './StudentProfilePane'
import { formatMoney } from './model'
import type { StudentWithBalance } from './types'

type StudentsPanelProps = {
	students: StudentWithBalance[]
	allStudents: StudentWithBalance[]
	lessons: Lesson[]
	attendance: AttendanceRecord[]
	filter: 'all' | StudentWithBalance['status']
	onFilterChange: (value: 'all' | StudentWithBalance['status']) => void
	onAddStudent: (input: CreateStudentInput) => Promise<void>
	onUpdateStudent: (studentId: string, input: UpdateStudentInput) => Promise<void>
	onArchiveStudent: (studentId: string) => Promise<void>
	onRecordPayment: (studentId: string) => Promise<void>
}

export function StudentsPanel({
	students,
	allStudents,
	lessons,
	attendance,
	filter,
	onFilterChange,
	onAddStudent,
	onUpdateStudent,
	onArchiveStudent,
	onRecordPayment,
}: StudentsPanelProps) {
	const [search, setSearch] = useState('')
	const [profileStudentId, setProfileStudentId] = useState<string | null>(null)
	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const [editingStudent, setEditingStudent] = useState<StudentWithBalance | null>(null)

	const query = search.trim().toLowerCase()
	const filteredStudents = useMemo(
		() =>
			students.filter((student) => {
				if (!query) return true
				return [student.fullName, student.email, student.phone, student.level, student.notes]
					.filter(Boolean)
					.some((value) => String(value).toLowerCase().includes(query))
			}),
		[query, students]
	)
	const activeProfileStudent =
		(profileStudentId ? allStudents.find((student) => student.id === profileStudentId) : null) ??
		filteredStudents[0] ??
		null

	return (
		<Card id="students">
			<CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<CardTitle>Students</CardTitle>
				<Button size="sm" onClick={() => setIsCreateOpen(true)}>
					<Plus className="h-4 w-4" />
					Add
				</Button>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
						<Input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search students"
							className="pl-9"
							aria-label="Search students"
						/>
					</div>
					<Select value={filter} onValueChange={(value) => onFilterChange(value as typeof filter)}>
						<SelectTrigger aria-label="Filter students by status">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{(['all', 'active', 'paused', 'archived'] as const).map((item) => (
								<SelectItem key={item} value={item}>
									{item}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
					<div className="overflow-x-auto">
						<table className="w-full min-w-[780px] table-fixed text-left text-sm">
							<thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
								<tr>
									<th className="w-[25%] py-2 font-medium">Name</th>
									<th className="w-[12%] py-2 font-medium">Level</th>
									<th className="w-[14%] py-2 font-medium">Status</th>
									<th className="w-[16%] py-2 font-medium">Billing</th>
									<th className="w-[13%] py-2 font-medium">Balance</th>
									<th className="w-[20%] py-2 text-right font-medium">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-zinc-100">
								{filteredStudents.map((student) => (
									<tr key={student.id}>
										<td className="py-3">
											<div className="font-medium text-zinc-950">{student.fullName}</div>
											<div className="truncate text-xs text-zinc-500">
												{student.email || student.phone || 'No contact'}
											</div>
										</td>
										<td className="py-3 text-zinc-700">{student.level || '-'}</td>
										<td className="py-3">
											<Badge
												tone={student.status === 'active' ? 'green' : student.status === 'paused' ? 'amber' : 'neutral'}
											>
												{student.status}
											</Badge>
										</td>
										<td className="py-3 text-zinc-700">
											<div>{formatMoney(student.defaultLessonPrice)}</div>
											<div className="text-xs text-zinc-500">{student.billingMode.replace('_', ' ')}</div>
										</td>
										<td className="py-3">
											<Badge tone={student.balance.overdue ? 'red' : 'green'}>
												{formatMoney(student.balance.balance)}
											</Badge>
										</td>
										<td className="py-3">
											<div className="flex justify-end gap-2">
												<Button
													size="icon"
													variant="ghost"
													aria-label={`Show profile for ${student.fullName}`}
													onClick={() => setProfileStudentId(student.id)}
												>
													<UserRound className="h-4 w-4" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													aria-label={`Edit ${student.fullName}`}
													onClick={() => setEditingStudent(student)}
												>
													<Edit3 className="h-4 w-4" />
												</Button>
												<Button
													size="icon"
													variant="secondary"
													aria-label={`Record payment for ${student.fullName}`}
													onClick={() => onRecordPayment(student.id)}
												>
													<Banknote className="h-4 w-4" />
												</Button>
												<Button
													size="icon"
													variant="ghost"
													aria-label={`Archive ${student.fullName}`}
													onClick={() => onArchiveStudent(student.id)}
													disabled={student.status === 'archived'}
												>
													<Archive className="h-4 w-4" />
												</Button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
						{filteredStudents.length === 0 && (
							<div className="border-t border-zinc-100 py-8 text-center text-sm text-zinc-500">No students found</div>
						)}
					</div>

					<StudentProfilePane student={activeProfileStudent} lessons={lessons} attendance={attendance} />
				</div>
			</CardContent>

			<StudentFormDialog
				open={isCreateOpen}
				mode="create"
				onOpenChange={setIsCreateOpen}
				onSubmit={async (input) => {
					await onAddStudent(input)
					setIsCreateOpen(false)
				}}
			/>
			<StudentFormDialog
				open={Boolean(editingStudent)}
				mode="edit"
				student={editingStudent}
				onOpenChange={(open) => {
					if (!open) setEditingStudent(null)
				}}
				onSubmit={async (input) => {
					if (!editingStudent) return
					await onUpdateStudent(editingStudent.id, input)
					setEditingStudent(null)
				}}
			/>
		</Card>
	)
}
