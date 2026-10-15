'use client'

import { UserPlus } from 'lucide-react'

import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SkeletonCount, SkeletonTable, SkeletonText } from '@/components/ui/skeleton'
import { TabItem, TabPanel, Tabs, TabsList } from '@/components/ui/tabs'

import { studentColumns } from './students-screen'

function ignore() {}

export function StudentsLoading() {
	return (
		<PageScroll>
			<PageHeader
				title="Students"
				description={<SkeletonText className="w-48 py-0.5" />}
				actions={
					<div className="flex flex-wrap gap-2">
						<Button variant="secondary">Refresh</Button>
						<Button leadingIcon={UserPlus}>New student</Button>
					</div>
				}
			/>
			<Tabs value="active" onValueChange={ignore}>
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
					<div className="flex min-w-0 rounded-xl bg-muted md:w-fit md:flex-none">
						<TabsList
							aria-label="Student lists"
							className="scroll-fade-x no-scrollbar bg-transparent [--scroll-fade-size:var(--scroll-fade-size-compact)] max-md:min-w-0 max-md:flex-1 max-md:overflow-x-auto"
						>
							<TabItem value="active" label="Active" />
							<TabItem value="archived" label="Archived" />
							<TabItem
								value="unassigned"
								label={
									<>
										Unassigned payments (<SkeletonCount />)
									</>
								}
							/>
						</TabsList>
					</div>
					<Input
						type="search"
						aria-label="Search students"
						placeholder="Search students"
						autoComplete="off"
						className="w-full lg:ml-auto lg:max-w-72 lg:min-w-0 lg:flex-1"
					/>
				</div>
				<TabPanel value="active" className="mt-4">
					<SkeletonTable columns={studentColumns} />
				</TabPanel>
			</Tabs>
		</PageScroll>
	)
}
