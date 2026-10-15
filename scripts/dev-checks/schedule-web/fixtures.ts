import { sql } from '../browser-context.ts'

export const fixtureWhere = (like: string) => `display_name like '${like}' and import_key is null`

export const cleanupText = (like: string) => `do $$ begin
if to_regclass('lesson_marks') is not null then
delete from lesson_marks where lesson_id in (select id from lessons where student_id in (select id from students where ${fixtureWhere(like)}))
or series_id in (select id from lesson_series where student_id in (select id from students where ${fixtureWhere(like)}));
end if;
if to_regclass('lesson_exceptions') is not null then
delete from lesson_exceptions where series_id in (select id from lesson_series where student_id in (select id from students where ${fixtureWhere(like)}));
end if;
if to_regclass('lessons') is not null then
delete from lessons where student_id in (select id from students where ${fixtureWhere(like)});
end if;
if to_regclass('lesson_series') is not null then
delete from lesson_series where student_id in (select id from students where ${fixtureWhere(like)});
end if;
if to_regclass('student_sections') is not null then
delete from student_sections where student_id in (select id from students where ${fixtureWhere(like)});
end if;
delete from students where ${fixtureWhere(like)};
end $$`

export function cleanupFixtures(label: string, like = 'Alex Example 20%') {
	const before = sql<{ n: number }>(`select count(*)::int as n from students where ${fixtureWhere(like)}`)
	const found = before.rows?.[0]?.n ?? 0
	sql(cleanupText(like))
	console.log(`${label}: fixture cards removed ${found}`)
	return found
}
