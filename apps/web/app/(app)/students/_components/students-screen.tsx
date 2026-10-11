'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'

import { UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Avatar } from '@/components/app/avatar'
import { EmptyLine } from '@/components/app/empty-line'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { MoneyText } from '@/components/app/ledger-text'
import { ReadError } from '@/components/app/read-error'
import { StatusDot } from '@/components/app/status-dot'
import { StudentBalance } from '@/components/app/student-balance'
import { TimePair } from '@/components/app/time-pair'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SkeletonTable, SkeletonText } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TabItem, TabPanel, Tabs, TabsList } from '@/components/ui/tabs'
import { apiRequest } from '@/lib/api-client'
import { Elevated } from '@/lib/elevated'
import { formatWhen, secondWhen, yearInZone } from '@/lib/schedule-format'
import { cn } from '@/lib/utils'

import type { SettingsResponse, StudentRow, StudentsResponse } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE } from '@dv-lab/core'

import { StudentFormDialog } from './student-form-dialog'
import { UnassignedPayments } from './unassigned-payments'

type ReadState =
	| { kind: 'loading' }
	| { kind: 'error' }
	| { kind: 'ready'; students: StudentRow[]; unassigned: number; threshold: number }

async function readStudents(): Promise<ReadState> {
	const [students, settings] = await Promise.all([
		apiRequest<StudentsResponse>('GET', '/students'),
		apiRequest<SettingsResponse>('GET', '/settings'),
	])
	if (!students.ok || !settings.ok) return { kind: 'error' }
	return {
		kind: 'ready',
		students: students.data.students,
		unassigned: students.data.unassignedPayments,
		threshold: settings.data.settings.paysSoonLessons,
	}
}

const headClass = 'px-4 text-body font-normal text-muted-foreground'
const nameCollator = new Intl.Collator('en', { sensitivity: 'base' })

function byName(left: StudentRow, right: StudentRow) {
	return nameCollator.compare(left.displayName, right.displayName)
}

function matchesQuery(student: StudentRow, query: string) {
	const text = query.trim().toLowerCase()
	return text === '' || student.displayName.toLowerCase().includes(text)
}

function NextLesson({ at, zone, currentYear }: { at: Date; zone: string | null; currentYear: number }) {
	const second = secondWhen(at, zone)
	return <TimePair main={formatWhen(at, SCHEDULE_TIME_ZONE, currentYear)} second={second} />
}

function StudentsTable({ rows, searching, threshold }: { rows: StudentRow[]; searching: boolean; threshold: number }) {
	const router = useRouter()
	const [zone] = useSecondZone()
	if (rows.length === 0) return searching ? <EmptyLine text="No students found" /> : <EmptyLine />
	const currentYear = yearInZone(new Date())
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
						<TableHead className={headClass}>Balance</TableHead>
						<TableHead className={headClass}>Next lesson</TableHead>
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
									{student.nextLessonAt === null ? (
										<span className="text-muted-foreground">None</span>
									) : (
										<NextLesson at={new Date(student.nextLessonAt)} zone={zone} currentYear={currentYear} />
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
	const [createOpen, setCreateOpen] = useState(false)
	const [tab, setTab] = useState('active')
	const [query, setQuery] = useState('')
	const createButton = useRef<HTMLButtonElement>(null)

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
	const threshold = state.kind === 'ready' ? state.threshold : 0
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
					<Button ref={createButton} leadingIcon={UserPlus} onClick={() => setCreateOpen(true)}>
						New student
					</Button>
				}
			/>
		)
		body = (
			<Tabs value={tab} onValueChange={setTab}>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div className="flex min-w-0 rounded-xl bg-muted">
						<TabsList
							aria-label="Student lists"
							className="scroll-fade-x bg-transparent [--scroll-fade-size:var(--scroll-fade-size-compact)] max-sm:min-w-0 max-sm:flex-1 max-sm:overflow-x-auto"
						>
							<TabItem value="active" label="Active" />
							<TabItem value="archived" label="Archived" />
							<TabItem
								value="unassigned"
								label={state.kind === 'ready' ? `Unassigned payments (${state.unassigned})` : 'Unassigned payments'}
							/>
						</TabsList>
					</div>
					{tab === 'unassigned' ? null : (
						<Input
							type="search"
							aria-label="Search students"
							placeholder="Search students"
							autoComplete="off"
							className="w-full sm:w-72"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
						/>
					)}
				</div>
				<TabPanel value="active" className="mt-4">
					{loading ? (
						<SkeletonTable />
					) : (
						<StudentsTable rows={shownActive} searching={searching} threshold={threshold} />
					)}
				</TabPanel>
				<TabPanel value="archived" className="mt-4">
					{loading ? (
						<SkeletonTable />
					) : (
						<StudentsTable rows={shownArchived} searching={searching} threshold={threshold} />
					)}
				</TabPanel>
				<TabPanel value="unassigned" className="mt-4">
					{loading ? <SkeletonTable /> : <UnassignedPayments students={active} onChanged={() => void load()} />}
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
