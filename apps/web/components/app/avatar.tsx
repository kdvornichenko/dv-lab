function initials(name: string) {
	return name
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => Array.from(word)[0])
		.join('')
		.toUpperCase()
}

export function Avatar({ name }: { name: string }) {
	return (
		<span
			aria-hidden
			className="flex size-7 shrink-0 items-center justify-center rounded-full bg-active text-caption font-semibold text-foreground"
		>
			{initials(name)}
		</span>
	)
}
