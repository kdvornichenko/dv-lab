'use client'

import { useMemo, useState } from 'react'
import type React from 'react'

import { Check, PlusCircle, Search, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type ButtonVariant = React.ComponentProps<typeof Button>['variant']

export type FacetedFilterOption = {
	value: string
	label: string
	count?: number
	keywords?: string[]
	leading?: React.ReactNode
}

type FacetedFilterProps = {
	label: string
	value: string[]
	options: FacetedFilterOption[]
	onValueChange: (value: string[]) => void
	icon?: React.ReactNode
	mode?: 'single' | 'multiple'
	buttonVariant?: ButtonVariant
	searchPlaceholder?: string
	emptyText?: string
	className?: string
	contentClassName?: string
	renderOption?: (option: FacetedFilterOption, state: { selected: boolean }) => React.ReactNode
	renderSelected?: (options: FacetedFilterOption[]) => React.ReactNode
	active?: boolean
}

export function FacetedFilter({
	label,
	value,
	options,
	onValueChange,
	icon,
	mode = 'multiple',
	buttonVariant = 'outline',
	searchPlaceholder = 'Search',
	emptyText = 'No options',
	className,
	contentClassName,
	renderOption,
	renderSelected,
	active,
}: FacetedFilterProps) {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')
	const selectedSet = useMemo(() => new Set(value), [value])
	const selectedOptions = useMemo(
		() => options.filter((option) => selectedSet.has(option.value)),
		[options, selectedSet]
	)
	const isActive = active ?? selectedOptions.length > 0
	const filteredOptions = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase()
		if (!normalizedQuery) return options
		return options.filter((option) =>
			[option.label, option.value, ...(option.keywords ?? [])].some((item) =>
				item.toLowerCase().includes(normalizedQuery)
			)
		)
	}, [options, query])
	const count = isActive ? selectedOptions.length : 0
	const selectedCount = selectedOptions.length

	function toggleOption(option: FacetedFilterOption) {
		if (mode === 'single') {
			onValueChange(selectedSet.has(option.value) ? [] : [option.value])
			setOpen(false)
			return
		}

		onValueChange(
			selectedSet.has(option.value) ? value.filter((item) => item !== option.value) : [...value, option.value]
		)
	}

	function clear() {
		setQuery('')
		onValueChange([])
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					size="sm"
					variant={buttonVariant}
					className={cn(
						'h-8.5 justify-start gap-1.5 border-dashed px-2.5 text-xs',
						count > 0 && 'border-sage-line bg-sage-soft/70 text-sage',
						className
					)}
				>
					{icon ?? <PlusCircle className="size-3.5" />}
					<span>{label}</span>
					{count > 0 ? (
						<>
							<Separator orientation="vertical" className="mx-0.5 h-4 bg-sage-line" />
							<Badge tone="green" className="h-5 min-w-5 rounded px-1.5 font-mono text-[10px]">
								{selectedCount}
							</Badge>
							<span className="hidden max-w-36 items-center gap-1 overflow-hidden md:inline-flex">
								{renderSelected ? (
									renderSelected(selectedOptions)
								) : (
									<>
										{selectedOptions.slice(0, 2).map((option) => (
											<span key={option.value} className="truncate rounded bg-surface/80 px-1.5 py-0.5 text-[11px]">
												{option.label}
											</span>
										))}
									</>
								)}
							</span>
						</>
					) : null}
				</Button>
			</PopoverTrigger>
			<PopoverContent className={cn('w-72 p-0', contentClassName)} align="start" sideOffset={8}>
				<div className="border-b border-line-soft p-2">
					<InputGroup className="h-8 border-line bg-surface">
						<InputGroupAddon>
							<Search className="size-3.5" />
						</InputGroupAddon>
						<InputGroupInput
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={searchPlaceholder}
							className="h-8 text-xs"
						/>
					</InputGroup>
				</div>
				<div className="max-h-72 overflow-y-auto p-1.5">
					<AnimatePresence initial={false}>
						{filteredOptions.map((option) => {
							const selected = selectedSet.has(option.value)
							return (
								<motion.button
									key={option.value}
									type="button"
									layout
									initial={{ opacity: 0, y: -3 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -3 }}
									transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
									className={cn(
										'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
										selected ? 'bg-sage-soft text-sage' : 'text-ink hover:bg-sage-soft/55 hover:text-sage'
									)}
									onClick={() => toggleOption(option)}
								>
									<span
										className={cn(
											'grid size-4 shrink-0 place-content-center rounded-sm border transition-colors',
											selected ? 'border-sage bg-sage text-white' : 'border-line-strong bg-surface text-transparent'
										)}
										aria-hidden="true"
									>
										<Check className="size-3" />
									</span>
									{renderOption ? (
										renderOption(option, { selected })
									) : (
										<>
											{option.leading ? <span className="shrink-0">{option.leading}</span> : null}
											<span className="min-w-0 flex-1 truncate">{option.label}</span>
										</>
									)}
									{option.count !== undefined ? (
										<span className="ml-auto font-mono text-[11px] text-ink-muted tabular-nums">{option.count}</span>
									) : null}
									{mode === 'single' && selected ? <Check className="ml-auto size-3.5" /> : null}
								</motion.button>
							)
						})}
					</AnimatePresence>
					{filteredOptions.length === 0 ? (
						<div className="px-2 py-6 text-center text-xs text-ink-muted">{emptyText}</div>
					) : null}
				</div>
				<div className="flex items-center justify-between border-t border-line-soft px-3 py-2">
					<span className="font-mono text-[10px] tracking-wider text-ink-muted uppercase">
						{selectedCount} selected
					</span>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="h-7 px-2 text-xs"
						disabled={selectedCount === 0}
						onClick={clear}
					>
						<X className="size-3.5" />
						Clear
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	)
}
