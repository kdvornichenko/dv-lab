ALTER TABLE "student_sections" ADD COLUMN "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "student_sections" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "student_sections" ADD COLUMN "position" integer;--> statement-breakpoint
ALTER TABLE "student_sections" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "student_sections" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "student_terms" ADD COLUMN "added_by" text;--> statement-breakpoint
ALTER TABLE "student_terms" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "student_terms" ADD COLUMN "removed_by" text;--> statement-breakpoint
CREATE UNIQUE INDEX "student_sections_id_uq" ON "student_sections" ("id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_sections_name_uq" ON "student_sections" ("student_id",lower("name")) WHERE "deleted_at" is null and "name" is not null;--> statement-breakpoint
ALTER TABLE "student_sections" ADD CONSTRAINT "student_sections_name_ck" CHECK ("name" is null or char_length(btrim("name")) between 1 and 60);--> statement-breakpoint
ALTER TABLE "student_sections" ADD CONSTRAINT "student_sections_position_ck" CHECK ("position" is null or "position" >= 1);--> statement-breakpoint
ALTER TABLE "student_sections" ADD CONSTRAINT "student_sections_revision_ck" CHECK ("revision" >= 1);--> statement-breakpoint
ALTER TABLE "student_terms" ADD CONSTRAINT "student_terms_removed_by_ck" CHECK ("removed_by" is null or "removed_by" in ('chat', 'review', 'teacher'));--> statement-breakpoint
ALTER TABLE "student_terms" ADD CONSTRAINT "student_terms_added_by_ck" CHECK ("added_by" is null or "added_by" in ('chat', 'review'));