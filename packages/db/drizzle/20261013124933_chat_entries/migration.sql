CREATE TABLE "lesson_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"series_id" uuid,
	"original_on" date,
	"lesson_id" uuid,
	"student_id" uuid NOT NULL,
	"body" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retracted_at" timestamp with time zone,
	CONSTRAINT "lesson_comments_body_ck" CHECK (char_length("body") between 1 and 2000),
	CONSTRAINT "lesson_comments_revision_ck" CHECK ("revision" >= 1),
	CONSTRAINT "lesson_comments_ref_ck" CHECK (("series_id" is null) = ("original_on" is null) and ("series_id" is null) <> ("lesson_id" is null))
);
--> statement-breakpoint
CREATE TABLE "student_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid NOT NULL,
	"section_kind" text NOT NULL,
	"body" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retracted_at" timestamp with time zone,
	CONSTRAINT "student_notes_section_kind_ck" CHECK ("section_kind" in ('general_info', 'interests', 'level', 'goals', 'typical_mistakes', 'lesson_ideas')),
	CONSTRAINT "student_notes_body_ck" CHECK (char_length("body") between 1 and 2000),
	CONSTRAINT "student_notes_revision_ck" CHECK ("revision" >= 1)
);
--> statement-breakpoint
CREATE INDEX "lesson_comments_occurrence_idx" ON "lesson_comments" ("series_id","original_on");--> statement-breakpoint
CREATE INDEX "lesson_comments_lesson_idx" ON "lesson_comments" ("lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_comments_student_idx" ON "lesson_comments" ("student_id");--> statement-breakpoint
CREATE INDEX "student_notes_student_created_idx" ON "student_notes" ("student_id","created_at","id");--> statement-breakpoint
ALTER TABLE "lesson_comments" ADD CONSTRAINT "lesson_comments_series_id_lesson_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "lesson_series"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "lesson_comments" ADD CONSTRAINT "lesson_comments_lesson_id_lessons_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "lesson_comments" ADD CONSTRAINT "lesson_comments_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT;