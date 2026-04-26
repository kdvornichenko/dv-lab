'use client'

import { useCallback, useEffect, useState } from 'react'

import { AlertTriangle, Trash2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
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
	const [isLoading, setIsLoading] = useState(true)

	const syncErrors = useCallback(async () => {
		try {
			setErrors(await listCrmErrors())
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to load CRM errors'
			toast.error('CRM errors unavailable', { description: message })
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		void syncErrors()
		return subscribeCrmErrors(() => void syncErrors())
	}, [syncErrors])

	async function removeError(errorId: string) {
		try {
			await deleteCrmError(errorId)
			await syncErrors()
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to delete CRM error'
			toast.error('Delete failed', { description: message })
		}
	}

	async function removeAllErrors() {
		try {
			await clearCrmErrors()
			setErrors([])
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to clear CRM errors'
			toast.error('Clear failed', { description: message })
		}
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
							<Button
								type="button"
								variant="outline"
								disabled={isLoading || errors.length === 0}
								onClick={() => void removeAllErrors()}
							>
								<XCircle className="h-4 w-4" />
								Clear all
							</Button>
						</div>
					</div>
				</header>

				<section className="rounded-lg border border-line bg-surface p-4 shadow-[0_18px_55px_-46px_var(--shadow-sage)]">
					<ScrollArea className="h-[calc(100dvh-15rem)] min-h-[18rem] pr-3">
						<div className="space-y-2">
							{isLoading &&
								Array.from({ length: 5 }).map((_, index) => (
									<div key={index} className="rounded-lg border border-line-soft bg-surface-muted p-3">
										<div className="flex items-center gap-2">
											<Skeleton className="h-4 w-4 rounded-full" />
											<Skeleton className="h-4 w-36" />
											<Skeleton className="h-3 w-20" />
										</div>
										<Skeleton className="mt-3 h-4 w-full" />
										<Skeleton className="mt-2 h-4 w-2/3" />
									</div>
								))}

							{!isLoading &&
								errors.map((error) => (
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
													onClick={() => void removeError(error.id)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent sideOffset={6}>Delete error</TooltipContent>
										</Tooltip>
									</div>
								))}

							{!isLoading && errors.length === 0 && (
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
