'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import {
	Archive,
	ArrowRight,
	Check,
	Info,
	LoaderCircle,
	MessageSquare,
	Pencil,
	RefreshCw,
	StickyNote,
	Tag,
	Trash2,
	TriangleAlert,
	UserPlus,
	Wallet,
	type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'

import { Panel } from '@/components/app/layout-parts'
import { StudentBalance } from '@/components/app/student-balance'
import { Banner, BannerDescription, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { formatDate, formatFullDate, yearInZone } from '@/lib/schedule-format'
import { changeReceiptHref } from '@/lib/schedule-links'

import { LESSON_MINUTES_DEFAULT, type ChatChange, type ChatChangeProposalBlock } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE, balancePhrase, formatHundredths, formatMoney } from '@dv-lab/core'

import type { ChangeHandlers } from './messages'

type Change<Operation extends ChatChange['operation']> = Extract<ChatChange, { operation: Operation }>

type Decision = 'confirm' | 'decline'

type Words = { question: string; confirm: string; decline: string; busy: string; icon: LucideIcon }

const WAITING = 'Waiting for your decision.'

const TOUCH = 'pointer-coarse:h-11'

function Spinner({ size }: { size?: number }) {
	return <LoaderCircle size={size ?? 16} className="animate-spin" aria-hidden />
}

function wordsOf(change: ChatChange): Words {
	switch (change.operation) {
		case 'record_payment':
			return {
				question: `Record ${change.studentName}'s payment?`,
				confirm: 'Record payment',
				decline: "Don't record this payment",
				busy: 'Recording payment…',
				icon: Wallet,
			}
		case 'create_card':
			return {
				question: 'Create a student card?',
				confirm: 'Create student card',
				decline: "Don't create the card",
				busy: 'Creating student card…',
				icon: UserPlus,
			}
		case 'set_rate':
			return {
				question: `Change ${change.studentName}'s rate?`,
				confirm: 'Save rate',
				decline: 'Keep rate',
				busy: 'Saving rate…',
				icon: Tag,
			}
		case 'archive_card':
			return {
				question: `Archive ${change.studentName}?`,
				confirm: 'Archive student',
				decline: 'Keep student active',
				busy: 'Archiving student…',
				icon: Archive,
			}
		case 'delete_payment':
			return {
				question: `Delete ${change.studentName}'s payment?`,
				confirm: 'Delete payment',
				decline: 'Keep payment',
				busy: 'Deleting payment…',
				icon: Trash2,
			}
		case 'remove_note':
			return {
				question: 'Remove this note?',
				confirm: 'Remove note',
				decline: 'Keep note',
				busy: 'Removing note…',
				icon: StickyNote,
			}
		case 'remove_comment':
			return {
				question: 'Remove this comment?',
				confirm: 'Remove comment',
				decline: 'Keep comment',
				busy: 'Removing comment…',
				icon: MessageSquare,
			}
		case 'bulk_move':
			return {
				question: `Move ${change.studentName}'s lessons?`,
				confirm: 'Move lessons',
				decline: 'Keep lesson times',
				busy: 'Moving lessons…',
				icon: Info,
			}
	}
}

function lessonsText(hundredths: number): string {
	return `${formatHundredths(hundredths)} ${hundredths === 100 ? 'lesson' : 'lessons'}`
}

function Header({ icon, text, children }: { icon: ReactNode; text: string; children?: ReactNode }) {
	return (
		<div className="flex items-start gap-2">
			<span className="flex shrink-0 pt-0.5 text-muted-foreground">{icon}</span>
			<p className="min-w-0 flex-1 text-body font-semibold wrap-anywhere text-foreground">{text}</p>
			{children}
		</div>
	)
}

function Caption({ children }: { children: ReactNode }) {
	return <p className="pl-6 text-caption wrap-anywhere text-muted-foreground tabular-nums">{children}</p>
}

function Warning({ children }: { children: ReactNode }) {
	return (
		<p className="flex items-start gap-2 pl-6 text-caption text-muted-foreground">
			<TriangleAlert aria-hidden size={14} className="mt-0.5 shrink-0 text-warning" />
			<span className="min-w-0 flex-1 wrap-anywhere">{children}</span>
		</p>
	)
}

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="grid grid-cols-[104px_minmax(0,1fr)] gap-2 pl-6">
			<p className="pt-0.5 text-caption text-muted-foreground">{label}</p>
			<div className="min-w-0 text-body wrap-anywhere text-foreground tabular-nums">{children}</div>
		</div>
	)
}

function Muted({ children }: { children: ReactNode }) {
	return <span className="text-muted-foreground">{children}</span>
}

function Quote({ body }: { body: string }) {
	return (
		<span title={body} className="line-clamp-3 wrap-anywhere whitespace-pre-line">
			{body}
		</span>
	)
}

function Shift({ before, after }: { before: ReactNode; after: ReactNode }) {
	return (
		<span className="flex flex-wrap items-center gap-1">
			{before}
			<ArrowRight size={14} aria-hidden className="shrink-0 text-muted-foreground" />
			<span className="sr-only">after</span>
			<span data-slot="change-after" className="rounded-md bg-active px-1">
				{after}
			</span>
		</span>
	)
}

function PaymentBalance({
	current,
	after,
	lessonMinutes,
}: {
	current: number | null
	after: number | null
	lessonMinutes: number
}) {
	if (current === null || after === null) return <StudentBalance minutes={null} lessonMinutes={lessonMinutes} />
	return (
		<span className="flex flex-wrap items-center gap-1">
			<StudentBalance minutes={current} lessonMinutes={lessonMinutes} />
			<ArrowRight size={14} aria-hidden className="shrink-0 text-muted-foreground" />
			<span className="sr-only">after payment</span>
			<span data-slot="change-balance-after" className="rounded-md bg-active px-1">
				<StudentBalance minutes={after} lessonMinutes={lessonMinutes} />
			</span>
		</span>
	)
}

function PaymentRows({ change }: { change: Change<'record_payment'> }) {
	const year = yearInZone(new Date(), change.timeZone)
	return (
		<>
			<Row label="Amount">{formatMoney(change.amountMinor, change.currency)}</Row>
			<Row label="Payment date">{formatDate(change.paidOn, year)}</Row>
			<Row label="Lesson credit">
				{change.lessonsHundredths === null ? <Muted>No lesson credit</Muted> : lessonsText(change.lessonsHundredths)}
			</Row>
			<Row label="Balance">
				<PaymentBalance
					current={change.balanceMinutes}
					after={change.balanceAfterMinutes}
					lessonMinutes={change.lessonMinutes}
				/>
			</Row>
			{change.note === null ? null : <Row label="Comment">{change.note}</Row>}
		</>
	)
}

function rateText(rate: { rateMinor: number | null; currency: string | null }): ReactNode {
	return rate.rateMinor === null ? (
		<Muted>No rate set</Muted>
	) : (
		`${formatMoney(rate.rateMinor, rate.currency)} per lesson`
	)
}

function lessonMinutesOf(change: Change<'delete_payment'>): number {
	if (change.lessonsHundredths === null || change.lessonsHundredths === 0 || change.creditedMinutes === 0)
		return LESSON_MINUTES_DEFAULT
	return Math.max(1, Math.round((change.creditedMinutes * 100) / change.lessonsHundredths))
}

function genderText(gender: 'female' | 'male'): string {
	return gender === 'female' ? 'Female' : 'Male'
}

function Rows({ change }: { change: ChatChange }) {
	const year = yearInZone(new Date(), SCHEDULE_TIME_ZONE)
	switch (change.operation) {
		case 'record_payment':
			return <PaymentRows change={change} />
		case 'create_card':
			return (
				<>
					<Row label="Name">{change.displayName}</Row>
					<Row label="Rate">{rateText(change)}</Row>
					<Row label="Lesson length">{`${change.lessonMinutes} min`}</Row>
					<Row label="No-show">Deducts</Row>
					<Row label="Time zone">Same as the teacher</Row>
					{change.gender === null ? null : <Row label="Gender">{genderText(change.gender)}</Row>}
				</>
			)
		case 'set_rate':
			return (
				<>
					<Row label="Current rate">{rateText(change.before)}</Row>
					<Row label="New rate">
						<span data-slot="change-after" className="rounded-md bg-active px-1">
							{rateText(change.after)}
						</span>
					</Row>
				</>
			)
		case 'archive_card':
			return (
				<Row label="Status">
					<Shift before="Active" after="Archived" />
				</Row>
			)
		case 'delete_payment': {
			const lessonMinutes = lessonMinutesOf(change)
			return (
				<>
					<Row label="Payment date">{formatDate(change.paidOn, year)}</Row>
					<Row label="Amount">{formatMoney(change.amountMinor, change.currency)}</Row>
					<Row label="Lesson credit">
						{change.lessonsHundredths === null ? (
							<Muted>No lesson credit</Muted>
						) : (
							lessonsText(change.lessonsHundredths)
						)}
					</Row>
					{change.note === null ? null : <Row label="Comment">{change.note}</Row>}
					<Row label="Balance">
						<PaymentBalance
							current={change.balanceMinutes}
							after={change.balanceAfterMinutes}
							lessonMinutes={lessonMinutes}
						/>
					</Row>
				</>
			)
		}
		case 'remove_note':
			return (
				<>
					<Row label="Student">{change.studentName}</Row>
					<Row label="Added">{formatFullDate(new Date(change.createdAt), SCHEDULE_TIME_ZONE, year)}</Row>
					<Row label="Note">
						<Quote body={change.body} />
					</Row>
				</>
			)
		case 'remove_comment':
			return (
				<>
					{change.lessonDate === null ? null : <Row label="Lesson">{formatDate(change.lessonDate, year)}</Row>}
					<Row label="Student">{change.studentName}</Row>
					<Row label="Comment">
						<Quote body={change.body} />
					</Row>
				</>
			)
		case 'bulk_move':
			return null
	}
}

function Notes({ change }: { change: ChatChange }) {
	switch (change.operation) {
		case 'record_payment':
			return (
				<Caption>
					{change.lessonsHundredths === null
						? 'This payment will not add lesson credit.'
						: 'The balance is recalculated when the payment is recorded.'}
				</Caption>
			)
		case 'create_card':
			return (
				<>
					<Caption>This creates a student card. Sign-in access is not created.</Caption>
					{change.duplicateName ? (
						<Warning>Another student has this name. The cards will stay separate.</Warning>
					) : null}
				</>
			)
		case 'set_rate':
			return <Caption>Existing payment lesson credit stays unchanged.</Caption>
		case 'archive_card':
			return (
				<>
					<Caption>The account, payments and notes are kept.</Caption>
					{change.accountActive ? <Caption>The account can still sign in; deactivate it separately.</Caption> : null}
				</>
			)
		case 'delete_payment':
			return <Caption>This removes only this payment. The balance will be recalculated.</Caption>
		case 'remove_note':
			return <Caption>Later notes stay.</Caption>
		case 'remove_comment':
			return <Caption>Later comments stay.</Caption>
		case 'bulk_move':
			return null
	}
}

function Lead({ change }: { change: ChatChange }) {
	if (change.operation !== 'archive_card' || !change.requestedDeletion) return null
	return (
		<p className="flex items-start gap-2 pl-6 text-body text-foreground">
			<Info aria-hidden size={14} className="mt-1 shrink-0 text-info" />
			<span className="min-w-0 flex-1 wrap-anywhere">
				Permanent student deletion is not available. You can archive this student instead.
			</span>
		</p>
	)
}

function appliedLine(change: ChatChange): string | null {
	switch (change.operation) {
		case 'record_payment': {
			const year = yearInZone(new Date(), change.timeZone)
			const credit = change.lessonsHundredths === null ? '' : `, ${lessonsText(change.lessonsHundredths)}`
			const values = `${change.studentName}, ${formatDate(change.paidOn, year)}: ${formatMoney(change.amountMinor, change.currency)}${credit}.`
			if (change.balanceAfterMinutes === null) return values
			return `${values} Balance is now ${balancePhrase(change.balanceAfterMinutes, change.lessonMinutes)}.`
		}
		case 'create_card':
			return `${change.displayName}.`
		case 'delete_payment': {
			const year = yearInZone(new Date(), SCHEDULE_TIME_ZONE)
			const values = `${change.studentName}, ${formatDate(change.paidOn, year)}: ${formatMoney(change.amountMinor, change.currency)}.`
			if (change.balanceAfterMinutes === null) return values
			return `${values} Balance is now ${balancePhrase(change.balanceAfterMinutes, lessonMinutesOf(change))}.`
		}
		default:
			return `${change.studentName}.`
	}
}

function appliedTitle(change: ChatChange): string {
	switch (change.operation) {
		case 'record_payment':
			return 'Payment recorded.'
		case 'create_card':
			return 'Student card created.'
		case 'set_rate':
			return 'Rate changed.'
		case 'archive_card':
			return 'Student archived.'
		case 'delete_payment':
			return 'Payment deleted.'
		case 'remove_note':
			return 'Note removed.'
		case 'remove_comment':
			return 'Comment removed.'
		case 'bulk_move':
			return 'Lessons moved.'
	}
}

function receiptLabel(change: ChatChange): { label: string; icon: LucideIcon } {
	switch (change.operation) {
		case 'record_payment':
			return { label: 'Edit payment', icon: Pencil }
		case 'create_card':
		case 'archive_card':
			return { label: 'Open student', icon: ArrowRight }
		case 'set_rate':
			return { label: 'Edit details', icon: Pencil }
		case 'delete_payment':
			return { label: 'View payments', icon: ArrowRight }
		case 'remove_note':
			return { label: 'View notes', icon: ArrowRight }
		case 'remove_comment':
			return { label: change.lessonDate === null ? 'View schedule' : 'View lesson', icon: ArrowRight }
		case 'bulk_move':
			return { label: 'View schedule', icon: ArrowRight }
	}
}

function targetName(change: ChatChange): string {
	return change.operation === 'create_card' ? change.displayName : change.studentName
}

function failedTitle(change: ChatChange): string {
	return change.operation === 'record_payment'
		? 'This payment was not recorded. Nothing was changed.'
		: 'This change was not applied. Review the details before trying again.'
}

export function ChangeProposal({
	block,
	onConfirm,
	onDecline,
	onRefresh,
}: { block: ChatChangeProposalBlock } & ChangeHandlers) {
	const [pending, setPending] = useState<Decision | null>(null)
	const [unknown, setUnknown] = useState(false)
	const [refreshing, setRefreshing] = useState(false)
	const status = useRef<HTMLDivElement>(null)
	const previous = useRef(block.state)
	const words = wordsOf(block.change)
	const Icon = words.icon

	useEffect(() => {
		if (previous.current === 'applying' && block.state !== 'applying' && block.state !== 'proposed')
			status.current?.focus()
		previous.current = block.state
	}, [block.state])

	const decide = async (decision: Decision) => {
		if (pending !== null || block.state !== 'proposed') return
		setPending(decision)
		const known = await (decision === 'confirm' ? onConfirm : onDecline)(block.actionId)
		setPending(null)
		setUnknown(!known)
	}

	const refresh = async () => {
		if (refreshing) return
		setRefreshing(true)
		const known = await onRefresh()
		setRefreshing(false)
		if (known) setUnknown(false)
	}

	if (block.state === 'stale' || block.state === 'failed') {
		const stale = block.state === 'stale'
		return (
			<Banner
				status={stale ? 'warning' : 'error'}
				role="alert"
				data-slot="chat-change"
				data-operation={block.change.operation}
				data-state={block.state}
			>
				<BannerTitle>
					{stale ? 'This proposal is out of date. Nothing was changed.' : failedTitle(block.change)}
				</BannerTitle>
				{stale ? <BannerDescription>Ask again to use the current details.</BannerDescription> : null}
			</Banner>
		)
	}

	if (block.change.operation === 'bulk_move') return null

	const busy = block.state === 'applying' || pending !== null
	const destructive = block.change.operation === 'delete_payment'

	function body() {
		if (unknown && block.state === 'proposed')
			return (
				<>
					<Header
						icon={<TriangleAlert size={16} className="text-warning" aria-hidden />}
						text="Could not load this change's status."
					/>
					<Rows change={block.change} />
					<div className="flex flex-wrap gap-2 pl-6">
						<Button
							variant="secondary"
							size="compact"
							className={TOUCH}
							disabled={refreshing}
							aria-busy={refreshing}
							leadingIcon={refreshing ? Spinner : RefreshCw}
							onClick={() => void refresh()}
						>
							Refresh status
						</Button>
					</div>
				</>
			)
		switch (block.state) {
			case 'applied': {
				const href = changeReceiptHref(block)
				const applied = appliedLine(block.change)
				const link = receiptLabel(block.change)
				return (
					<div ref={status} tabIndex={-1} role="status" className="flex flex-col gap-2 outline-none">
						<Header icon={<Check size={16} aria-hidden />} text={appliedTitle(block.change)} />
						{applied === null ? null : <Caption>{applied}</Caption>}
						{href === null ? null : (
							<div className="flex flex-wrap gap-2 pl-6">
								<Button
									variant="ghost"
									size="compact"
									className={`${TOUCH} h-auto min-h-7 py-1 whitespace-normal`}
									leadingIcon={link.icon}
									nativeButton={false}
									aria-label={`${link.label}: ${targetName(block.change)}`}
									render={<Link href={href} />}
								>
									{link.label}
								</Button>
							</div>
						)}
					</div>
				)
			}
			case 'declined':
				return (
					<>
						<div className="flex flex-col gap-2 opacity-60">
							<Header icon={<Icon size={16} aria-hidden />} text={words.question} />
							<Lead change={block.change} />
							<Rows change={block.change} />
						</div>
						<div
							ref={status}
							tabIndex={-1}
							role="status"
							className="flex items-start gap-2 pl-6 text-caption text-muted-foreground outline-none"
						>
							<Info aria-hidden size={14} className="mt-0.5 shrink-0 text-info" />
							<span className="min-w-0 flex-1">Proposal declined. This proposal made no changes.</span>
						</div>
					</>
				)
			case 'proposed':
			case 'applying':
				return (
					<>
						<Header icon={<Icon size={16} aria-hidden />} text={words.question} />
						<Lead change={block.change} />
						<Rows change={block.change} />
						<Notes change={block.change} />
						<p role="status" className="sr-only">
							{busy
								? pending === 'decline'
									? ''
									: words.busy
								: `${WAITING} Review the details before applying this change.`}
						</p>
						<div className="flex flex-wrap gap-2 pl-6">
							<Button
								variant={destructive ? 'secondary' : 'primary'}
								size="compact"
								className={destructive ? `${TOUCH} text-destructive` : TOUCH}
								disabled={busy}
								leadingIcon={busy && pending !== 'decline' ? Spinner : undefined}
								onClick={() => void decide('confirm')}
							>
								{busy && pending !== 'decline' ? words.busy : words.confirm}
							</Button>
							<Button
								variant="ghost"
								size="compact"
								className={TOUCH}
								disabled={busy}
								leadingIcon={pending === 'decline' ? Spinner : undefined}
								onClick={() => void decide('decline')}
							>
								{words.decline}
							</Button>
						</div>
					</>
				)
			default:
				return (
					<>
						<Header icon={<Icon size={16} aria-hidden />} text={words.question} />
						<Rows change={block.change} />
						<p role="status" className="pl-6 text-caption text-muted-foreground">
							{WAITING}
						</p>
					</>
				)
		}
	}

	return (
		<Panel>
			<div
				role="group"
				aria-label={words.question}
				aria-busy={busy}
				data-slot="chat-change"
				data-operation={block.change.operation}
				data-state={unknown && block.state === 'proposed' ? 'unknown' : block.state}
				className="flex flex-col gap-2 px-4 py-3"
			>
				{body()}
			</div>
		</Panel>
	)
}
