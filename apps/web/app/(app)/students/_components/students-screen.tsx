'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { UserPlus } from 'lucide-react'

import { Avatar } from '@/components/app/avatar'
import { EmptyLine } from '@/components/app/empty-line'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { ReadError } from '@/components/app/read-error'
import { StatusDot } from '@/components/app/status-dot'
import { Button } from '@/components/ui/button'
import { SkeletonTable, SkeletonText } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TabItem, TabPanel, Tabs, TabsList } from '@/components/ui/tabs'
import { apiRequest } from '@/lib/api-client'
import { Elevated } from '@/lib/elevated'
import { cn } from '@/lib/utils'

import type { StudentListResponse, StudentAccount } from '@dv-lab/contracts'

import { useToast } from '../../_components/toasts'
import { CreateStudentDialog } from './create-student-dialog'
import { DeactivateStudentDialog } from './deactivate-student-dialog'

type ReadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; students: StudentAccount[] }

const createdFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

async function readStudents(): Promise<ReadState> {
	const result = await apiRequest<StudentListResponse>('GET', '/students')
	return result.ok ? { kind: 'ready', students: result.data.students } : { kind: 'error' }
}

const headClass = 'px-4 text-body font-normal text-muted-foreground'

function StudentsTable({
	rows,
	onDeactivate,
}: {
	rows: StudentAccount[]
	onDeactivate: (student: StudentAccount) => void
}) {
	if (rows.length === 0) return <EmptyLine />
	return (
		<Elevated offset={1} shadowLevel={2} className="w-0 min-w-full overflow-hidden rounded-2xl">
			<Table className="text-body">
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						<TableHead className={headClass}>Student</TableHead>
						<TableHead className={headClass}>Login</TableHead>
						<TableHead className={headClass}>Status</TableHead>
						<TableHead className={headClass}>Created</TableHead>
						<TableHead className={headClass}>
							<span className="sr-only">Actions</span>
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((student) => {
						const active = student.status === 'active'
						return (
							<TableRow key={student.id} className="hover:bg-transparent">
								<TableCell className="px-4 py-2">
									<div className="flex max-w-64 min-w-0 items-center gap-2">
										<Avatar name={student.displayName} />
										<span
											className={cn('min-w-0 truncate text-body', active ? 'text-foreground' : 'text-muted-foreground')}
										>
											{student.displayName}
										</span>
									</div>
								</TableCell>
								<TableCell className="px-4 py-2 text-body">{student.login}</TableCell>
								<TableCell className="px-4 py-2">
									<StatusDot status={student.status} />
								</TableCell>
								<TableCell className="px-4 py-2 text-body tabular-nums">
									{createdFormat.format(new Date(student.createdAt))}
								</TableCell>
								<TableCell className="px-4 py-2 text-right">
									{active ? (
										<Button
											variant="ghost"
											size="compact"
											aria-label={`Deactivate ${student.displayName}`}
											onClick={() => onDeactivate(student)}
										>
											Deactivate
										</Button>
									) : null}
								</TableCell>
							</TableRow>
						)
					})}
				</TableBody>
			</Table>
		</Elevated>
	)
}

export function StudentsScreen() {
	const toast = useToast()
	const [state, setState] = useState<ReadState>({ kind: 'loading' })
	const [createOpen, setCreateOpen] = useState(false)
	const [deactivating, setDeactivating] = useState<StudentAccount | null>(null)

	const load = useCallback(async () => {
		setState(await readStudents())
	}, [])

	useEffect(() => {
		let current = true
		void readStudents().then((next) => {
			if (current) setState(next)
		})
		return () => {
			current = false
		}
	}, [])

	const createButton = (
		<Button leadingIcon={UserPlus} onClick={() => setCreateOpen(true)}>
			Create student account
		</Button>
	)

	let header: ReactNode
	let body: ReactNode
	if (state.kind === 'error') {
		header = <PageHeader title="Students" />
		body = <ReadError screen="students" onRefresh={load} />
	} else {
		const loading = state.kind === 'loading'
		const active = loading ? [] : state.students.filter((student) => student.status === 'active')
		const deactivated = loading ? [] : state.students.filter((student) => student.status === 'deactivated')
		header = (
			<PageHeader
				title="Students"
				description={
					loading ? (
						<SkeletonText className="w-48 py-0.5" />
					) : (
						`${active.length} active, ${deactivated.length} deactivated`
					)
				}
				actions={createButton}
			/>
		)
		body = (
			<Tabs defaultValue="active">
				<TabsList aria-label="Account status">
					<TabItem value="active" label="Active" />
					<TabItem value="deactivated" label="Deactivated" />
				</TabsList>
				<TabPanel value="active" className="mt-4">
					{loading ? <SkeletonTable /> : <StudentsTable rows={active} onDeactivate={setDeactivating} />}
				</TabPanel>
				<TabPanel value="deactivated" className="mt-4">
					{loading ? <SkeletonTable /> : <StudentsTable rows={deactivated} onDeactivate={setDeactivating} />}
				</TabPanel>
			</Tabs>
		)
	}

	return (
		<PageScroll>
			{header}
			{body}
			{createOpen ? (
				<CreateStudentDialog
					onClose={() => setCreateOpen(false)}
					onFinished={(student, revealed) => {
						setCreateOpen(false)
						if (!revealed) {
							toast.show({
								title: 'Account created',
								description: `${student.displayName} can sign in with the login ${student.login}.`,
							})
						}
						void load()
					}}
				/>
			) : null}
			{deactivating ? (
				<DeactivateStudentDialog
					student={deactivating}
					onClose={() => setDeactivating(null)}
					onDeactivated={(student) => {
						setDeactivating(null)
						toast.show({
							title: 'Account deactivated',
							description: `${student.displayName} is signed out on every device.`,
						})
						void load()
					}}
				/>
			) : null}
		</PageScroll>
	)
}
