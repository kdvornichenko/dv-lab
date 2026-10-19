'use client'

import { forwardRef } from 'react'

import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox'

import { nameMatches } from '@dv-lab/core'

export interface SearchOption {
	value: string
	label: string
	detail?: string
}

interface SearchSelectProps {
	id: string
	options: readonly SearchOption[]
	value: string
	onChange: (value: string) => void
	placeholder: string
	emptyTitle?: string
	emptyHint?: string
	disabled?: boolean
	error?: string
	autoFocus?: boolean
	onBlur?: () => void
	'aria-describedby'?: string
	className?: string
}

function matches(option: SearchOption, query: string): boolean {
	const text = query.trim()
	return text === '' || nameMatches(option.label, text) || nameMatches(option.detail ?? '', text)
}

export const SearchSelect = forwardRef<HTMLInputElement, SearchSelectProps>(function SearchSelect(
	{
		id,
		options,
		value,
		onChange,
		placeholder,
		emptyTitle = 'Nothing found',
		emptyHint,
		disabled = false,
		error,
		autoFocus,
		onBlur,
		'aria-describedby': describedBy,
		className,
	},
	ref
) {
	return (
		<Combobox items={options} value={value} onValueChange={onChange} filter={matches} disabled={disabled}>
			<ComboboxInput
				ref={ref}
				id={id}
				placeholder={placeholder}
				error={error}
				autoFocus={autoFocus}
				aria-describedby={describedBy}
				autoComplete="off"
				onBlur={onBlur}
				className={className ?? 'w-full min-w-0 pointer-coarse:text-[16px]'}
			/>
			<ComboboxContent>
				<ComboboxList emptyTitle={emptyTitle} emptyHint={emptyHint}>
					{(item) => {
						const option = typeof item === 'string' ? { value: item, label: item } : item
						return (
							<ComboboxItem key={option.value} value={option.value} detail={option.detail}>
								{option.label}
							</ComboboxItem>
						)
					}}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	)
})
