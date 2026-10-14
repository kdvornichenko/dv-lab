'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import { ArrowRight, Check, Info, LoaderCircle, Pencil, RefreshCw, TriangleAlert, Wallet } from 'lucide-react'
import Link from 'next/link'

import { Panel } from '@/components/app/layout-parts'
import { StudentBalance } from '@/components/app/student-balance'
import { Banner, BannerDescription, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { formatDate, yearInZone } from '@/lib/schedule-format'
import { studentHref } from '@/lib/schedule-links'

import type { ChatChange, ChatChangeProposalBlock } from '@dv-lab/contracts'
import { balancePhrase, formatHundredths, formatMoney } from '@dv-lab/core'

import type { ChangeHandlers } from './messages'

type PaymentChange = Extract<ChatChange, { operation: 'record_payment' }>

type Decision = 'confirm' | 'decline'

type Words = { question: string; confirm: string; decline: string; busy: string }

const WAITING = 'Waiting for your decision.'

const TOUCH = 'pointer-coarse:h-11'

function Spinner({ size }: { size?: number }) {
	return <LoaderCircle size={size ?? 16} className="animate-spin" aria-hidden />
}

function wordsOf(change: ChatChange): Words {
	if (change.operation === 'record_payment')
		return {
			question: `Record ${change.studentName}'s payment?`,
			confirm: 'Record payment',
			decline: "Don't record this payment",
			busy: 'Recording payment…',
		}
	return {
		question: 'Review this change',
		confirm: 'Apply change',
		decline: 'Keep as it is',
		busy: 'Applying changes…',
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

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="grid grid-cols-[104px_minmax(0,1fr)] gap-2 pl-6">
			<p className="pt-0.5 text-caption text-muted-foreground">{label}</p>
			<div className="min-w-0 text-body wrap-anywhere text-foreground tabular-nums">{children}</div>
		</div>
	)
}

function Balance({ change }: { change: PaymentChange }) {
	if (change.balanceMinutes === null || change.balanceAfterMinutes === null)
		return <StudentBalance minutes={null} lessonMinutes={change.lessonMinutes} />
	return (
		<span className="flex flex-wrap items-center gap-1">
			<StudentBalance minutes={change.balanceMinutes} lessonMinutes={change.lessonMinutes} />
			<ArrowRight size={14} aria-hidden className="shrink-0 text-muted-foreground" />
			<span className="sr-only">after payment</span>
			<span className="rounded-md bg-active px-1">
				<StudentBalance minutes={change.balanceAfterMinutes} lessonMinutes={change.lessonMinutes} />
			</span>
		</span>
	)
}

function PaymentRows({ change }: { change: PaymentChange }) {
	const year = yearInZone(new Date(), change.timeZone)
	return (
		<>
			<Row label="Amount">{formatMoney(change.amountMinor, change.currency)}</Row>
			<Row label="Payment date">{formatDate(change.paidOn, year)}</Row>
			<Row label="Lesson credit">
				{change.lessonsHundredths === null ? (
					<span className="text-muted-foreground">No lesson credit</span>
				) : (
					lessonsText(change.lessonsHundredths)
				)}
			</Row>
			<Row label="Balance">
				<Balance change={change} />
			</Row>
			{change.note === null ? null : <Row label="Comment">{change.note}</Row>}
		</>
	)
}

function Rows({ change }: { change: ChatChange }) {
	if (change.operation === 'record_payment') return <PaymentRows change={change} />
	return null
}

function proposalLine(change: ChatChange): string | null {
	if (change.operation !== 'record_payment') return null
	return change.lessonsHundredths === null
		? 'This payment will not add lesson credit.'
		: 'The balance is recalculated when the payment is recorded.'
}

function appliedLine(change: ChatChange): string | null {
	if (change.operation !== 'record_payment') return null
	const year = yearInZone(new Date(), change.timeZone)
	const credit = change.lessonsHundredths === null ? '' : `, ${lessonsText(change.lessonsHundredths)}`
	const values = `${change.studentName}, ${formatDate(change.paidOn, year)}: ${formatMoney(change.amountMinor, change.currency)}${credit}.`
	if (change.balanceAfterMinutes === null) return values
	return `${values} Balance is now ${balancePhrase(change.balanceAfterMinutes, change.lessonMinutes)}.`
}

function appliedTitle(change: ChatChange): string {
	return change.operation === 'record_payment' ? 'Payment recorded.' : 'Change applied.'
}

function receiptHref(block: ChatChangeProposalBlock): string | null {
	if (block.receipt === null) return null
	if (block.change.operation !== 'record_payment') return studentHref(block.receipt.studentId)
	return studentHref(block.receipt.studentId, {
		tab: 'payments',
		...(block.receipt.paymentId ? { payment: block.receipt.paymentId } : {}),
	})
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
			<Banner status={stale ? 'warning' : 'error'} role="alert" data-slot="chat-change" data-state={block.state}>
				<BannerTitle>
					{stale
						? 'This proposal is out of date. Nothing was changed.'
						: block.change.operation === 'record_payment'
							? 'This payment was not recorded. Nothing was changed.'
							: 'This change was not applied. Review the details before trying again.'}
				</BannerTitle>
				{stale ? <BannerDescription>Ask again to use the current details.</BannerDescription> : null}
			</Banner>
		)
	}

	const busy = block.state === 'applying' || pending !== null
	const line = proposalLine(block.change)

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
				const href = receiptHref(block)
				const applied = appliedLine(block.change)
				return (
					<div ref={status} tabIndex={-1} role="status" className="flex flex-col gap-2 outline-none">
						<Header icon={<Check size={16} aria-hidden />} text={appliedTitle(block.change)} />
						{applied === null ? null : <Caption>{applied}</Caption>}
						{href === null ? null : (
							<div className="flex flex-wrap gap-2 pl-6">
								<Button
									variant="ghost"
									size="compact"
									className={TOUCH}
									leadingIcon={Pencil}
									nativeButton={false}
									render={<Link href={href} />}
								>
									{block.change.operation === 'record_payment' ? 'Edit payment' : 'Open student'}
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
							<Header icon={<Wallet size={16} aria-hidden />} text={words.question} />
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
						<Header icon={<Wallet size={16} aria-hidden />} text={words.question} />
						<Rows change={block.change} />
						{line === null ? null : <Caption>{line}</Caption>}
						<p role="status" className="sr-only">
							{busy
								? pending === 'decline'
									? ''
									: words.busy
								: `${WAITING} Review the details before applying this change.`}
						</p>
						<div className="flex flex-wrap gap-2 pl-6">
							<Button
								variant="primary"
								size="compact"
								className={TOUCH}
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
						<Header icon={<Wallet size={16} aria-hidden />} text={words.question} />
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
