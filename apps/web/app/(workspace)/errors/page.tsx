'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
	AlertCircle,
	AlertTriangle,
	CalendarClock,
	Copy,
	Database,
	Pause,
	Play,
	RefreshCw,
	Search,
	Settings,
	Terminal,
	Trash2,
	Users,
	WalletCards,
	X,
	XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Kbd } from '@/components/ui/kbd'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
	clearCrmErrors,
	deleteCrmError,
	listCrmErrors,
	subscribeCrmErrors,
	type CrmErrorLogEntry,
} from '@/lib/crm/error-log'
import { cn } from '@/lib/utils'

type LogType = 'all' | 'calendar' | 'students' | 'lessons' | 'payments' | 'settings' | 'system'

type LogEntryView = CrmErrorLogEntry & {
	endpoint: string | null
	eventId: string
	type: Exclude<LogType, 'all'>
	typeLabel: string
	createdDate: Date
	timeLabel: string
	dateLabel: string
	traceId: string
}

const LOG_TYPES: Array<{ value: LogType; label: string }> = [
	{ value: 'all', label: 'All types' },
	{ value: 'calendar', label: 'Calendar' },
	{ value: 'students', label: 'Students' },
	{ value: 'lessons', label: 'Lessons' },
	{ value: 'payments', label: 'Payments' },
	{ value: 'settings', label: 'Settings' },
	{ value: 'system', label: 'System' },
]

const LOG_TYPE_META: Record<
	Exclude<LogType, 'all'>,
	{ label: string; icon: typeof Terminal; badge: 'blue' | 'green' | 'amber' | 'neutral' | 'red' }
> = {
	calendar: { label: 'Calendar', icon: CalendarClock, badge: 'blue' },
	students: { label: 'Students', icon: Users, badge: 'green' },
	lessons: { label: 'Lessons', icon: Database, badge: 'amber' },
	payments: { label: 'Payments', icon: WalletCards, badge: 'green' },
	settings: { label: 'Settings', icon: Settings, badge: 'neutral' },
	system: { label: 'System', icon: Terminal, badge: 'red' },
}

function formatLogTime(value: string) {
	return new Intl.DateTimeFormat('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	}).format(new Date(value))
}

function formatLogDate(value: string) {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: '2-digit',
		year: 'numeric',
	}).format(new Date(value))
}

function inferLogType(error: CrmErrorLogEntry): Exclude<LogType, 'all'> {
	const text = `${error.source} ${error.message}`.toLowerCase()
	if (text.includes('calendar') || text.includes('google')) return 'calendar'
	if (text.includes('student')) return 'students'
	if (text.includes('lesson') || text.includes('attendance')) return 'lessons'
	if (text.includes('payment') || text.includes('billing')) return 'payments'
	if (text.includes('settings') || text.includes('sidebar') || text.includes('theme')) return 'settings'
	return 'system'
}

function extractEndpoint(message: string) {
	const match = message.match(/\b(GET|POST|PATCH|PUT|DELETE)\s+(\/?api\/[^\s:]+)/i)
	if (!match) return null

	const method = match[1].toUpperCase()
	const endpoint = match[2].startsWith('/') ? match[2] : `/${match[2]}`
	return `${method} ${endpoint}`
}

function normalizeLogEntry(error: CrmErrorLogEntry): LogEntryView {
	const type = inferLogType(error)
	return {
		...error,
		endpoint: extractEndpoint(error.message),
		eventId: `log_${error.id.slice(-6)}`,
		type,
		typeLabel: LOG_TYPE_META[type].label,
		createdDate: new Date(error.createdAt),
		timeLabel: formatLogTime(error.createdAt),
		dateLabel: formatLogDate(error.createdAt),
		traceId: `tr_${error.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`,
	}
}

function matchLogQuery(entry: LogEntryView, query: string) {
	if (!query) return true
	return [entry.eventId, entry.traceId, entry.typeLabel, entry.endpoint, entry.source, entry.message]
		.join(' ')
		.toLowerCase()
		.includes(query)
}

