CREATE TABLE "lesson_marks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"series_id" uuid,
	"original_on" date,
	"lesson_id" uuid,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_marks_kind_ck" CHECK ("kind" in ('done', 'no_show', 'none')),
	CONSTRAINT "lesson_marks_ref_ck" CHECK (("series_id" is null) = ("original_on" is null) and ("series_id" is null) <> ("lesson_id" is null))
);
--> statement-breakpoint
CREATE TABLE "teacher_settings" (
	"account_id" uuid PRIMARY KEY,
	"pays_soon_lessons" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_settings_pays_soon_ck" CHECK ("pays_soon_lessons" between 0 and 20)
);
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "no_show_deducts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_marks_occurrence_uq" ON "lesson_marks" ("series_id","original_on");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_marks_lesson_uq" ON "lesson_marks" ("lesson_id");--> statement-breakpoint
ALTER TABLE "lesson_marks" ADD CONSTRAINT "lesson_marks_series_id_lesson_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "lesson_series"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "lesson_marks" ADD CONSTRAINT "lesson_marks_lesson_id_lessons_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD CONSTRAINT "teacher_settings_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT;