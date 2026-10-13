'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'

import { UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Avatar } from '@/components/app/avatar'
import { useCalendarRefresh } from '@/components/app/calendar-command-provider'
import { EmptyLine } from '@/components/app/empty-line'
import { NextLessonTime } from '@/components/app/google-calendar-state'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { MoneyText } from '@/components/app/ledger-text'
import { ReadError } from '@/components/app/read-error'
import { StatusDot } from '@/components/app/status-dot'
import { StudentBalance } from '@/components/app/student-balance'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
	Skeleton,
	SkeletonAvatar,
	SkeletonCount,
	SkeletonLine,
	SkeletonTable,
	SkeletonText,
	type SkeletonTableColumn,
} from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TabItem, TabPanel, Tabs, TabsList } from '@/components/ui/tabs'
import { apiRequest } from '@/lib/api-client'
import { Elevated } from '@/lib/elevated'
import { yearInZone } from '@/lib/schedule-format'
import { cn } from '@/lib/utils'

import type { StudentRow, StudentsResponse } from '@dv-lab/contracts'

import { StudentFormDialog } from './student-form-dialog'
import { UnassignedPayments, UnassignedPaymentsSkeleton } from './unassigned-payments'

type ReadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: StudentsResponse }

async function readStudents(): Promise<ReadState> {
	const result = await apiRequest<StudentsResponse>('GET', '/students')
	return result.ok ? { kind: 'ready', data: result.data } : { kind: 'error' }
}

const headClass = 'px-4 text-body font-normal text-muted-foreground'
const studentColumns: SkeletonTableColumn[] = [
	{
		title: 'Student',
		cell: (
			<div className="flex items-center gap-2">
				<SkeletonAvatar />
				<Skeleton className="h-3 w-21" />
			</div>
		),
	},
	{ title: 'Status', cell: <Skeleton className="size-2 rounded-full" /> },
	{ title: 'Rate', cell: <SkeletonLine className="w-16" /> },
	{
		title: 'Balance',
		cell: (
			<div className="flex h-5 items-center gap-2">
				<Skeleton className="size-2 shrink-0 rounded-full" />
				<Skeleton className="h-3 w-22" />
			</div>
		),
	},
	{
		title: 'Next lesson',
		cellClassName: 'py-1',
		cell: (
			<div className="flex flex-col">
				<SkeletonLine className="w-32" />
				<SkeletonLine box="h-3.5" className="h-2.5 w-16" />
			</div>
		),
	},
]
const nameCollator = new Intl.Collator('en', { sensitivity: 'base' })

function byName(left: StudentRow, right: StudentRow) {
	return nameCollator.compare(left.displayName, right.displayName)
}

function matchesQuery(student: StudentRow, query: string) {
	const text = query.trim().toLowerCase()
	return text === '' || student.displayName.toLowerCase().includes(text)
}

function StudentsTable({ rows, searching, data }: { rows: StudentRow[]; searching: boolean; data: StudentsResponse }) {
	const router = useRouter()
	const { defaultTimeZone: mainTimeZone, asOf, paysSoonLessons: threshold } = data
	const [zone] = useSecondZone(mainTimeZone)
	if (rows.length === 0) return searching ? <EmptyLine text="No students found" /> : <EmptyLine />
	const currentYear = yearInZone(new Date(asOf), mainTimeZone)
	function open(event: MouseEvent<HTMLTableRowElement>, id: string) {
		if ((event.target as HTMLElement).closest('a')) return
		router.push(`/students/${id}`)
	}
	return (
		<Elevated offset={1} shadowLevel={2} className="w-0 min-w-full overflow-hidden rounded-2xl">
			<Table className="text-body">
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						{studentColumns.map((column, index) => (
							<TableHead key={index} className={headClass}>
								{column.title}
							</TableHead>
						))}
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
								<TableCell className="px-4 py-2 text-body">
									<StudentBalance
										dot
										minutes={student.balanceMinutes}
										lessonMinutes={student.defaultLessonMinutes}
										threshold={threshold}
									/>
								</TableCell>
								<TableCell className="px-4 py-1 text-body tabular-nums">
									<NextLessonTime
										next={student.nextLesson}
										timeZone={mainTimeZone}
										secondZone={zone}
										currentYear={currentYear}
									/>
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
	const [createOpen, setCreateOpen] = useState(false)
	const [tab, setTab] = useState('active')
	const [query, setQuery] = useState('')
	const createButton = useRef<HTMLButtonElement>(null)
	const requests = useRef(0)

	const load = useCallback(async () => {
		const id = ++requests.current
		const next = await readStudents()
		if (id === requests.current) setState(next)
	}, [])

	useCalendarRefresh(load)

	useEffect(() => {
		const counter = requests
		void load()
		return () => {
			counter.current++
		}
	}, [load])

	const students = state.kind === 'ready' ? state.data.students : null
	const active = useMemo(
		() => (students ?? []).filter((student) => student.status === 'active').sort(byName),
		[students]
	)
	const archived = useMemo(
		() => (students ?? []).filter((student) => student.status === 'archived').sort(byName),
		[students]
	)
	const shownActive = useMemo(() => active.filter((student) => matchesQuery(student, query)), [active, query])
	const shownArchived = useMemo(() => archived.filter((student) => matchesQuery(student, query)), [archived, query])
	const searching = query.trim() !== ''

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
				actions={
					<div className="flex flex-wrap gap-2">
						<Button variant="secondary" onClick={() => void load()}>
							Refresh
						</Button>
						<Button ref={createButton} leadingIcon={UserPlus} onClick={() => setCreateOpen(true)}>
							New student
						</Button>
					</div>
				}
			/>
		)
		body = (
			<Tabs value={tab} onValueChange={setTab}>
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
					<div className="flex min-w-0 rounded-xl bg-muted md:w-fit md:flex-none">
						<TabsList
							aria-label="Student lists"
							className="scroll-fade-x bg-transparent [--scroll-fade-size:var(--scroll-fade-size-compact)] max-md:min-w-0 max-md:flex-1 max-md:overflow-x-auto"
						>
							<TabItem value="active" label="Active" />
							<TabItem value="archived" label="Archived" />
							<TabItem
								value="unassigned"
								label={
									state.kind === 'ready' ? (
										`Unassigned payments (${state.data.unassignedPayments})`
									) : (
										<>
											Unassigned payments (<SkeletonCount />)
										</>
									)
								}
							/>
						</TabsList>
					</div>
					{tab === 'unassigned' ? null : (
						<Input
							type="search"
							aria-label="Search students"
							placeholder="Search students"
							autoComplete="off"
							className="w-full lg:ml-auto lg:max-w-72 lg:min-w-0 lg:flex-1"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
						/>
					)}
				</div>
				<TabPanel value="active" className="mt-4">
					{loading ? (
						<SkeletonTable columns={studentColumns} />
					) : (
						<StudentsTable rows={shownActive} searching={searching} data={state.data} />
					)}
				</TabPanel>
				<TabPanel value="archived" className="mt-4">
					{loading ? (
						<SkeletonTable columns={studentColumns} />
					) : (
						<StudentsTable rows={shownArchived} searching={searching} data={state.data} />
					)}
				</TabPanel>
				<TabPanel value="unassigned" className="mt-4">
					{loading ? (
						<UnassignedPaymentsSkeleton />
					) : (
						<UnassignedPayments students={active} onChanged={() => void load()} />
					)}
				</TabPanel>
			</Tabs>
		)
	}

	return (
		<PageScroll>
			{header}
			{body}
			{createOpen ? (
				<StudentFormDialog
					mode="create"
					onClose={() => {
						setCreateOpen(false)
						requestAnimationFrame(() => createButton.current?.focus())
					}}
					onSaved={() => {
						setCreateOpen(false)
						void load()
					}}
				/>
			) : null}
		</PageScroll>
	)
}
