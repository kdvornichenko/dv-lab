import type { ScheduleBlock } from '@dv-lab/contracts'
import { lessonActions } from '@dv-lab/core'

export function hasStaleActions(blocks: readonly ScheduleBlock[], now: Date): boolean {
	return blocks.some((block) => {
		const current = lessonActions(block.outcome, new Date(block.startsAt), now)
		return block.actions.mark !== current.mark || block.actions.series !== current.series
	})
}
