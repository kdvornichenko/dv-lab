import { Elevated } from '@/lib/elevated'

export function EmptyLine() {
	return (
		<Elevated offset={1} shadowLevel={2} className="rounded-2xl">
			<p className="px-6 py-12 text-center text-body text-muted-foreground">Nothing here yet</p>
		</Elevated>
	)
}
