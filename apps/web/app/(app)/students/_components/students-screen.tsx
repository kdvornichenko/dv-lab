'use client'

import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { UserPlus } from 'lucide-react'

import { Avatar } from '@/components/app/avatar'
import { EmptyLine } from '@/components/app/empty-line'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { LessonsText, MoneyText } from '@/components/app/ledger-text'
import { ReadError } from '@/components/app/read-error'
import { StatusDot } from '@/components/app/status-dot'
import { Button } from '@/components/ui/button'
import { SkeletonTable, SkeletonText } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TabItem, TabPanel, Tabs, TabsList } from '@/components/ui/tabs'
import { apiRequest } from '@/lib/api-client'
import { Elevated } from '@/lib/elevated'
import { cn } from '@/lib/utils'

import type { StudentRow, StudentsResponse } from '@dv-lab/contracts'

type ReadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; students: StudentRow[] }

async function readStudents(): Promise<ReadState> {
	const result = await apiRequest<StudentsResponse>('GET', '/students')
	return result.ok ? { kind: 'ready', students: result.data.students } : { kind: 'error' }
}

const headClass = 'px-4 text-body font-normal text-muted-foreground'
const nameCollator = new Intl.Collator('en', { sensitivity: 'base' })

function byName(left: StudentRow, right: StudentRow) {
	return nameCollator.compare(left.displayName, right.displayName)
}

function StudentsTable({ rows }: { rows: StudentRow[] }) {
	const router = useRouter()
	if (rows.length === 0) return <EmptyLine />
	function open(event: MouseEvent<HTMLTableRowElement>, id: string) {
		if ((event.target as HTMLElement).closest('a')) return
		router.push(`/students/${id}`)
	}
	return (
		<Elevated offset={1} shadowLevel={2} className="w-0 min-w-full overflow-hidden rounded-2xl">
			<Table className="text-body">
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						<TableHead className={headClass}>Student</TableHead>
						<TableHead className={headClass}>Status</TableHead>
						<TableHead className={headClass}>Rate</TableHead>
						<TableHead className={cn(headClass, 'text-right')}>Lessons left</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((student) => {
						const active = student.status === 'active'
						return (
							<TableRow
								key={student.id}
								className="cursor-pointer hover:bg-hover"
								onClick={(event) => open(event, student.id)}
							>
								<TableCell className="px-4 py-2">
									<div className="flex max-w-64 min-w-0 items-center gap-2">
										<Avatar name={student.displayName} />
										<Link
											href={`/students/${student.id}`}
											className={cn(
												'min-w-0 truncate rounded-sm text-body outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
												active ? 'text-foreground' : 'text-muted-foreground'
											)}
										>
											{student.displayName}
										</Link>
									</div>
								</TableCell>
								<TableCell className="px-4 py-2">
									<StatusDot status={student.status} />
								</TableCell>
								<TableCell className="px-4 py-2 text-body tabular-nums">
									{student.rateMinor === null ? (
										<span className="text-muted-foreground">No rate</span>
									) : (
										<>
											<MoneyText amountMinor={student.rateMinor} currency={student.currency} /> / lesson
										</>
									)}
								</TableCell>
								<TableCell className="px-4 py-2 text-right text-body tabular-nums">
									{student.balanceMinutes === null ? (
										<span className="text-muted-foreground">Set opening balance</span>
									) : (
										<LessonsText minutes={student.balanceMinutes} lessonMinutes={student.defaultLessonMinutes} />
									)}
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
	const [state, setState] = useState<ReadState>({ kind: 'loading' })

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

	const students = state.kind === 'ready' ? state.students : null
	const active = useMemo(() => (students ?? []).filter((student) => student.status === 'active').sort(byName), [students])
	const archived = useMemo(
		() => (students ?? []).filter((student) => student.status === 'archived').sort(byName),
		[students]
	)

	let header: ReactNode
	let body: ReactNode
	if (state.kind === 'error') {
		header = <PageHeader title="Students" />
		body = <ReadError screen="students" onRefresh={load} />
	} else {
		const loading = state.kind === 'loading'
		header = (
			<PageHeader
				title="Students"
				description={
					loading ? <SkeletonText className="w-48 py-0.5" /> : `${active.length} active, ${archived.length} archived`
				}
				actions={<Button leadingIcon={UserPlus}>New student</Button>}
			/>
		)
		body = (
			<Tabs defaultValue="active">
				<TabsList aria-label="Student lists">
					<TabItem value="active" label="Active" />
					<TabItem value="archived" label="Archived" />
				</TabsList>
				<TabPanel value="active" className="mt-4">
					{loading ? <SkeletonTable /> : <StudentsTable rows={active} />}
				</TabPanel>
				<TabPanel value="archived" className="mt-4">
					{loading ? <SkeletonTable /> : <StudentsTable rows={archived} />}
				</TabPanel>
			</Tabs>
		)
	}

	return (
		<PageScroll>
			{header}
			{body}
		</PageScroll>
	)
}
