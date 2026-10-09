'use client'

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'

import {
	forwardRef,
	useRef,
	useEffect,
	useLayoutEffect,
	useState,
	useCallback,
	useMemo,
	createContext,
	useContext,
	type ReactNode,
	type HTMLAttributes,
	type InputHTMLAttributes,
} from 'react'

import { cva, type VariantProps } from 'class-variance-authority'
import { motion, AnimatePresence, animate, useMotionValue } from 'framer-motion'

import { FluidHoverHighlight } from '@/components/fluid-hover-highlight'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useFluidHover, useRegisterFluidHoverItem, type ItemRect } from '@/hooks/use-fluid-hover'
import { useMergeSplitBlocks, useSelectionRuns, SelectionBackgrounds } from '@/hooks/use-merge-split'
import { Elevated } from '@/lib/elevated'
import { useIcons, type IconComponent } from '@/lib/icon-context'
import { popupMotionClass, popupScrollAreaClass, popupViewportClass, isDisabledRow } from '@/lib/popup'
import { useShape, shapeMap } from '@/lib/shape-context'
import { SizeProvider, useSize, typeClass, type SizeVariant } from '@/lib/size-context'
import { spring, exitFallbackMs } from '@/lib/springs'
import { cn } from '@/lib/utils'

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

type ComboboxItemData = string | { value: string; label: string; detail?: string }

function itemValue(item: ComboboxItemData): string {
	return typeof item === 'string' ? item : item.value
}

function itemLabel(item: ComboboxItemData): string {
	return typeof item === 'string' ? item : item.label
}

const CREATE_VALUE = '\u0000create'

function isCreateItem(item: ComboboxItemData): boolean {
	return itemValue(item) === CREATE_VALUE
}

function defaultCreateLabel(query: string): ReactNode {
	return `Create “${query}”`
}

type ComboboxValue<Multiple extends boolean> = Multiple extends true ? string[] : string

interface ComboboxContextValue {
	values: string[]
	multiple: boolean
	inputValue: string
	open: boolean
	actionsRef: React.RefObject<{ unmount: () => void } | null>

	anchorRef: React.RefObject<HTMLDivElement | null>
	disabled: boolean
	itemsByValue: Map<string, ComboboxItemData>

	createRow: ReactNode | null

	allSelected: boolean
}

const ComboboxContext = createContext<ComboboxContextValue | null>(null)

interface Highlight {
	index: number
	keyboard: boolean
}
const ComboboxHighlightContext = createContext<Highlight | null>(null)

function useComboboxContext() {
	const ctx = useContext(ComboboxContext)
	if (!ctx) throw new Error('Combobox compound components must be inside <Combobox>')
	return ctx
}

interface ComboboxContentContextValue {
	registerItem: (index: number, element: HTMLElement | null) => void
	activeIndex: number | null
}

const ComboboxContentContext = createContext<ComboboxContentContextValue | null>(null)

const ComboboxItemIndexContext = createContext<number>(0)

interface ComboboxProps<T extends ComboboxItemData = ComboboxItemData, Multiple extends boolean = false> {
	children: ReactNode

	items: readonly T[]

	multiple?: Multiple

	value?: ComboboxValue<Multiple>
	defaultValue?: ComboboxValue<Multiple>
	onValueChange?: (value: ComboboxValue<Multiple>) => void

	filter?: (item: T, query: string) => boolean

	onCreate?: (query: string) => T | void

	createLabel?: (query: string) => ReactNode

	hideSelected?: boolean
	disabled?: boolean
	name?: string
	required?: boolean

	size?: SizeVariant
}

function toValues(v: string | readonly string[] | undefined): string[] {
	if (v === undefined) return []
	if (Array.isArray(v)) return v as string[]
	return v === '' ? [] : [v as string]
}

