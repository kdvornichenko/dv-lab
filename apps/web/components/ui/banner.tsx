'use client'
import {
	forwardRef,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type HTMLAttributes,
	type ReactNode,
} from 'react'

import {
	AnimatePresence,
	PresenceContext,
	animate,
	motion,
	useMotionValue,
	usePresence,
	useReducedMotion,
	useTransform,
	type ValueAnimationTransition,
} from 'framer-motion'

import { Button, type ButtonProps } from '@/components/ui/button'
import { fontWeights } from '@/lib/font-weight'
import { useIcons, type IconComponent } from '@/lib/icon-context'
import { useShape } from '@/lib/shape-context'
import { SizeProvider, typeClass, useSize, type SizeVariant } from '@/lib/size-context'
import { spring } from '@/lib/springs'
import { cn } from '@/lib/utils'

type BannerStatus = 'default' | 'info' | 'success' | 'warning' | 'error'
type BannerContrast = 'low' | 'high'
type BannerVariant = 'inline' | 'fixed'
const TONE: Record<BannerStatus, string> = {
	default: 'var(--foreground)',
	info: 'var(--info)',
	success: 'var(--success)',
	warning: 'var(--warning)',
	error: 'var(--destructive)',
}
function fillFor(status: BannerStatus, contrast: BannerContrast) {
	if (contrast === 'low') return 'var(--hover)'
	const amount = status === 'default' ? 8 : 12
	return `color-mix(in oklab, var(--banner-tone) ${amount}%, transparent)`
}
type ColoredStatus = Exclude<BannerStatus, 'default'>
function StatusGlyph({ status, size }: { status: ColoredStatus; size: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
			{status === 'warning' ? (
				<path
					d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
					fill="currentColor"
					stroke="currentColor"
					strokeWidth={1.5}
					strokeLinejoin="round"
				/>
			) : (
				<circle cx="12" cy="12" r="10.5" fill="currentColor" />
			)}
			<g className="stroke-background" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
				{status === 'success' ? (
					<path d="m8.5 12.25 2.5 2.5 4.5-5" />
				) : status === 'warning' ? (
					<path d="M12 9.5v3.5M12 17h.01" />
				) : status === 'error' ? (
					<path d="M12 7.5v5M12 16.5h.01" />
				) : (
					<path d="M12 16.5v-5M12 7.5h.01" />
				)}
			</g>
		</svg>
	)
}
interface BannerMotionConfig {
	readonly appear: {
		readonly row: ValueAnimationTransition<number>
		readonly banner: ValueAnimationTransition<number>
		readonly fromScale: number
	}
	readonly dismiss: {
		readonly row: ValueAnimationTransition<number>
		readonly shrinkTo: number
	}
}
const bannerMotion: BannerMotionConfig = {
	appear: {
		row: { type: 'spring', duration: spring.moderate.duration * 2, bounce: 0 },
		banner: {
			type: 'spring',
			duration: spring.slow.duration,
			bounce: spring.slow.bounce,
			delay: spring.fast.duration,
		},
		fromScale: 0.4,
	},
	dismiss: {
		row: { duration: spring.moderate.exit.duration * 2, ease: 'easeInOut' },
		shrinkTo: 0.6,
	},
}
const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
function focusNeighbour(banner: HTMLElement) {
	const candidates = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
		(el) => !banner.contains(el) && (el.checkVisibility?.() ?? true)
	)
	const after = candidates.find((el) => banner.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
	const before = candidates.filter((el) => banner.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING).pop()
	;(after ?? before)?.focus({ preventScroll: true })
}
interface BannerMotionProps {
	fixed: boolean
	reduceMotion: boolean
	config: BannerMotionConfig
	children: ReactNode
}
function BannerMotion({ fixed, reduceMotion, config, children }: BannerMotionProps) {
	const appear = useContext(PresenceContext)?.initial !== false
	const [isPresent, safeToRemove] = usePresence()
	const safeToRemoveRef = useRef(safeToRemove)
	const configRef = useRef(config)
	useEffect(() => {
		safeToRemoveRef.current = safeToRemove
		configRef.current = config
	})
	const scaled = !fixed && !reduceMotion
	const slides = fixed && !reduceMotion
	const row = useMotionValue(appear ? 0 : 1)
	const shown = useMotionValue(appear ? 0 : 1)
	const scale = useMotionValue(appear && scaled ? config.appear.fromScale : 1)
	const gap = useMotionValue(0)
	const overflow = useMotionValue(fixed ? 'hidden' : 'visible')
	const gridTemplateRows = useTransform(row, (v) => `${v}fr`)
	const marginBottom = useTransform([row, gap], ([r, g]: number[]) => (r - 1) * g)
	const y = useTransform(row, (v) => (slides ? `${(v - 1) * 100}%` : '0%'))
	const pointerEvents = useTransform(shown, (v) => (v > 0.5 ? 'auto' : 'none'))
	const rootRef = useRef<HTMLDivElement | null>(null)
	const measure = useCallback(
		(el: HTMLDivElement | null) => {
			rootRef.current = el
			const parent = el?.parentElement
			if (!parent) return
			const style = getComputedStyle(parent)
			const column =
				parent.children.length > 1 && style.display.endsWith('flex') && style.flexDirection.startsWith('column')
			gap.set(column ? parseFloat(style.rowGap) || 0 : 0)
		},
		[gap]
	)
	useEffect(() => {
		const { appear: enter, dismiss: leave } = configRef.current
		if (isPresent) {
			overflow.set(fixed ? 'hidden' : 'visible')
			const open = animate(row, 1, reduceMotion ? { duration: 0 } : enter.row)
			if (slides) {
				const follow = row.on('change', (v) => shown.set(v))
				return () => {
					follow()
					open.stop()
				}
			}
			const show = animate(shown, 1, reduceMotion ? spring.fast : enter.banner)
			const grow = scaled ? animate(scale, 1, enter.banner) : undefined
			return () => {
				open.stop()
				show.stop()
				grow?.stop()
			}
		}
		const root = rootRef.current
		if (root?.contains(document.activeElement)) focusNeighbour(root)
		if (reduceMotion) {
			const hide = animate(shown, 0, spring.fast.exit)
			hide.then(() => safeToRemoveRef.current?.())
			return () => hide.stop()
		}
		overflow.set('hidden')
		const end = fixed ? 0 : Math.min(leave.shrinkTo, 0.99)
		const rowFrom = row.get()
		const shownFrom = shown.get()
		const scaleFrom = scale.get()
		const unfollow = row.on('change', (v) => {
			const left = rowFrom > end ? (v - end) / (rowFrom - end) : rowFrom > 0 ? v / rowFrom : 0
			shown.set(shownFrom * Math.min(1, Math.max(0, left)))
			if (scaled) scale.set(Math.min(scaleFrom, Math.max(v, end)))
		})
		const close = animate(row, 0, leave.row)
		close.then(() => safeToRemoveRef.current?.())
		return () => {
			unfollow()
			close.stop()
		}
	}, [isPresent, reduceMotion, fixed, scaled, slides, row, shown, scale, overflow])
	return (
		<motion.div
			ref={measure}
			style={{ gridTemplateRows, marginBottom, overflow }}
			className={cn('grid w-full', fixed && 'sticky top-0 z-40')}
		>
			<div className="min-h-0">
				<motion.div style={{ opacity: shown, scale, y, pointerEvents, transformOrigin: 'top' }}>{children}</motion.div>
			</div>
		</motion.div>
	)
}
interface BannerProps extends HTMLAttributes<HTMLDivElement> {
	status?: BannerStatus
	contrast?: BannerContrast
	variant?: BannerVariant
	icon?: IconComponent
	dismissible?: boolean
	onDismiss?: () => void
	dismissLabel?: string
	open?: boolean
	size?: SizeVariant
	motion?: BannerMotionConfig
}
const Banner = forwardRef<HTMLDivElement, BannerProps>(
	(
		{
			status = 'default',
			contrast = 'low',
			variant = 'inline',
			icon: Icon,
			dismissible = false,
			onDismiss,
			dismissLabel = 'Dismiss',
			open: openProp,
			size,
			motion: motionConfig = bannerMotion,
			role,
			className,
			style,
			children,
			...props
		},
		ref
	) => {
		const shape = useShape()
		const sizeClasses = useSize(size)
		const compact = sizeClasses.variant === 'compact'
		const icons = useIcons()
		const XIcon = icons.x
		const InfoIcon = icons.info
		const reduceMotion = useReducedMotion() ?? false
		const fixed = variant === 'fixed'
		const [openState, setOpenState] = useState(true)
		const open = openProp ?? openState
		const handleDismiss = () => {
			onDismiss?.()
			if (openProp === undefined) setOpenState(false)
		}
		const iconSize = compact ? 16 : 20
		const OutlineIcon = Icon ?? (status === 'default' ? InfoIcon : undefined)
		const body = (
			<div
				ref={ref}
				role={role ?? (status === 'error' || status === 'warning' ? 'alert' : 'status')}
				data-slot="banner"
				data-status={status}
				data-contrast={contrast}
				data-variant={variant}
				className={cn(
					'group/banner @container/banner relative grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center text-foreground',
					'has-data-[slot=banner-description]:items-start',
					compact ? 'p-3' : 'p-4',
					!fixed && shape.container,
					className
				)}
				style={
					{
						'--banner-tone': TONE[status],
						'--banner-fill': fillFor(status, contrast),
						backgroundColor: fixed ? 'var(--background)' : undefined,
						backgroundImage: 'linear-gradient(var(--banner-fill), var(--banner-fill))',
						...style,
					} as CSSProperties
				}
				{...props}
			>
				<span
					aria-hidden="true"
					className={cn(
						'col-start-1 row-start-1 flex items-center justify-center text-[color:var(--banner-tone)]',
						compact ? 'mr-2.5 h-[18px]' : 'mr-3 h-5'
					)}
				>
					{OutlineIcon ? (
						<OutlineIcon size={iconSize} strokeWidth={1.5} />
					) : (
						status !== 'default' && <StatusGlyph status={status} size={iconSize} />
					)}
				</span>

				{children}

				{dismissible && (
					<button
						type="button"
						onClick={handleDismiss}
						aria-label={dismissLabel}
						className={cn(
							'col-start-4 row-start-1 flex size-7 cursor-pointer items-center justify-center text-muted-foreground transition-colors duration-80 outline-none hover:bg-hover hover:text-foreground focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]',
							compact ? '-my-[5px] -mr-1.5 ml-1.5' : '-my-1 -mr-1.5 ml-2',
							shape.button
						)}
					>
						<XIcon size={compact ? 13 : 15} strokeWidth={1.5} />
					</button>
				)}
			</div>
		)
		const banner = (
			<AnimatePresence initial={false}>
				{open && (
					<BannerMotion key="banner" fixed={fixed} reduceMotion={reduceMotion} config={motionConfig}>
						{body}
					</BannerMotion>
				)}
			</AnimatePresence>
		)
		return size ? <SizeProvider size={size}>{banner}</SizeProvider> : banner
	}
)
Banner.displayName = 'Banner'
const BannerTitle = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
	({ className, style, ...props }, ref) => {
		const compact = useSize().variant === 'compact'
		return (
			<p
				ref={ref}
				data-slot="banner-title"
				className={cn(
					'col-start-2 row-start-1 min-w-0 text-foreground',
					typeClass('subtitle', compact ? 'compact' : 'default'),
					className
				)}
				style={{ fontVariationSettings: fontWeights.semibold, ...style }}
				{...props}
			/>
		)
	}
)
BannerTitle.displayName = 'BannerTitle'
const BannerDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
	({ className, ...props }, ref) => {
		const compact = useSize().variant === 'compact'
		return (
			<p
				ref={ref}
				data-slot="banner-description"
				className={cn(
					'col-start-2 row-start-2 mt-0.5 min-w-0 text-foreground',
					typeClass('subtitle', compact ? 'compact' : 'default'),
					className
				)}
				{...props}
			/>
		)
	}
)
BannerDescription.displayName = 'BannerDescription'
const BannerActions = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
	const compact = useSize().variant === 'compact'
	return (
		<div
			ref={ref}
			data-slot="banner-actions"
			className={cn(
				'col-start-3 row-start-1 flex flex-wrap items-center gap-2',
				compact ? '-my-[5px] ml-2.5' : '-my-1 ml-3',
				'group-has-data-[slot=banner-description]/banner:col-start-2 group-has-data-[slot=banner-description]/banner:row-start-3 group-has-data-[slot=banner-description]/banner:my-0 group-has-data-[slot=banner-description]/banner:ml-0',
				compact
					? 'group-has-data-[slot=banner-description]/banner:mt-1.5'
					: 'group-has-data-[slot=banner-description]/banner:mt-2',
				'@max-sm/banner:col-start-2 @max-sm/banner:row-start-3 @max-sm/banner:my-0 @max-sm/banner:ml-0',
				compact ? '@max-sm/banner:mt-1.5' : '@max-sm/banner:mt-2',
				className
			)}
			{...props}
		/>
	)
})
BannerActions.displayName = 'BannerActions'
type BannerActionVariant = 'primary' | 'secondary' | 'ghost'
const BANNER_ACTION_ORDER: Record<BannerActionVariant, string> = {
	primary: 'order-3 group-has-data-[slot=banner-description]/banner:order-1 @max-sm/banner:order-1',
	secondary: 'order-2',
	ghost: 'order-1 group-has-data-[slot=banner-description]/banner:order-3 @max-sm/banner:order-3',
}
interface BannerActionProps extends Omit<ButtonProps, 'variant' | 'size' | 'asChild' | 'render' | 'nativeButton'> {
	variant?: BannerActionVariant
	href?: string
	external?: boolean
}
const BannerAction = forwardRef<HTMLButtonElement, BannerActionProps>(
	({ variant = 'secondary', href, external = false, className, children, ...props }, ref) => {
		const classes = cn(BANNER_ACTION_ORDER[variant], variant === 'ghost' && 'text-foreground', className)
		if (href) {
			return (
				<Button
					ref={ref}
					variant={variant}
					size="compact"
					data-slot="banner-action"
					className={classes}
					{...props}
					render={
						<a
							href={href}
							target={external ? '_blank' : undefined}
							rel={external ? 'noopener noreferrer' : undefined}
						/>
					}
					nativeButton={false}
				>
					{children}
				</Button>
			)
		}
		return (
			<Button
				ref={ref}
				type="button"
				variant={variant}
				size="compact"
				data-slot="banner-action"
				className={classes}
				{...props}
			>
				{children}
			</Button>
		)
	}
)
BannerAction.displayName = 'BannerAction'
export { Banner, BannerTitle, BannerDescription, BannerActions, BannerAction, bannerMotion }
export type {
	BannerProps,
	BannerMotionConfig,
	BannerStatus,
	BannerContrast,
	BannerVariant,
	BannerActionProps,
	BannerActionVariant,
}
