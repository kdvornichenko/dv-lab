'use client'

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'

import { SizeProvider, type SizeVariant } from '@/lib/size-context'

import {
	ComboboxContext,
	ComboboxHighlightContext,
	CREATE_VALUE,
	defaultCreateLabel,
	isCreateItem,
	itemLabel,
	itemValue,
	useIsoLayoutEffect,
	type ComboboxItemData,
	type ComboboxValue,
	type Highlight,
} from './context'

type ComboboxRootProps<Value, Multiple extends boolean | undefined = false, Item = Value> = Omit<
	ComboboxPrimitive.Root.Props<Value, Multiple, Item>,
	'autoHighlight'
> & { autoHighlight?: boolean | 'always' }

const ComboboxRoot = ComboboxPrimitive.Root as <Value, Multiple extends boolean | undefined = false, Item = Value>(
	props: ComboboxRootProps<Value, Multiple, Item>
) => React.JSX.Element

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

	onOpenChange?: (open: boolean) => void
	onInputValueChange?: (value: string) => void
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
	onOpenChange,
	onInputValueChange,
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
		(next: ComboboxItemData[] | ComboboxItemData | null) => {
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
				<ComboboxRoot<ComboboxItemData, boolean>
					items={listItems}
					multiple={isMultiple}

					value={isMultiple ? selectedItems : (selectedItems[0] ?? null)}
					onValueChange={handleValueChange}
					isItemEqualToValue={(a: ComboboxItemData, b: ComboboxItemData) => itemValue(a) === itemValue(b)}
					itemToStringLabel={itemLabel}
					itemToStringValue={itemValue}
					filter={filterFn}
					open={open}
					onOpenChange={(next) => {
						setOpen(next)
						onOpenChange?.(next)
					}}
					onInputValueChange={(next) => {
						setInputValue(next)
						onInputValueChange?.(next)
					}}
					actionsRef={actionsRef}
					autoHighlight="always"
					onItemHighlighted={(item, details) =>
						setHighlight(item === undefined ? null : { index: details.index, reason: details.reason })
					}
					disabled={disabled}
					name={name}
					required={required}

					modal={false}
				>
					{children}
				</ComboboxRoot>
			</ComboboxHighlightContext.Provider>
		</ComboboxContext.Provider>
	)

	return size ? <SizeProvider size={size}>{root}</SizeProvider> : root
}

Combobox.displayName = 'Combobox'

export { Combobox, type ComboboxProps }
