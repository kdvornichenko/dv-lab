'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { Archive, ArchiveRestore, ArrowLeft, Wallet } from 'lucide-react'
import Link from 'next/link'

import { Avatar } from '@/components/app/avatar'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { PageHeader, PageScroll, Panel } from '@/components/app/layout-parts'
import { LessonsText, MoneyText } from '@/components/app/ledger-text'
import { ReadError } from '@/components/app/read-error'
import { StatusDot } from '@/components/app/status-dot'
import { NotFoundPage } from '@/components/app/status-pages'
import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonProfileHeader } from '@/components/ui/skeleton'
import { TabItem, TabPanel, Tabs, TabsList } from '@/components/ui/tabs'
import { apiRequest } from '@/lib/api-client'

import type { StudentDetail, StudentResponse } from '@dv-lab/contracts'

import { useToast } from '../../../_components/toasts'
import { OverviewTab } from './overview-tab'
import { RecordPaymentDialog } from './record-payment-dialog'

type ReadState =
	{ kind: 'loading' } | { kind: 'error' } | { kind: 'not_found' } | { kind: 'ready'; student: StudentDetail }

async function readStudent(id: string): Promise<ReadState> {
	const result = await apiRequest<StudentResponse>('GET', `/students/${id}`)
	if (result.ok) return { kind: 'ready', student: result.data.student }
	return result.status === 404 ? { kind: 'not_found' } : { kind: 'error' }
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
			<TabsList aria-label="Student sections">
				<TabItem value="overview" label="Overview" disabled={disabled} />
			</TabsList>
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

function SummaryLine({ student, onSetBalance }: { student: StudentDetail; onSetBalance: () => void }) {
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
				<Button variant="ghost" size="compact" onClick={onSetBalance}>
					Set opening balance
				</Button>
			) : (
				<span>
					<LessonsText minutes={balance} lessonMinutes={student.defaultLessonMinutes} phrase /> left
				</span>
			)}
		</div>
	)
}

export function StudentProfile({ id }: { id: string }) {
	const [state, setState] = useState<ReadState>({ kind: 'loading' })
	const [tab, setTab] = useState('overview')
	const [confirm, setConfirm] = useState<'archive' | 'restore' | null>(null)
	const [recordOpen, setRecordOpen] = useState(false)
	const lessonsInput = useRef<HTMLInputElement>(null)
	const statusButton = useRef<HTMLButtonElement>(null)
	const recordButton = useRef<HTMLButtonElement>(null)
	const toast = useToast()

	const reload = useCallback(async () => {
		setState(await readStudent(id))
	}, [id])

	useEffect(() => {
		let current = true
		void readStudent(id).then((next) => {
			if (current) setState(next)
		})
		return () => {
			current = false
		}
	}, [id])

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

	if (state.kind === 'error') {
		return (
			<PageScroll>
				<BackButton />
				<ReadError screen="student" onRefresh={reload} />
			</PageScroll>
		)
	}

	if (state.kind === 'loading') {
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

	const { student } = state
	return (
		<PageScroll>
			<BackButton />
			<PageHeader
				title={
					<span className="flex items-center gap-2">
						<Avatar name={student.displayName} />
						<span className="min-w-0 wrap-anywhere">{student.displayName}</span>
					</span>
				}
				description={<SummaryLine student={student} onSetBalance={focusOpeningBalance} />}
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
				<TabsList aria-label="Student sections">
					<TabItem value="overview" label="Overview" />
				</TabsList>
				<TabPanel value="overview" className="mt-4">
					<OverviewTab student={student} lessonsInputRef={lessonsInput} onSaved={() => void reload()} />
				</TabPanel>
			</Tabs>
			{recordOpen ? (
				<RecordPaymentDialog
					student={student}
					onClose={closeRecord}
					onRecorded={() => {
						closeRecord()
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
