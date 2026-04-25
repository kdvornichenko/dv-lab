import { Archive, Banknote, Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { formatMoney } from './model'
import type { StudentWithBalance } from './types'

type StudentsPanelProps = {
	students: StudentWithBalance[]
	filter: 'all' | StudentWithBalance['status']
	onFilterChange: (value: 'all' | StudentWithBalance['status']) => void
	onAddStudent: () => void
	onArchiveStudent: (studentId: string) => void
	onRecordPayment: (studentId: string) => void
}

export function StudentsPanel({
	students,
	filter,
	onFilterChange,
	onAddStudent,
	onArchiveStudent,
	onRecordPayment,
}: StudentsPanelProps) {
	return (
		<Card id="students">
			<CardHeader className="flex flex-row items-center justify-between gap-3">
				<CardTitle>Students</CardTitle>
				<Button size="sm" onClick={onAddStudent}>
					<Plus className="h-4 w-4" />
					Add
				</Button>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="flex flex-wrap gap-2">
					{(['all', 'active', 'paused', 'archived'] as const).map((item) => (
						<Button
							key={item}
							type="button"
							size="sm"
							variant={filter === item ? 'primary' : 'secondary'}
							onClick={() => onFilterChange(item)}
						>
							{item}
						</Button>
					))}
				</div>

				<div className="overflow-x-auto">
					<table className="w-full min-w-[680px] table-fixed text-left text-sm">
						<thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
							<tr>
								<th className="w-[26%] py-2 font-medium">Name</th>
								<th className="w-[14%] py-2 font-medium">Level</th>
								<th className="w-[16%] py-2 font-medium">Status</th>
								<th className="w-[18%] py-2 font-medium">Balance</th>
								<th className="w-[26%] py-2 text-right font-medium">Actions</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-zinc-100">
							{students.map((student) => (
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
									<td className="py-3">
										<Badge tone={student.balance.overdue ? 'red' : 'green'}>
											{formatMoney(student.balance.balance)}
										</Badge>
									</td>
									<td className="py-3">
										<div className="flex justify-end gap-2">
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
				</div>
			</CardContent>
		</Card>
	)
}
