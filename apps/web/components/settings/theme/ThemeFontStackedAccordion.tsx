'use client'

import { type FC, useState } from 'react'

import { Check } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { StackedAccordion, StackedAccordionItem, StackedAccordionTrigger } from '@/components/ui/stacked-accordion'
import { fontOptions, fontStackFor } from '@/lib/theme/theme-settings'

import type { CrmThemeSettings } from '@teacher-crm/api-types'

import type {
	FontOptionButtonProps,
	FontSection,
	FontSectionKey,
	FontSettingKey,
	ThemeFontStackedAccordionProps,
} from './ThemeFontStackedAccordion.types'

export const ThemeFontStackedAccordion: FC<ThemeFontStackedAccordionProps> = ({ draft, onDraftChange }) => {
	const [openSection, setOpenSection] = useState<FontSectionKey[]>(['heading'])
	const reduceMotion = useReducedMotion()
	const sections: FontSection[] = [
		{
			description: 'Used for page titles, card headings, and panel labels.',
			key: 'headingFont',
			label: 'Heading',
			sample: 'Schedule workspace',
			value: draft.headingFont,
			section: 'heading',
		},
		{
			description: 'Used for tables, forms, filters, and regular interface copy.',
			key: 'bodyFont',
			label: 'Body',
			sample: 'Student note preview',
			value: draft.bodyFont,
			section: 'body',
		},
		{
			description: 'Used for balances, prices, dates, and compact operational values.',
			key: 'numberFont',
			label: 'Numbers',
			sample: '1234567890',
			value: draft.numberFont,
			section: 'numbers',
		},
	]

	function updateFont(key: FontSettingKey, value: CrmThemeSettings['headingFont']) {
		onDraftChange((current) => ({ ...current, [key]: value }))
	}

	return (
		<StackedAccordion
			type="multiple"
			value={openSection}
			onValueChange={(value) => {
				if (value) setOpenSection(value as FontSectionKey[])
			}}
			className="space-y-0"
		>
			{sections.map((section) => {
				const selected = fontOptions.find((option) => option.value === section.value)
				const isOpen = openSection.includes(section.section)

				return (
					<StackedAccordionItem
						key={section.section}
						value={section.section}
						className="border-line-soft bg-surface-muted"
					>
						<StackedAccordionTrigger className="hover:bg-sage-soft/45 px-3 py-3 text-left hover:no-underline">
							<span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,8.75rem)] items-center gap-3">
								<span className="min-w-0">
									<span className="text-ink block text-sm font-semibold">{section.label}</span>
									<span className="text-ink-muted mt-1 block truncate text-xs">{section.description}</span>
								</span>
								<span
									className="border-line-soft bg-surface text-ink min-w-0 truncate rounded-md border px-2 py-1 text-xs font-semibold"
									style={{ fontFamily: fontStackFor(section.value) }}
								>
									{selected?.label}
								</span>
							</span>
						</StackedAccordionTrigger>
						<AnimatePresence initial={false}>
							{isOpen ? (
								<motion.div
									key="content"
									initial={{ height: 0, opacity: 0, filter: reduceMotion ? 'blur(0px)' : 'blur(4px)' }}
									animate={{ height: 'auto', opacity: 1, filter: 'blur(0px)' }}
									exit={{ height: 0, opacity: 0, filter: reduceMotion ? 'blur(0px)' : 'blur(4px)' }}
									transition={
										reduceMotion
											? { duration: 0 }
											: {
													height: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
													opacity: { duration: 0.18, ease: 'easeOut' },
													filter: { duration: 0.18, ease: 'easeOut' },
												}
									}
									className="overflow-hidden"
								>
									<div className="px-3 pb-3">
										<div className="grid grid-cols-2 gap-2">
											{fontOptions.map((option) => (
												<FontOptionButton
													key={option.value}
													option={option}
													sample={section.sample}
													selected={section.value === option.value}
													onSelect={() => updateFont(section.key, option.value)}
												/>
											))}
										</div>
									</div>
								</motion.div>
							) : null}
						</AnimatePresence>
					</StackedAccordionItem>
				)
			})}
		</StackedAccordion>
	)
}

const FontOptionButton: FC<FontOptionButtonProps> = ({ onSelect, option, sample, selected }) => {
	return (
		<button
			type="button"
			aria-pressed={selected}
			className="border-line-soft bg-surface hover:border-sage-line hover:bg-sage-soft/45 aria-pressed:border-sage-line aria-pressed:bg-sage-soft relative min-w-0 rounded-xl border p-3 pr-8 text-left transition-colors"
			onClick={onSelect}
		>
			<p className="text-ink truncate text-sm font-semibold">{option.label}</p>
			<p className="text-ink mt-2 truncate text-lg" style={{ fontFamily: fontStackFor(option.value) }}>
				{sample}
			</p>
			{selected ? <Check className="text-sage absolute right-3 top-3 size-4" /> : null}
		</button>
	)
}
