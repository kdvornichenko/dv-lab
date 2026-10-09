'use client'
import {
	createContext,
	forwardRef,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type HTMLAttributes,
	type InputHTMLAttributes,
	type KeyboardEvent as ReactKeyboardEvent,
} from 'react'

import { useIcons } from '@/lib/icon-context'
import { useSize } from '@/lib/size-context'
import { SURFACE_BG } from '@/lib/surface-classes'
import { useSurface } from '@/lib/surface-context'
import { cn } from '@/lib/utils'

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect
interface SearchHandle {
	input: HTMLInputElement | null
	autoFocus: boolean
	append: (text: string) => void
	deleteBackward: () => void
}
interface DropdownSearchHostValue {
	register: (handle: SearchHandle) => () => void
	open: boolean
}
export const DropdownSearchHostContext = createContext<DropdownSearchHostValue | null>(null)
const ROW_SELECTOR = [
	'[role="menuitem"]:not([aria-disabled="true"])',
	'[role="menuitemradio"]:not([aria-disabled="true"])',
	'[role="menuitemcheckbox"]:not([aria-disabled="true"])',
].join(', ')
const ANY_ROW = '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]'
function precedes(a: Node, b: Node) {
	return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}
function menuRows(from: HTMLElement | null): HTMLElement[] {
	const menu = from?.closest<HTMLElement>('[role="menu"]')
	return menu ? Array.from(menu.querySelectorAll<HTMLElement>(ROW_SELECTOR)) : []
}
function scrollToTop(row: HTMLElement) {
	const menu = row.closest<HTMLElement>('[role="menu"]')
	for (let el = row.parentElement; el && menu?.contains(el); el = el.parentElement) {
		const { overflowY } = getComputedStyle(el)
		if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
			el.scrollTop = 0
			return
		}
	}
}
export function useDropdownSearchHost(open: boolean) {
	const handleRef = useRef<SearchHandle | null>(null)
	const [searchMounted, setSearchMounted] = useState(false)
	const register = useCallback((handle: SearchHandle) => {
		handleRef.current = handle
		setSearchMounted(true)
		return () => {
			if (handleRef.current === handle) {
				handleRef.current = null
				setSearchMounted(false)
			}
		}
	}, [])
	const host = useMemo(() => ({ register, open }), [register, open])
	const onKeyDownCapture = useCallback((e: ReactKeyboardEvent<HTMLElement>) => {
		const handle = handleRef.current
		if (!handle?.input) return
		if (e.target === handle.input) return
		if (e.metaKey || e.ctrlKey || e.altKey) return
		if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			const target = e.target instanceof HTMLElement ? e.target : null
			if (!target?.matches(ANY_ROW)) return
			const up = e.key === 'ArrowUp'
			const rows = menuRows(target)
			const edge = up ? rows[0] : rows[rows.length - 1]
			const pastEdge = !edge || edge === target || (up ? precedes(target, edge) : precedes(edge, target))
			if (pastEdge) {
				e.preventDefault()
				e.stopPropagation()
				handle.input.focus()
				scrollToTop(target)
			}
		} else if (e.key.length === 1 && e.key !== ' ') {
			e.preventDefault()
			e.stopPropagation()
			handle.input.focus()
			handle.append(e.key)
		} else if (e.key === 'Backspace') {
			e.preventDefault()
			e.stopPropagation()
			handle.input.focus()
			handle.deleteBackward()
		}
	}, [])
	const hasSearch = useCallback(() => handleRef.current !== null, [])
	const searchTakesFocus = useCallback(() => handleRef.current?.autoFocus ?? false, [])
	return {
		host,
		hasSearch,
		searchTakesFocus,
		searchMounted,
		onKeyDownCapture,
	}
}
export interface DropdownSearchProps extends Omit<
	InputHTMLAttributes<HTMLInputElement>,
	'value' | 'onChange' | 'size' | 'defaultValue'
> {
	value: string
	onValueChange: (value: string) => void
	placeholder?: string
	clearOnClose?: boolean
	autoFocus?: boolean
}
const DropdownSearch = forwardRef<HTMLInputElement, DropdownSearchProps>(
	(
		{
			value,
			onValueChange,
			placeholder = 'Search…',
			clearOnClose = true,
			autoFocus = true,
			className,
			onKeyDown,
			...props
		},
		ref
	) => {
		const icons = useIcons()
		const SearchIcon = icons.search
		const sizeClasses = useSize()
		const compact = sizeClasses.variant === 'compact'
		const host = useContext(DropdownSearchHostContext)
		const open = host?.open ?? true
		const surface = useSurface()
		const inputRef = useRef<HTMLInputElement | null>(null)
		const valueRef = useRef(value)
		const onValueChangeRef = useRef(onValueChange)
		const clearOnCloseRef = useRef(clearOnClose)
		const autoFocusRef = useRef(autoFocus)
		useIsoLayoutEffect(() => {
			valueRef.current = value
			onValueChangeRef.current = onValueChange
			clearOnCloseRef.current = clearOnClose
			autoFocusRef.current = autoFocus
		})
		useEffect(() => {
			if (!host) return
			return host.register({
				get input() {
					return inputRef.current
				},
				get autoFocus() {
					return autoFocusRef.current
				},
				append: (text) => onValueChangeRef.current(valueRef.current + text),
				deleteBackward: () => onValueChangeRef.current(valueRef.current.slice(0, -1)),
			})
		}, [host])
		useEffect(() => {
			if (!open) return
			if (clearOnCloseRef.current && valueRef.current !== '') {
				onValueChangeRef.current('')
			}
			if (!autoFocus) return
			let inner: number | undefined
			const outer = requestAnimationFrame(() => {
				inner = requestAnimationFrame(() => inputRef.current?.focus())
			})
			return () => {
				cancelAnimationFrame(outer)
				if (inner !== undefined) cancelAnimationFrame(inner)
			}
		}, [open, autoFocus])
		useEffect(
			() => () => {
				if (clearOnCloseRef.current && valueRef.current !== '') {
					onValueChangeRef.current('')
				}
			},
			[]
		)
		const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
			onKeyDown?.(e)
			if (e.defaultPrevented) return
			if (e.key === 'Escape' || e.key === 'Tab') return
			e.stopPropagation()
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				const rows = menuRows(e.currentTarget)
				if (rows.length === 0) return
				e.preventDefault()
				;(e.key === 'ArrowDown' ? rows[0] : rows[rows.length - 1]).focus()
			} else if (e.key === 'Enter') {
				e.preventDefault()
			}
		}
		return (
			<div
				className={cn(
					'group/search border-border/60 sticky top-0 z-20 -mx-1 -mt-1 mb-0.5 flex shrink-0 items-center border-b',
					SURFACE_BG[surface],
					sizeClasses.control,
					sizeClasses.gap,
					compact ? 'px-2.5' : 'px-3',
					className
				)}
			>
				<SearchIcon
					size={sizeClasses.icon}
					strokeWidth={1.5}
					className="text-muted-foreground group-focus-within/search:text-foreground shrink-0 transition-[color,stroke-width] duration-80 group-focus-within/search:stroke-[2]"
				/>
				<input
					ref={(node) => {
						inputRef.current = node
						if (typeof ref === 'function') ref(node)
						else if (ref) ref.current = node
					}}
					type="text"
					role="searchbox"
					autoComplete="off"
					autoCorrect="off"
					spellCheck={false}
					value={value}
					onChange={(e) => onValueChange(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					className={cn(
						'text-foreground placeholder:text-muted-foreground min-w-0 flex-1 rounded-none bg-transparent font-[inherit] outline-none',
						sizeClasses.field,
						compact ? 'leading-5' : 'leading-6'
					)}
					{...props}
				/>
			</div>
		)
	}
)
DropdownSearch.displayName = 'DropdownSearch'
const DropdownEmpty = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
	const sizeClasses = useSize()
	return (
		<div
			ref={ref}
			role="status"
			aria-live="polite"
			className={cn('text-muted-foreground px-2 py-6 text-center', sizeClasses.text, className)}
			{...props}
		/>
	)
})
DropdownEmpty.displayName = 'DropdownEmpty'
export { DropdownSearch, DropdownEmpty }
