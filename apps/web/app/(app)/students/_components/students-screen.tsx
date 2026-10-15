'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'

import { ArrowDown, ArrowUp, ArrowUpDown, ListFilter, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
	debounce,
	parseAsArrayOf,
	parseAsString,
	parseAsStringLiteral,
	useQueryStates,
	type UseQueryStatesKeysMap,
} from 'nuqs'

import { Avatar } from '@/components/app/avatar'
import { useCalendarRefresh } from '@/components/app/calendar-command-provider'
import { EmptyLine } from '@/components/app/empty-line'
import { EmptyState } from '@/components/app/empty-state'
import { NextLessonTime } from '@/components/app/google-calendar-state'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { MoneyText } from '@/components/app/ledger-text'
import { ReadError } from '@/components/app/read-error'
import { useAttentionClock } from '@/components/app/status-dot'
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

import { CURRENCIES, type StudentRow, type StudentsResponse } from '@dv-lab/contracts'

import { StudentFormDialog } from './student-form-dialog'
import { FILTER_RESET, FilterChips, FiltersButton, type ViewPatch } from './students-filters'
import {
	BALANCE_STATES,
	PRESENCE_VALUES,
	SORT_DIRECTIONS,
	SORT_KEYS,
	activeFilterCount,
	studentsView,
	type SortKey,
	type StudentsViewState,
} from './students-view'
import { UnassignedPayments, UnassignedPaymentsSkeleton } from './unassigned-payments'

type ReadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: StudentsResponse }

async function readStudents(): Promise<ReadState> {
	const result = await apiRequest<StudentsResponse>('GET', '/students')
	return result.ok ? { kind: 'ready', data: result.data } : { kind: 'error' }
}

