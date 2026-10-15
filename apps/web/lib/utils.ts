import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const unitValue = (value: string) => /^\d+(\.\d+)?$/.test(value)
const unit = (name: string) => [name, { [name]: [unitValue] }]

const twMerge = extendTailwindMerge({
	extend: {
		classGroups: {
			p: unit('p-unit'),
			px: unit('px-unit'),
			py: unit('py-unit'),
			pt: unit('pt-unit'),
			gap: unit('gap-unit'),
			top: unit('top-unit'),
			'font-size': [
				'text-display',
				'text-title',
				'text-subtitle',
				'text-body',
				'text-caption',
				'text-micro',
				'text-site-display',
				'text-site-title',
				'text-site-subtitle',
				'text-site-body',
				'text-site-caption',
				'text-site-micro',
			],
		},
	},
})
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}
