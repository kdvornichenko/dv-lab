import { useMemo, useState } from 'react'

import { Archive, Banknote, Edit3, Plus, Search, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatUsdAmount, selectStudentLedgerProjection, STUDENT_FILTER_OPTIONS } from '@/lib/crm/model'
import type { StudentWithBalance } from '@/lib/crm/types'

import type { AttendanceRecord, CreateStudentInput, Lesson, UpdateStudentInput } from '@teacher-crm/api-types'

import { StudentFormDialog } from './StudentFormDialog'
import { StudentProfilePane } from './StudentProfilePane'

type StudentsPanelProps = {
	visibleStudents: StudentWithBalance[]
	profileStudents: StudentWithBalance[]
	lessons: Lesson[]
	attendance: AttendanceRecord[]
	filter: 'all' | StudentWithBalance['status']
	now: Date
	onFilterChange: (value: 'all' | StudentWithBalance['status']) => void
	onAddStudent: (input: CreateStudentInput) => Promise<void>
	onUpdateStudent: (studentId: string, input: UpdateStudentInput) => Promise<void>
	onArchiveStudent: (studentId: string) => Promise<void>
	onRecordPayment: (studentId: string) => Promise<void>
}

export function StudentsPanel({
	visibleStudents,
	profileStudents,
	lessons,
	attendance,
	filter,
	now,
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
			visibleStudents.filter((student) => {
				if (!query) return true
				return [student.fullName, student.email, student.phone, student.level, student.notes]
					.filter(Boolean)
					.some((value) => String(value).toLowerCase().includes(query))
			}),
		[query, visibleStudents]
	)
	const activeProfileStudent =
		(profileStudentId ? profileStudents.find((student) => student.id === profileStudentId) : null) ??
		filteredStudents[0] ??
		null

	return (
		<Card id="students" className="border-line bg-surface rounded-lg shadow-none">
			<CardHeader className="border-line-soft flex flex-col gap-3 border-b lg:flex-row lg:items-center lg:justify-between">
				<div>
					<CardTitle className="text-ink text-base">Student ledger</CardTitle>
					<p className="text-ink-muted mt-1 text-sm">Balances, billing mode, and next payment attention.</p>
				</div>
				<Button size="sm" onClick={() => setIsCreateOpen(true)}>
					<Plus className="h-4 w-4" />
					Add student
				</Button>
			</CardHeader>
			<CardContent className="space-y-4 pt-4">
				<div className="grid gap-3 md:flex">
					<div className="relative md:flex-1">
						<Search className="text-ink-muted pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
						<Input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search students"
							className="border-line-strong bg-surface-muted pl-9"
							aria-label="Search students"
						/>
					</div>
					<Select value={filter} onValueChange={(value) => onFilterChange(value as typeof filter)}>
						<SelectTrigger
							aria-label="Filter students by status"
							className="border-line-strong bg-surface-muted md:w-47.5"
						>
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

				<div className="grid gap-4 xl:flex xl:items-start">
					<div className="border-line min-w-0 rounded-lg border xl:flex-1">
						<ScrollArea className="w-full">
							<div className="min-w-270">
								<Table>
									<TableHeader>
										<TableRow className="border-line bg-surface-muted hover:bg-surface-muted">
											<TableHead className="w-52.5 text-ink-muted text-xs uppercase">Student</TableHead>
											<TableHead className="w-22.5 text-ink-muted text-xs uppercase">Level</TableHead>
											<TableHead className="w-32.5 text-ink-muted text-xs uppercase">Billing mode</TableHead>
											<TableHead className="w-37.5 text-ink-muted text-xs uppercase">Package plan</TableHead>
											<TableHead className="w-30 text-ink-muted text-xs uppercase">Lessons left</TableHead>
											<TableHead className="w-35 text-ink-muted text-xs uppercase">Next payment</TableHead>
											<TableHead className="w-30 text-ink-muted text-xs uppercase">Balance</TableHead>
											<TableHead className="w-25 text-ink-muted text-xs uppercase">Status</TableHead>
											<TableHead className="w-37.5 text-ink-muted text-right text-xs uppercase">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredStudents.map((student) => {
											const projection = selectStudentLedgerProjection(student, lessons, attendance, now)
											return (
												<TableRow
													key={student.id}
													className="border-line-soft hover:bg-surface-muted h-12 cursor-pointer transition-[background-color] duration-150"
													onClick={() => setProfileStudentId(student.id)}
												>
													<TableCell>
														<div className="text-ink font-medium">{student.fullName}</div>
														<div className="text-ink-muted truncate text-xs">
															{student.email || student.phone || 'No contact'}
														</div>
													</TableCell>
													<TableCell className="text-ink">{student.level || '-'}</TableCell>
													<TableCell className="text-ink capitalize">{projection.billingLabel}</TableCell>
													<TableCell className="text-ink-muted">{projection.plan}</TableCell>
													<TableCell className="text-ink font-mono text-xs tabular-nums">
														{projection.lessonsLeft}
													</TableCell>
													<TableCell className="text-ink-muted font-mono text-xs tabular-nums">
														{projection.nextPayment}
													</TableCell>
													<TableCell>
														<Badge tone={projection.balanceTone} className="font-mono tabular-nums">
															{formatUsdAmount(student.balance.balance)}
														</Badge>
													</TableCell>
													<TableCell>
														<Badge tone={projection.statusTone}>{student.status}</Badge>
													</TableCell>
													<TableCell onClick={(event) => event.stopPropagation()}>
														<div className="flex justify-end gap-1.5">
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
													</TableCell>
												</TableRow>
											)
										})}
									</TableBody>
								</Table>
								{filteredStudents.length === 0 && (
									<div className="border-line-soft bg-surface-muted text-ink-muted border-t py-8 text-center text-sm">
										No students match this ledger view.
									</div>
								)}
							</div>
							<ScrollBar orientation="horizontal" className="z-10" />
						</ScrollArea>
					</div>

					<div className="xl:w-80 xl:shrink-0">
						<StudentProfilePane student={activeProfileStudent} lessons={lessons} attendance={attendance} now={now} />
					</div>
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
