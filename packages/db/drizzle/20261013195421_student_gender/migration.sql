ALTER TABLE "students" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_gender_ck" CHECK ("gender" is null or "gender" in ('female', 'male'));