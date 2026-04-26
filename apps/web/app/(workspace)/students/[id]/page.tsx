import { StudentSettingsClient } from './StudentSettingsClient'

export default async function StudentSettingsPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	return <StudentSettingsClient studentId={id} />
}
