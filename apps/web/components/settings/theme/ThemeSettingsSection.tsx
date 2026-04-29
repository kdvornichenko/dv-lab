import type { ReactNode } from 'react'

export function ThemeSettingsSection({
	children,
	hint,
	icon,
	title,
}: {
	children: ReactNode
	hint?: string
	icon?: ReactNode
	title: string
}) {
	return (
		<section className="border-line bg-surface rounded-2xl border p-4 shadow-[0_18px_55px_-48px_var(--shadow-sage)]">
			<header className="mb-4 flex items-start gap-3">
				{icon ? (
					<span className="border-sage-line bg-sage-soft text-sage mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border">
						{icon}
					</span>
				) : null}
				<div>
					<h2 className="font-heading text-ink text-sm font-semibold">{title}</h2>
					{hint ? <p className="text-ink-muted mt-1 text-xs leading-5">{hint}</p> : null}
				</div>
			</header>
			{children}
		</section>
	)
}
