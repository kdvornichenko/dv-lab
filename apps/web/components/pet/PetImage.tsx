'use client'

/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from 'react'

import { catPetManifest, type PetPose } from '@/lib/pet/pet-manifest'

type PetImageProps = {
	pose: PetPose
	facing: 'left' | 'right'
	width: number
	height: number
	onClick: () => void
}

export function PetImage({ pose, facing, width, height, onClick }: PetImageProps) {
	const asset = catPetManifest.animations[pose]
	const style = {
		width,
		height,
		objectFit: 'contain',
		objectPosition: 'center bottom',
		transform: facing === 'right' ? 'scaleX(-1)' : 'scaleX(1)',
		transformOrigin: 'center bottom',
	} satisfies CSSProperties

	return (
		<button
			type="button"
			aria-label="Wake pet"
			className="pointer-events-auto block cursor-pointer border-0 bg-transparent p-0"
			onClick={onClick}
			style={{ width, height, lineHeight: 0 }}
		>
			<img src={asset.src} alt="" draggable={false} style={style} />
		</button>
	)
}
