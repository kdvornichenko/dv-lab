ALTER TABLE "students" ADD COLUMN "package_months" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "package_lesson_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "package_total_price" numeric(12, 2) DEFAULT '0' NOT NULL;