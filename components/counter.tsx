'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'

export const Counter = () => {
	const [count, setCount] = useState(0)

	return (
		<Button className="rounded-full" onClick={() => setCount(count + 1)}>
			Count is {count}
		</Button>
	)
}
