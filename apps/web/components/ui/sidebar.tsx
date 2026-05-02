'use client'

import { Slot } from '@radix-ui/react-slot'

import * as React from 'react'

import { type VariantProps } from 'class-variance-authority'
import { PanelLeftIcon, PanelRightIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
	sidebarMenuButtonVariants,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarInset,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarSeparator,
} from '@/components/ui/sidebar-visual'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const SIDEBAR_COOKIE_NAME = 'sidebar_state'
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = '16rem'
const SIDEBAR_WIDTH_MOBILE = '18rem'
const SIDEBAR_WIDTH_ICON = '3rem'
const SIDEBAR_KEYBOARD_SHORTCUT = 'b'
const SIDEBAR_MOBILE_BREAKPOINT = 1024

function useIsSidebarMobile() {
	const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

	React.useEffect(() => {
		const mql = window.matchMedia(`(max-width: ${SIDEBAR_MOBILE_BREAKPOINT - 1}px)`)
		const onChange = () => {
			setIsMobile(window.innerWidth < SIDEBAR_MOBILE_BREAKPOINT)
		}
		mql.addEventListener('change', onChange)
		setIsMobile(window.innerWidth < SIDEBAR_MOBILE_BREAKPOINT)
		return () => mql.removeEventListener('change', onChange)
	}, [])

	return !!isMobile
}

type SidebarContextProps = {
	state: 'expanded' | 'collapsed'
	open: boolean
	setOpen: (open: boolean) => void
	openMobile: boolean
	setOpenMobile: (open: boolean) => void
	openMobileRight: boolean
	setOpenMobileRight: (open: boolean) => void
	isMobile: boolean
	toggleSidebar: (side?: 'left' | 'right') => void
	leftSidebarCollapsible: 'offcanvas' | 'icon' | 'none'
	setLeftSidebarCollapsible: (collapsible: 'offcanvas' | 'icon' | 'none') => void
	leftSidebarVisible: boolean
	setLeftSidebarVisible: (visible: boolean) => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebarInternal(): SidebarContextProps {
	const context = React.useContext(SidebarContext)
	if (!context) {
		throw new Error('useSidebar must be used within a SidebarProvider.')
	}

	return context
}

export type SidebarPublicApi = Pick<
	SidebarContextProps,
	'isMobile' | 'open' | 'openMobile' | 'toggleSidebar' | 'setOpenMobile' | 'setOpenMobileRight'
> & {
	mobileOpen: boolean
	closeMobile: () => void
}

/**
 * Public facade for external consumers.
 * Keep this surface small and stable; internal components can use the full context.
 */
function useSidebar(): SidebarPublicApi {
	const { isMobile, open, openMobile, toggleSidebar, setOpenMobile, setOpenMobileRight } = useSidebarInternal()

	return React.useMemo(
		() => ({
			isMobile,
			open,
			openMobile,
			mobileOpen: openMobile,
			toggleSidebar,
			setOpenMobile,
			setOpenMobileRight,
			closeMobile: () => setOpenMobile(false),
		}),
		[isMobile, open, openMobile, toggleSidebar, setOpenMobile, setOpenMobileRight]
	)
}

function SidebarProvider({
	defaultOpen = true,
	open: openProp,
	onOpenChange: setOpenProp,
	className,
	style,
	children,
	...props
}: React.ComponentProps<'div'> & {
	defaultOpen?: boolean
	open?: boolean
	onOpenChange?: (open: boolean) => void
}) {
	const isMobile = useIsSidebarMobile()
	const [openMobile, setOpenMobile] = React.useState(false)
	const [openMobileRight, setOpenMobileRight] = React.useState(false)
	const [leftSidebarCollapsible, setLeftSidebarCollapsible] = React.useState<'offcanvas' | 'icon' | 'none'>('offcanvas')
	const [leftSidebarVisible, setLeftSidebarVisible] = React.useState(false)

	// This is the internal state of the sidebar.
	// We use openProp and setOpenProp for control from outside the component.
	const [_open, _setOpen] = React.useState(defaultOpen)
	const open = openProp ?? _open
	const setOpen = React.useCallback(
		(value: boolean | ((value: boolean) => boolean)) => {
			const openState = typeof value === 'function' ? value(open) : value
			if (setOpenProp) {
				setOpenProp(openState)
			} else {
				_setOpen(openState)
			}

			// This sets the cookie to keep the sidebar state.
			document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
		},
		[setOpenProp, open]
	)

	// Helper to toggle the sidebar.
	const toggleSidebar = React.useCallback(
		(side: 'left' | 'right' = 'left') => {
			if (isMobile) {
				if (side === 'right') {
					setOpenMobileRight((open) => !open)
					return
				}
				setOpenMobile((open) => !open)
				return
			}
			setOpen((open) => !open)
		},
		[isMobile, setOpen]
	)

	// Adds a keyboard shortcut to toggle the sidebar.
	React.useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
				event.preventDefault()
				toggleSidebar('left')
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [toggleSidebar])

	// We add a state so that we can do data-state="expanded" or "collapsed".
	// This makes it easier to style the sidebar with Tailwind classes.
	const state = open ? 'expanded' : 'collapsed'
	const currentSidebarWidth = React.useMemo(() => {
		if (!leftSidebarVisible) return '0px'
		if (isMobile) return '0px'
		if (state === 'expanded') return SIDEBAR_WIDTH
		if (leftSidebarCollapsible === 'offcanvas') return '0px'
		if (leftSidebarCollapsible === 'icon') return SIDEBAR_WIDTH_ICON
		return SIDEBAR_WIDTH
	}, [leftSidebarVisible, isMobile, state, leftSidebarCollapsible])

	const contextValue = React.useMemo<SidebarContextProps>(
		() => ({
			state,
			open,
			setOpen,
			isMobile,
			openMobile,
			setOpenMobile,
			openMobileRight,
			setOpenMobileRight,
			toggleSidebar,
			leftSidebarCollapsible,
			setLeftSidebarCollapsible,
			leftSidebarVisible,
			setLeftSidebarVisible,
		}),
		[
			state,
			open,
			setOpen,
			isMobile,
			openMobile,
			setOpenMobile,
			openMobileRight,
			setOpenMobileRight,
			toggleSidebar,
			leftSidebarCollapsible,
			leftSidebarVisible,
		]
	)

	return (
		<SidebarContext.Provider value={contextValue}>
			<TooltipProvider delayDuration={0}>
				<div
					data-slot="sidebar-wrapper"
					style={
						{
							'--sidebar-width': SIDEBAR_WIDTH,
							'--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
							'--sidebar-width-current': currentSidebarWidth,
							...style,
						} as React.CSSProperties
					}
					className={cn('group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full', className)}
					{...props}
				>
					{children}
				</div>
			</TooltipProvider>
		</SidebarContext.Provider>
	)
}

