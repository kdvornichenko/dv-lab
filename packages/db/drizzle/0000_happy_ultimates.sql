CREATE TYPE "public"."attendance_status" AS ENUM('planned', 'attended', 'absent', 'cancelled', 'rescheduled');--> statement-breakpoint
CREATE TYPE "public"."billing_mode" AS ENUM('per_lesson', 'monthly', 'package');--> statement-breakpoint
CREATE TYPE "public"."calendar_connection_status" AS ENUM('not_connected', 'authorization_required', 'connected', 'expired', 'error');--> statement-breakpoint
CREATE TYPE "public"."calendar_provider" AS ENUM('google');--> statement-breakpoint
CREATE TYPE "public"."calendar_sync_status" AS ENUM('not_synced', 'synced', 'failed', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."lesson_status" AS ENUM('planned', 'completed', 'cancelled', 'rescheduled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'bank_transfer', 'card', 'other');--> statement-breakpoint
CREATE TYPE "public"."student_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" "attendance_status" DEFAULT 'planned' NOT NULL,
	"billable" boolean DEFAULT true NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"provider" "calendar_provider" DEFAULT 'google' NOT NULL,
	"provider_account_email" text,
	"required_scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"granted_scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"token_available" boolean DEFAULT false NOT NULL,
	"encrypted_access_token" text,
	"encrypted_refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"selected_calendar_id" text,
	"selected_calendar_name" text,
	"status" "calendar_connection_status" DEFAULT 'not_connected' NOT NULL,
	"connected_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_sync_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"provider" "calendar_provider" DEFAULT 'google' NOT NULL,
	"external_event_id" text,
	"external_calendar_id" text,
	"status" "calendar_sync_status" DEFAULT 'not_synced' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_students" (
	"teacher_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	CONSTRAINT "lesson_students_lesson_id_student_id_pk" PRIMARY KEY("lesson_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"topic" text,
	"notes" text,
	"status" "lesson_status" DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lessons_teacher_id_id_uniq" UNIQUE("teacher_id","id")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"paid_at" date NOT NULL,
	"method" "payment_method" DEFAULT 'bank_transfer' NOT NULL,
	"comment" text,
	"correction_of_payment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"level" text,
	"status" "student_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"default_lesson_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"billing_mode" "billing_mode" DEFAULT 'per_lesson' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "students_teacher_id_id_uniq" UNIQUE("teacher_id","id")
);
--> statement-breakpoint
CREATE TABLE "teacher_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"email" text,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_profiles_auth_user_id_unique" UNIQUE("auth_user_id")
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_teacher_lesson_fk" FOREIGN KEY ("teacher_id","lesson_id") REFERENCES "public"."lessons"("teacher_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_teacher_student_fk" FOREIGN KEY ("teacher_id","student_id") REFERENCES "public"."students"("teacher_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_teacher_id_teacher_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teacher_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sync_events" ADD CONSTRAINT "calendar_sync_events_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sync_events" ADD CONSTRAINT "calendar_sync_events_teacher_lesson_fk" FOREIGN KEY ("teacher_id","lesson_id") REFERENCES "public"."lessons"("teacher_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_students" ADD CONSTRAINT "lesson_students_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_students" ADD CONSTRAINT "lesson_students_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_students" ADD CONSTRAINT "lesson_students_teacher_lesson_fk" FOREIGN KEY ("teacher_id","lesson_id") REFERENCES "public"."lessons"("teacher_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_students" ADD CONSTRAINT "lesson_students_teacher_student_fk" FOREIGN KEY ("teacher_id","student_id") REFERENCES "public"."students"("teacher_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_teacher_id_teacher_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teacher_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_teacher_id_teacher_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teacher_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_teacher_student_fk" FOREIGN KEY ("teacher_id","student_id") REFERENCES "public"."students"("teacher_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_teacher_id_teacher_profiles_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teacher_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_lesson_student_uniq" ON "attendance_records" USING btree ("teacher_id","lesson_id","student_id");--> statement-breakpoint
CREATE INDEX "attendance_student_status_idx" ON "attendance_records" USING btree ("teacher_id","student_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_connections_teacher_provider_uniq" ON "calendar_connections" USING btree ("teacher_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_sync_events_lesson_provider_uniq" ON "calendar_sync_events" USING btree ("teacher_id","lesson_id","provider");--> statement-breakpoint
CREATE INDEX "lessons_teacher_starts_at_idx" ON "lessons" USING btree ("teacher_id","starts_at");--> statement-breakpoint
CREATE INDEX "payments_student_paid_at_idx" ON "payments" USING btree ("teacher_id","student_id","paid_at");--> statement-breakpoint
CREATE INDEX "students_teacher_status_idx" ON "students" USING btree ("teacher_id","status");--> statement-breakpoint
CREATE INDEX "students_name_search_idx" ON "students" USING btree ("teacher_id","full_name");