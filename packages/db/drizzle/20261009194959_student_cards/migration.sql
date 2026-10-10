CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid,
	"paid_on" date NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text,
	"lessons_count" numeric(7,2),
	"credited_minutes" integer DEFAULT 0 NOT NULL,
	"note" text,
	"source" text NOT NULL,
	"import_key" text CONSTRAINT "payments_import_key_uq" UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_ck" CHECK ("amount_minor" > 0),
	CONSTRAINT "payments_currency_format_ck" CHECK ("currency" is null or "currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "payments_currency_ck" CHECK ("currency" is not null or ("lessons_count" is null and "credited_minutes" = 0)),
	CONSTRAINT "payments_unassigned_ck" CHECK ("student_id" is not null or ("lessons_count" is null and "credited_minutes" = 0)),
	CONSTRAINT "payments_credited_ck" CHECK ("credited_minutes" >= 0 and ("lessons_count" is not null or "credited_minutes" = 0)),
	CONSTRAINT "payments_lessons_ck" CHECK ("lessons_count" is null or "lessons_count" >= 0),
	CONSTRAINT "payments_note_ck" CHECK ("note" is null or char_length("note") between 1 and 500),
	CONSTRAINT "payments_source_ck" CHECK ("source" in ('manual', 'vault'))
);
--> statement-breakpoint
CREATE TABLE "student_sections" (
	"student_id" uuid,
	"kind" text,
	"body" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_sections_pk" PRIMARY KEY("student_id","kind"),
	CONSTRAINT "student_sections_kind_ck" CHECK ("kind" in ('general_info', 'interests', 'level', 'goals', 'typical_mistakes', 'lesson_ideas')),
	CONSTRAINT "student_sections_body_ck" CHECK (char_length("body") <= 20000)
);
--> statement-breakpoint
CREATE TABLE "student_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid NOT NULL,
	"term" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_terms_term_ck" CHECK ("term" = btrim("term") and char_length("term") between 1 and 200),
	CONSTRAINT "student_terms_note_ck" CHECK ("note" is null or char_length("note") between 1 and 2000)
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"display_name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"rate_minor" integer,
	"currency" text,
	"default_lesson_minutes" integer DEFAULT 60 NOT NULL,
	"parent" text,
	"level" text,
	"goals" text,
	"time_zone" text,
	"opening_balance_minutes" integer,
	"opening_balance_on" date,
	"import_key" text CONSTRAINT "students_import_key_uq" UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "students_status_ck" CHECK ("status" in ('active', 'archived')),
	CONSTRAINT "students_archived_at_ck" CHECK (("status" = 'archived') = ("archived_at" is not null)),
	CONSTRAINT "students_display_name_ck" CHECK (char_length("display_name") between 1 and 80),
	CONSTRAINT "students_rate_ck" CHECK (("rate_minor" is null) = ("currency" is null) and ("rate_minor" is null or "rate_minor" > 0)),
	CONSTRAINT "students_currency_ck" CHECK ("currency" is null or "currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "students_lesson_minutes_ck" CHECK ("default_lesson_minutes" between 15 and 240),
	CONSTRAINT "students_text_ck" CHECK (("parent" is null or char_length("parent") between 1 and 200) and ("level" is null or char_length("level") between 1 and 200) and ("goals" is null or char_length("goals") between 1 and 200)),
	CONSTRAINT "students_time_zone_ck" CHECK ("time_zone" is null or char_length("time_zone") between 1 and 64),
	CONSTRAINT "students_opening_ck" CHECK (("opening_balance_minutes" is null) = ("opening_balance_on" is null) and ("opening_balance_minutes" is null or "opening_balance_minutes" >= 0))
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "student_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_student_uq" ON "accounts" ("student_id") WHERE "student_id" is not null and "status" = 'active';--> statement-breakpoint
CREATE INDEX "payments_student_paid_idx" ON "payments" ("student_id","paid_on");--> statement-breakpoint
CREATE UNIQUE INDEX "student_terms_term_uq" ON "student_terms" ("student_id",lower("term"));--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "student_sections" ADD CONSTRAINT "student_sections_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "student_terms" ADD CONSTRAINT "student_terms_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_student_role_ck" CHECK ("student_id" is null or "role" = 'student');