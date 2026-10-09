import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const twMerge = extendTailwindMerge({
	extend: {
		classGroups: {
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
