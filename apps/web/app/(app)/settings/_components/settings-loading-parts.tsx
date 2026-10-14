import { ChevronDown, Plus } from 'lucide-react'

import { Panel } from '@/components/app/layout-parts'
import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonCount, SkeletonLine } from '@/components/ui/skeleton'

export const CHAT_MODEL_DESCRIPTION = 'What new chats start with.'
export const MODELS_DESCRIPTION =
	'The models the assistant may use, in the order of the chat menu, and what a request may cost.'
export const BUDGET_DESCRIPTION =
	'When the limit is reached the assistant stops answering until next month. Everything else keeps working.'

const FIELD_RING = 'ring-1 ring-inset ring-input'
export const ROW_TOP = 'flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4'
export const ROW_CENTER = 'flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4'

export function Hint() {
	return <SkeletonLine box="h-(--lh-caption)" className="h-2.5 w-35" />
}

export function SelectShape() {
	return (
		<div className={`flex h-9 w-full items-center justify-between gap-2 rounded-md px-3 ${FIELD_RING}`}>
			<Skeleton className="h-4 w-32" />
			<ChevronDown size={16} aria-hidden className="shrink-0 text-muted-foreground" />
		</div>
	)
}

export function NumberShape({ className }: { className: string }) {
	return (
		<div className={`flex items-center justify-end rounded-md px-3 ${FIELD_RING} ${className}`}>
			<Skeleton className="h-3 w-12" />
		</div>
	)
}

function Footer() {
	return (
		<div className="flex items-center justify-between gap-3">
			<p className="text-caption text-muted-foreground">Saved to your account.</p>
			<Button type="button" size="compact" disabled>
				Save
			</Button>
		</div>
	)
}

export function ChatModelLoading() {
	return (
		<Panel id="settings-chat-model" title="Chat model" description={CHAT_MODEL_DESCRIPTION}>
			<div role="status" aria-label="Loading chat model" className="flex flex-col gap-4 px-4 pt-1 pb-4">
				<div className={ROW_CENTER}>
					<div className="flex min-w-0 flex-col gap-1">
						<span className="text-body text-foreground">Model</span>
						<p className="text-caption text-muted-foreground">Used for every new chat</p>
					</div>
					<div className="w-full md:w-65 md:shrink-0">
						<SelectShape />
					</div>
				</div>
				<div className={ROW_TOP}>
					<div className="flex min-w-0 flex-col gap-1">
						<span className="text-body text-foreground">
							Effort: <SkeletonCount className="w-14" />
						</span>
						<p className="text-caption text-muted-foreground">
							Faster answers, or smarter ones that take longer and cost more
						</p>
					</div>
					<div className="w-full md:w-65 md:shrink-0">
						<div className="flex w-full flex-col">
							<div className="mb-1 h-3.5" aria-hidden />
							<div className="flex h-6 w-full items-center">
								<Skeleton className="h-1 w-full" />
							</div>
							<div className="mt-1.5 flex justify-between text-micro text-muted-foreground">
								<span>Faster</span>
								<span>Smarter</span>
							</div>
						</div>
					</div>
				</div>
				<p className="text-caption text-muted-foreground">
					Saved to your account. Each chat can change its own model and effort from its composer.
				</p>
			</div>
		</Panel>
	)
}

function LimitLoading({ label, hint }: { label: string; hint: string }) {
	return (
		<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
			<div className="flex min-w-0 flex-col gap-1">
				<span className="text-body text-foreground">{label}</span>
				<p className="text-caption text-muted-foreground">{hint}</p>
			</div>
			<NumberShape className="h-8 w-full md:w-35 md:shrink-0" />
		</div>
	)
}

export function ModelsLoading() {
	return (
		<Panel id="settings-models" title="Models and limits" description={MODELS_DESCRIPTION}>
			<div role="status" aria-label="Loading models" className="flex flex-col gap-4 px-4 pt-1 pb-4">
				<div className="flex flex-col gap-3">
					<Skeleton className="h-24.5 w-full rounded-xl" />
					<Skeleton className="h-24.5 w-full rounded-xl" />
					<Skeleton className="h-24.5 w-full rounded-xl" />
				</div>
				<div>
					<Button type="button" variant="tertiary" size="compact" leadingIcon={Plus}>
						Add model
					</Button>
				</div>
				<div className="flex flex-col gap-3 border-t border-border pt-3">
					<LimitLoading label="Max input tokens" hint="The largest request the assistant will send." />
					<LimitLoading label="Max output tokens" hint="The longest answer it may write." />
				</div>
				<p className="text-caption text-muted-foreground">
					Prices come from Anthropic&apos;s published price list, as of <SkeletonCount className="w-16" />. Change them
					here if the list changes.
				</p>
				<Footer />
			</div>
		</Panel>
	)
}

export function BudgetLoading() {
	return (
		<Panel id="settings-budget" title="Budget" description={BUDGET_DESCRIPTION}>
			<div role="status" aria-label="Loading budget" className="flex flex-col gap-4 px-4 pt-1 pb-4">
				<div className={ROW_CENTER}>
					<div className="flex min-w-0 flex-col gap-1">
						<span className="text-body text-foreground">Monthly limit</span>
						<p className="text-caption text-muted-foreground">In US dollars. New installs start at $10.</p>
					</div>
					<div
						className={`relative flex h-8 w-full items-center justify-end rounded-md px-3 md:w-30 md:shrink-0 ${FIELD_RING}`}
					>
						<span aria-hidden className="absolute top-1/2 left-3 -translate-y-1/2 text-body text-muted-foreground">
							$
						</span>
						<Skeleton className="h-3 w-10" />
					</div>
				</div>
				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between gap-3">
						<SkeletonLine className="w-20" />
						<SkeletonLine className="w-16" />
					</div>
					<div className="h-2 rounded-sm bg-selected" />
					<p className="text-caption text-muted-foreground">An estimate from the prices in Models and limits.</p>
					<div className="mt-2 flex flex-col gap-2">
						<p className="text-caption text-muted-foreground">Usage by conversation</p>
						<ul className="flex flex-col">
							{['w-40', 'w-32', 'w-48'].map((width) => (
								<li key={width} className="-mx-2 flex items-center justify-between gap-4 px-2 py-1">
									<SkeletonLine className={width} />
									<SkeletonLine className="w-12" />
								</li>
							))}
						</ul>
					</div>
				</div>
				<p className="text-caption text-muted-foreground">Costs count toward your monthly budget.</p>
				<Footer />
			</div>
		</Panel>
	)
}
