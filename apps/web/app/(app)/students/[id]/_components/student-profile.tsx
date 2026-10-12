'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { Archive, ArchiveRestore, ArrowLeft, Wallet } from 'lucide-react'
import Link from 'next/link'

import { Avatar } from '@/components/app/avatar'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { PageHeader, PageScroll, Panel } from '@/components/app/layout-parts'
import { MoneyText } from '@/components/app/ledger-text'
import { ReadError } from '@/components/app/read-error'
import { StatusDot } from '@/components/app/status-dot'
import { NotFoundPage } from '@/components/app/status-pages'
import { StudentBalance } from '@/components/app/student-balance'
import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonProfileHeader } from '@/components/ui/skeleton'
import { TabItem, TabPanel, Tabs, TabsList } from '@/components/ui/tabs'
import { apiRequest } from '@/lib/api-client'

import type { SectionKind, StudentDetail, StudentResponse } from '@dv-lab/contracts'

import { useToast } from '../../../_components/toasts'
import { NotesTab, type SectionDrafts } from './notes-tab'
import { OverviewTab } from './overview-tab'
import { PaymentsTab } from './payments-tab'
import { RecordPaymentDialog } from './record-payment-dialog'
import { VocabularyTab } from './vocabulary-tab'

type ReadState =
	{ kind: 'loading' | 'error' | 'not_found'; data: StudentResponse | null } | { kind: 'ready'; data: StudentResponse }

async function readStudent(id: string): Promise<ReadState> {
	const result = await apiRequest<StudentResponse>('GET', `/students/${id}`)
	if (result.ok) return { kind: 'ready', data: result.data }
	return { kind: result.status === 404 ? 'not_found' : 'error', data: null }
}

function BackButton() {
	return (
		<Button
			variant="ghost"
			size="compact"
			leadingIcon={ArrowLeft}
			nativeButton={false}
			render={<Link href="/students" />}
			className="self-start"
		>
			Students
		</Button>
	)
}

function SectionTabs({ children, disabled }: { children: ReactNode; disabled: boolean }) {
	return (
		<Tabs defaultValue="overview">
			<div className="flex w-fit max-w-full min-w-0 rounded-xl bg-muted">
				<TabsList
					aria-label="Student sections"
					className="scroll-fade-x bg-transparent [--scroll-fade-size:var(--scroll-fade-size-compact)] max-sm:min-w-0 max-sm:flex-1 max-sm:overflow-x-auto"
				>
					<TabItem value="overview" label="Overview" disabled={disabled} />
					<TabItem value="notes" label="Notes" disabled={disabled} />
					<TabItem value="vocabulary" label="Vocabulary" disabled={disabled} />
					<TabItem value="payments" label="Payments" disabled={disabled} />
				</TabsList>
			</div>
			<TabPanel value="overview" className="mt-4">
				{children}
			</TabPanel>
		</Tabs>
	)
}

function LoadingBody() {
	return (
		<div className="grid gap-4 md:gap-6 lg:grid-cols-2">
			<Panel>
				<div className="flex flex-col gap-4 p-4">
					<Skeleton className="h-5 w-24" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-3/5" />
				</div>
			</Panel>
			<Panel>
				<div className="flex flex-col gap-4 p-4">
					<Skeleton className="h-5 w-32" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
				</div>
			</Panel>
		</div>
	)
}

function SummaryLine({
	student,
	threshold,
	onSetBalance,
}: {
	student: StudentDetail
	threshold: number
	onSetBalance: () => void
}) {
	const balance = student.balanceMinutes
	const rate = student.rateMinor
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
			<span className="inline-flex items-center gap-2">
				<StatusDot status={student.status} />
				{student.status === 'active' ? 'Active' : 'Archived'}
			</span>
			<span className="tabular-nums">
				{rate === null ? (
					'No rate'
				) : (
					<>
						<MoneyText amountMinor={rate} currency={student.currency} /> / lesson
					</>
				)}
			</span>
			<StudentBalance dot minutes={balance} lessonMinutes={student.defaultLessonMinutes} threshold={threshold} />
			{balance === null ? (
				<Button variant="ghost" size="compact" onClick={onSetBalance}>
					Set opening balance
				</Button>
			) : null}
		</div>
	)
}

export function StudentProfile({ id }: { id: string }) {
	const [state, setState] = useState<ReadState>({ kind: 'loading', data: null })
	const [tab, setTab] = useState('overview')
	const [confirm, setConfirm] = useState<'archive' | 'restore' | null>(null)
	const [recordOpen, setRecordOpen] = useState(false)
	const [paymentsVersion, setPaymentsVersion] = useState(0)
	const [drafts, setDrafts] = useState<SectionDrafts>({})
	const lessonsInput = useRef<HTMLInputElement>(null)
	const statusButton = useRef<HTMLButtonElement>(null)
	const recordButton = useRef<HTMLButtonElement>(null)
	const requests = useRef(0)
	const toast = useToast()

	const reload = useCallback(async () => {
		const requestId = ++requests.current
		const next = await readStudent(id)
		if (requestId !== requests.current) return false
		setState((previous) => (next.kind === 'ready' ? next : { ...next, data: previous.data }))
		return next.kind === 'ready'
	}, [id])

	useEffect(() => {
		const counter = requests
		void reload()
		return () => {
			counter.current++
		}
	}, [reload])

	function changeDraft(kind: SectionKind, value: string | undefined) {
		setDrafts((current) => {
			const next = { ...current }
			if (value === undefined) delete next[kind]
			else next[kind] = value
			return next
		})
	}

	function focusOpeningBalance() {
		setTab('overview')
		requestAnimationFrame(() => lessonsInput.current?.focus())
	}

	function closeRecord() {
		setRecordOpen(false)
		requestAnimationFrame(() => recordButton.current?.focus())
	}

	function closeConfirm() {
		setConfirm(null)
		requestAnimationFrame(() => statusButton.current?.focus())
	}

	async function changeStatus(action: 'archive' | 'restore') {
		const result = await apiRequest<StudentResponse>('POST', `/students/${id}/${action}`)
		if (!result.ok) return false
		const name = result.data.student.displayName
		toast.show(
			action === 'archive'
				? { title: 'Student archived', description: `${name} is in the Archived tab.` }
				: { title: 'Student restored', description: `${name} is back in the Active tab.` }
		)
		await reload()
		return true
	}

	if (state.kind === 'not_found') return <NotFoundPage inShell />

	if (state.kind === 'error' && state.data === null) {
		return (
			<PageScroll>
				<BackButton />
				<ReadError
					screen="student"
					onRefresh={async () => {
						await reload()
					}}
				/>
			</PageScroll>
		)
	}

	if (state.data === null) {
		return (
			<PageScroll>
				<BackButton />
				<SkeletonProfileHeader />
				<SectionTabs disabled>
					<LoadingBody />
				</SectionTabs>
			</PageScroll>
		)
	}

	const { student, paysSoonLessons: threshold, defaultTimeZone: mainTimeZone, asOf } = state.data
	return (
		<PageScroll>
			<BackButton />
			{state.kind === 'error' ? (
				<ReadError
					screen="student"
					onRefresh={async () => {
						await reload()
					}}
				/>
			) : null}
			<div className={state.kind === 'error' ? 'hidden' : 'contents'}>
				<PageHeader
					title={
						<span className="flex items-center gap-2">
							<Avatar name={student.displayName} />
							<span className="min-w-0 wrap-anywhere">{student.displayName}</span>
						</span>
					}
					description={<SummaryLine student={student} threshold={threshold} onSetBalance={focusOpeningBalance} />}
					actions={
						<>
							{student.status === 'active' ? (
								<Button
									ref={statusButton}
									variant="secondary"
									leadingIcon={Archive}
									onClick={() => setConfirm('archive')}
								>
									Archive
								</Button>
							) : (
								<Button
									ref={statusButton}
									variant="secondary"
									leadingIcon={ArchiveRestore}
									onClick={() => setConfirm('restore')}
								>
									Restore
								</Button>
							)}
							<Button ref={recordButton} leadingIcon={Wallet} onClick={() => setRecordOpen(true)}>
								Record payment
							</Button>
						</>
					}
				/>
				<Tabs value={tab} onValueChange={setTab}>
					<div className="flex w-fit max-w-full min-w-0 rounded-xl bg-muted">
						<TabsList
							aria-label="Student sections"
							className="scroll-fade-x bg-transparent [--scroll-fade-size:var(--scroll-fade-size-compact)] max-sm:min-w-0 max-sm:flex-1 max-sm:overflow-x-auto"
						>
							<TabItem value="overview" label="Overview" />
							<TabItem value="notes" label="Notes" />
							<TabItem value="vocabulary" label="Vocabulary" />
							<TabItem value="payments" label="Payments" />
						</TabsList>
					</div>
					<TabPanel value="overview" className="mt-4">
						<OverviewTab
							student={student}
							mainTimeZone={mainTimeZone}
							asOf={asOf}
							lessonsInputRef={lessonsInput}
							onSaved={reload}
						/>
					</TabPanel>
					<TabPanel value="notes" className="mt-4">
						<NotesTab student={student} drafts={drafts} onDraftChange={changeDraft} />
					</TabPanel>
					<TabPanel value="vocabulary" className="mt-4">
						<VocabularyTab student={student} />
					</TabPanel>
					<TabPanel value="payments" className="mt-4">
						<PaymentsTab student={student} refreshKey={paymentsVersion} onChanged={() => void reload()} />
					</TabPanel>
				</Tabs>
			</div>
			{recordOpen ? (
				<RecordPaymentDialog
					student={student}
					mainTimeZone={mainTimeZone}
					currentMainTimeZone={mainTimeZone}
					asOf={asOf}
					onClose={closeRecord}
					onRefresh={() => {
						closeRecord()
						void reload()
					}}
					onRecorded={() => {
						closeRecord()
						setPaymentsVersion((version) => version + 1)
						void reload()
					}}
				/>
			) : null}
			{confirm === 'archive' ? (
				<ConfirmDialog
					title={`Archive ${student.displayName}?`}
					body={`${student.displayName} moves to the Archived tab. The account, payments and notes are kept.${student.account?.status === 'active' ? ' The account can still sign in; deactivate it separately.' : ''}`}
					cancelLabel="Keep student"
					confirmLabel="Archive student"
					pendingLabel="Archiving…"
					tone="primary"
					failureText="Could not archive the student. Try again."
					onConfirm={() => changeStatus('archive')}
					onClose={closeConfirm}
				/>
			) : null}
			{confirm === 'restore' ? (
				<ConfirmDialog
					title={`Restore ${student.displayName}?`}
					body={`${student.displayName} returns to the Active tab.`}
					cancelLabel="Keep archived"
					confirmLabel="Restore student"
					pendingLabel="Restoring…"
					tone="primary"
					failureText="Could not restore the student. Try again."
					onConfirm={() => changeStatus('restore')}
					onClose={closeConfirm}
				/>
			) : null}
		</PageScroll>
	)
}
