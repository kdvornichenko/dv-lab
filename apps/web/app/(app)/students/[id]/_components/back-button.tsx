import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

export function BackButton() {
	return (
		<Button
			variant="secondary"
			size="compact"
			leadingIcon={ArrowLeft}
			nativeButton={false}
			render={<Link href="/students" />}
			className="self-start"
		>
			Students
		</Button>
	)
}
