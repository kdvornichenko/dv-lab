export type OfferPackageInputsProps = {
	label: string
	baseLessonPrice: string
	lessonDurationMinutes: string
	months: 3 | 5
	lessonsPerWeek: string
	onLessonsPerWeekChange: (value: string) => void
}

export type OfferInputProps = {
	label: string
	value: string
	onChange: (value: string) => void
}
