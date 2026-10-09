import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { requireTeacherPage } from '@/lib/session'

import { StudentProfile } from './_components/student-profile'

export const metadata: Metadata = { title: 'Student' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
	await requireTeacherPage()
	const { id } = await params
	if (!UUID.test(id)) notFound()
	return <StudentProfile id={id} />
}
