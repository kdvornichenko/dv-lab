import type { DbExecutor } from '@dv-lab/db'

import { appliedCancellation } from './cancelled-singles.ts'
import type { MappingRow } from './read-state.ts'

export function cancelledOccurrenceBaseline(
	executor: DbExecutor,
	mapping: Pick<MappingRow, 'accountId' | 'connectionId'>,
	occurrence: { seriesId: string; originalOn: string },
	eventId: string
) {
	return appliedCancellation(
		executor,
		mapping,
		(ref) => ref.kind === 'series' && ref.seriesId === occurrence.seriesId && ref.originalOn === occurrence.originalOn,
		eventId
	)
}
