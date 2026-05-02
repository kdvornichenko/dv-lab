'use client'

import { type FC, useState } from 'react'

import { Archive, ArrowLeft, Banknote, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { OfferTextComposer } from '@/components/students/OfferTextComposer'
import { PaymentFormDialog } from '@/components/students/PaymentFormDialog'
import { StudentFormDialog } from '@/components/students/StudentFormDialog'
import { StudentProfilePane } from '@/components/students/StudentProfilePane'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTeacherCrm } from '@/hooks/useTeacherCrm'
import { findStudentByRouteId } from '@/lib/crm/student-route-id'

import type { StudentSettingsClientProps } from './StudentSettingsClient.types'

export const StudentSettingsClient: FC<StudentSettingsClientProps> = ({ studentId }) => {
	const router = useRouter()
	const crm = useTeacherCrm()
	const [isEditOpen, setIsEditOpen] = useState(false)
	const [isPaymentOpen, setIsPaymentOpen] = useState(false)
	const student = findStudentByRouteId(crm.studentRows, studentId)
	const now = new Date()

	async function deleteStudent() {
		if (!student) return
		if (!window.confirm(`Delete ${student.fullName}? This removes the student and related database rows.`)) return
		await crm.deleteStudent(student.id)
		router.push('/students')
	}

	if (crm.isLoading) return <StudentSettingsSkeleton />

	if (!student) {
		return (
			<main className="min-h-full p-unit">
				<section className="rounded-lg border border-line bg-surface p-6">
					<Button asChild variant="ghost" size="sm">
						<Link href="/students">
							<ArrowLeft className="h-4 w-4" />
							Students
						</Link>
					</Button>
					<h1 className="mt-4 text-xl font-semibold text-ink">Student not found</h1>
					<p className="mt-1 text-sm text-ink-muted">
						The student may have been deleted or belongs to another teacher.
					</p>
				</section>
			</main>
		)
	}

	return (
		<main className="min-h-full p-unit">
			<div className="mx-auto w-full space-y-5">
				<header className="rounded-lg border border-line bg-surface p-4 shadow-[0_18px_55px_-46px_var(--shadow-sage)]">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="min-w-0">
							<Button asChild variant="ghost" size="sm" className="-ml-2">
								<Link href="/students">
									<ArrowLeft className="h-4 w-4" />
									Students
								</Link>
							</Button>
							<p className="mt-3 font-mono text-xs font-semibold text-sage uppercase">Student settings</p>
							<h1 data-private className="mt-1 truncate text-2xl font-semibold text-ink">
								{student.fullName}
							</h1>
							<div className="mt-2 flex flex-wrap gap-2">
								<Badge tone={student.status === 'active' ? 'green' : student.status === 'paused' ? 'amber' : 'neutral'}>
									{student.status}
								</Badge>
								<Badge tone="neutral" className="font-mono tabular-nums">
									{studentId}
								</Badge>
							</div>
						</div>
						<div className="flex flex-wrap justify-end gap-2">
							<Button type="button" variant="secondary" onClick={() => setIsEditOpen(true)}>
								<Pencil className="h-4 w-4" />
								Edit
							</Button>
							<Button type="button" variant="secondary" onClick={() => setIsPaymentOpen(true)}>
								<Banknote className="h-4 w-4" />
								Record payment
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={student.status === 'archived'}
								onClick={() => void crm.archiveStudent(student.id)}
							>
								<Archive className="h-4 w-4" />
								Archive
							</Button>
							<Button type="button" variant="destructive" onClick={() => void deleteStudent()}>
								<Trash2 className="h-4 w-4" />
								Delete
							</Button>
						</div>
					</div>
				</header>

				<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_28rem] xl:items-start">
					<StudentProfilePane student={student} lessons={crm.state.lessons} now={now} />
					<OfferTextComposer />
				</div>
			</div>

			<StudentFormDialog
				open={isEditOpen}
				mode="edit"
				student={student}
				onOpenChange={setIsEditOpen}
				onSubmit={async (input) => {
					await crm.updateStudent(student.id, input)
					setIsEditOpen(false)
				}}
			/>
			<PaymentFormDialog
				open={isPaymentOpen}
				student={student}
				onOpenChange={setIsPaymentOpen}
				onSubmit={crm.recordPayment}
			/>
		</main>
	)
}

const StudentSettingsSkeleton: FC = () => {
	return (
		<main className="min-h-full p-unit">
			<div className="grid content-start gap-5">
				<Skeleton className="h-36 rounded-lg" />
				<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_28rem]">
					<Skeleton className="h-96 rounded-lg" />
					<Skeleton className="h-96 rounded-lg" />
				</div>
			</div>
		</main>
	)
}
