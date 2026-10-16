'use client'

import { useState, type ReactNode } from 'react'

import { Check, CircleCheck, Info, TriangleAlert, Undo2, type LucideIcon } from 'lucide-react'

import { Panel } from '@/components/app/layout-parts'
import { Banner, BannerActions, BannerDescription, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { useMainTimeZone } from '@/lib/main-time-zone'
import { formatDay, yearInZone } from '@/lib/schedule-format'
import { studentHref } from '@/lib/schedule-links'

import type { ChatReviewOfferBlock, ChatReviewResultBlock } from '@dv-lab/contracts'

import { TextLink } from './agent-links'
import { Caption, Header, Spinner, TOUCH } from './change-proposal'

export type ReviewHandlers = {
	onAnswer: (block: ChatReviewOfferBlock, yes: boolean) => Promise<boolean>
	onRun: (student: { id: string; name: string }) => Promise<boolean>
	onUndo: (actionId: string) => Promise<void>
}

type Item = ChatReviewResultBlock['fixed'][number]

const CANT_UNDO = "Can't undo: a block changed after the review."
const UNDONE = 'Changes undone. The notes are as they were before the review.'

function dayOf(instant: string, zone: string): string {
	return formatDay(new Date(instant), zone, yearInZone(new Date(), zone))
}

function Note({ icon, children, role }: { icon: ReactNode; children: ReactNode; role?: 'status' }) {
	return (
		<p role={role} className="flex items-start gap-2 pl-6 text-caption text-muted-foreground">
			<span className="mt-0.5 flex shrink-0">{icon}</span>
			<span className="min-w-0 flex-1 wrap-anywhere">{children}</span>
		</p>
	)
}

export function ReviewFailed({
	student,
	onRun,
}: {
	student: { id: string; name: string }
	onRun: ReviewHandlers['onRun']
}) {
	const [busy, setBusy] = useState(false)

	async function run() {
		if (busy) return
		setBusy(true)
		try {
			await onRun(student)
		} finally {
			setBusy(false)
		}
	}

	return (
		<Banner status="error" role="status" data-slot="chat-review" data-state="failed" aria-busy={busy}>
			<BannerTitle>The review did not finish. Nothing was changed.</BannerTitle>
			<BannerDescription>{`${student.name}'s notes are as they were.`}</BannerDescription>
			<BannerActions>
				<Button
					variant="secondary"
					size="compact"
					className={TOUCH}
					leadingIcon={busy ? Spinner : undefined}
					disabled={busy}
					onClick={() => void run()}
				>
					Run again
				</Button>
			</BannerActions>
		</Banner>
	)
}

function Section({
	title,
	items,
	studentId,
	icon: Icon,
	tone,
	slot,
}: {
	title: string
	items: readonly Item[]
	studentId: string
	icon: LucideIcon
	tone: string
	slot: string
}) {
	if (items.length === 0) return null
	return (
		<section data-slot={slot} className="flex flex-col gap-1 pl-6">
			<h4 className="text-caption font-semibold text-muted-foreground">
				{title} <span className="font-normal tabular-nums">{items.length}</span>
			</h4>
			<ul className="flex flex-col gap-1">
				{items.map((item, index) => (
					<li key={index} className="flex items-start gap-2">
						<Icon aria-hidden size={14} className={`mt-1 shrink-0 ${tone}`} />
						<span className="min-w-0 flex-1 text-body wrap-anywhere text-foreground">
							{item.text}
							{item.block === undefined ? null : (
								<>
									{' '}
									<TextLink href={studentHref(studentId, { tab: 'notes', section: item.block.blockKey })}>
										{`Open ${item.block.blockName === '' ? 'block' : item.block.blockName}`}
									</TextLink>
								</>
							)}
						</span>
					</li>
				))}
			</ul>
		</section>
	)
}

function UndoChanges({ block, onUndo }: { block: ChatReviewResultBlock; onUndo: ReviewHandlers['onUndo'] }) {
	const [busy, setBusy] = useState(false)

	async function undo() {
		if (busy) return
		setBusy(true)
		try {
			await onUndo(block.actionId)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="flex flex-wrap gap-2 pl-6">
			<Button
				variant="secondary"
				size="compact"
				className={TOUCH}
				leadingIcon={busy ? Spinner : Undo2}
				disabled={busy}
				aria-busy={busy}
				onClick={() => void undo()}
			>
				{busy ? 'Undoing…' : 'Undo changes'}
			</Button>
		</div>
	)
}

export function ReviewResult({ block, onRun, onUndo }: { block: ChatReviewResultBlock } & ReviewHandlers) {
	const zone = useMainTimeZone()
	const student = { id: block.studentId, name: block.studentName }
	if (block.undo === 'none' && block.issue === 'changed') return <ReviewFailed student={student} onRun={onRun} />
	const empty = block.fixed.length + block.found.length + block.decisions.length === 0
	const undone = block.undo === 'undone'
	return (
		<Panel>
			<div
				role="group"
				aria-label="Review finished"
				data-slot="chat-review"
				data-state="result"
				data-undo={block.undo}
				className="flex flex-col gap-3 px-4 py-3"
			>
				<div className="flex flex-col gap-1">
					<Header icon={<CircleCheck size={16} aria-hidden className="text-success" />} text="Review finished" />
					<Caption>{`${block.studentName}'s notes and vocabulary · ${dayOf(block.finishedAt, zone)}`}</Caption>
				</div>
				{empty ? (
					<p className="pl-6 text-body text-foreground" data-slot="chat-review-empty">
						{`Nothing to fix. ${block.studentName}'s notes and vocabulary are consistent.`}
					</p>
				) : (
					<>
						<Section
							title="Fixed"
							items={block.fixed}
							studentId={block.studentId}
							icon={Check}
							tone="text-success"
							slot="chat-review-fixed"
						/>
						<Section
							title="Found and left as it is"
							items={block.found}
							studentId={block.studentId}
							icon={Info}
							tone="text-info"
							slot="chat-review-found"
						/>
						<Section
							title="Needs your decision"
							items={block.decisions}
							studentId={block.studentId}
							icon={TriangleAlert}
							tone="text-warning"
							slot="chat-review-decisions"
						/>
					</>
				)}
				{block.undo === 'available' ? <UndoChanges block={block} onUndo={onUndo} /> : null}
				{block.undo === 'unavailable' ? (
					<Note role="status" icon={<Info aria-hidden size={14} className="text-info" />}>
						{CANT_UNDO}
					</Note>
				) : null}
				{undone ? (
					<Note role="status" icon={<Check aria-hidden size={14} className="text-success" />}>
						{UNDONE}
					</Note>
				) : null}
			</div>
		</Panel>
	)
}

export function ReviewOffer({
	block,
	onAnswer,
}: {
	block: ChatReviewOfferBlock
	onAnswer: ReviewHandlers['onAnswer']
}) {
	const zone = useMainTimeZone()
	const [busy, setBusy] = useState<'yes' | 'no' | null>(null)
	const [failed, setFailed] = useState(false)
	if (block.state !== 'proposed') return null
	const name = block.studentName
	const sentence =
		block.lastReviewedAt === null
			? `${name}'s notes and vocabulary have never been reviewed. Run a review?`
			: `The last review of ${name}'s notes and vocabulary was on ${dayOf(block.lastReviewedAt, zone)}. Run a new one?`

	async function answer(yes: boolean) {
		if (busy !== null) return
		setBusy(yes ? 'yes' : 'no')
		setFailed(false)
		try {
			if (!(await onAnswer(block, yes))) setFailed(true)
		} finally {
			setBusy(null)
		}
	}

	return (
		<Panel>
			<div
				role="group"
				aria-label="Review question"
				aria-busy={busy !== null}
				data-slot="chat-review"
				data-state="offer"
				className="flex flex-col gap-2 px-4 py-3"
			>
				<p className="text-body wrap-anywhere text-foreground">{sentence}</p>
				<div className="flex flex-wrap gap-2">
					<Button
						variant="primary"
						size="compact"
						className={TOUCH}
						leadingIcon={busy === 'yes' ? Spinner : undefined}
						disabled={busy !== null}
						onClick={() => void answer(true)}
					>
						Yes
					</Button>
					<Button
						variant="secondary"
						size="compact"
						className={TOUCH}
						disabled={busy !== null}
						onClick={() => void answer(false)}
					>
						No
					</Button>
				</div>
				{failed ? (
					<p role="alert" className="text-caption text-destructive">
						Could not save the answer. Try again.
					</p>
				) : null}
			</div>
		</Panel>
	)
}
