export function balanceMinutes(openingMinutes: number | null, credited: readonly number[]): number | null {
	if (openingMinutes === null) return null
	return credited.reduce((sum, minutes) => sum + minutes, openingMinutes)
}
