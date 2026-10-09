'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { UserPlus } from 'lucide-react'

import { Avatar } from '@/components/app/avatar'
import { EmptyLine } from '@/components/app/empty-line'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { ReadError } from '@/components/app/read-error'
import { Button } from '@/components/ui/button'
import { SkeletonTable, SkeletonText } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip } from '@/components/ui/tooltip'
import { apiRequest } from '@/lib/api-client'
import { Elevated } from '@/lib/elevated'
import { cn } from '@/lib/utils'

import type { AccountStatus, StudentListResponse, StudentRow } from '@dv-lab/contracts'

import { CreateStudentDialog } from './create-student-dialog'

type ReadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; students: StudentRow[] }

const createdFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

function StatusDot({ status }: { status: AccountStatus }) {
	const label = status === 'active' ? 'Active' : 'Deactivated'
	return (
		<Tooltip content={label}>
			<span
				role="img"
				aria-label={label}
				className={cn(
					"relative inline-block size-2 rounded-full before:absolute before:-inset-2 before:content-['']",
					status === 'active' ? 'bg-success' : 'bg-muted-foreground'
				)}
			/>
		</Tooltip>
	)
}

function StudentsTable({ rows }: { rows: StudentRow[] }) {
	if (rows.length === 0) return <EmptyLine />
	return (
		<Elevated offset={1} shadowLevel={2} className="overflow-hidden rounded-2xl">
			<Table className="text-body">
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						<TableHead className="px-4 text-body font-normal text-muted-foreground">Student</TableHead>
						<TableHead className="px-4 text-body font-normal text-muted-foreground">Login</TableHead>
						<TableHead className="px-4 text-body font-normal text-muted-foreground">Status</TableHead>
						<TableHead className="px-4 text-body font-normal text-muted-foreground">Created</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((student) => (
						<TableRow key={student.id} className="hover:bg-transparent">
							<TableCell className="px-4 py-2">
								<div className="flex min-w-0 items-center gap-2">
									<Avatar name={student.displayName} />
									<span className="min-w-0 truncate text-body text-foreground">{student.displayName}</span>
								</div>
							</TableCell>
							<TableCell className="px-4 py-2 text-body">{student.login}</TableCell>
							<TableCell className="px-4 py-2">
								<StatusDot status={student.status} />
							</TableCell>
							<TableCell className="px-4 py-2 text-body tabular-nums">
								{createdFormat.format(new Date(student.createdAt))}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</Elevated>
	)
}

async function readStudents(): Promise<ReadState> {
	const result = await apiRequest<StudentListResponse>('GET', '/students')
	return result.ok ? { kind: 'ready', students: result.data.students } : { kind: 'error' }
}

export function StudentsScreen() {
	const [state, setState] = useState<ReadState>({ kind: 'loading' })
	const [createOpen, setCreateOpen] = useState(false)

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
	} else if (state.kind === 'loading') {
		header = <PageHeader title="Students" description={<SkeletonText className="w-48" />} actions={createButton} />
		body = <SkeletonTable />
	} else {
		const active = state.students.filter((student) => student.status === 'active')
		const deactivated = state.students.length - active.length
		header = (
			<PageHeader
				title="Students"
				description={`${active.length} active, ${deactivated} deactivated`}
				actions={createButton}
			/>
		)
		body = <StudentsTable rows={active} />
	}

	return (
		<PageScroll>
			{header}
			{body}
			{createOpen ? (
				<CreateStudentDialog
					onClose={() => setCreateOpen(false)}
					onFinished={() => {
						setCreateOpen(false)
						void load()
					}}
				/>
			) : null}
		</PageScroll>
	)
}
