CREATE TABLE "lesson_exceptions" (
	"series_id" uuid,
	"original_on" date,
	"kind" text NOT NULL,
	"starts_at" timestamp with time zone,
	"duration_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_exceptions_pk" PRIMARY KEY("series_id","original_on"),
	CONSTRAINT "lesson_exceptions_kind_ck" CHECK ("kind" in ('cancelled', 'moved', 'restored')),
	CONSTRAINT "lesson_exceptions_moved_ck" CHECK (("kind" <> 'moved' or "starts_at" is not null) and ("starts_at" is null) = ("duration_minutes" is null)),
	CONSTRAINT "lesson_exceptions_minutes_ck" CHECK ("duration_minutes" is null or "duration_minutes" between 15 and 240)
);
--> statement-breakpoint
CREATE TABLE "lesson_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"duration_minutes" integer NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_series_weekday_ck" CHECK ("weekday" between 1 and 7),
	CONSTRAINT "lesson_series_starts_on_ck" CHECK (extract(isodow from "starts_on") = "weekday"),
	CONSTRAINT "lesson_series_ends_on_ck" CHECK ("ends_on" is null or "ends_on" >= "starts_on" - 1),
	CONSTRAINT "lesson_series_start_time_ck" CHECK (extract(second from "start_time") = 0),
	CONSTRAINT "lesson_series_minutes_ck" CHECK ("duration_minutes" between 15 and 240)
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lessons_status_ck" CHECK ("status" in ('scheduled', 'cancelled')),
	CONSTRAINT "lessons_minutes_ck" CHECK ("duration_minutes" between 15 and 240)
);
--> statement-breakpoint
CREATE INDEX "lesson_exceptions_moved_idx" ON "lesson_exceptions" ("starts_at") WHERE "kind" = 'moved';--> statement-breakpoint
CREATE INDEX "lesson_series_student_idx" ON "lesson_series" ("student_id");--> statement-breakpoint
CREATE INDEX "lessons_starts_at_idx" ON "lessons" ("starts_at");--> statement-breakpoint
CREATE INDEX "lessons_student_starts_idx" ON "lessons" ("student_id","starts_at");--> statement-breakpoint
ALTER TABLE "lesson_exceptions" ADD CONSTRAINT "lesson_exceptions_series_id_lesson_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "lesson_series"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "lesson_series" ADD CONSTRAINT "lesson_series_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT;