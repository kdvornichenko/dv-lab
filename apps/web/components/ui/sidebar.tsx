'use client'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'

import {
	useCallback,
	useEffect,
	useRef,
	useState,
	forwardRef,
	type ReactNode,
	type CSSProperties,
	type HTMLAttributes,
} from 'react'

import { motion, useReducedMotion } from 'framer-motion'

import { ScrollArea } from '@/components/ui/scroll-area'
import {
	useSidebar,
	SidebarShell,
	type SidebarSide,
	type SidebarVariant,
	type SidebarCollapsible,
} from '@/components/ui/sidebar-core'
import { spring, exitFallbackMs } from '@/lib/springs'
import { surfaceClasses } from '@/lib/surface-classes'
import { useSurface, SurfaceProvider } from '@/lib/surface-context'
import { cn } from '@/lib/utils'

type MotionSafeDivProps = Omit<
	React.HTMLAttributes<HTMLDivElement>,
	'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
>
interface SidebarSheetProps {
	side: SidebarSide
	open: boolean
	onClose: () => void
	children: ReactNode
}
function SidebarSheet({ side, open, onClose, children }: SidebarSheetProps) {
	const { widthMobile } = useSidebar()
	const reduceMotion = useReducedMotion() ?? false
	const panelRef = useRef<HTMLDivElement | null>(null)
	const substrate = useSurface()
	const level = Math.min(substrate + 2, 8)
	const [closing, setClosing] = useState(false)
	const visible = open && !closing
	const finishClose = useCallback(() => {
		setClosing(false)
		onClose()
	}, [onClose])
	const wasOpen = useRef(open)
	useEffect(() => {
		if (wasOpen.current && !open) setClosing(true)
		wasOpen.current = open
	}, [open])
	useEffect(() => {
		if (!closing) return
		const id = setTimeout(finishClose, exitFallbackMs(spring.moderate))
		return () => clearTimeout(id)
	}, [closing, finishClose])
	const offscreen = side === 'left' ? '-100%' : '100%'
	return (
		<DialogPrimitive.Root
			open={open || closing}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) setClosing(true)
			}}
		>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Backdrop
					render={(backdropProps) => {
						const { style: _style, ...rest } = backdropProps as React.HTMLAttributes<HTMLDivElement>
						return (
							<motion.div
								{...(rest as MotionSafeDivProps)}
								className="fixed inset-0 z-40 bg-black/40 dark:bg-black/80"
								initial={{ opacity: 0 }}
								animate={{ opacity: visible ? 1 : 0 }}
								transition={visible ? { duration: spring.moderate.duration } : spring.moderate.exit}
							/>
						)
					}}
				/>

				<DialogPrimitive.Popup
					aria-label="Sidebar"
					initialFocus={panelRef}
					render={(popupProps) => {
						const {
							style: baseStyle,
							ref: baseRef,
							...rest
						} = popupProps as React.HTMLAttributes<HTMLDivElement> & {
							ref?: React.Ref<HTMLDivElement>
						}
						return (
							<motion.div
								{...(rest as MotionSafeDivProps)}
								ref={(node: HTMLDivElement | null) => {
									panelRef.current = node
									if (typeof baseRef === 'function') baseRef(node)
									else if (baseRef) (baseRef as React.MutableRefObject<HTMLDivElement | null>).current = node
								}}
								tabIndex={-1}
								data-sidebar="sidebar"
								data-mobile="true"
								data-side={side}
								className={cn(
									'fixed inset-y-0 z-50 flex flex-col overflow-hidden outline-none',
									!visible && 'pointer-events-none',
									side === 'left' ? 'left-0' : 'right-0',
									surfaceClasses(level, 3)
								)}
								style={{
									...(baseStyle as CSSProperties | undefined),
									width: widthMobile,
								}}
								initial={{ x: offscreen }}
								animate={{ x: visible ? 0 : offscreen }}
								transition={reduceMotion ? { duration: 0 } : visible ? spring.moderate : spring.moderate.exit}
								onAnimationComplete={() => {
									if (closing) finishClose()
								}}
							>
								<SurfaceProvider value={level}>{children}</SurfaceProvider>
							</motion.div>
						)
					}}
				/>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	)
}
export interface SidebarProps extends Omit<
	HTMLAttributes<HTMLDivElement>,
	'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
