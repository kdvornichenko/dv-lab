'use client'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'

import {
	forwardRef,
	isValidElement,
	type ButtonHTMLAttributes,
	type ReactElement,
	type ReactNode,
	type HTMLAttributes,
} from 'react'

import { motion } from 'framer-motion'

import { Button } from '@/components/ui/button'
import { fontWeights } from '@/lib/font-weight'
import { useIcons } from '@/lib/icon-context'
import { useShape } from '@/lib/shape-context'
import { useSize, useSizeVariant, typeClass } from '@/lib/size-context'
import { spring } from '@/lib/springs'
import { surfaceClasses } from '@/lib/surface-classes'
import { SurfaceProvider, useSurface } from '@/lib/surface-context'
import { cn } from '@/lib/utils'

const DIALOG_OFFSET = 4
interface DialogProps {
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
	modal?: boolean
	children?: ReactNode
}
function Dialog({ children, open, defaultOpen, onOpenChange, modal }: DialogProps) {
	return (
		<DialogPrimitive.Root
			open={open}
			defaultOpen={defaultOpen}
			onOpenChange={(next) => onOpenChange?.(next)}
			modal={modal}
		>
			{children}
		</DialogPrimitive.Root>
	)
}
interface DialogSlotProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	render?: ReactElement
	asChild?: boolean
}
function slotRender(render: ReactElement | undefined, asChild: boolean | undefined, children: ReactNode) {
	if (render) return render
	return asChild && isValidElement(children) ? (children as ReactElement) : undefined
}
const DialogTrigger = forwardRef<HTMLButtonElement, DialogSlotProps>(({ render, asChild, children, ...props }, ref) => {
	const el = slotRender(render, asChild, children)
	return el ? (
		<DialogPrimitive.Trigger ref={ref} render={el} {...props} />
	) : (
		<DialogPrimitive.Trigger ref={ref} {...props}>
			{children}
		</DialogPrimitive.Trigger>
	)
})
DialogTrigger.displayName = 'DialogTrigger'
const DialogClose = forwardRef<HTMLButtonElement, DialogSlotProps>(({ render, asChild, children, ...props }, ref) => {
	const el = slotRender(render, asChild, children)
	return el ? (
		<DialogPrimitive.Close ref={ref} render={el} {...props} />
	) : (
		<DialogPrimitive.Close ref={ref} {...props}>
			{children}
		</DialogPrimitive.Close>
	)
})
DialogClose.displayName = 'DialogClose'
interface DialogContentProps extends HTMLAttributes<HTMLDivElement> {
	size?: 'sm' | 'lg' | 'xl'
	container?: HTMLElement | null
	showCloseButton?: boolean
	position?: 'center' | 'top'
}
const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
	({ className, children, size = 'sm', container, showCloseButton = true, position = 'center', ...props }, ref) => {
		const icons = useIcons()
		const XIcon = icons.x
		const shape = useShape()
		const substrate = useSurface()
		const dialogLevel = Math.min(substrate + DIALOG_OFFSET, 8)
		const compact = useSize().variant === 'compact'
		return (
			<DialogPrimitive.Portal container={container ?? undefined}>
				<DialogPrimitive.Backdrop
					render={(backdropProps, state) => {
						const exiting = state.transitionStatus === 'ending'
						const {
							style: _style,
							onDrag: _onDrag,
							onDragStart: _onDragStart,
							onDragEnd: _onDragEnd,
							onAnimationStart: _onAnimationStart,
							onAnimationEnd: _onAnimationEnd,
							onAnimationIteration: _onAnimationIteration,
							...rest
						} = backdropProps as React.HTMLAttributes<HTMLDivElement>
						return (
							<motion.div
								{...rest}
								className={cn(container ? 'absolute' : 'fixed', 'inset-0 z-50 bg-black/40 dark:bg-black/80')}
								initial={{ opacity: 0 }}
								animate={{ opacity: exiting ? 0 : 1 }}
								transition={exiting ? spring.slow.exit : spring.slow}
							/>
						)
					}}
				/>
				<DialogPrimitive.Popup
					ref={ref}
					render={(popupProps, state) => {
						const exiting = state.transitionStatus === 'ending'
						const {
							style: baseStyle,
							onDrag: _onDrag,
							onDragStart: _onDragStart,
							onDragEnd: _onDragEnd,
							onAnimationStart: _onAnimationStart,
							onAnimationEnd: _onAnimationEnd,
							onAnimationIteration: _onAnimationIteration,
							...rest
						} = popupProps as React.HTMLAttributes<HTMLDivElement>
						return (
							<motion.div
								{...rest}
								{...(props as Omit<
									React.HTMLAttributes<HTMLDivElement>,
									| 'onDrag'
									| 'onDragStart'
									| 'onDragEnd'
									| 'onAnimationStart'
									| 'onAnimationEnd'
									| 'onAnimationIteration'
								>)}
								className={cn(
									container ? 'absolute' : 'fixed',
									'left-1/2 z-50 w-[calc(100%-2rem)]',
									position === 'top' ? 'top-[12dvh]' : 'top-1/2',
									surfaceClasses(dialogLevel),
									'p-6 focus:outline-none',
									size === 'sm' && (compact ? 'max-w-[360px]' : 'max-w-[400px]'),
									size === 'lg' && (compact ? 'max-w-[480px]' : 'max-w-[540px]'),
									size === 'xl' && (compact ? 'max-w-[800px]' : 'max-w-[880px]'),
									shape.container,
									className
								)}
								style={{
									...(baseStyle as React.CSSProperties | undefined),
									...(props.style as React.CSSProperties | undefined),
								}}
								initial={{ opacity: 0, scale: 0.97, x: '-50%', y: position === 'top' ? 0 : '-50%' }}
								animate={{
									opacity: exiting ? 0 : 1,
									scale: exiting ? 0.97 : 1,
									x: '-50%',
									y: position === 'top' ? 0 : '-50%',
								}}
								transition={exiting ? spring.slow.exit : spring.slow}
							>
								<SurfaceProvider value={dialogLevel}>
									{children}
									{showCloseButton && (
										<DialogPrimitive.Close
											render={
												<Button variant="ghost" size="icon-sm" className="absolute top-3 right-3">
													<XIcon />
													<span className="sr-only">Close</span>
												</Button>
											}
										/>
									)}
								</SurfaceProvider>
							</motion.div>
						)
					}}
				/>
			</DialogPrimitive.Portal>
		)
	}
)
DialogContent.displayName = 'DialogContent'
function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('mb-4 flex flex-col gap-1.5', className)} {...props} />
}
function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('mt-6 flex justify-end gap-2', className)} {...props} />
}
const DialogTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
	({ className, ...props }, ref) => {
		const compact = useSizeVariant() === 'compact'
		return (
			<DialogPrimitive.Title
				ref={ref}
				className={cn(typeClass('title', compact ? 'compact' : 'default'), 'text-foreground', className)}
				style={{ fontVariationSettings: fontWeights.semibold }}
				{...props}
			/>
		)
	}
)
DialogTitle.displayName = 'DialogTitle'
const DialogDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
	({ className, ...props }, ref) => {
		const compact = useSizeVariant() === 'compact'
		return (
			<DialogPrimitive.Description
				ref={ref}
				className={cn(typeClass('body', compact ? 'compact' : 'default'), 'text-muted-foreground', className)}
				{...props}
			/>
		)
	}
)
DialogDescription.displayName = 'DialogDescription'
export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose }
export type { DialogSlotProps as DialogTriggerProps, DialogSlotProps as DialogCloseProps }
