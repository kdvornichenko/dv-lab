'use client'

import type { PetEngineSnapshot, PetImageBounds } from '@/lib/pet/pet-engine'

import { PetImage } from './PetImage'

type WebsitePetOverlayProps = {
	snapshot: PetEngineSnapshot
	image: PetImageBounds
}

export function WebsitePetOverlay({ snapshot, image }: WebsitePetOverlayProps) {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed top-0 left-0 z-40 select-none"
			style={{
				width: image.width,
				height: image.height,
				transform: `translate3d(${snapshot.position.x}px, ${snapshot.position.y}px, 0)`,
				willChange: 'transform',
			}}
		>
			<PetImage pose={snapshot.pose} facing={snapshot.facing} width={image.width} height={image.height} />
		</div>
	)
}
