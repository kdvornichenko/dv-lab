'use client'

import { type ComponentProps, forwardRef, useMemo, useState } from 'react'
import { HexColorPicker } from 'react-colorful'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useForwardedRef } from '@/lib/use-forwarded-ref'
import { cn } from '@/lib/utils'

interface ColorPickerProps {
	value: string
	onChange: (value: string) => void
	onBlur?: () => void
	isPopover?: boolean
}

const DEFAULT_HEX_COLOR = '#FFFFFF'
const HEX_COLOR_PATTERN = /^#(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/

const resolvePreviewHexColor = (value: string): string => {
	if (!value || !HEX_COLOR_PATTERN.test(value)) {
		return DEFAULT_HEX_COLOR
	}

	return value
}

const ColorPicker = forwardRef<
	HTMLInputElement,
	Omit<ComponentProps<typeof Button>, 'value' | 'onChange' | 'onBlur'> & ColorPickerProps
>(({ disabled, value, onChange, onBlur, name, className, size, isPopover = true, ...props }, forwardedRef) => {
	const ref = useForwardedRef(forwardedRef)
	const [open, setOpen] = useState(false)

	const inputValue = useMemo(() => value || DEFAULT_HEX_COLOR, [value])
	const previewValue = useMemo(() => resolvePreviewHexColor(value), [value])

	const content = (
		<div className={cn('space-y-2', disabled && 'pointer-events-none opacity-50')}>
			<HexColorPicker color={previewValue} onChange={onChange} />
			<Input
				disabled={disabled}
				maxLength={7}
				name={name}
				onBlur={onBlur}
				onChange={(e) => onChange(e.currentTarget.value)}
				ref={ref}
				value={inputValue}
			/>
		</div>
	)

	if (!isPopover) {
		return <div className={cn('w-fit space-y-2', className)}>{content}</div>
	}

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild disabled={disabled}>
				<Button
					{...props}
					className={cn('block', className)}
					onBlur={onBlur}
					onClick={() => setOpen(true)}
					size={size}
					style={{ backgroundColor: previewValue }}
					variant="outline"
				>
					<div />
				</Button>
			</PopoverTrigger>

			<PopoverContent className="w-full">{content}</PopoverContent>
		</Popover>
	)
})

ColorPicker.displayName = 'ColorPicker'

export { ColorPicker }
