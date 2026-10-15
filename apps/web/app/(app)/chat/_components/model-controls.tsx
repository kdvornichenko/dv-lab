'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, Info, RotateCcw } from 'lucide-react'

import { EFFORT_LABEL, EffortMeter, EffortSlider, clampEffort, highestEffort } from '@/components/app/effort-slider'
import { Button } from '@/components/ui/button'
import {
	DropdownContent,
	DropdownMenu,
	DropdownSeparator,
	DropdownSub,
	DropdownSubContent,
	DropdownSubTrigger,
	DropdownTrigger,
	useDropdown,
} from '@/components/ui/dropdown'
import { MenuItem } from '@/components/ui/menu-item'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip } from '@/components/ui/tooltip'
import { useRegisterFluidHoverItem } from '@/hooks/use-fluid-hover'
import { dollars, toCents } from '@/lib/usd-text'
import { cn } from '@/lib/utils'

import type { BudgetSnapshot, ChatEffort, ModelCapability } from '@dv-lab/contracts'

import type { ChatModels, ModelChoice } from './use-chat'

const MENU_ROWS = 4
const LONGEST_WORD = EFFORT_LABEL.xhigh
const WORD_EASE = [0.23, 1, 0.32, 1] as const
const UNAVAILABLE_LINE = 'Not available with your API key.'

export type ChoiceView = {
	capabilities: readonly ModelCapability[]
	budget: BudgetSnapshot
	defaultId: string
	defaultName: string
	defaultEffortOf: (capability: ModelCapability) => ChatEffort
	modelId: string
	model: ModelCapability | null
	effort: ChatEffort | null
	override: boolean
}

export function readChoice(models: ChatModels): ChoiceView | null {
	if (models.assistant.kind !== 'ready') return null
	const { settings, capabilities, budget } = models.assistant.data
	const defaultId = settings.model ?? settings.models[0]?.id
	const defaultCapability = capabilities.find((item) => item.id === defaultId)
	if (defaultId === undefined || defaultCapability === undefined) return null
	const defaultEffortOf = (capability: ModelCapability) =>
		capability.id === defaultId ? (settings.effort ?? capability.defaultEffort) : capability.defaultEffort
	const { conversation, pending } = models
	const modelId = conversation ? conversation.model : (pending?.model ?? defaultId)
	const model = capabilities.find((item) => item.id === modelId) ?? null
	const effort = conversation ? conversation.effort : (pending?.effort ?? (model ? defaultEffortOf(model) : null))
	const override = conversation ? conversation.override : pending !== null
	return {
		capabilities,
		budget,
		defaultId,
		defaultName: defaultCapability.name,
		defaultEffortOf,
		modelId,
		model,
		effort,
		override,
	}
}

export function choiceUnavailable(view: ChoiceView): boolean {
	return view.model === null || !view.model.available
}

function request(view: ChoiceView, modelId: string, effort: ChatEffort | null): ModelChoice {
	const capability = view.capabilities.find((item) => item.id === modelId)
	return {
		model: modelId === view.defaultId ? null : modelId,
		effort: capability === undefined || effort === null || effort === view.defaultEffortOf(capability) ? null : effort,
	}
}

function ModelRow({
	index,
	capability,
	isDefault,
	selected,
	digit,
	onPick,
}: {
	index: number
	capability: ModelCapability
	isDefault: boolean
	selected: boolean
	digit: number | null
	onPick: () => void
}) {
	const ref = useRef<HTMLDivElement>(null)
	const { registerItem, renderMenuItem } = useDropdown()
	useRegisterFluidHoverItem(registerItem, index, ref)
	if (!renderMenuItem) return null
	const available = capability.available
	return renderMenuItem({
		radio: true,
		checkbox: false,
		checked: selected,
		value: index,
		disabled: !available,
		label: capability.name,
		closeOnClick: true,
		onActivate: available ? onPick : undefined,
		element: (
			<div
				ref={ref}
				data-fluid-hover-index={index}
				data-slot="model-row"
				data-model={capability.id}
				aria-label={capability.name}
				className={cn(
					'relative z-10 flex h-12 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2 outline-none',
					!available && 'pointer-events-none opacity-50'
				)}
			/>
		),
		children: (
			<>
				<span className="inline-flex size-4 shrink-0 items-center justify-center">
					{selected ? <Check size={16} strokeWidth={2} aria-hidden /> : null}
				</span>
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="flex items-center gap-2">
						<span className="truncate text-body font-medium text-foreground">{capability.name}</span>
						{isDefault ? (
							<span className="shrink-0 rounded-full bg-hover px-1.5 text-micro text-foreground">Default</span>
						) : null}
					</span>
					<span className="truncate text-micro text-muted-foreground">
						{available ? capability.description : UNAVAILABLE_LINE}
					</span>
				</span>
				{digit !== null ? (
					<span aria-hidden className="shrink-0 text-micro text-muted-foreground pointer-coarse:hidden">
						{digit}
					</span>
				) : null}
			</>
		),
	})
}

