ALTER TABLE "lesson_marks" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_marks" ADD CONSTRAINT "lesson_marks_revision_ck" CHECK ("revision" >= 1);