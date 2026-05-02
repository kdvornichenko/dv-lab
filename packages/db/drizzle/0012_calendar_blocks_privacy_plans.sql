ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "birthday" date;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "package_lesson_price_override" numeric(12, 2);

CREATE TABLE IF NOT EXISTS "lesson_occurrence_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"occurrence_starts_at" timestamp with time zone NOT NULL,
	"replacement_lesson_id" uuid,
	"reason" text DEFAULT 'moved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_occurrence_exceptions_lesson_occurrence_uniq" UNIQUE("teacher_id", "lesson_id", "occurrence_starts_at"),
	CONSTRAINT "lesson_occurrence_exceptions_teacher_lesson_fk"
		FOREIGN KEY ("teacher_id", "lesson_id") REFERENCES "lessons"("teacher_id", "id") ON DELETE cascade,
	CONSTRAINT "lesson_occurrence_exceptions_teacher_replacement_lesson_fk"
		FOREIGN KEY ("teacher_id", "replacement_lesson_id") REFERENCES "lessons"("teacher_id", "id") ON DELETE set null
);

CREATE TABLE IF NOT EXISTS "calendar_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL REFERENCES "teacher_profiles"("id") ON DELETE cascade,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"external_event_id" text,
	"external_calendar_id" text,
	"sync_status" "calendar_sync_status" DEFAULT 'not_synced' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "calendar_blocks_teacher_starts_at_idx"
	ON "calendar_blocks" ("teacher_id", "starts_at");
