import { useMemo, useState } from 'react'

import { Archive, Banknote, Edit3, Plus, Search, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import type { AttendanceRecord, CreateStudentInput, Lesson, UpdateStudentInput } from '@teacher-crm/api-types'

import { StudentFormDialog } from './StudentFormDialog'
import { StudentProfilePane } from './StudentProfilePane'
import { formatUsdAmount, selectStudentLedgerProjection, STUDENT_FILTER_OPTIONS } from './model'
import type { StudentWithBalance } from './types'

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
		<Card id="students" className="rounded-lg border-[#E6E0D4] bg-white shadow-none">
			<CardHeader className="flex flex-col gap-3 border-b border-[#EFE8DC] lg:flex-row lg:items-center lg:justify-between">
				<div>
					<CardTitle className="text-base text-[#181713]">Student ledger</CardTitle>
					<p className="mt-1 text-sm text-[#6F6B63]">Balances, billing mode, and next payment attention.</p>
				</div>
				<Button size="sm" onClick={() => setIsCreateOpen(true)}>
					<Plus className="h-4 w-4" />
					Add student
				</Button>
			</CardHeader>
			<CardContent className="space-y-4 pt-4">
				<div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_190px]">
					<div className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6F6B63]" />
						<Input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search students"
							className="border-[#D8D0C2] bg-[#FBFAF6] pl-9"
							aria-label="Search students"
						/>
					</div>
					<Select value={filter} onValueChange={(value) => onFilterChange(value as typeof filter)}>
						<SelectTrigger aria-label="Filter students by status" className="border-[#D8D0C2] bg-[#FBFAF6]">
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

				<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
					<div className="min-w-0 rounded-lg border border-[#E6E0D4]">
						<ScrollArea className="w-full">
							<div className="min-w-[1080px]">
								<Table>
									<TableHeader>
										<TableRow className="border-[#E6E0D4] bg-[#FBFAF6] hover:bg-[#FBFAF6]">
											<TableHead className="w-[210px] text-xs uppercase text-[#6F6B63]">Student</TableHead>
											<TableHead className="w-[90px] text-xs uppercase text-[#6F6B63]">Level</TableHead>
											<TableHead className="w-[130px] text-xs uppercase text-[#6F6B63]">Billing mode</TableHead>
											<TableHead className="w-[150px] text-xs uppercase text-[#6F6B63]">Package plan</TableHead>
											<TableHead className="w-[120px] text-xs uppercase text-[#6F6B63]">Lessons left</TableHead>
											<TableHead className="w-[140px] text-xs uppercase text-[#6F6B63]">Next payment</TableHead>
											<TableHead className="w-[120px] text-xs uppercase text-[#6F6B63]">Balance</TableHead>
											<TableHead className="w-[100px] text-xs uppercase text-[#6F6B63]">Status</TableHead>
											<TableHead className="w-[150px] text-right text-xs uppercase text-[#6F6B63]">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filteredStudents.map((student) => {
											const projection = selectStudentLedgerProjection(student, lessons, attendance, now)
											return (
												<TableRow
													key={student.id}
													className="h-12 cursor-pointer border-[#EFE8DC] transition-[background-color] duration-150 hover:bg-[#FBFAF6]"
													onClick={() => setProfileStudentId(student.id)}
												>
													<TableCell>
														<div className="font-medium text-[#181713]">{student.fullName}</div>
														<div className="truncate text-xs text-[#6F6B63]">
															{student.email || student.phone || 'No contact'}
														</div>
													</TableCell>
													<TableCell className="text-[#181713]">{student.level || '-'}</TableCell>
													<TableCell className="capitalize text-[#181713]">{projection.billingLabel}</TableCell>
													<TableCell className="text-[#6F6B63]">{projection.plan}</TableCell>
													<TableCell className="font-mono text-xs tabular-nums text-[#181713]">
														{projection.lessonsLeft}
													</TableCell>
													<TableCell className="font-mono text-xs tabular-nums text-[#6F6B63]">
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
									<div className="border-t border-[#EFE8DC] bg-[#FBFAF6] py-8 text-center text-sm text-[#6F6B63]">
										No students match this ledger view.
									</div>
								)}
							</div>
							<ScrollBar orientation="horizontal" className="z-10" />
						</ScrollArea>
					</div>

					<StudentProfilePane student={activeProfileStudent} lessons={lessons} attendance={attendance} now={now} />
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