function Combobox<T extends ComboboxItemData = ComboboxItemData, Multiple extends boolean = false>({
	children,
	items,
	multiple,
	value,
	defaultValue,
	onValueChange,
	filter,
	onCreate,
	createLabel = defaultCreateLabel,
	hideSelected = false,
	disabled = false,
	name,
	required,
	size,
}: ComboboxProps<T, Multiple>) {
	const isMultiple = !!multiple
	const [internalValues, setInternalValues] = useState<string[]>(() => toValues(defaultValue))
	const [inputValue, setInputValue] = useState('')
	const [open, setOpen] = useState(false)
	const [highlight, setHighlight] = useState<Highlight | null>(null)
	const actionsRef = useRef<{ unmount: () => void } | null>(null)
	const anchorRef = useRef<HTMLDivElement | null>(null)

	const controlledValues = useMemo(() => toValues(value), [value])
	const values = value !== undefined ? controlledValues : internalValues

	const query = inputValue.trim()
	const createItem = useMemo<ComboboxItemData | null>(() => {
		if (!onCreate || query === '') return null
		const lower = query.toLocaleLowerCase()
		const exists = items.some((item) => itemLabel(item).toLocaleLowerCase() === lower)
		return exists ? null : { value: CREATE_VALUE, label: query }
	}, [onCreate, query, items])

	const itemsByValue = useMemo(() => {
		const map = new Map<string, ComboboxItemData>()
		for (const item of items) map.set(itemValue(item), item)

		if (createItem) map.set(CREATE_VALUE, createItem)
		return map
	}, [items, createItem])
	const selectedItems = useMemo(
		() => values.map((v) => itemsByValue.get(v)).filter(Boolean) as T[],
		[values, itemsByValue]
	)

	const hideChecked = hideSelected && isMultiple
	const listItems = useMemo<readonly ComboboxItemData[]>(() => {
		const visible = hideChecked ? items.filter((item) => !values.includes(itemValue(item))) : items
		return createItem ? [...visible, createItem] : visible
	}, [items, hideChecked, values, createItem])
	const allSelected = hideChecked && query === '' && items.length > 0 && listItems.length === 0

	const onCreateRef = useRef(onCreate)
	useIsoLayoutEffect(() => {
		onCreateRef.current = onCreate
	})
	const handleValueChange = useCallback(
		(next: T[] | T | null) => {
			const picked = Array.isArray(next) ? next : next == null ? [] : [next]
			const created = picked.find(isCreateItem)
			let nextValues = picked.filter((item) => !isCreateItem(item)).map(itemValue)
			if (created) {
				const made = onCreateRef.current?.(itemLabel(created))
				if (made == null) {
					if (!isMultiple) return
				} else {
					nextValues = [...nextValues, itemValue(made)]
				}
			}
			if (value === undefined) setInternalValues(nextValues)
			onValueChange?.((isMultiple ? nextValues : (nextValues[0] ?? '')) as ComboboxValue<Multiple>)
		},
		[value, onValueChange, isMultiple]
	)

	const { contains } = ComboboxPrimitive.useFilter()
	const filterFn = useMemo(() => {
		if (!filter && !createItem) return undefined
		const match = filter
			? (item: ComboboxItemData, q: string) => filter(item as T, q)
			: (item: ComboboxItemData, q: string) => contains(item, q, itemLabel)
		return (item: ComboboxItemData, q: string) => isCreateItem(item) || match(item, q)
	}, [filter, createItem, contains])

	const createRow = createItem ? createLabel(query) : null
	const ctx = useMemo(
		() => ({
			values,
			multiple: isMultiple,
			inputValue,
			open,
			actionsRef,
			anchorRef,
			disabled,
			itemsByValue,
			createRow,
			allSelected,
		}),
		[values, isMultiple, inputValue, open, disabled, itemsByValue, createRow, allSelected]
	)

	const root = (
		<ComboboxContext.Provider value={ctx}>
			<ComboboxHighlightContext.Provider value={highlight}>
				<ComboboxPrimitive.Root
					items={listItems}
					multiple={isMultiple}

					value={(isMultiple ? selectedItems : (selectedItems[0] ?? null)) as never}
					onValueChange={handleValueChange as never}
					isItemEqualToValue={(a: T, b: T) => itemValue(a) === itemValue(b)}
					itemToStringLabel={itemLabel}
					itemToStringValue={itemValue}
					filter={filterFn}
					open={open}
					onOpenChange={(next) => setOpen(next)}
					onInputValueChange={(next) => setInputValue(next)}
					actionsRef={actionsRef}
					autoHighlight={ALWAYS_HIGHLIGHT}
					onItemHighlighted={(item, details) =>
						setHighlight(item === undefined ? null : { index: details.index, keyboard: details.reason !== 'pointer' })
					}
					disabled={disabled}
					name={name}
					required={required}

					modal={false}
				>
					{children}
				</ComboboxPrimitive.Root>
			</ComboboxHighlightContext.Provider>
		</ComboboxContext.Provider>
	)

	return size ? <SizeProvider size={size}>{root}</SizeProvider> : root
}