function Chip({
	children,
	active,
	className,
	...props
}: { children?: ReactNode; active: boolean } & Omit<React.ComponentProps<typeof Button>, 'children' | 'active'>) {
	return (
		<Button
			type="button"
			variant="tertiary"
			size="compact"
			active={active}
			className={cn('min-w-0 gap-1 rounded-full px-2.5 font-medium pointer-coarse:h-9', className)}
			{...props}
		>
			<span className="flex min-w-0 items-center gap-1 whitespace-nowrap">{children}</span>
		</Button>
	)
}

function ModelMenu({
	view,
	disabled,
	open,
	onOpenChange,
	onChoose,
}: {
	view: ChoiceView
	disabled: boolean
	open: boolean
	onOpenChange: (open: boolean) => void
	onChoose: (choice: ModelChoice) => unknown
}) {
	const top = view.capabilities.slice(0, MENU_ROWS)
	const extra = view.capabilities.slice(MENU_ROWS)
	const selectedTop = top.findIndex((item) => item.id === view.modelId)
	const selectedExtra = extra.findIndex((item) => item.id === view.modelId)
	const name = view.model?.name ?? view.modelId
	const used = dollars(toCents(view.budget.spentUsd, true))
	const cap = dollars(toCents(view.budget.capUsd, false), true)
	const resetIndex = top.length

	function pick(capability: ModelCapability) {
		const wanted = view.effort ?? view.defaultEffortOf(capability)
		void onChoose(request(view, capability.id, clampEffort(capability.efforts, wanted)))
		onOpenChange(false)
	}

	useEffect(() => {
		if (!open) return
		function onKey(event: KeyboardEvent) {
			if (event.metaKey || event.ctrlKey || event.altKey || !/^[1-9]$/.test(event.key)) return
			const target = top[Number(event.key) - 1]
			if (!target) return
			event.preventDefault()
			if (target.available) pick(target)
		}
		document.addEventListener('keydown', onKey)
		return () => document.removeEventListener('keydown', onKey)
	})

	return (
		<DropdownMenu size="compact" open={open} onOpenChange={onOpenChange} disabled={disabled}>
			<Tooltip content={view.override ? `This chat uses ${name}. Default: ${view.defaultName}.` : 'Model'} side="top">
				<DropdownTrigger
					render={
						<Chip
							active={view.override}
							disabled={disabled}
							data-slot="model-chip"
							aria-label={`Model: ${name}`}
							aria-haspopup="menu"
						/>
					}
				>
					<span className="max-w-36 min-w-0 truncate leading-5 @max-[376px]:max-w-24">{name}</span>
					<ChevronDown size={12} aria-hidden className="shrink-0" />
				</DropdownTrigger>
			</Tooltip>
			<DropdownContent
				side="top"
				align="start"
				sideOffset={8}
				checkedIndex={selectedTop >= 0 ? selectedTop : undefined}
				className="w-75 max-w-[calc(100vw-2rem)]"
			>
				{top.map((capability, index) => (
					<ModelRow
						key={capability.id}
						index={index}
						capability={capability}
						isDefault={capability.id === view.defaultId}
						selected={index === selectedTop}
						digit={index + 1}
						onPick={() => pick(capability)}
					/>
				))}
				<DropdownSeparator />
				{view.override ? (
					<MenuItem
						index={resetIndex}
						label={`Use default (${view.defaultName})`}
						icon={RotateCcw}
						onSelect={() => {
							void onChoose({ model: null, effort: null })
							onOpenChange(false)
						}}
					/>
				) : null}
				{extra.length > 0 ? (
					<DropdownSub>
						<DropdownSubTrigger index={resetIndex + 1} label="Other models" />
						<DropdownSubContent checkedIndex={selectedExtra >= 0 ? selectedExtra : undefined}>
							{extra.map((capability, index) => (
								<ModelRow
									key={capability.id}
									index={index}
									capability={capability}
									isDefault={capability.id === view.defaultId}
									selected={index === selectedExtra}
									digit={null}
									onPick={() => pick(capability)}
								/>
							))}
						</DropdownSubContent>
					</DropdownSub>
				) : null}
				<p className="px-2 pt-2 pb-1 text-micro text-muted-foreground" data-slot="model-menu-cost">
					Costs count toward your monthly budget. {used} of {cap} used.
				</p>
			</DropdownContent>
		</DropdownMenu>
	)
}