export default function ErrorLogPage() {
	const [errors, setErrors] = useState<CrmErrorLogEntry[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [isPaused, setIsPaused] = useState(false)
	const [query, setQuery] = useState('')
	const [typeFilter, setTypeFilter] = useState<LogType>('all')
	const [selectedId, setSelectedId] = useState<string | null>(null)

	const syncErrors = useCallback(async () => {
		try {
			setErrors(await listCrmErrors())
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to load CRM errors'
			toast.error('Log stream unavailable', { description: message })
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		void syncErrors()
		if (isPaused) return
		return subscribeCrmErrors(() => void syncErrors())
	}, [isPaused, syncErrors])

	const entries = useMemo(
		() => errors.map(normalizeLogEntry).sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime()),
		[errors]
	)
	const normalizedQuery = query.trim().toLowerCase()
	const filteredEntries = useMemo(
		() =>
			entries.filter((entry) => {
				if (typeFilter !== 'all' && entry.type !== typeFilter) return false
				return matchLogQuery(entry, normalizedQuery)
			}),
		[entries, normalizedQuery, typeFilter]
	)
	const selected = entries.find((entry) => entry.id === selectedId) ?? null
	const typeCounts = useMemo(() => {
		return entries.reduce(
			(acc, entry) => {
				acc[entry.type] = (acc[entry.type] ?? 0) + 1
				return acc
			},
			{} as Partial<Record<Exclude<LogType, 'all'>, number>>
		)
	}, [entries])

	async function removeError(errorId: string) {
		try {
			await deleteCrmError(errorId)
			if (selectedId === errorId) setSelectedId(null)
			await syncErrors()
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to delete log entry'
			toast.error('Delete failed', { description: message })
		}
	}

	async function removeAllErrors() {
		try {
			await clearCrmErrors()
			setSelectedId(null)
			setErrors([])
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to clear log entries'
			toast.error('Clear failed', { description: message })
		}
	}

	return (
		<main className="min-h-full px-4 py-6 sm:px-6">
			<div className="mx-auto w-full max-w-7xl space-y-4">
				<header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex min-w-0 items-center gap-2">
						<Terminal className="text-ink-muted size-4 shrink-0" />
						<h1 className="font-heading text-ink text-xl font-semibold">Logs</h1>
						<Badge variant="outline" className="ml-1 gap-1.5 font-mono text-[10px] uppercase">
							<span
								className={cn('size-1.5 rounded-full', isPaused ? 'bg-ink-muted/60' : 'bg-success animate-pulse')}
							/>
							{isPaused ? 'paused' : 'live'}
						</Badge>
						<Badge tone={entries.length > 0 ? 'red' : 'green'} className="font-mono tabular-nums">
							{entries.length} saved
						</Badge>
					</div>

					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						<InputGroup className="bg-surface w-full sm:w-80">
							<InputGroupAddon>
								<Search className="size-3.5" />
							</InputGroupAddon>
							<InputGroupInput
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="type:calendar token"
								className="font-mono text-xs"
								aria-label="Search logs"
							/>
							<InputGroupAddon align="inline-end">
								<Kbd>/</Kbd>
							</InputGroupAddon>
						</InputGroup>
						<Button size="sm" variant="outline" onClick={() => setIsPaused((current) => !current)}>
							{isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
							{isPaused ? 'Resume' : 'Pause'}
						</Button>
						<Button size="sm" variant="outline" onClick={() => void syncErrors()} disabled={isLoading}>
							<RefreshCw className={cn('size-4', isLoading && 'animate-spin')} />
							Refresh
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={isLoading || entries.length === 0}
							onClick={() => void removeAllErrors()}
						>
							<XCircle className="size-4" />
							Clear all
						</Button>
					</div>
				</header>

				<section className="border-line bg-surface shadow-xs rounded-xl border">
					<div className="border-line-soft flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
						<div className="flex min-w-0 flex-wrap items-center gap-2">
							{LOG_TYPES.filter((item) => item.value !== 'all').map((item) => {
								const value = item.value as Exclude<LogType, 'all'>
								const meta = LOG_TYPE_META[value]
								const Icon = meta.icon
								const isActive = typeFilter === value
								return (
									<Button
										key={value}
										type="button"
										size="sm"
										variant={isActive ? 'secondary' : 'ghost'}
										className={cn(
											'relative h-8 gap-1.5 overflow-hidden font-mono text-[11px] transition-all',
											isActive && 'pr-6!'
										)}
										onClick={() => setTypeFilter(isActive ? 'all' : value)}
									>
										<Icon className="size-3.5" />
										{meta.label}
										<span className="text-ink-muted tabular-nums">{typeCounts[value] ?? 0}</span>
										<X
											className={cn(
												'absolute right-1 top-1/2 size-3.5 -translate-y-1/2 transition-all',
												isActive ? 'opacity-100 blur-none' : 'opacity-0 blur-sm'
											)}
										/>
									</Button>
								)
							})}
						</div>
						<p className="text-ink-muted font-mono text-[11px]">
							Showing {filteredEntries.length} of {entries.length} entries · click a row for details
						</p>
					</div>

					<div className="overflow-x-auto">
						<Table className="min-w-260 font-mono text-xs">
							<TableHeader>
								<TableRow className="bg-background hover:bg-background">
									<TableHead className="ps-4 text-[10px] tracking-wider">Time</TableHead>
									<TableHead className="text-[10px] tracking-wider">Lvl</TableHead>
									<TableHead className="text-[10px] tracking-wider">Type</TableHead>
									<TableHead className="text-[10px] tracking-wider">Source</TableHead>
									<TableHead className="text-[10px] tracking-wider">Endpoint</TableHead>
									<TableHead className="text-[10px] tracking-wider">Event</TableHead>
									<TableHead className="text-[10px] tracking-wider">Message</TableHead>
									<TableHead className="pe-4 text-right text-[10px] tracking-wider">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isLoading &&
									Array.from({ length: 6 }).map((_, index) => (
										<TableRow key={index}>
											<TableCell colSpan={8} className="px-4 py-2">
												<Skeleton className="h-8 w-full" />
											</TableCell>
										</TableRow>
									))}

								{!isLoading &&
									filteredEntries.map((entry) => (
										<LogTableRow
											key={entry.id}
											entry={entry}
											active={selectedId === entry.id}
											onSelect={() => setSelectedId(entry.id)}
											onDelete={() => void removeError(entry.id)}
										/>
									))}

								{!isLoading && filteredEntries.length === 0 && (
									<TableRow>
										<TableCell colSpan={8} className="px-4 py-12 text-center">
											<div className="mx-auto max-w-sm">
												<AlertCircle className="text-ink-muted mx-auto size-5" />
												<p className="font-heading text-ink mt-2 text-sm font-semibold">No logs match this view</p>
												<p className="text-ink-muted mt-1 text-xs">
													Clear the query or switch the type filter to inspect another log stream.
												</p>
											</div>
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
				</section>
			</div>

			<LogDetailSheet entry={selected} onClose={() => setSelectedId(null)} onDelete={removeError} />
		</main>
	)
}

function LogTableRow({
	entry,
	active,
	onSelect,
	onDelete,
}: {
	entry: LogEntryView
	active: boolean
	onSelect: () => void
	onDelete: () => void
}) {
	const meta = LOG_TYPE_META[entry.type]
	const Icon = meta.icon

	return (
		<TableRow
			data-active={active}
			tabIndex={0}
			aria-selected={active}
			className={cn(
				'focus-visible:ring-ring/35 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-[3px]',
				active ? 'bg-danger-soft/80 hover:bg-danger-soft/80' : 'bg-danger-soft/30 hover:bg-danger-soft/60'
			)}
			onClick={onSelect}
			onKeyDown={(event) => {
				if (event.key !== 'Enter' && event.key !== ' ') return
				event.preventDefault()
				onSelect()
			}}
		>
			<TableCell className="text-ink-muted ps-4 tabular-nums">{entry.timeLabel}</TableCell>
			<TableCell>
				<span className="inline-flex items-center gap-1.5">
					<span className="bg-danger size-1.5 rounded-full" />
					<span className="text-danger text-[10px] uppercase tracking-wider">error</span>
				</span>
			</TableCell>
			<TableCell>
				<Badge tone={meta.badge} className="gap-1.5 font-mono text-[10px]">
					<Icon className="size-3" />
					{meta.label}
				</Badge>
			</TableCell>
			<TableCell className="text-ink-muted max-w-40 truncate">{entry.source}</TableCell>
			<TableCell className="text-ink-muted max-w-40 truncate">{entry.endpoint ?? '-'}</TableCell>
			<TableCell className="text-ink-muted tabular-nums">{entry.eventId}</TableCell>
			<TableCell className="max-w-xl">
				<span className="flex items-center gap-2">
					<AlertTriangle className="text-danger size-3.5 shrink-0" />
					<span className="truncate">{entry.message}</span>
				</span>
			</TableCell>
			<TableCell className="pe-4 text-right" onClick={(event) => event.stopPropagation()}>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="text-ink-muted hover:bg-danger-soft hover:text-danger size-8"
							aria-label={`Delete ${entry.source} log`}
							onClick={onDelete}
						>
							<Trash2 className="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent sideOffset={6}>Delete log</TooltipContent>
				</Tooltip>
			</TableCell>
		</TableRow>
	)
}

function LogDetailSheet({
	entry,
	onClose,
	onDelete,
}: {
	entry: LogEntryView | null
	onClose: () => void
	onDelete: (errorId: string) => Promise<void>
}) {
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

function LogSection({ title, copyValue, children }: { title: string; copyValue?: string; children: React.ReactNode }) {
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

function KeyVal({ label, value, copy = false }: { label: string; value: string; copy?: boolean }) {
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