Combobox.displayName = 'Combobox'

const popupShape = shapeMap.rounded

const ALWAYS_HIGHLIGHT = 'always' as unknown as boolean

const fieldRing = 'ring-1 ring-inset ring-input'

const fieldVariants = cva(
	[
		'group flex cursor-text items-center rounded-md ring-1 ring-inset',
		'transition-all duration-80',
		'focus-within:outline-1 focus-within:outline-offset-2 focus-within:outline-focus-ring',
		'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
	],
	{
		variants: {
			variant: {
				bordered: [fieldRing, 'bg-transparent hover:bg-hover'],

				borderless:
					'bg-transparent ring-transparent focus-within:bg-card focus-within:ring-border hover:bg-hover hover:ring-border',
			},
		},
		defaultVariants: {
			variant: 'bordered',
		},
	}
)

const fieldButtonClass =
	'flex shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors duration-80 hover:text-foreground focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)] data-[disabled]:pointer-events-none'

const clearButtonClass = cn(fieldButtonClass, 'transition-[color,background-color] hover:bg-hover active:bg-active')

const chipRemoveClass = cn(fieldButtonClass, 'rounded hover:bg-active')

interface ComboboxFieldProps
	extends
		Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'value' | 'defaultValue' | 'onChange'>,
		VariantProps<typeof fieldVariants> {
	icon?: IconComponent
	placeholder?: string
	error?: string

	clearable?: boolean

	size?: SizeVariant
}

type ComboboxInputProps = ComboboxFieldProps

function FieldControls({ clearable, compact, iconSize }: { clearable: boolean; compact: boolean; iconSize: number }) {
	const icons = useIcons()
	const XIcon = icons.x
	const pill = useShape().variant === 'pill'
	return (
		<>
			{clearable && (
				<span className={cn('flex shrink-0 items-center justify-center', compact ? 'size-5' : 'size-6')}>
					<ComboboxPrimitive.Clear
						aria-label="Clear"
						className={cn(clearButtonClass, pill && 'rounded-full', compact ? 'size-5' : 'size-6')}
					>
						<XIcon size={iconSize} strokeWidth={1.5} />
					</ComboboxPrimitive.Clear>
				</span>
			)}

			<ComboboxPrimitive.Trigger
				aria-label="Open"
				tabIndex={-1}
				className={cn(fieldButtonClass, compact ? '-mr-px size-5' : '-mr-1 size-6')}
			>
				<svg
					width={iconSize}
					height={iconSize}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					className="transition-colors duration-80"
				>
					<path d="M6 9l6 6 6-6" />
				</svg>
			</ComboboxPrimitive.Trigger>
		</>
	)
}

