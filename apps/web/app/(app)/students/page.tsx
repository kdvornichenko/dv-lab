import type { Metadata } from 'next'

import { requireTeacherPage } from '@/lib/session'

import { StudentsScreen } from './_components/students-screen'

export const metadata: Metadata = { title: 'Students' }

export default async function StudentsPage() {
	await requireTeacherPage()
	return <StudentsScreen />
}
