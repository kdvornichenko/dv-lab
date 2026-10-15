import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { placeView, type EventDescriptionBlock, type EventTextRun } from '@dv-lab/contracts'

const LINK_CLASS =
	'text-foreground underline decoration-foreground/45 decoration-1 underline-offset-2 transition-colors duration-80 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export function EventLink({ href, className, children, ...props }: ComponentProps<'a'> & { href: string }) {
	return (
		<a href={href} target="_blank" rel="noopener noreferrer" className={cn(LINK_CLASS, className)} {...props}>
			{children}
		</a>
	)
}

function Run({ run }: { run: EventTextRun }) {
	if (run.kind === 'break') return <br />
	let node: ReactNode = run.text
	if (run.bold) node = <strong className="font-semibold">{node}</strong>
	if (run.italic) node = <em>{node}</em>
	if (run.underline) node = <u>{node}</u>
	if (run.kind === 'link') node = <EventLink href={run.href}>{node}</EventLink>
	return node
}

function Runs({ runs }: { runs: readonly EventTextRun[] }) {
	return runs.map((run, index) => <Run key={index} run={run} />)
}

function Block({ block }: { block: EventDescriptionBlock }) {
	if (block.kind === 'divider')
		return <div role="separator" data-slot="event-divider" className="my-1 h-px shrink-0 bg-border" />
	if (block.kind === 'paragraph')
		return (
			<p className="text-body wrap-anywhere text-foreground">
				<Runs runs={block.runs} />
			</p>
		)
	const List = block.ordered ? 'ol' : 'ul'
	return (
		<List
			className={cn(
				'flex flex-col gap-0.5 ps-5 text-body wrap-anywhere text-foreground',
				block.ordered ? 'list-decimal' : 'list-disc'
			)}
		>
			{block.items.map((item, index) => (
				<li key={index}>
					<Runs runs={item} />
				</li>
			))}
		</List>
	)
}

export function EventDescription({ blocks }: { blocks: readonly EventDescriptionBlock[] }) {
	if (blocks.length === 0) return null
	return (
		<div data-slot="event-description" className="scroll-fade -m-1 flex max-h-40 flex-col gap-2 overflow-y-auto p-1">
			{blocks.map((block, index) => (
				<Block key={index} block={block} />
			))}
		</div>
	)
}

export function EventPlace({ location }: { location: string | null }) {
	const view = placeView(location)
	if (view === null) return null
	if (view.kind === 'text') return <span data-slot="event-place-text">{view.text}</span>
	return (
		<EventLink href={view.href} data-slot="event-place" className="block min-w-0 truncate leading-5">
			{view.label}
		</EventLink>
	)
}
