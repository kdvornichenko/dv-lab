import { sql } from 'drizzle-orm'

import type { Database } from '@dv-lab/db'

import { importCard } from '../cards/cards.ts'
import { addMissingPayments } from '../cards/payments.ts'
import { addMissingSections } from '../cards/sections.ts'
import { addMissingTerms } from '../cards/terms.ts'
import type { ImportPacket } from './packet.ts'

type TableCount = { inserted: number; skipped: number }

type ApplyResult = Record<'students' | 'sections' | 'terms' | 'payments', TableCount>

type PacketPayment = ImportPacket['unmatched'][number]

const counter = (): TableCount => ({ inserted: 0, skipped: 0 })

function count(target: TableCount, attempted: number, inserted: number) {
	target.inserted += inserted
	target.skipped += attempted - inserted
}

const toImported = (studentId: string | null) => (payment: PacketPayment) => ({
	importKey: payment.key,
	studentId,
	paidOn: payment.paidOn,
	amountMinor: payment.amountMinor,
	currency: payment.currency,
	note: payment.note,
})

export function applyPacket(db: Database, packet: ImportPacket): Promise<ApplyResult> {
	return db.transaction(async (tx): Promise<ApplyResult> => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext('dvlab_import_vault'))`)
		const result: ApplyResult = { students: counter(), sections: counter(), terms: counter(), payments: counter() }
		for (const student of packet.students) {
			const card = await importCard(tx, {
				importKey: student.key,
				displayName: student.displayName,
				rateMinor: student.rate?.amountMinor ?? null,
				currency: student.rate?.currency ?? null,
				defaultLessonMinutes: student.rate?.lessonMinutes ?? 60,
			})
			count(result.students, 1, card.inserted ? 1 : 0)
			count(result.sections, student.sections.length, await addMissingSections(tx, card.id, student.sections))
			count(result.terms, student.terms.length, await addMissingTerms(tx, card.id, student.terms))
			count(
				result.payments,
				student.payments.length,
				await addMissingPayments(tx, student.payments.map(toImported(card.id)))
			)
		}
		count(
			result.payments,
			packet.unmatched.length,
			await addMissingPayments(tx, packet.unmatched.map(toImported(null)))
		)
		return result
	})
}
