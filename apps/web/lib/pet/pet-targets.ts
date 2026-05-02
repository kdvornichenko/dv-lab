import type { PetTarget } from './pet-engine'

export const PET_TARGET_SELECTOR = '[data-pet-target]'

export function listPetTargets(): PetTarget[] {
	if (typeof document === 'undefined' || typeof window === 'undefined') {
		return []
	}

	return Array.from(document.querySelectorAll<HTMLElement>(PET_TARGET_SELECTOR))
		.map((element, index) => {
			const rect = element.getBoundingClientRect()

			return {
				id: element.dataset.petTarget || `pet-target-${index}`,
				x: rect.left,
				y: rect.top + 5,
				width: rect.width,
				height: rect.height,
			}
		})
		.filter((target) => {
			if (target.width < 96 || target.height < 40) {
				return false
			}

			return (
				target.x + target.width > 0 &&
				target.y + target.height > 0 &&
				target.x < window.innerWidth &&
				target.y < window.innerHeight
			)
		})
}
