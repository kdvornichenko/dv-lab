'use client'

import { useId, type ReactNode } from 'react'

import { Info, TriangleAlert } from 'lucide-react'

import { Panel } from '@/components/app/layout-parts'
import { Button } from '@/components/ui/button'

import type { ChatEssayBlock } from '@dv-lab/contracts'

export type EssayOutcome = 'streaming' | 'complete' | 'incomplete' | 'unavailable'

export const ESSAY_LABEL = 'Approximate estimate — not an official IELTS score.'

const TOUCH = 'pointer-coarse:h-11'

function AskAnother({ onAsk }: { onAsk: () => void }) {
	return (
		<div className="flex flex-wrap gap-2">
			<Button variant="secondary" size="compact" className={TOUCH} onClick={onAsk}>
				Ask another question
			</Button>
		</div>
	)
}

export function EssayFeedback({
	task,
	outcome,
	onAsk,
	children,
}: {
	task: ChatEssayBlock['task']
	outcome: EssayOutcome
	onAsk: () => void
	children?: ReactNode
}) {
	const labelId = useId()
	return (
		<Panel>
			<div
				role="group"
				aria-label="Essay feedback"
				aria-describedby={labelId}
				aria-busy={outcome === 'streaming'}
				data-slot="chat-essay"
				data-outcome={outcome}
				className="flex min-w-0 flex-col gap-3 px-4 py-3"
			>
				<h3 className="text-title font-semibold text-foreground">Essay feedback</h3>
				<p
					id={labelId}
					data-slot="chat-essay-label"
					className="flex items-start gap-2 rounded-lg bg-hover px-2.5 py-1.5 text-caption font-medium text-foreground"
				>
					<Info aria-hidden size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
					<span className="min-w-0 flex-1 wrap-anywhere">{ESSAY_LABEL}</span>
				</p>
				{outcome === 'unavailable' ? (
					<>
						<div className="flex flex-col gap-1">
							<p className="text-body font-semibold text-foreground">Feedback unavailable</p>
							<p className="text-body text-muted-foreground">Could not complete feedback for this essay.</p>
						</div>
						<AskAnother onAsk={onAsk} />
					</>
				) : (
					<>
						{task === null ? (
							<div data-slot="chat-essay-task" className="flex flex-col gap-1">
								<p className="text-body font-semibold text-foreground">Task criterion not assessed</p>
								<p className="text-body wrap-anywhere text-muted-foreground">
									No task prompt or task type was supplied.
								</p>
							</div>
						) : null}
						{children}
						{outcome === 'incomplete' ? (
							<>
								<p
									role="status"
									className="flex items-start gap-2 text-body font-semibold text-foreground"
									data-slot="chat-essay-incomplete"
								>
									<TriangleAlert aria-hidden size={16} className="mt-0.5 shrink-0 text-warning" />
									<span className="min-w-0 flex-1">Feedback incomplete</span>
								</p>
								<AskAnother onAsk={onAsk} />
							</>
						) : null}
					</>
				)}
			</div>
		</Panel>
	)
}