> {
	side?: SidebarSide
	variant?: SidebarVariant
	collapsible?: SidebarCollapsible
	bordered?: boolean
	railTooltipOpen?: boolean
	rail?: boolean
}
const Sidebar = forwardRef<HTMLDivElement, SidebarProps>(
	(
		{
			side = 'left',
			variant = 'sidebar',
			collapsible = 'offcanvas',
			bordered = true,
			rail = true,
			railTooltipOpen,
			className,
			style,
			children,
			...props
		},
		ref
	) => {
		const { isMobile, openMobile, setOpenMobile, width, registerSide } = useSidebar()
		useEffect(() => registerSide(side), [side, registerSide])
		if (collapsible === 'none') {
			return (
				<div
					ref={ref}
					data-slot="sidebar"
					data-variant={variant}
					data-side={side}
					className={cn('peer sticky top-0 flex h-svh shrink-0 flex-col', side === 'right' && 'order-last', className)}
					style={{ width, ...style } as CSSProperties}
					{...props}
				>
					<div
						data-sidebar="sidebar"
						className={cn(
							'flex h-full min-h-0 w-full flex-col',
							bordered &&
								variant === 'sidebar' &&
								(side === 'left' ? 'border-r border-border' : 'border-l border-border')
						)}
					>
						{children}
					</div>
				</div>
			)
		}
		return (
			<>
				{isMobile && (
					<SidebarSheet side={side} open={openMobile} onClose={() => setOpenMobile(false)}>
						{children}
					</SidebarSheet>
				)}
				<SidebarShell
					ref={ref}
					side={side}
					variant={variant}
					bordered={bordered}
					rail={rail}
					railTooltipOpen={railTooltipOpen}
					className={className}
					style={style}
					{...props}
				>
					{children}
				</SidebarShell>
			</>
		)
	}
)
Sidebar.displayName = 'Sidebar'
export interface SidebarContentProps extends HTMLAttributes<HTMLDivElement> {
	viewportClassName?: string
}
const SidebarContent = forwardRef<HTMLDivElement, SidebarContentProps>(
	({ className, viewportClassName, children, ...props }, ref) => {
		const { isMobile } = useSidebar()
		if (isMobile) {
			return (
				<div className="scroll-divider flex min-h-0 w-full flex-1 flex-col [--scroll-divider-inset:8px]">
					<div
						ref={ref}
						data-sidebar="content"
						className={cn('scroll-fade flex min-h-0 w-full flex-1 flex-col overflow-y-auto', className)}
						{...props}
					>
						{children}
					</div>
				</div>
			)
		}
		return (
			<ScrollArea
				className={cn('scroll-divider min-h-0 w-full flex-1', className)}
				viewportClassName={cn('scroll-fade [&>div]:!block [&>div]:!min-w-0', viewportClassName)}
			>
				<div ref={ref} data-sidebar="content" className="flex w-full min-w-0 flex-col" {...props}>
					{children}
				</div>
			</ScrollArea>
		)
	}
)
SidebarContent.displayName = 'SidebarContent'
export { Sidebar, SidebarContent }
export {
	SidebarProvider,
	useSidebar,
	SidebarTrigger,
	SidebarRail,
	SidebarInset,
	SidebarInput,
	SidebarHeader,
	SidebarFooter,
	SidebarSeparator,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarGroupAction,
	SidebarGroupActions,
	SidebarGroupContent,
	SIDEBAR_COOKIE_NAME,
	SIDEBAR_COOKIE_MAX_AGE,
	SIDEBAR_WIDTH,
	SIDEBAR_WIDTH_MOBILE,
	SIDEBAR_KEYBOARD_SHORTCUT,
	SIDEBAR_KEYBOARD_SHORTCUT_RIGHT,
	SIDEBAR_MIN_WIDTH,
	SIDEBAR_MAX_WIDTH,
} from '@/components/ui/sidebar-core'
export type {
	SidebarContextValue,
	SidebarProviderProps,
	SidebarTriggerProps,
	SidebarRailProps,
	SidebarInsetProps,
	SidebarInputProps,
	SidebarSectionProps,
	SidebarGroupLabelProps,
	SidebarGroupActionProps,
	SidebarSide,
	SidebarVariant,
	SidebarCollapsible,
} from '@/components/ui/sidebar-core'
export {
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
	SidebarMenuAction,
	SidebarMenuActions,
	SidebarMenuBadge,
	SidebarMenuSkeleton,
	SidebarMenuSub,
	SidebarMenuSubItem,
	SidebarMenuSubButton,
	sidebarMenuButtonVariants,
} from '@/components/ui/sidebar-menu'
export type {
	SidebarMenuProps,
	SidebarMenuItemProps,
	SidebarMenuButtonProps,
	SidebarMenuActionProps,
	SidebarMenuBadgeProps,
	SidebarMenuSkeletonProps,
	SidebarMenuSubProps,
	SidebarMenuSubItemProps,
	SidebarMenuSubButtonProps,
} from '@/components/ui/sidebar-menu'
