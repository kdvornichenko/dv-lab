'use client'

import { useEffect, useState } from 'react'

import { AlertTriangle, Trash2, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
	clearCrmErrors,
	deleteCrmError,
	listCrmErrors,
	subscribeCrmErrors,
	type CrmErrorLogEntry,
} from '@/lib/crm/error-log'

function formatErrorTime(value: string) {
	return new Intl.DateTimeFormat('ru-RU', {
		day: '2-digit',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
	}).format(new Date(value))
}

export default function ErrorLogPage() {
	const [errors, setErrors] = useState<CrmErrorLogEntry[]>([])

	useEffect(() => {
		const syncErrors = () => setErrors(listCrmErrors())
		syncErrors()
		return subscribeCrmErrors(syncErrors)
	}, [])

	function removeError(errorId: string) {
		deleteCrmError(errorId)
		setErrors(listCrmErrors())
	}

	function removeAllErrors() {
		clearCrmErrors()
		setErrors([])
	}

	return (
		<main className="flex min-h-dvh flex-col gap-unit p-unit">
			<div className="mx-auto grid h-full w-full grow gap-5">
				<header className="rounded-lg border border-line bg-surface p-4 shadow-[0_18px_55px_-46px_var(--shadow-sage)]">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div className="min-w-0">
							<p className="font-mono text-xs font-semibold text-danger uppercase">System log</p>
							<h1 className="mt-1 text-xl font-semibold text-ink">CRM errors</h1>
							<p className="mt-1 max-w-2xl text-sm text-ink-muted">Request failures from CRM operations.</p>
						</div>
						<div className="flex items-center gap-2">
							<Badge tone={errors.length > 0 ? 'red' : 'green'} className="font-mono tabular-nums">
								{errors.length} saved
							</Badge>
							<Button type="button" variant="outline" disabled={errors.length === 0} onClick={removeAllErrors}>
								<XCircle className="h-4 w-4" />
								Clear all
							</Button>
						</div>
					</div>
				</header>

				<section className="rounded-lg border border-line bg-surface p-4 shadow-[0_18px_55px_-46px_var(--shadow-sage)]">
					<ScrollArea className="h-[calc(100dvh-15rem)] min-h-[18rem] pr-3">
						<div className="space-y-2">
							{errors.map((error) => (
								<div
									key={error.id}
									className="flex items-start justify-between gap-3 rounded-lg border border-line-soft bg-surface-muted p-3"
								>
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
											<p className="truncate text-sm font-semibold text-ink">{error.source}</p>
											<p className="font-mono text-xs text-ink-muted tabular-nums">
												{formatErrorTime(error.createdAt)}
											</p>
										</div>
										<p className="mt-2 text-sm leading-6 text-danger">{error.message}</p>
									</div>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="text-ink-muted hover:bg-danger-soft hover:text-danger"
												aria-label={`Delete ${error.source} error`}
												onClick={() => removeError(error.id)}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										</TooltipTrigger>
										<TooltipContent sideOffset={6}>Delete error</TooltipContent>
									</Tooltip>
								</div>
							))}

							{errors.length === 0 && (
								<div className="rounded-lg border border-dashed border-line-strong bg-surface-muted p-5">
									<p className="text-sm font-semibold text-ink">No saved errors</p>
									<p className="mt-1 text-xs text-ink-muted">There are no saved failures in this workspace.</p>
								</div>
							)}
						</div>
					</ScrollArea>
				</section>
			</div>
		</main>
	)
}
