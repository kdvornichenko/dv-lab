'use client'
import { useDirection } from '@base-ui/react/direction-provider'
import type { MenuTriggerProps } from '@base-ui/react/menu'
import { Menu } from '@base-ui/react/menu'

import { forwardRef, useCallback, useMemo, useRef, type ReactNode } from 'react'

import {
	SUBMENU_ALIGN_OFFSET,
	SUBMENU_SIDE_OFFSET,
	SubmenuChevron,
	useReportSubmenu,
	type DropdownSubTriggerProps,
} from '@/components/ui/dropdown-sub'
import {
	DropdownContext,
	MenuItem,
	useControllableOpen,
	useDropdown,
	type MenuItemRenderOptions,
} from '@/components/ui/menu-item'
import { SizeProvider, type SizeVariant } from '@/lib/size-context'

import { DropdownContent, type DropdownContentProps } from './content'
import { DropdownMenuContext, useDropdownMenuContext, type DropdownMenuActions } from './context'

interface DropdownMenuProps {
	children: ReactNode
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
	disabled?: boolean
	size?: SizeVariant
}
function DropdownMenu({
	children,
	open: openProp,
	defaultOpen = false,
	onOpenChange,
	disabled = false,
	size,
}: DropdownMenuProps) {
	const [open, handleOpenChange] = useControllableOpen(openProp, defaultOpen, onOpenChange)
	const actionsRef = useRef<DropdownMenuActions | null>(null)
	const ctx = useMemo(() => ({ open, actionsRef, sub: false }), [open])
	const root = (
		<DropdownMenuContext.Provider value={ctx}>
			<Menu.Root open={open} onOpenChange={handleOpenChange} actionsRef={actionsRef} disabled={disabled} modal={false}>
				{children}
			</Menu.Root>
		</DropdownMenuContext.Provider>
	)
	return size ? <SizeProvider size={size}>{root}</SizeProvider> : root
}
DropdownMenu.displayName = 'DropdownMenu'
type DropdownTriggerProps = MenuTriggerProps
const DropdownTrigger = Menu.Trigger

interface DropdownSubProps {
	children: ReactNode
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
}
function DropdownSub({ children, open: openProp, defaultOpen = false, onOpenChange }: DropdownSubProps) {
	const [open, handleOpenChange] = useControllableOpen(openProp, defaultOpen, onOpenChange)
	const actionsRef = useRef<DropdownMenuActions | null>(null)
	const ctx = useMemo(() => ({ open, actionsRef, sub: true }), [open])
	return (
		<DropdownMenuContext.Provider value={ctx}>
			<Menu.SubmenuRoot open={open} onOpenChange={handleOpenChange} actionsRef={actionsRef}>
				{children}
			</Menu.SubmenuRoot>
		</DropdownMenuContext.Provider>
	)
}
DropdownSub.displayName = 'DropdownSub'
const DropdownSubTrigger = forwardRef<HTMLDivElement, DropdownSubTriggerProps>(({ index, ...props }, ref) => {
	const parent = useDropdown()
	const { open } = useDropdownMenuContext()
	useReportSubmenu(parent.onSubmenuOpenChange, index, open)
	const lit = parent.activeIndex === index
	const renderMenuItem = useCallback(
		({ disabled, label, onActivate, element, children }: MenuItemRenderOptions) => (
			<Menu.SubmenuTrigger disabled={disabled} label={label} onClick={onActivate} render={element}>
				{children}
				<SubmenuChevron lit={lit} />
			</Menu.SubmenuTrigger>
		),
		[lit]
	)
	const ctx = useMemo(() => ({ ...parent, renderMenuItem }), [parent, renderMenuItem])
	return (
		<DropdownContext.Provider value={ctx}>
			<MenuItem ref={ref} index={index} {...props} />
		</DropdownContext.Provider>
	)
})
DropdownSubTrigger.displayName = 'DropdownSubTrigger'
type DropdownSubContentProps = Omit<DropdownContentProps, 'side' | 'align'>
const DropdownSubContent = forwardRef<HTMLDivElement, DropdownSubContentProps>(
	({ sideOffset = SUBMENU_SIDE_OFFSET, alignOffset = SUBMENU_ALIGN_OFFSET, ...props }, ref) => {
		const direction = useDirection()
		return (
			<DropdownContent
				ref={ref}
				side={direction === 'rtl' ? 'left' : 'right'}
				align="start"
				sideOffset={sideOffset}
				alignOffset={alignOffset}
				{...props}
			/>
		)
	}
)
DropdownSubContent.displayName = 'DropdownSubContent'

export {
	DropdownMenu,
	type DropdownMenuProps,
	DropdownSub,
	DropdownSubContent,
	type DropdownSubContentProps,
	type DropdownSubProps,
	DropdownSubTrigger,
	DropdownTrigger,
	type DropdownTriggerProps,
}