function Sidebar({
	side = 'left',
	variant = 'sidebar',
	collapsible = 'offcanvas',
	className,
	children,
	...props
}: React.ComponentProps<'div'> & {
	side?: 'left' | 'right'
	variant?: 'sidebar' | 'floating' | 'inset'
	collapsible?: 'offcanvas' | 'icon' | 'none'
}) {
	const {
		isMobile,
		state,
		openMobile,
		setOpenMobile,
		openMobileRight,
		setOpenMobileRight,
		setLeftSidebarCollapsible,
		setLeftSidebarVisible,
	} = useSidebarInternal()
	const sidebarRef = React.useRef<HTMLDivElement | null>(null)

	React.useEffect(() => {
		if (side !== 'left') return
		setLeftSidebarCollapsible(collapsible)
	}, [side, collapsible, setLeftSidebarCollapsible])

	React.useEffect(() => {
		if (side !== 'left') return

		const updateVisibility = () => {
			const node = sidebarRef.current
			if (!node) {
				setLeftSidebarVisible(false)
				return
			}

			const styles = window.getComputedStyle(node)
			const isVisible = styles.display !== 'none' && styles.visibility !== 'hidden'
			setLeftSidebarVisible(isVisible)
		}

		updateVisibility()
		window.addEventListener('resize', updateVisibility)

		const observer = new MutationObserver(updateVisibility)
		if (sidebarRef.current) {
			observer.observe(sidebarRef.current, { attributes: true, attributeFilter: ['class', 'style'] })
		}

		return () => {
			window.removeEventListener('resize', updateVisibility)
			observer.disconnect()
			setLeftSidebarVisible(false)
		}
	}, [side, setLeftSidebarVisible])

	// if (collapsible === 'none') {
	// 	return (
	// 		<div
	// 			data-slot="sidebar"
	// 			className={cn('bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col', className)}
	// 			{...props}
	// 		>
	// 			{children}
	// 		</div>
	// 	)
	// }

	if (isMobile) {
		const mobileOpen = side === 'right' ? openMobileRight : openMobile
		const setMobileOpen = side === 'right' ? setOpenMobileRight : setOpenMobile

		return (
			<Sheet open={mobileOpen} onOpenChange={setMobileOpen} {...props}>
				<SheetContent
					data-sidebar="sidebar"
					data-slot="sidebar"
					data-mobile="true"
					className="bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden"
					style={
						{
							'--sidebar-width': SIDEBAR_WIDTH_MOBILE,
						} as React.CSSProperties
					}
					side={side}
				>
					<SheetHeader className="sr-only">
						<SheetTitle>Sidebar</SheetTitle>
						<SheetDescription>Displays the mobile sidebar.</SheetDescription>
					</SheetHeader>
					<div className="flex h-full w-full flex-col">{children}</div>
				</SheetContent>
			</Sheet>
		)
	}

	return (
		<div
			ref={sidebarRef}
			className="text-sidebar-foreground tab:block group peer hidden"
			data-state={state}
			data-collapsible={state === 'collapsed' ? collapsible : ''}
			data-variant={variant}
			data-side={side}
			data-slot="sidebar"
		>
			{/* This is what handles the sidebar gap on desktop */}
			<div
				data-slot="sidebar-gap"
				className={cn(
					'w-(--sidebar-width) relative bg-transparent transition-[width] duration-200 ease-linear',
					'group-data-[collapsible=offcanvas]:w-0',
					'group-data-[side=right]:rotate-180',
					variant === 'floating' || variant === 'inset'
						? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
						: 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)'
				)}
			/>
			<div
				data-slot="sidebar-container"
				className={cn(
					'tab-sm:flex w-(--sidebar-width) fixed inset-y-0 z-10 hidden h-svh transition-[left,right,width] duration-200 ease-linear',
					side === 'left'
						? 'left-0 group-data-[collapsible=offcanvas]:-left-(--sidebar-width)'
						: 'right-0 group-data-[collapsible=offcanvas]:-right-(--sidebar-width)',
					// Adjust the padding for floating and inset variants.
					variant === 'floating' || variant === 'inset'
						? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'
						: 'group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l',
					className
				)}
				{...props}
			>
				<div
					data-sidebar="sidebar"
					data-slot="sidebar-inner"
					className="bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm"
				>
					{children}
				</div>
			</div>
		</div>
	)
}

function SidebarTrigger({
	side = 'left',
	className,
	onClick,
	...props
}: React.ComponentProps<typeof Button> & { side?: 'left' | 'right' }) {
	const { toggleSidebar } = useSidebarInternal()

	return (
		<Button
			data-sidebar="trigger"
			data-slot="sidebar-trigger"
			variant="outline"
			size="icon"
			className={cn('size-btn', className)}
			onClick={(event) => {
				onClick?.(event)
				toggleSidebar(side)
			}}
			{...props}
		>
			{side === 'right' ? <PanelRightIcon /> : <PanelLeftIcon />}
			<span className="sr-only">Toggle Sidebar</span>
		</Button>
	)
}

function SidebarRail({ className, ...props }: React.ComponentProps<'button'>) {
	const { toggleSidebar } = useSidebarInternal()

	return (
		<button
			data-sidebar="rail"
			data-slot="sidebar-rail"
			aria-label="Toggle Sidebar"
			tabIndex={-1}
			onClick={() => toggleSidebar('left')}
			title="Toggle Sidebar"
			className={cn(
				'hover:after:bg-sidebar-border mob:flex absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 group-data-[side=left]:-right-4 group-data-[side=right]:left-0',
				'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
				'[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
				'hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full',
				'[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
				'[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
				className
			)}
			{...props}
		/>
	)
}

function SidebarMenuButton({
	asChild = false,
	isActive = false,
	variant = 'default',
	size = 'default',
	tooltip,
	className,
	...props
}: React.ComponentProps<'button'> & {
	asChild?: boolean
	isActive?: boolean
	tooltip?: string | React.ComponentProps<typeof TooltipContent>
} & VariantProps<typeof sidebarMenuButtonVariants>) {
	const Comp = asChild ? Slot : 'button'
	const { isMobile, state } = useSidebarInternal()

	const button = (
		<Comp
			data-slot="sidebar-menu-button"
			data-sidebar="menu-button"
			data-size={size}
			data-active={isActive}
			className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
			{...props}
		/>
	)

	if (!tooltip) {
		return button
	}

	if (typeof tooltip === 'string') {
		tooltip = {
			children: tooltip,
		}
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>{button}</TooltipTrigger>
			<TooltipContent side="right" align="center" hidden={state !== 'collapsed' || isMobile} {...tooltip} />
		</Tooltip>
	)
}

export {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarInset,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarProvider,
	SidebarRail,
	SidebarSeparator,
	SidebarTrigger,
	useSidebar,
}