function EffortWord({ word }: { word: string }) {
	const reduceMotion = useReducedMotion() ?? false
	return (
		<span className="inline-grid align-top">
			<span aria-hidden className="invisible col-start-1 row-start-1">
				{LONGEST_WORD}
			</span>
			{reduceMotion ? (
				<span className="col-start-1 row-start-1">{word}</span>
			) : (
				<AnimatePresence initial={false}>
					<motion.span
						key={word}
						className="col-start-1 row-start-1"
						initial={{ opacity: 0, filter: 'blur(2px)' }}
						animate={{ opacity: 1, filter: 'blur(0px)', transition: { duration: 0.16, ease: WORD_EASE } }}
						exit={{ opacity: 0, filter: 'blur(2px)', transition: { duration: 0.12, ease: WORD_EASE } }}
					>
						{word}
					</motion.span>
				</AnimatePresence>
			)}
		</span>
	)
}

function EffortPopover({
	view,
	level,
	capability,
	disabled,
	onChoose,
}: {
	view: ChoiceView
	level: ChatEffort
	capability: ModelCapability
	disabled: boolean
	onChoose: (choice: ModelChoice) => Promise<boolean>
}) {
	const [open, setOpen] = useState(false)
	const [preview, setPreview] = useState<ChatEffort | null>(null)
	const thumb = useRef<HTMLDivElement>(null)
	const fallback = view.defaultEffortOf(capability)
	const marker = fallback === capability.recommendedEffort ? 'Default · recommended' : 'Default'
	const word = EFFORT_LABEL[level]
	const titleWord = EFFORT_LABEL[preview ?? level]
	const ceiling = highestEffort(capability.efforts)
	const differs = level !== fallback
	const modelOverride = view.modelId === view.defaultId ? null : view.modelId
	const resetLabel = `Use default (${EFFORT_LABEL[fallback]})`

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				disabled={disabled}
				render={
					<Chip
						active={view.override}
						disabled={disabled}
						data-slot="effort-chip"
						aria-label={`Effort: ${word}`}
						aria-haspopup="dialog"
					/>
				}
			>
				<EffortMeter level={level} />
				<span className="@max-[376px]:sr-only">{word}</span>
			</PopoverTrigger>
			<PopoverContent
				side="top"
				align="start"
				sideOffset={8}
				className="w-72 max-w-[calc(100vw-2rem)] gap-3 p-4"
				onKeyDown={(event) => {
					if (event.key === 'Enter' && event.target === thumb.current) {
						event.preventDefault()
						setOpen(false)
					}
				}}
			>
				<div className="flex items-center justify-between gap-2">
					<PopoverTitle className="whitespace-nowrap">
						Effort: <EffortWord word={titleWord} />
					</PopoverTitle>
					<div className="flex items-center gap-1">
						<Tooltip content={resetLabel} side="top">
							<Button
								type="button"
								variant="ghost"
								size="icon-compact"
								aria-label={resetLabel}
								aria-hidden={differs ? undefined : true}
								tabIndex={differs ? 0 : -1}
								data-slot="effort-reset"
								className={cn(
									'size-6 text-muted-foreground transition-opacity duration-160 motion-reduce:transition-none',
									differs ? 'opacity-100' : 'pointer-events-none opacity-0'
								)}
								onClick={() => {
									void onChoose({ model: modelOverride, effort: null })
									thumb.current?.focus({ preventScroll: true })
								}}
							>
								<RotateCcw />
							</Button>
						</Tooltip>
						<Tooltip content="Higher effort thinks longer: answers take more time and cost more." side="top">
							<span
								role="img"
								aria-label="Higher effort thinks longer: answers take more time and cost more."
								tabIndex={0}
								className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
							>
								<Info size={14} aria-hidden />
							</span>
						</Tooltip>
					</div>
				</div>
				<EffortSlider
					value={level}
					supported={capability.efforts}
					modelName={capability.name}
					marker={marker}
					markerAt={fallback}
					label="Effort"
					thumbRef={thumb}
					commit="release"
					onPreview={setPreview}
					onChange={(next) => onChoose(request(view, view.modelId, next))}
				/>
				{capability.efforts.length < 5 ? (
					<p className="text-caption text-muted-foreground">
						{capability.name} goes up to {EFFORT_LABEL[ceiling]}.
					</p>
				) : null}
			</PopoverContent>
		</Popover>
	)
}

export function ModelControls({
	models,
	disabled,
	menuOpen,
	onMenuOpenChange,
}: {
	models: ChatModels
	disabled: boolean
	menuOpen: boolean
	onMenuOpenChange: (open: boolean) => void
}) {
	const view = readChoice(models)
	if (view === null) return null
	return (
		<div className="@container flex min-w-0 gap-0.5" data-slot="model-controls">
			<ModelMenu
				view={view}
				disabled={disabled}
				open={menuOpen}
				onOpenChange={onMenuOpenChange}
				onChoose={(choice) => models.choose(choice)}
			/>
			{view.model && view.effort ? (
				<EffortPopover
					view={view}
					level={view.effort}
					capability={view.model}
					disabled={disabled || !view.model.available}
					onChoose={(choice) => models.choose(choice)}
				/>
			) : null}
		</div>
	)
}