export const studentColumns: SkeletonTableColumn[] = [
	{
		title: 'Student',
		cell: (
			<div className="flex items-center gap-2">
				<SkeletonAvatar />
				<Skeleton className="h-3 w-21" />
			</div>
		),
	},
	{ title: 'Rate per lesson', cell: <SkeletonLine className="w-16" /> },
	{
		title: 'Balance in lessons',
		cell: (
			<div className="flex h-5 items-center gap-2">
				<Skeleton className="size-2 shrink-0 rounded-full" />
				<Skeleton className="h-3 w-14" />
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

const viewParsers = {
	q: parseAsString.withDefault(''),
	sort: parseAsStringLiteral(SORT_KEYS),
	dir: parseAsStringLiteral(SORT_DIRECTIONS).withDefault('asc'),
	pay: parseAsArrayOf(parseAsStringLiteral(BALANCE_STATES)).withDefault([]),
	cur: parseAsArrayOf(parseAsStringLiteral(CURRENCIES)).withDefault([]),
	rate: parseAsStringLiteral(PRESENCE_VALUES).withDefault('any'),
	next: parseAsStringLiteral(PRESENCE_VALUES).withDefault('any'),
} satisfies UseQueryStatesKeysMap

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
	{ key: 'student', label: 'Student' },
	{ key: 'rate', label: 'Rate per lesson' },
	{ key: 'balance', label: 'Balance in lessons' },
	{ key: 'next', label: 'Next lesson' },
]

function SortHead({
	column,
	state,
	onSort,
}: {
	column: { key: SortKey; label: string }
	state: StudentsViewState
	onSort: (key: SortKey) => void
}) {
	const active = state.sort === column.key
	const Icon = !active ? ArrowUpDown : state.dir === 'asc' ? ArrowUp : ArrowDown
	return (
		<TableHead
			aria-sort={active ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
			className="p-0 text-body font-normal"
		>
			<button
				type="button"
				onClick={() => onSort(column.key)}
				className={cn(
					'flex h-10 w-full cursor-pointer items-center gap-1 px-4 text-left outline-none',
					'transition-colors hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset',
					active ? 'font-medium text-foreground' : 'text-muted-foreground'
				)}
			>
				<span>{column.label}</span>
				<Icon size={14} strokeWidth={1.5} aria-hidden className={cn('shrink-0', !active && 'opacity-50')} />
			</button>
		</TableHead>
	)
}

function StudentsTable({
	rows,
	state,
	data,
	onSort,
	emptyText,
	onReset,
}: {
	rows: StudentRow[]
	state: StudentsViewState
	data: StudentsResponse
	onSort: (key: SortKey) => void
	emptyText: string | null
	onReset: () => void
}) {
	const router = useRouter()
	const frame = useRef<HTMLDivElement>(null)
	const { defaultTimeZone: mainTimeZone, asOf, paysSoonLessons: threshold } = data
	const [zone] = useSecondZone(mainTimeZone)
	useAttentionClock(frame)
	if (rows.length === 0) {
		if (activeFilterCount(state) > 0) {
			return (
				<Elevated offset={1} shadowLevel={2} className="rounded-2xl">
					<EmptyState
						icon={ListFilter}
						title="No students match"
						description="Try fewer filters or another name."
						action={<Button onClick={onReset}>Reset filters</Button>}
					/>
				</Elevated>
			)
		}
		return emptyText === null ? <EmptyLine /> : <EmptyLine text={emptyText} />
	}
	const currentYear = yearInZone(new Date(asOf), mainTimeZone)
	function open(event: MouseEvent<HTMLTableRowElement>, id: string) {
		if ((event.target as HTMLElement).closest('a')) return
		router.push(`/students/${id}`)
	}
	return (
		<Elevated ref={frame} offset={1} shadowLevel={2} className="w-0 min-w-full overflow-hidden rounded-2xl">
			<Table className="min-w-160 text-body">
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						{SORT_COLUMNS.map((column) => (
							<SortHead key={column.key} column={column} state={state} onSort={onSort} />
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
								<TableCell className="px-4 py-2 text-body tabular-nums">
									{student.rateMinor === null ? (
										<span className="text-muted-foreground">No rate</span>
									) : (
										<MoneyText amountMinor={student.rateMinor} currency={student.currency} />
									)}
								</TableCell>
								<TableCell className="px-4 py-2 text-body">
									<StudentBalance
										dot
										short
										attention="loop"
										attentionId={student.id}
										minutes={student.balanceMinutes}
										lessonMinutes={student.defaultLessonMinutes}
										threshold={threshold}
									/>
								</TableCell>
								<TableCell className="px-4 py-1 text-body tabular-nums">
									{student.nextLesson.result === 'none' && student.nextLesson.status.state === 'fresh' ? (
										<span className="text-muted-foreground">None</span>
									) : (
										<NextLessonTime
											next={student.nextLesson}
											timeZone={mainTimeZone}
											secondZone={zone}
											currentYear={currentYear}
										/>
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
	const [view, setView] = useQueryStates(viewParsers, {
		history: 'replace',
		shallow: true,
		clearOnDefault: true,
	})
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

	const change = useCallback((patch: ViewPatch) => void setView(patch), [setView])

	function onSort(key: SortKey) {
		if (view.sort !== key) void setView({ sort: key, dir: 'asc' })
		else if (view.dir === 'asc') void setView({ dir: 'desc' })
		else void setView({ sort: null, dir: 'asc' })
	}

	const students = state.kind === 'ready' ? state.data.students : null
	const threshold = state.kind === 'ready' ? state.data.paysSoonLessons : 2
	const active = useMemo(() => (students ?? []).filter((student) => student.status === 'active'), [students])
	const archived = useMemo(() => (students ?? []).filter((student) => student.status === 'archived'), [students])
	const activeView = useMemo(() => studentsView(active, view, threshold), [active, view, threshold])
	const archivedView = useMemo(() => studentsView(archived, view, threshold), [archived, view, threshold])
	const currentView = tab === 'archived' ? archivedView : activeView
	const currentTotal = tab === 'archived' ? archived.length : active.length
	const searching = view.q.trim() !== ''
	const emptyText = searching ? 'No students found' : null
	const activeSorted = useMemo(() => [...active].sort(byName), [active])

	let header: ReactNode
	let body: ReactNode
	if (state.kind === 'error') {
		header = <PageHeader title="Students" />
		body = <ReadError screen="students" onRefresh={load} />
	} else {
		const loading = state.kind === 'loading'
		const listTab = tab !== 'unassigned'
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
							className="scroll-fade-x no-scrollbar bg-transparent [--scroll-fade-size:var(--scroll-fade-size-compact)] max-md:min-w-0 max-md:flex-1 max-md:overflow-x-auto"
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
					{listTab ? (
						<div className="flex min-w-0 gap-2 lg:ml-auto">
							<Input
								type="search"
								aria-label="Search students"
								placeholder="Search students"
								autoComplete="off"
								className="min-w-50 flex-1 lg:w-60 lg:flex-none"
								value={view.q}
								onChange={(event) => void setView({ q: event.target.value }, { limitUrlUpdates: debounce(300) })}
							/>
							<FiltersButton state={view} result={currentView} total={currentTotal} onChange={change} />
						</div>
					) : null}
				</div>
				{listTab ? <FilterChips state={view} onChange={change} /> : null}
				<TabPanel value="active" className="mt-4">
					{loading ? (
						<SkeletonTable columns={studentColumns} />
					) : (
						<StudentsTable
							rows={activeView.rows}
							state={view}
							data={state.data}
							onSort={onSort}
							emptyText={emptyText}
							onReset={() => change(FILTER_RESET)}
						/>
					)}
				</TabPanel>
				<TabPanel value="archived" className="mt-4">
					{loading ? (
						<SkeletonTable columns={studentColumns} />
					) : (
						<StudentsTable
							rows={archivedView.rows}
							state={view}
							data={state.data}
							onSort={onSort}
							emptyText={emptyText}
							onReset={() => change(FILTER_RESET)}
						/>
					)}
				</TabPanel>
				<TabPanel value="unassigned" className="mt-4">
					{loading ? (
						<UnassignedPaymentsSkeleton />
					) : (
						<UnassignedPayments students={activeSorted} onChanged={() => void load()} />
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

const nameCollator = new Intl.Collator('en', { sensitivity: 'base' })

function byName(left: StudentRow, right: StudentRow) {
	return nameCollator.compare(left.displayName, right.displayName)
}
