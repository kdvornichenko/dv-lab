export function studentCleanupSql(where) {
	if (!where || !String(where).trim()) throw new Error('studentCleanupSql needs a where clause')
	const cards = `select id from students where ${where}`
	const series = `select id from lesson_series where student_id in (${cards})`
	const singles = `select id from lessons where student_id in (${cards})`
	const logins = `select id from accounts where student_id in (${cards})`
	return [
		`delete from sessions where account_id in (${logins})`,
		`delete from push_payment_alerts where student_id in (${cards}) or account_id in (${logins})`,
		`delete from push_deliveries where account_id in (${logins})`,
		`delete from push_subscriptions where account_id in (${logins})`,
		`delete from accounts where student_id in (${cards})`,
		`delete from lesson_comments where student_id in (${cards}) or series_id in (${series}) or lesson_id in (${singles})`,
		`delete from lesson_marks where series_id in (${series}) or lesson_id in (${singles})`,
		`delete from lesson_exceptions where series_id in (${series})`,
		`delete from lessons where student_id in (${cards})`,
		`delete from lesson_series where student_id in (${cards})`,
		`delete from payments where student_id in (${cards})`,
		`delete from student_notes where student_id in (${cards})`,
		`delete from note_reviews where student_id in (${cards})`,
		`delete from student_terms where student_id in (${cards})`,
		`delete from student_sections where student_id in (${cards})`,
		`delete from google_event_mappings where student_id in (${cards})`,
		`delete from google_next_lessons where student_id in (${cards})`,
		`delete from google_read_events where student_id in (${cards})`,
		`delete from students where ${where};`,
	].join(';\n')
}

export function removeStudentCards(run, where) {
	const result = run(studentCleanupSql(where))
	return Number(result?.rowCount ?? 0)
}
