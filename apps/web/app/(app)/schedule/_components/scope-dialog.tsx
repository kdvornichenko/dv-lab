'use client'

import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'

import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import type { CalendarEditScope } from '@dv-lab/contracts'

export type ScopeKind =
	{ subject: 'event'; action: 'delete' | 'save' } | { subject: 'lesson'; action: 'save' | 'cancel' }

interface ScopeCopy {
	title: string
	rows: readonly { scope: CalendarEditScope; label: string }[]
	note: string | null
	safe: string
	confirm: string
	pending: string
	failure: string
	destructive: boolean
}

const EVENT_ROWS = [
	{ scope: 'one', label: 'This event' },
	{ scope: 'following', label: 'This and following events' },
	{ scope: 'all', label: 'All events' },
] as const

const LESSON_FAILURE = 'Could not apply this change. Refresh the calendar before trying again.'

function copyOf(kind: ScopeKind): ScopeCopy {
	if (kind.subject === 'event' && kind.action === 'delete')
		return {
			title: 'Delete repeating event',
			rows: EVENT_ROWS,
			note: null,
			safe: 'Keep events',
			confirm: 'Delete',
			pending: 'Deleting…',
			failure: 'Could not delete the event. Try again.',
			destructive: true,
		}
	if (kind.subject === 'event')
		return {
			title: 'Change repeating event',
			rows: EVENT_ROWS,
			note: null,
			safe: 'Back',
			confirm: 'Save',
			pending: 'Saving…',
			failure: 'Could not save the event. Try again.',
			destructive: false,
		}
	if (kind.action === 'cancel')
		return {
			title: 'Cancel repeating lesson',
			rows: [
				{ scope: 'one', label: 'This lesson' },
				{ scope: 'following', label: 'This and following lessons' },
			],
			note: 'Past lessons and their marks stay as they are.',
			safe: 'Keep lessons',
			confirm: 'Cancel lessons',
			pending: 'Cancelling…',
			failure: LESSON_FAILURE,
			destructive: true,
		}
	return {
		title: 'Change repeating lesson',
		rows: [
			{ scope: 'one', label: 'This lesson' },
			{ scope: 'following', label: 'This and following lessons' },
			{ scope: 'all', label: 'All lessons' },
		],
		note: 'Lessons with a mark or a comment, and the lessons before them, stay at their old time.',
		safe: 'Back',
		confirm: 'Save',
		pending: 'Saving…',
		failure: LESSON_FAILURE,
		destructive: false,
	}
}

function unavailableLine(labels: readonly string[]): string {
	return `${labels.join(' and ')} ${labels.length > 1 ? 'are' : 'is'} unavailable for this series. Change it in Google Calendar.`
}

export function ScopeDialog({
	kind,
	allowed,
	onConfirm,
	onClose,
	onDone = onClose,
}: {
	kind: ScopeKind
	allowed: readonly CalendarEditScope[]
	onConfirm: (scope: CalendarEditScope) => Promise<boolean>
	onClose: () => void
	onDone?: () => void
}) {
	const copy = copyOf(kind)
	const [scope, setScope] = useState<CalendarEditScope>('one')
	const [pending, setPending] = useState(false)
	const [failed, setFailed] = useState(false)
	const titleId = useId()
	const reasonId = useId()
	const unavailable = copy.rows.filter((row) => !allowed.includes(row.scope)).map((row) => row.label)

	async function confirm() {
		if (pending || !allowed.includes(scope)) return
		setFailed(false)
		setPending(true)
		const done = await onConfirm(scope)
		setPending(false)
		if (done) onDone()
		else setFailed(true)
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !pending) onClose()
			}}
		>
			<DialogContent size="sm" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle id={titleId}>{copy.title}</DialogTitle>
					<DialogDescription className="sr-only">Choose which {kind.subject}s this covers.</DialogDescription>
				</DialogHeader>
				<RadioGroup
					value={scope}
					onValueChange={(value) => setScope(value as CalendarEditScope)}
					aria-labelledby={titleId}
					aria-describedby={unavailable.length > 0 ? reasonId : undefined}
					disabled={pending}
					className="flex flex-col gap-1"
				>
					{copy.rows.map((row) => (
						<Radio.Root
							key={row.scope}
							value={row.scope}
							disabled={!allowed.includes(row.scope)}
							className={cn(
								'group flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-body text-foreground outline-none',
								'hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus-ring',
								'data-[checked]:bg-active data-[checked]:font-semibold',
								'data-[disabled]:cursor-default data-[disabled]:opacity-50 data-[disabled]:hover:bg-transparent'
							)}
						>
							<span
								aria-hidden
								className="flex size-4 shrink-0 items-center justify-center rounded-full ring-1 ring-input ring-inset group-data-[checked]:bg-primary group-data-[checked]:ring-0"
							>
								<Radio.Indicator className="size-1.5 rounded-full bg-primary-foreground" />
							</span>
							<span className="min-w-0 flex-1 truncate">{row.label}</span>
						</Radio.Root>
					))}
				</RadioGroup>
				{unavailable.length > 0 ? (
					<p id={reasonId} className="mt-2 text-caption text-muted-foreground">
						{unavailableLine(unavailable)}
					</p>
				) : null}
				{copy.note !== null ? <p className="mt-2 text-caption text-muted-foreground">{copy.note}</p> : null}
				{failed ? (
					<p role="alert" className="mt-2 text-body text-destructive">
						{copy.failure}
					</p>
				) : null}
				<DialogFooter className="mt-2 max-sm:flex-col-reverse max-sm:*:h-10 max-sm:*:w-full">
					<Button type="button" variant="secondary" autoFocus onClick={onClose} disabled={pending}>
						{copy.safe}
					</Button>
					<Button
						type="button"
						variant={copy.destructive ? 'tertiary' : 'primary'}
						className={copy.destructive ? 'text-destructive' : undefined}
						loading={pending}
						onClick={() => void confirm()}
					>
						{pending ? copy.pending : copy.confirm}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