const ComboboxInput = forwardRef<HTMLInputElement, ComboboxInputProps>(
	(
		{
			className,
			variant,
			icon: Icon,
			placeholder = 'Search…',
			error,
			clearable = false,
			size,
			id,
			'aria-describedby': describedBy,
			onKeyDown,
			...props
		},
		ref
	) => {
		const sizeClasses = useSize(size)
		const compact = sizeClasses.variant === 'compact'
		const { anchorRef, open } = useComboboxContext()
		const errorId = error && id ? `${id}-error` : undefined

		return (
			<div className="flex flex-col gap-2">
				<ComboboxPrimitive.InputGroup
					ref={anchorRef}
					className={cn(
						fieldVariants({ variant }),
						sizeClasses.control,
						sizeClasses.gap,
						sizeClasses.px,
						compact ? 'min-w-[128px]' : 'min-w-[160px]',
						error && 'ring-destructive',
						className
					)}
				>
					{Icon && (
						<Icon
							size={sizeClasses.icon}
							strokeWidth={1.5}
							className="shrink-0 text-muted-foreground transition-[color,stroke-width] duration-80 group-focus-within:stroke-[2] group-focus-within:text-foreground"
						/>
					)}
					<ComboboxPrimitive.Input
						ref={ref}
						id={id}
						placeholder={placeholder}
						aria-invalid={!!error || undefined}
						aria-describedby={errorId ?? describedBy}
						className={cn(
							'min-w-0 flex-1 rounded-none bg-transparent font-[inherit] text-foreground outline-none placeholder:text-muted-foreground',
							sizeClasses.field,

							compact ? 'leading-5' : 'leading-6'
						)}
						{...props}
						onKeyDown={(event) => {
							onKeyDown?.(event)
							if (event.key !== 'Escape') return
							if (open) event.stopPropagation()
							else event.preventBaseUIHandler()
						}}
					/>
					<FieldControls clearable={clearable} compact={compact} iconSize={sizeClasses.icon} />
				</ComboboxPrimitive.InputGroup>
				{error && (
					<span id={errorId} className="text-caption text-destructive">
						{error}
					</span>
				)}
			</div>
		)
	}
)

ComboboxInput.displayName = 'ComboboxInput'

type ComboboxChipsProps = ComboboxFieldProps

function useChipRowHeight(padY: number) {
	const height = useMotionValue<number | 'auto'>('auto')
	const roRef = useRef<ResizeObserver | null>(null)
	const padRef = useRef(padY)
	useIsoLayoutEffect(() => {
		padRef.current = padY
	})
	const measure = useCallback(
		(el: HTMLDivElement | null) => {
			roRef.current?.disconnect()
			roRef.current = null
			if (!el) return
			const measure = () => {
				if (el.offsetHeight <= 0) return
				const target = el.offsetHeight + padRef.current
				if (height.get() === 'auto') height.set(target)
				else if (height.get() !== target) animate(height, target, spring.fast)
			}
			measure()
			const ro = new ResizeObserver(measure)
			ro.observe(el)
			roRef.current = ro
		},
		[height]
	)
	return { measure, height }
}

const ComboboxChips = forwardRef<HTMLInputElement, ComboboxChipsProps>(
	(
		{
			className,
			variant,
			icon: Icon,
			placeholder = 'Search…',
			error,
			clearable = false,
			size,
			id,
			'aria-describedby': describedBy,
			...props
		},
		ref
	) => {
		const icons = useIcons()
		const XIcon = icons.x
		const shape = useShape()
		const sizeClasses = useSize(size)
		const compact = sizeClasses.variant === 'compact'
		const { anchorRef, open, disabled, inputValue, values } = useComboboxContext()
		const { measure: measureChipRows, height: chipRowsHeight } = useChipRowHeight(compact ? 8 : 12)
		const errorId = error && id ? `${id}-error` : undefined

		return (
			<div className="flex flex-col gap-2">
				<ComboboxPrimitive.Chips
					ref={anchorRef}

					render={<motion.div style={{ height: chipRowsHeight }} />}

					data-disabled={disabled || undefined}
					data-popup-open={open || undefined}
					className={cn(
						fieldVariants({ variant }),

						'transition-[color,background-color,border-radius,box-shadow,opacity]',

						'!items-start',
						compact ? 'min-h-7 py-1' : 'min-h-9 py-1.5',
						sizeClasses.gap,
						sizeClasses.px,
						compact ? 'min-w-[128px]' : 'min-w-[160px]',
						error && 'ring-destructive',
						className
					)}
				>
					{Icon && (
						<span className={cn('flex shrink-0 items-center', compact ? 'h-5' : 'h-6')}>
							<Icon
								size={sizeClasses.icon}
								strokeWidth={1.5}
								className="shrink-0 text-muted-foreground transition-[color,stroke-width] duration-80 group-focus-within:stroke-[2] group-focus-within:text-foreground"
							/>
						</span>
					)}
					<div
						ref={measureChipRows}
						className={cn(
							'relative flex min-w-0 flex-1 flex-wrap items-center gap-1',

							!Icon && values.length > 0 && '-ml-1'
						)}
					>
						<ComboboxPrimitive.Value>
							{(selected: ComboboxItemData[] | null) => (
								<>
									<AnimatePresence initial={false} mode="popLayout">
										{(selected ?? []).map((item) => {
											const label = itemLabel(item)
											return (
												<motion.span
													key={itemValue(item)}
													layout
													initial={{ opacity: 0, scale: 0.9 }}
													animate={{ opacity: 1, scale: 1 }}
													exit={{ opacity: 0, scale: 0.9, pointerEvents: 'none', transition: spring.fast.exit }}
													transition={spring.fast}

													style={{ originX: 0 }}
													className="inline-flex max-w-full shrink-0"
												>
													<ComboboxPrimitive.Chip
														aria-label={label}
														className={cn(
															'inline-flex max-w-full shrink-0 items-center gap-0.5 bg-hover pr-0.5 pl-2 text-foreground outline-none',
															shape.variant === 'pill' ? 'rounded-full' : 'rounded-md',
															'focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]',
															compact ? 'h-5' : 'h-6',
															typeClass('caption', compact ? 'compact' : 'default')
														)}
													>
														<span className="truncate">{label}</span>
														<ComboboxPrimitive.ChipRemove
															aria-label={`Remove ${label}`}
															className={cn(
																chipRemoveClass,
																shape.variant === 'pill' && 'rounded-full',
																compact ? 'size-4' : 'size-5'
															)}
														>
															<XIcon size={compact ? 10 : 12} strokeWidth={2} />
														</ComboboxPrimitive.ChipRemove>
													</ComboboxPrimitive.Chip>
												</motion.span>
											)
										})}
									</AnimatePresence>

									<span className="flex min-w-6 flex-auto">
										<ComboboxPrimitive.Input
											ref={ref}
											id={id}
											size={Math.max(1, inputValue.length + 1)}
											placeholder={selected?.length ? undefined : placeholder}
											aria-invalid={!!error || undefined}
											aria-describedby={errorId ?? describedBy}
											className={cn(
												'w-full min-w-0 rounded-none bg-transparent font-[inherit] text-foreground outline-none placeholder:text-muted-foreground',
												sizeClasses.field,

												compact ? 'h-5 leading-5' : 'h-6 leading-6'
											)}
											{...props}
										/>
									</span>
								</>
							)}
						</ComboboxPrimitive.Value>
					</div>
					<FieldControls clearable={clearable} compact={compact} iconSize={sizeClasses.icon} />
				</ComboboxPrimitive.Chips>
				{error && (
					<span id={errorId} className="text-caption text-destructive">
						{error}
					</span>
				)}
			</div>
		)
	}
)

ComboboxChips.displayName = 'ComboboxChips'

