'use client'

import type { PetEngineSnapshot, PetImageBounds } from '@/lib/pet/pet-engine'

import { PetImage } from './PetImage'

type WebsitePetOverlayProps = {
	snapshot: PetEngineSnapshot
	image: PetImageBounds
	onPetClick: () => void
}

export function WebsitePetOverlay({ snapshot, image, onPetClick }: WebsitePetOverlayProps) {
	return (
		<div
			className="pointer-events-none fixed left-0 top-0 z-40 select-none"
			style={{
				width: image.width,
				height: image.height,
				transform: `translate3d(${snapshot.position.x}px, ${snapshot.position.y}px, 0)`,
				willChange: 'transform',
			}}
		>
			<PetImage
				pose={snapshot.pose}
				facing={snapshot.facing}
				width={image.width}
				height={image.height}
				onClick={onPetClick}
			/>
		</div>
	)
}
