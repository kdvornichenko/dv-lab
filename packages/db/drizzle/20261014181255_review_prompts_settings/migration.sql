CREATE TABLE "chat_command_prompts" (
	"account_id" uuid,
	"command" text,
	"body" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_command_prompts_pk" PRIMARY KEY("account_id","command"),
	CONSTRAINT "chat_command_prompts_command_ck" CHECK ("command" ~ '^/[a-z][a-z0-9_-]{0,31}$'),
	CONSTRAINT "chat_command_prompts_body_ck" CHECK ("body" is null or char_length("body") between 1 and 8000),
	CONSTRAINT "chat_command_prompts_revision_ck" CHECK ("revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE "note_reviews" (
	"student_id" uuid PRIMARY KEY,
	"reviewed_at" timestamp with time zone,
	"offered_on" date,
	"running_conversation_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "notify_lesson_soon" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "notify_lesson_minutes" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "notify_pays_soon" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_command_prompts" ADD CONSTRAINT "chat_command_prompts_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "note_reviews" ADD CONSTRAINT "note_reviews_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD CONSTRAINT "teacher_settings_notify_minutes_ck" CHECK ("notify_lesson_minutes" between 5 and 120);