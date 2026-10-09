import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { requireTeacherPage } from '@/lib/session'

export const metadata: Metadata = { title: 'Page not found' }

export default async function MissingPage() {
	await requireTeacherPage()
	notFound()
}