type PositionerProps = React.ComponentProps<typeof ComboboxPrimitive.Positioner>

interface ComboboxContentProps {
	className?: string
	children: ReactNode
	side?: PositionerProps['side']
	align?: PositionerProps['align']
	sideOffset?: number
}

const ComboboxContent = forwardRef<HTMLDivElement, ComboboxContentProps>(
	({ className, children, side = 'bottom', align = 'start', sideOffset = 4 }, ref) => {
		const { open, actionsRef, anchorRef } = useComboboxContext()

		useEffect(() => {
			if (open) return
			const id = setTimeout(() => actionsRef.current?.unmount(), exitFallbackMs(spring.fast))
			return () => clearTimeout(id)
		}, [open, actionsRef])

		return (
			<ComboboxPrimitive.Portal>
				<ComboboxPrimitive.Positioner
					anchor={anchorRef}
					side={side}
					align={align}
					sideOffset={sideOffset}
					className="z-50 outline-none"
				>
					<motion.div
						className={popupMotionClass}
						initial={{ opacity: 0, y: 'var(--popup-enter-y)', scaleY: 0.96 }}
						animate={open ? { opacity: 1, y: 0, scaleY: 1 } : { opacity: 0, y: 'var(--popup-enter-y)', scaleY: 0.96 }}
						transition={open ? spring.fast : spring.fast.exit}

						onAnimationComplete={() => {
							if (!open) actionsRef.current?.unmount()
						}}
					>
						<ComboboxPrimitive.Popup
							ref={ref}
							render={<Elevated offset={2} shadowLevel={4} />}
							className={cn(
								'flex max-h-72 w-[var(--anchor-width)] flex-col overflow-hidden rounded-xl p-1 outline-none select-none',
								className
							)}
						>
							{children}
						</ComboboxPrimitive.Popup>
					</motion.div>
				</ComboboxPrimitive.Positioner>
			</ComboboxPrimitive.Portal>
		)
	}
)

ComboboxContent.displayName = 'ComboboxContent'

interface ComboboxListProps {
	className?: string

	children: (item: ComboboxItemData, index: number) => ReactNode

	emptyTitle?: ReactNode
	emptyHint?: ReactNode
}

const ComboboxList = forwardRef<HTMLDivElement, ComboboxListProps>(
	({ className, children, emptyTitle, emptyHint }, ref) => {
		const { open, values, multiple, inputValue, createRow } = useComboboxContext()
		const highlight = useContext(ComboboxHighlightContext)
		const icons = useIcons()
		const PlusIcon = icons.plus
		const shape = popupShape
		const containerRef = useRef<HTMLDivElement>(null)

		const hover = useFluidHover(containerRef, { isItemDisabled: isDisabledRow })
		const { activeIndex, setActiveIndex, itemRects, isMeasured, handlers, registerItem, remeasure } = hover

		const [checkedIndices, setCheckedIndices] = useState<number[]>([])

		useEffect(() => {
			if (!open) return
			remeasure()
		}, [open, remeasure])

		const [reflow, setReflow] = useState<{
			query: string
			armedRects: ItemRect[] | null
		}>(() => ({ query: inputValue, armedRects: null }))
		if (reflow.query !== inputValue) {
			setReflow({ query: inputValue, armedRects: itemRects })
		}
		const reflowSnap = reflow.armedRects !== null
		const reflowLanded = reflow.armedRects !== null && itemRects !== reflow.armedRects
		useEffect(() => {
			if (!reflowLanded) return
			const armed = reflow.armedRects
			const frame = requestAnimationFrame(() =>
				setReflow((r) => (r.armedRects === armed ? { ...r, armedRects: null } : r))
			)
			return () => cancelAnimationFrame(frame)
		}, [reflowLanded, reflow.armedRects])

		useEffect(() => {
			if (!open) return

			let inner: number
			const outer = requestAnimationFrame(() => {
				inner = requestAnimationFrame(() => {
					const container = containerRef.current
					if (container) {
						const rows = Array.from(container.querySelectorAll('[data-fluid-hover-index]')) as HTMLElement[]
						const next: number[] = []
						rows.forEach((el, i) => {
							if (values.includes(el.getAttribute('data-value') ?? '')) next.push(i)
						})
						setCheckedIndices(next)
					}
				})
			})
			return () => {
				cancelAnimationFrame(outer)
				cancelAnimationFrame(inner)
			}
		}, [open, values, inputValue])

		useEffect(() => {
			if (!highlight) setActiveIndex(null)
			else if (highlight.keyboard) setActiveIndex(highlight.index)
		}, [highlight, setActiveIndex])

		const [overlaysOpen, setOverlaysOpen] = useState(open)
		if (overlaysOpen !== open) {
			setOverlaysOpen(open)
			if (!open) {
				setCheckedIndices([])
				setActiveIndex(null)
			}
		}

		const runs = useSelectionRuns(multiple ? checkedIndices : [])
		const blocks = useMergeSplitBlocks(runs, isMeasured && open ? itemRects : [], shape.bgRadius)

		const contentCtx = useMemo(() => ({ registerItem, activeIndex }), [registerItem, activeIndex])

		return (
			<ComboboxContentContext.Provider value={contentCtx}>
				<ScrollArea className={popupScrollAreaClass} viewportClassName={cn(popupViewportClass, 'scroll-fade')}>
					<ComboboxPrimitive.List
						ref={(node: HTMLDivElement | null) => {
							;(containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node
							if (typeof ref === 'function') ref(node)
							else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
						}}
						onMouseEnter={handlers.onMouseEnter}
						onMouseMove={handlers.onMouseMove}
						onMouseLeave={handlers.onMouseLeave}
						onClick={handlers.onClick}
						className={cn('relative flex flex-col outline-none', className)}
					>
						{open && multiple && (
							<SelectionBackgrounds blocks={reflowSnap ? blocks.map((b) => ({ ...b, instant: true })) : blocks} />
						)}

						{open && (
							<FluidHoverHighlight
								hover={hover}
								className={cn(shape.bg, 'bg-active')}
								transition={reflowSnap ? false : undefined}
							/>
						)}

						<ComboboxPrimitive.Collection>
							{(item: ComboboxItemData, index: number) => (
								<ComboboxItemIndexContext.Provider key={itemValue(item)} value={index}>
									{isCreateItem(item) ? (
										<ComboboxItem value={CREATE_VALUE} icon={PlusIcon}>
											{createRow}
										</ComboboxItem>
									) : (
										children(item, index)
									)}
								</ComboboxItemIndexContext.Provider>
							)}
						</ComboboxPrimitive.Collection>
					</ComboboxPrimitive.List>
				</ScrollArea>
				{emptyTitle ? (
					<ComboboxEmpty>
						<div className="text-body text-muted-foreground">{emptyTitle}</div>
						{emptyHint ? <div className="text-caption text-muted-foreground">{emptyHint}</div> : null}
					</ComboboxEmpty>
				) : null}
			</ComboboxContentContext.Provider>
		)
	}
)

ComboboxList.displayName = 'ComboboxList'

interface ComboboxItemProps extends HTMLAttributes<HTMLDivElement> {
	icon?: IconComponent

	value: string
	disabled?: boolean
	detail?: ReactNode
}

const ComboboxItem = forwardRef<HTMLDivElement, ComboboxItemProps>(
	({ className, children, icon: Icon, value, disabled = false, detail, ...props }, ref) => {
		const comboboxCtx = useComboboxContext()
		const contentCtx = useContext(ComboboxContentContext)
		const index = useContext(ComboboxItemIndexContext)
		const internalRef = useRef<HTMLDivElement>(null)
		const shape = popupShape
		const sizeClasses = useSize()
		const compact = sizeClasses.variant === 'compact'

		const registerItem = contentCtx?.registerItem
		useRegisterFluidHoverItem(registerItem, index, internalRef)

		const isActive = contentCtx?.activeIndex === index
		const isChecked = comboboxCtx.values.includes(value)

		const item = comboboxCtx.itemsByValue.get(value) ?? value

		return (
			<ComboboxPrimitive.Item
				value={item}
				index={index}
				disabled={disabled}
				render={
					<div
						ref={(node: HTMLDivElement | null) => {
							;(internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node
							if (typeof ref === 'function') ref(node)
							else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
						}}
						data-fluid-hover-index={index}
						data-value={value}
						className={cn(
							`relative z-10 flex ${sizeClasses.control} shrink-0 items-center ${sizeClasses.gap} ${shape.item} ${sizeClasses.itemPx} ${sizeClasses.text} cursor-pointer outline-none select-none`,
							'transition-[color] duration-80',
							isActive || isChecked ? 'text-foreground' : 'text-muted-foreground',
							disabled && 'pointer-events-none opacity-50',
							className
						)}
						{...props}
					/>
				}
			>
				<span aria-hidden className={cn('shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')}>
					<AnimatePresence initial={false}>
						{isChecked && (
							<motion.svg
								key="check"
								width={sizeClasses.icon}
								height={sizeClasses.icon}
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth={2}
								strokeLinecap="round"
								strokeLinejoin="round"
								className="text-foreground"
								initial={{ opacity: 1 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 1 }}
							>
								<motion.path
									d="M4 12L9 17L20 6"
									initial={{ pathLength: 0 }}
									animate={{
										pathLength: 1,
										transition: { duration: 0.08, ease: 'easeOut' },
									}}
									exit={{
										pathLength: 0,
										transition: { duration: 0.04, ease: 'easeIn' },
									}}
								/>
							</motion.svg>
						)}
					</AnimatePresence>
				</span>

				{Icon && (
					<Icon
						size={sizeClasses.icon}
						strokeWidth={isActive || isChecked ? 2 : 1.5}
						className="shrink-0 transition-[color,stroke-width] duration-80"
					/>
				)}

				<span className="-my-1 min-w-0 flex-1 truncate py-1 [text-box:trim-both_cap_alphabetic]">{children}</span>

				{detail ? <span className="shrink-0 text-muted-foreground">{detail}</span> : null}
			</ComboboxPrimitive.Item>
		)
	}
)

ComboboxItem.displayName = 'ComboboxItem'

interface ComboboxEmptyProps extends HTMLAttributes<HTMLDivElement> {
	allSelected?: ReactNode
}

const ComboboxEmpty = forwardRef<HTMLDivElement, ComboboxEmptyProps>(
	({ className, children, allSelected, ...props }, ref) => {
		const sizeClasses = useSize()
		const ctx = useComboboxContext()
		return (
			<ComboboxPrimitive.Empty
				ref={ref}
				className={cn('px-3 text-center text-muted-foreground [&:not(:empty)]:py-6', sizeClasses.text, className)}
				{...props}
			>
				{ctx.allSelected && allSelected !== undefined ? allSelected : children}
			</ComboboxPrimitive.Empty>
		)
	}
)

ComboboxEmpty.displayName = 'ComboboxEmpty'

export {
	Combobox,
	ComboboxInput,
	ComboboxChips,
	ComboboxContent,
	ComboboxList,
	ComboboxItem,
	ComboboxEmpty,
	fieldVariants as comboboxFieldVariants,
}

export type {
	ComboboxItemData,
	ComboboxValue,
	ComboboxProps,
	ComboboxInputProps,
	ComboboxChipsProps,
	ComboboxContentProps,
	ComboboxListProps,
	ComboboxItemProps,
	ComboboxEmptyProps,
}
