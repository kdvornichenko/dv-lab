import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SkeletonContent } from '@/components/app/skeleton-swap'
import { requireTeacherPage } from '@/lib/session'

import { parseProfileArrival } from './_components/profile-arrival'
import { StudentProfile } from './_components/student-profile'

export const metadata: Metadata = { title: 'Student' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Param = string | string[] | undefined

export default async function StudentPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>
	searchParams: Promise<{ tab?: Param; dialog?: Param; entry?: Param; section?: Param }>
}) {
	await requireTeacherPage()
	const { id } = await params
	if (!UUID.test(id)) notFound()
	const arrival = parseProfileArrival(await searchParams)
	return (
		<SkeletonContent>
			<StudentProfile id={id} arrival={arrival} />
		</SkeletonContent>
	)
}
