import { EmptyLine } from '@/components/app/empty-line'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { ThemeToggle } from '@/components/app/theme-toggle'

export default function Page() {
	return (
		<main className="flex h-dvh flex-col bg-surface-2">
			<PageScroll>
				<PageHeader title="dv-lab" description="Workspace is being set up." actions={<ThemeToggle />} />
				<EmptyLine />
			</PageScroll>
		</main>
	)
}
