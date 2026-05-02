'use client'

import { type FC, useState } from 'react'

import { Copy, Terminal, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

import { LOG_TYPE_META } from './error-log-model'
import type { KeyValProps, LogDetailSheetProps, LogSectionProps } from './error-log.types'

export const ErrorLogDetailSheet: FC<LogDetailSheetProps> = ({ entry, onClose, onDelete }) => {
	const meta = entry ? LOG_TYPE_META[entry.type] : null
	const Icon = meta?.icon ?? Terminal

	return (
		<Sheet open={Boolean(entry)} onOpenChange={(open) => !open && onClose()}>
			<SheetContent className="max-w-xl! bg-surface sm:w-136 gap-0 p-0" side="right">
				{entry && meta ? (
					<>
						<SheetHeader className="border-line-soft border-b p-5 pr-12">
							<SheetTitle className="flex items-center gap-2 font-mono text-base">
								<span className="bg-danger size-1.5 rounded-full" />
								<span className="text-danger text-[10px] uppercase tracking-wider">error</span>
								<span className="text-ink truncate">{entry.eventId}</span>
								<Badge tone={meta.badge} className="gap-1.5 font-mono text-[10px]">
									<Icon className="size-3" />
									{meta.label}
								</Badge>
							</SheetTitle>
							<p className="text-ink-muted mt-1 font-mono text-[11px]">
								{entry.dateLabel} · {entry.timeLabel} · {entry.source}
							</p>
							<SheetDescription className="sr-only">
								Log details for {entry.eventId}, including message, identifiers, and payload.
							</SheetDescription>
						</SheetHeader>

						<ScrollArea className="min-h-0 flex-1">
							<div className="space-y-6 py-5">
								<LogSection title="Message" copyValue={entry.message}>
									<pre className="border-line-soft bg-surface-muted text-ink/90 overflow-x-auto whitespace-pre-wrap rounded-md border p-3 font-mono text-[12px] leading-relaxed">
										{entry.message}
									</pre>
								</LogSection>

								<LogSection title="Identifiers">
									<KeyVal label="Event" value={entry.eventId} copy />
									<KeyVal label="Trace" value={entry.traceId} copy />
									<KeyVal label="Type" value={entry.typeLabel} />
									<KeyVal label="Source" value={entry.source} />
									{entry.endpoint ? <KeyVal label="Endpoint" value={entry.endpoint} copy /> : null}
								</LogSection>

								<LogSection title="Payload" copyValue={JSON.stringify(entry, null, 2)}>
									<pre className="border-line-soft bg-surface-muted text-ink/85 max-h-72 overflow-auto rounded-md border p-3 font-mono text-[11px] leading-relaxed">
										{JSON.stringify(
											{
												id: entry.id,
												type: entry.type,
												endpoint: entry.endpoint,
												source: entry.source,
												message: entry.message,
												createdAt: entry.createdAt,
											},
											null,
											2
										)}
									</pre>
								</LogSection>

								<div className="px-5 pb-5">
									<Separator className="mb-4" />
									<div className="flex flex-wrap items-center gap-2">
										<Button size="sm" variant="outline" type="button" onClick={() => void onDelete(entry.id)}>
											<Trash2 className="size-4" />
											Delete log
										</Button>
										<Button size="sm" variant="outline" type="button" onClick={onClose}>
											Close
										</Button>
									</div>
								</div>
							</div>
						</ScrollArea>
					</>
				) : null}
			</SheetContent>
		</Sheet>
	)
}

const LogSection: FC<LogSectionProps> = ({ title, copyValue, children }) => {
	const [copied, setCopied] = useState(false)

	return (
		<section className="px-5">
			<header className="mb-2 flex items-center justify-between gap-3">
				<h3 className="text-ink-muted font-mono text-[10px] uppercase tracking-[0.25em]">{title}</h3>
				{copyValue ? (
					<button
						type="button"
						className="text-ink-muted hover:bg-sage-soft hover:text-sage inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors"
						onClick={() => {
							void navigator.clipboard.writeText(copyValue)
							setCopied(true)
							window.setTimeout(() => setCopied(false), 1200)
						}}
					>
						<Copy className="size-3" />
						{copied ? 'Copied' : 'Copy'}
					</button>
				) : null}
			</header>
			<div className="flex flex-col gap-1.5">{children}</div>
		</section>
	)
}

const KeyVal: FC<KeyValProps> = ({ label, value, copy = false }) => {
	const [copied, setCopied] = useState(false)

	return (
		<div className="hover:bg-sage-soft/45 group flex items-baseline justify-between gap-3 rounded-md px-2 py-1 transition-colors">
			<span className="text-ink-muted font-mono text-[10px] uppercase tracking-[0.2em]">{label}</span>
			<span className="flex min-w-0 items-center gap-1.5">
				<span className="max-w-70 text-ink/90 truncate font-mono text-[12px]">{value}</span>
				{copy ? (
					<button
						type="button"
						aria-label={`Copy ${label}`}
						className="text-ink-muted/50 hover:bg-sage-soft hover:text-sage inline-flex size-5 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
						onClick={() => {
							void navigator.clipboard.writeText(value)
							setCopied(true)
							window.setTimeout(() => setCopied(false), 1200)
						}}
					>
						{copied ? <span className="text-[9px]">ok</span> : <Copy className="size-3" />}
					</button>
				) : null}
			</span>
		</div>
	)
}
