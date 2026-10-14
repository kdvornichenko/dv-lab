INSERT INTO "student_sections" ("student_id", "kind", "body", "name", "position")
SELECT "students"."id", "standard"."kind", '', "standard"."name", "standard"."position"
FROM "students"
CROSS JOIN (VALUES
	('general_info', 'General info', 1),
	('interests', 'Interests', 2),
	('level', 'Level', 3),
	('goals', 'Goals', 4),
	('typical_mistakes', 'Typical mistakes', 5),
	('lesson_ideas', 'Lesson ideas', 6)
) AS "standard" ("kind", "name", "position")
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "student_sections"
SET "name" = "standard"."name", "position" = "standard"."position"
FROM (VALUES
	('general_info', 'General info', 1),
	('interests', 'Interests', 2),
	('level', 'Level', 3),
	('goals', 'Goals', 4),
	('typical_mistakes', 'Typical mistakes', 5),
	('lesson_ideas', 'Lesson ideas', 6)
) AS "standard" ("kind", "name", "position")
WHERE "student_sections"."kind" = "standard"."kind" AND "student_sections"."name" IS NULL;
