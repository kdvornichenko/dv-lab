ALTER TABLE "lesson_series" ADD COLUMN "time_zone" text DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "time_zone" text DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL;--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "default_time_zone" text DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL;