'use client'

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { motion, useReducedMotion } from 'framer-motion'
import { LoaderCircle } from 'lucide-react'
import Link from 'next/link'

import { Panel } from '@/components/app/layout-parts'
import { MarkdownView } from '@/components/app/markdown-view'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Banner, BannerAction, BannerActions, BannerDescription, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { formatTime, formatWhen, mainWhen, secondWhen, yearInZone } from '@/lib/schedule-format'
import { spring } from '@/lib/springs'
import { zoneLabel } from '@/lib/time-zones'

import type { ChatBlock, ChatClarifyBlock, ChatMessage, ChatRefusedBlock, MentionBinding } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE } from '@dv-lab/core'

import { ActionResult } from './action-result'
import { CalendarProposal } from './calendar-proposal'
import { ChatProgress } from './chat-progress'
import { RecordBlockView, isRecordBlock } from './fact-blocks'
import { ReplyFooter } from './reply-footer'
import { StudentMention } from './student-mention'

export type CalendarHandlers = {
	onConfirm: (actionId: string) => void
	onCheck: (actionId: string) => Promise<void>
}

export type ReplyHandlers = {
	onAsk: () => void
	onCheckStatus: () => Promise<void>
}

export type ActiveReply = { messageId: string | null; stopping: boolean }

type Notice = { tone: 'info' | 'warning'; title: string; line?: string; settings?: boolean }

const CALENDAR_STILL = 'Marks, notes and comments still work.'

function notice(block: ChatRefusedBlock, secondZone: string | null): Notice {
	switch (block.code) {
		case 'lesson_done':
			return {
				tone: 'info',
				title: 'This lesson is marked Done, so it stays where it is.',
				line: 'Set the mark to Scheduled first, then ask again.',
			}
		case 'lesson_not_started': {
			const zone = block.timeZone
			const at = block.lessonStartsAt ? new Date(block.lessonStartsAt) : null
			const line =
				at !== null && zone !== undefined
					? `This lesson is on ${mainWhen(at, zone, secondZone, yearInZone(new Date(), zone))}.`
					: undefined
			if (block.kind === 'comment')
				return { tone: 'info', title: 'Comments can be added once the lesson has started.', line }
			return { tone: 'info', title: 'You can mark a lesson once it has started.', line }
		}
		case 'outside_sync_window':
			return {
				tone: 'info',
				title:
					'This week is outside the synced range, from 8 weeks back to 53 weeks ahead. Calendar changes are unavailable.',
				line: CALENDAR_STILL,
			}
		case 'connection_required':
			return {
				tone: 'info',
				title: 'Connect Google Calendar to use the calendar. Previously saved history is available for viewing.',
				line: CALENDAR_STILL,
				settings: true,
			}
		case 'command_pending':
			return { tone: 'info', title: 'Earlier calendar requests need recovery before you can make new changes.' }
		case 'calendar_unavailable':
			return {
				tone: 'info',
				title: 'Google Calendar is unavailable. Showing the last checked view. Calendar changes are disabled.',
			}
		case 'series_marked':
			return {
				tone: 'info',
				title: 'This series has marked lessons on or after that date, so it cannot move from there.',
				line: 'Lessons with a mark or a comment stay where they are. Choose a later date, or move one lesson.',
			}
		case 'lesson_changed':
			return {
				tone: 'warning',
				title: 'This lesson changed after you asked. Nothing was changed.',
				line: 'Ask again to use its current time.',
			}
		case 'mention_stale':
			return { tone: 'warning', title: 'This student is no longer available. Choose a student again.' }
		case 'out_of_phase':
			return { tone: 'info', title: 'This change is not available in chat yet. Use the existing screen.' }
		case 'budget_reached':
			return { tone: 'info', title: 'Chat is paused because its monthly budget has been reached.' }
		case 'budget_insufficient':
			return { tone: 'info', title: 'Not enough budget for this request.' }
		case 'not_found':
			return block.kind === 'note'
				? { tone: 'warning', title: 'This student is no longer available. Choose a student again.' }
				: { tone: 'warning', title: 'Could not find this lesson. Nothing was changed.' }
		case 'credits_unavailable':
			return {
				tone: 'info',
				title: 'API credits unavailable',
				line: 'The API account cannot admit this request. Check its billing status.',
			}
		case 'model_refused':
			return {
				tone: 'info',
				title: 'The assistant declined to answer this request.',
				line: 'Try asking in other words.',
			}
		case 'model_unavailable':
		case 'provider_unavailable':
			return { tone: 'info', title: 'Model settings are unavailable. Refresh before sending.' }
	}
}

function Refused({ block }: { block: ChatRefusedBlock }) {
	const [secondZone] = useSecondZone(block.timeZone ?? null)
	const shown = notice(block, secondZone)
	return (
		<Banner status={shown.tone} role="status" data-refusal={block.code}>
			<BannerTitle>{shown.title}</BannerTitle>
			{shown.line ? <BannerDescription>{shown.line}</BannerDescription> : null}
			{shown.settings ? (
				<BannerActions>
					<Button variant="secondary" size="compact" render={<Link href="/settings" />}>
						Connect Google Calendar
					</Button>
				</BannerActions>
			) : null}
		</Banner>
	)
}

function Clarify({
	block,
	onChoose,
}: {
	block: ChatClarifyBlock
	onChoose: (block: ChatClarifyBlock, reply: string) => void
}) {
	const zone = block.options[0]?.timeZone ?? null
	const [secondZone] = useSecondZone(zone)
	const year = zone === null ? 0 : yearInZone(new Date(), zone)
	if (block.question === 'date_time') {
		return (
			<Panel>
				<div role="status" data-slot="chat-clarify" className="flex flex-col gap-1 px-4 py-3">
					<p className="text-body font-semibold text-foreground">What date and time do you mean?</p>
					<p className="text-caption text-muted-foreground">Answer in the message box.</p>
				</div>
			</Panel>
		)
	}
	return (
		<Panel>
			<div role="status" data-slot="chat-clarify" className="flex flex-col gap-2 px-4 py-3">
				<p className="text-body font-semibold text-foreground">Which lesson do you mean?</p>
				<ul className="-mx-2 flex flex-col">
					{block.options.slice(0, 5).map((option) => {
						const at = new Date(option.startsAt)
						const second = secondWhen(at, option.timeZone, secondZone)
						const main = `${formatWhen(at, option.timeZone, year)} ${zoneLabel(option.timeZone, at)}`
						return (
							<li key={option.startsAt}>
								<button
									type="button"
									className="flex h-10 w-full items-center gap-3 rounded-lg px-2 text-left tabular-nums outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
									onClick={() => onChoose(block, option.reply)}
								>
									<span className="min-w-0 flex-1 truncate">
										<span className="text-body text-foreground">{main}</span>{' '}
										<span className="text-micro text-muted-foreground">
											{second === null ? block.studentName : `${second} · ${block.studentName}`}
										</span>
									</span>
								</button>
							</li>
						)
					})}
				</ul>
			</div>
		</Panel>
	)
}

function Block({
	block,
	onUndo,
	onChoose,
	calendar,
	replies,
}: {
	block: ChatBlock
	onUndo: (actionId: string) => void
	onChoose: (block: ChatClarifyBlock, reply: string) => void
	calendar: CalendarHandlers
	replies: ReplyHandlers
}) {
	if (block.type === 'action_result') return <ActionResult block={block} onUndo={onUndo} />
	if (block.type === 'clarify') return <Clarify block={block} onChoose={onChoose} />
	if (block.type === 'calendar_proposal') return <CalendarProposal block={block} onUndo={onUndo} {...calendar} />
	if (block.type === 'refused') return <Refused block={block} />
	if (isRecordBlock(block)) return <RecordBlockView block={block} />
	if (block.type === 'stopped') return <p className="text-caption text-muted-foreground">Reply stopped.</p>
	if (block.type === 'withheld') return <Withheld onAsk={replies.onAsk} />
	if (block.type === 'interrupted') return <Interrupted onCheckStatus={replies.onCheckStatus} />
	return null
}

function Withheld({ onAsk }: { onAsk: () => void }) {
	return (
		<Banner status="warning" role="status" data-reply-state="withheld">
			<BannerTitle>Could not verify this answer from the available records.</BannerTitle>
			<BannerActions>
				<BannerAction onClick={onAsk}>Ask another question</BannerAction>
			</BannerActions>
		</Banner>
	)
}

function Interrupted({ onCheckStatus }: { onCheckStatus: () => Promise<void> }) {
	const [checking, setChecking] = useState(false)
	async function check() {
		setChecking(true)
		try {
			await onCheckStatus()
		} finally {
			setChecking(false)
		}
	}
	return (
		<Banner status="warning" role="status" data-reply-state="interrupted" aria-busy={checking}>
			<BannerTitle>This reply was interrupted. Check its status before sending again.</BannerTitle>
			<BannerActions>
				<BannerAction disabled={checking} onClick={() => void check()}>
					Check status
				</BannerAction>
			</BannerActions>
		</Banner>
	)
}

function Working({ label }: { label: string }) {
	return (
		<p role="status" className="flex items-center gap-2 text-body text-muted-foreground">
			<LoaderCircle size={16} className="shrink-0 animate-spin" aria-hidden />
			{label}
		</p>
	)
}

function renderMention(studentId: string, children: ReactNode): ReactNode {
	return <StudentMention studentId={studentId}>{children}</StudentMention>
}

function messageTime(iso: string): string {
	return formatTime(new Date(iso), SCHEDULE_TIME_ZONE)
}

