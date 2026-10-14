ALTER TABLE "payments" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_revision_ck" CHECK ("revision" >= 1);--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_revision_ck" CHECK ("revision" >= 1);