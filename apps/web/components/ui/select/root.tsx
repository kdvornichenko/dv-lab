'use client'

import { Select as SelectPrimitive } from '@base-ui/react/select'

import { Children, isValidElement, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { SizeProvider, type SizeVariant } from '@/lib/size-context'

import { SelectContext } from './context'

const selectionAckMs = 300

interface SelectProps {
	children: ReactNode
	value?: string
	defaultValue?: string
	onValueChange?: (value: string) => void
	disabled?: boolean
	name?: string
	required?: boolean

	size?: SizeVariant
}

function collectSelectItems(node: ReactNode, out: { value: string; label: ReactNode }[] = []) {
	Children.forEach(node, (child) => {
		if (!isValidElement(child)) return
		const props = child.props as { value?: unknown; children?: ReactNode }
		if (typeof props.value === 'string') {
			out.push({
				value: props.value,
				label: typeof props.children === 'string' ? props.children : props.value,
			})
		} else if (props.children) {
			collectSelectItems(props.children, out)
		}
	})
	return out
}

function Select({ children, value, defaultValue, onValueChange, disabled = false, name, required, size }: SelectProps) {
	const [internalValue, setInternalValue] = useState(defaultValue ?? '')
	const [open, setOpen] = useState(false)
	const actionsRef = useRef<{ unmount: () => void } | null>(null)
	const currentValue = value !== undefined ? value : internalValue

	const items = useMemo(() => collectSelectItems(children), [children])

	const handleValueChange = useCallback(
		(next: string | null) => {
			const v = next ?? ''
			if (value === undefined) setInternalValue(v)
			onValueChange?.(v)
		},
		[value, onValueChange]
	)

	const ackTimeoutRef = useRef<number | null>(null)
	const cancelAckClose = useCallback(() => {
		if (ackTimeoutRef.current !== null) {
			clearTimeout(ackTimeoutRef.current)
			ackTimeoutRef.current = null
		}
	}, [])
	useEffect(() => cancelAckClose, [cancelAckClose])

	const handleOpenChange = useCallback(
		(nextOpen: boolean, eventDetails: { reason: string }) => {
			if (!nextOpen && eventDetails.reason === 'item-press') {
				cancelAckClose()
				ackTimeoutRef.current = window.setTimeout(() => {
					ackTimeoutRef.current = null
					setOpen(false)
				}, selectionAckMs)
				return
			}
			cancelAckClose()
			setOpen(nextOpen)
		},
		[cancelAckClose]
	)

	const ctx = useMemo(() => ({ value: currentValue, open, actionsRef }), [currentValue, open])

	const root = (
		<SelectContext.Provider value={ctx}>
			<SelectPrimitive.Root<string>
				value={currentValue === '' ? null : currentValue}
				onValueChange={handleValueChange}
				open={open}
				onOpenChange={handleOpenChange}
				actionsRef={actionsRef}
				items={items}
				disabled={disabled}
				name={name}
				required={required}

				modal={false}
			>
				{children}
			</SelectPrimitive.Root>
		</SelectContext.Provider>
	)

	return size ? <SizeProvider size={size}>{root}</SizeProvider> : root
}

Select.displayName = 'Select'

export { Select, type SelectProps }
