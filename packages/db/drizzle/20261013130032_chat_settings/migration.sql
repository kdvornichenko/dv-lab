ALTER TABLE "teacher_settings" ADD COLUMN "chat_monthly_cap_usd" numeric(10,2) DEFAULT '10.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "chat_max_input_tokens" integer DEFAULT 100000 NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "chat_max_output_tokens" integer DEFAULT 16000 NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "chat_models" jsonb;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "chat_model" text;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "chat_effort" text;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD CONSTRAINT "teacher_settings_chat_cap_ck" CHECK ("chat_monthly_cap_usd" > 0);--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD CONSTRAINT "teacher_settings_chat_input_ck" CHECK ("chat_max_input_tokens" between 1000 and 100000);--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD CONSTRAINT "teacher_settings_chat_output_ck" CHECK ("chat_max_output_tokens" >= 1000);--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD CONSTRAINT "teacher_settings_chat_effort_ck" CHECK ("chat_effort" is null or "chat_effort" in ('low', 'medium', 'high', 'xhigh', 'max'));