'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { Archive, ArchiveRestore, LoaderCircle, MessageSquare, Wallet } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Avatar } from '@/components/app/avatar'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { MoneyText } from '@/components/app/ledger-text'
import { ReadError } from '@/components/app/read-error'
import { StatusDot } from '@/components/app/status-dot'
import { NotFoundPage } from '@/components/app/status-pages'
import { StudentBalance } from '@/components/app/student-balance'
import { Button } from '@/components/ui/button'
import { TabItem, TabPanel, Tabs, TabsList } from '@/components/ui/tabs'
import { API_CACHE_INVALIDATED, DATA_CHANGED_CHANNEL, apiRequest } from '@/lib/api-client'
import { withoutSearchParams } from '@/lib/arrival-mark'

import type { SectionKind, StudentDetail, StudentResponse } from '@dv-lab/contracts'

import { useToast } from '../../../_components/toasts'
import { BackButton } from './back-button'
import { LessonsTab } from './lessons-tab'
import { NotesTab, type SectionDrafts } from './notes-tab'
import { OverviewTab, type OverviewTarget } from './overview-tab'
import { PaymentsTab } from './payments-tab'
import { initialProfileTab, type ProfileArrival, type ProfileMark } from './profile-arrival'
import { ProfileLoading } from './profile-loading'
import { RecordPaymentDialog } from './record-payment-dialog'
import { VocabularyTab } from './vocabulary-tab'

type ReadState =
	{ kind: 'loading' | 'error' | 'not_found'; data: StudentResponse | null } | { kind: 'ready'; data: StudentResponse }

async function readStudent(id: string): Promise<ReadState> {
	const result = await apiRequest<StudentResponse>('GET', `/students/${id}`)
	if (result.ok) return { kind: 'ready', data: result.data }
	return { kind: result.status === 404 ? 'not_found' : 'error', data: null }
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
			{balance === null ? (
				<StudentBalance minutes={null} lessonMinutes={student.defaultLessonMinutes} />
			) : (
				<StudentBalance
					dot
					attention="pulse"
					minutes={balance}
					lessonMinutes={student.defaultLessonMinutes}
					threshold={threshold}
				/>
			)}
			{balance === null ? (
				<Button variant="ghost" size="compact" onClick={onSetBalance}>
					Set opening balance
				</Button>
			) : null}
		</div>
	)
}

export function StudentProfile({ id, arrival }: { id: string; arrival: ProfileArrival }) {
	const router = useRouter()
	const [state, setState] = useState<ReadState>({ kind: 'loading', data: null })
	const [tab, setTab] = useState<string>(() => initialProfileTab(arrival))
	const [mark, setMark] = useState<ProfileMark | null>(arrival.mark)
	const [editRequested, setEditRequested] = useState(false)
	const [confirm, setConfirm] = useState<{ action: 'archive' | 'restore'; revision: number } | null>(null)
	const [confirmFailure, setConfirmFailure] = useState<string | null>(null)
	const [openPayment, setOpenPayment] = useState(arrival.payment)
	const [recordOpen, setRecordOpen] = useState(false)
	const [paymentsVersion, setPaymentsVersion] = useState(0)
	const [lessonsVersion, setLessonsVersion] = useState(0)
	const [drafts, setDrafts] = useState<SectionDrafts>({})
	const [openingRequested, setOpeningRequested] = useState(false)
	const [openingChat, startOpeningChat] = useTransition()
	const statusButton = useRef<HTMLButtonElement>(null)
	const recordButton = useRef<HTMLButtonElement>(null)
	const requests = useRef(0)
	const dialogRequest = useRef(arrival.dialog)
	const toast = useToast()

	const dropParams = useCallback(
		(names: readonly string[]) => {
			const next = withoutSearchParams(names)
			if (next !== undefined) router.replace(next, { scroll: false })
		},
		[router]
	)

	const reload = useCallback(async () => {
		const requestId = ++requests.current
		const next = await readStudent(id)
		if (requestId !== requests.current) return false
		setState((previous) => (next.kind === 'ready' ? next : { ...next, data: previous.data }))
		const wanted = dialogRequest.current
		if (wanted !== null && next.kind !== 'error') {
			dialogRequest.current = null
			if (wanted === 'payment' && next.kind === 'ready' && next.data.student.balanceMinutes !== null)
				setRecordOpen(true)
			if (wanted === 'details' && next.kind === 'ready') setEditRequested(true)
			dropParams(['dialog'])
		}
		return next.kind === 'ready'
	}, [id, dropParams])

	useEffect(() => {
		const counter = requests
		void reload()
		return () => {
			counter.current++
		}
	}, [reload])

	const refresh = useCallback(async () => {
		const ready = await reload()
		if (ready) setLessonsVersion((version) => version + 1)
		return ready
	}, [reload])

	useEffect(() => {
		const changed = () => setLessonsVersion((version) => version + 1)
		window.addEventListener(API_CACHE_INVALIDATED, changed)
		DATA_CHANGED_CHANNEL?.addEventListener('message', changed)
		return () => {
			window.removeEventListener(API_CACHE_INVALIDATED, changed)
			DATA_CHANGED_CHANNEL?.removeEventListener('message', changed)
		}
	}, [])

	function changeDraft(kind: SectionKind, value: string | undefined) {
		setDrafts((current) => {
			const next = { ...current }
			if (value === undefined) delete next[kind]
			else next[kind] = value
			return next
		})
	}

	function changeTab(next: string) {
		setTab(next)
		if (mark === null) return
		setMark(null)
		dropParams(['entry', 'section'])
	}

	function focusOpeningBalance() {
		changeTab('payments')
		setOpeningRequested(true)
	}

	function openTab(target: OverviewTarget, section?: SectionKind | null) {
		setTab(target)
		if (target === 'notes' && section !== undefined && section !== null) {
			setMark({ entry: null, section })
			return
		}
		if (mark === null) return
		setMark(null)
		dropParams(['entry', 'section'])
	}

	function askInChat() {
		startOpeningChat(() => {
			router.push(`/chat?new=1&student=${id}`)
		})
	}

	function closeRecord() {
		setRecordOpen(false)
		requestAnimationFrame(() => recordButton.current?.focus())
	}

	function openConfirm(action: 'archive' | 'restore', revision: number) {
		setConfirmFailure(null)
		setConfirm({ action, revision })
	}

	function closeConfirm() {
		setConfirm(null)
		requestAnimationFrame(() => statusButton.current?.focus())
	}

	async function changeStatus(action: 'archive' | 'restore', revision: number) {
		const result = await apiRequest<StudentResponse>('POST', `/students/${id}/${action}`, {
			expectedRevision: revision,
		})
		if (!result.ok) {
			setConfirmFailure(
				result.error?.code === 'precondition_failed'
					? 'This student changed elsewhere. Reload the page and try again.'
					: null
			)
			return false
		}
		const name = result.data.student.displayName
		toast.show(
			action === 'archive'
				? { title: 'Student archived', description: `${name} is in the Archived tab.` }
				: { title: 'Student restored', description: `${name} is back in the Active tab.` }
		)
		await refresh()
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
						await refresh()
					}}
				/>
			</PageScroll>
		)
	}

	if (state.data === null) return <ProfileLoading />

	const { student, paysSoonLessons: threshold, defaultTimeZone: mainTimeZone, asOf } = state.data
	return (
		<PageScroll>
			<BackButton />
			{state.kind === 'error' ? (
				<ReadError
					screen="student"
					onRefresh={async () => {
						await refresh()
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
									onClick={() => openConfirm('archive', student.revision)}
								>
									Archive
								</Button>
							) : (
								<Button
									ref={statusButton}
									variant="secondary"
									leadingIcon={ArchiveRestore}
									onClick={() => openConfirm('restore', student.revision)}
								>
									Restore
								</Button>
							)}
							{student.status === 'active' ? (
								<Button
									data-slot="ask-in-chat"
									variant="secondary"
									leadingIcon={openingChat ? undefined : MessageSquare}
									disabled={openingChat}
									aria-busy={openingChat}
									className="min-w-36 max-sm:h-11"
									onClick={askInChat}
								>
									{openingChat ? (
										<span className="inline-flex items-center gap-1.5">
											<LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
											Opening chat…
										</span>
									) : (
										'Ask in chat'
									)}
								</Button>
							) : null}
							<Button ref={recordButton} leadingIcon={Wallet} onClick={() => setRecordOpen(true)}>
								Record payment
							</Button>
						</>
					}
				/>
				<Tabs value={tab} onValueChange={changeTab}>
					<div className="flex w-fit max-w-full min-w-0 rounded-xl bg-muted">
						<TabsList
							aria-label="Student sections"
							className="scroll-fade-x bg-transparent [--scroll-fade-size:var(--scroll-fade-size-compact)] max-sm:min-w-0 max-sm:flex-1 max-sm:overflow-x-auto pointer-coarse:max-sm:-my-2 pointer-coarse:max-sm:py-2"
						>
							<TabItem value="overview" label="Overview" />
							<TabItem value="lessons" label="Lessons" />
							<TabItem value="payments" label="Payments" />
							<TabItem value="notes" label="Notes" />
							<TabItem value="vocabulary" label="Vocabulary" />
						</TabsList>
					</div>
					<TabPanel value="overview" className="mt-4">
						<OverviewTab
							student={student}
							mainTimeZone={mainTimeZone}
							asOf={asOf}
							threshold={threshold}
							refreshKey={lessonsVersion}
							onSaved={refresh}
							autoOpenEdit={editRequested}
							onAutoOpened={() => setEditRequested(false)}
							onOpenTab={openTab}
							onSetOpeningBalance={focusOpeningBalance}
						/>
					</TabPanel>
					<TabPanel value="lessons" className="mt-4">
						<LessonsTab
							student={student}
							mainTimeZone={mainTimeZone}
							asOf={asOf}
							refreshKey={lessonsVersion}
							onOpenPayments={(paymentId) => {
								changeTab('payments')
								if (paymentId !== null) setOpenPayment(paymentId)
							}}
						/>
					</TabPanel>
					<TabPanel value="notes" className="mt-4">
						<NotesTab
							student={student}
							drafts={drafts}
							timeZone={mainTimeZone}
							asOf={asOf}
							onDraftChange={changeDraft}
							mark={mark}
							onMarkDone={() => {
								setMark(null)
								dropParams(['entry', 'section'])
							}}
						/>
					</TabPanel>
					<TabPanel value="vocabulary" className="mt-4">
						<VocabularyTab student={student} />
					</TabPanel>
					<TabPanel value="payments" className="mt-4">
						<PaymentsTab
							student={student}
							mainTimeZone={mainTimeZone}
							asOf={asOf}
							refreshKey={paymentsVersion}
							openPaymentId={openPayment}
							onOpened={() => {
								setOpenPayment(null)
								dropParams(['payment'])
							}}
							onChanged={() => void refresh()}
							openingRequested={openingRequested}
							onOpeningOpened={() => setOpeningRequested(false)}
						/>
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
						void refresh()
					}}
					onRecorded={() => {
						closeRecord()
						setPaymentsVersion((version) => version + 1)
						void refresh()
					}}
				/>
			) : null}
			{confirm?.action === 'archive' ? (
				<ConfirmDialog
					title={`Archive ${student.displayName}?`}
					body={`${student.displayName} moves to the Archived tab. The account, payments and notes are kept.${student.account?.status === 'active' ? ' The account can still sign in; deactivate it separately.' : ''}`}
					cancelLabel="Keep student"
					confirmLabel="Archive student"
					pendingLabel="Archiving…"
					tone="primary"
					failureText={confirmFailure ?? 'Could not archive the student. Try again.'}
					onConfirm={() => changeStatus('archive', confirm.revision)}
					onClose={closeConfirm}
				/>
			) : null}
			{confirm?.action === 'restore' ? (
				<ConfirmDialog
					title={`Restore ${student.displayName}?`}
					body={`${student.displayName} returns to the Active tab.`}
					cancelLabel="Keep archived"
					confirmLabel="Restore student"
					pendingLabel="Restoring…"
					tone="primary"
					failureText={confirmFailure ?? 'Could not restore the student. Try again.'}
					onConfirm={() => changeStatus('restore', confirm.revision)}
					onClose={closeConfirm}
				/>
			) : null}
		</PageScroll>
	)
}
