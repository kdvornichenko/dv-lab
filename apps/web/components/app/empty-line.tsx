import { Elevated } from '@/lib/elevated'

export function EmptyLine({ text = 'Nothing here yet' }: { text?: string }) {
	return (
		<Elevated offset={1} shadowLevel={2} className="rounded-2xl">
			<p className="px-6 py-12 text-center text-body text-muted-foreground">{text}</p>
		</Elevated>
	)
}