function fullTime(iso: string): string {
	const at = new Date(iso)
	return `${formatWhen(at, SCHEDULE_TIME_ZONE, yearInZone(new Date(), SCHEDULE_TIME_ZONE))} ${zoneLabel(SCHEDULE_TIME_ZONE, at)}`
}

function TeacherText({ text, mentions }: { text: string; mentions: readonly MentionBinding[] }) {
	const parts: ReactNode[] = []
	let cursor = 0
	for (const binding of [...mentions].sort((left, right) => left.start - right.start)) {
		const start = binding.start > 0 && text[binding.start - 1] === '@' ? binding.start - 1 : binding.start
		if (start < cursor || binding.end > text.length) continue
		parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor, start)}</Fragment>)
		parts.push(
			<StudentMention key={`m${start}`} studentId={binding.studentId}>
				{text.slice(start, binding.end)}
			</StudentMention>
		)
		cursor = binding.end
	}
	parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor)}</Fragment>)
	return <>{parts}</>
}

function MessageItem({
	message,
	reduceMotion,
	busy = false,
	children,
}: {
	message: ChatMessage
	reduceMotion: boolean
	busy?: boolean
	children: ReactNode
}) {
	return (
		<motion.li
			data-message-id={message.id}
			data-role={message.role}
			aria-busy={busy || undefined}
			className={
				message.role === 'teacher'
					? 'group/message flex max-w-[80%] flex-col items-end gap-1 self-end'
					: 'group/message flex flex-col gap-3'
			}
			initial={reduceMotion ? false : { opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ type: 'spring', duration: spring.moderate.duration, bounce: 0 }}
		>
			{children}
		</motion.li>
	)
}

export function Messages({
	messages,
	onUndo,
	onChoose,
	calendar,
	replies,
	active,
}: {
	messages: readonly ChatMessage[]
	onUndo: (actionId: string) => void
	onChoose: (block: ChatClarifyBlock, reply: string) => void
	calendar: CalendarHandlers
	replies: ReplyHandlers
	active: ActiveReply | null
}) {
	const reduceMotion = useReducedMotion() ?? false
	const end = useRef<HTMLDivElement>(null)
	const atBottom = useRef(true)
	const lastSent = useRef<string | null>(null)
	const orphan = active !== null && !messages.some((message) => message.id === active.messageId)

	useEffect(() => {
		const viewport = end.current?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
		if (!viewport) return
		const track = () => {
			atBottom.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 4
		}
		viewport.addEventListener('scroll', track, { passive: true })
		return () => viewport.removeEventListener('scroll', track)
	}, [])

	useLayoutEffect(() => {
		const viewport = end.current?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
		const sent = messages.findLast((message) => message.role === 'teacher')?.id ?? null
		if (sent !== lastSent.current) {
			lastSent.current = sent
			atBottom.current = true
		}
		if (viewport && atBottom.current) viewport.scrollTop = viewport.scrollHeight
	}, [messages])

	return (
		<>
			<ol className="flex flex-col gap-4" data-slot="chat-messages">
				{messages.map((message) =>
					message.role === 'teacher' ? (
						<MessageItem key={message.id} message={message} reduceMotion={reduceMotion}>
							<p className="rounded-2xl bg-active px-3.5 py-2 text-body [overflow-wrap:anywhere] break-words whitespace-pre-wrap text-foreground">
								<TeacherText text={message.body} mentions={message.mentions} />
							</p>
							<span className="text-caption text-muted-foreground tabular-nums">{messageTime(message.createdAt)}</span>
						</MessageItem>
					) : (
						<MessageItem
							key={message.id}
							message={message}
							reduceMotion={reduceMotion}
							busy={active?.messageId === message.id}
						>
							<ChatProgress
								steps={message.steps}
								live={active?.messageId === message.id}
								hasText={message.body !== ''}
							/>
							{message.body === '' ? null : (
								<MarkdownView
									body={message.body}
									chat={{
										mentions: message.mentions,
										streaming: active?.messageId === message.id && !active.stopping,
										renderMention,
									}}
								/>
							)}
							{active?.messageId === message.id && active.stopping ? <Working label="Stopping reply…" /> : null}
							{message.blocks.map((block, index) => (
								<Block
									key={
										block.type === 'action_result' || block.type === 'calendar_proposal'
											? block.actionId
											: `${message.id}-${index}`
									}
									block={block}
									onUndo={onUndo}
									onChoose={onChoose}
									calendar={calendar}
									replies={replies}
								/>
							))}
							{active?.messageId === message.id ? null : (
								<ReplyFooter
									time={messageTime(message.finishedAt ?? message.createdAt)}
									title={fullTime(message.finishedAt ?? message.createdAt)}
									copyText={message.body === '' ? null : message.body}
								/>
							)}
						</MessageItem>
					)
				)}
			</ol>
			{orphan ? <ChatProgress steps={[]} live hasText={false} /> : null}
			<div ref={end} aria-hidden />
		</>
	)
}
