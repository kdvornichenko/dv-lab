'use client'

/* eslint-disable @next/next/no-img-element */

import type { CSSProperties } from 'react'

import { catPetManifest, type PetPose } from '@/lib/pet/pet-manifest'

type PetImageProps = {
	pose: PetPose
	facing: 'left' | 'right'
	width: number
	height: number
}

export function PetImage({ pose, facing, width, height }: PetImageProps) {
	const asset = catPetManifest.animations[pose]
	const style = {
		width,
		height,
		objectFit: 'contain',
		transform: facing === 'left' ? 'scaleX(-1)' : 'scaleX(1)',
		transformOrigin: 'center',
	} satisfies CSSProperties

	return <img src={asset.src} alt="" draggable={false} style={style} />
}
