import React, { FC } from 'react'

import { Loader2 } from 'lucide-react'

interface LoadingScreenProps {
	message: string
}

const LoadingScreen: FC<LoadingScreenProps> = ({ message }) => {
	return (
		<div className="flex h-screen flex-col items-center justify-center">
			<Loader2 className="h-8 w-8 animate-spin" />
			<p className="mt-4 text-lg">{message}</p>
		</div>
	)
}

export default LoadingScreen
