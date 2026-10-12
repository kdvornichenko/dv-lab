'use client'

import { createContext, useContext, useEffect, useLayoutEffect, type ReactNode } from 'react'

import { shapeMap } from '@/lib/shape-context'

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
	reason: 'keyboard' | 'pointer' | 'none'
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

const popupShape = shapeMap.rounded

export {
	CREATE_VALUE,
	ComboboxContentContext,
	ComboboxContext,
	ComboboxHighlightContext,
	type ComboboxItemData,
	ComboboxItemIndexContext,
	type ComboboxValue,
	type Highlight,
	defaultCreateLabel,
	isCreateItem,
	itemLabel,
	itemValue,
	popupShape,
	useComboboxContext,
	useIsoLayoutEffect,
}
