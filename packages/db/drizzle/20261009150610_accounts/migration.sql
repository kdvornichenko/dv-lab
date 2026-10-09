CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"login" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"password_hash" text NOT NULL,
	"auth_epoch" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_role_ck" CHECK ("role" in ('teacher', 'student')),
	CONSTRAINT "accounts_status_ck" CHECK ("status" in ('active', 'deactivated')),
	CONSTRAINT "accounts_auth_epoch_ck" CHECK ("auth_epoch" >= 0),
	CONSTRAINT "accounts_login_normalized_ck" CHECK ("login" = lower(btrim("login")) and char_length("login") between 3 and 254),
	CONSTRAINT "accounts_student_login_ck" CHECK ("role" <> 'student' or "login" ~ '^[a-z0-9._-]{3,32}$'),
	CONSTRAINT "accounts_display_name_ck" CHECK (char_length("display_name") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY,
	"account_id" uuid NOT NULL,
	"auth_epoch" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_token_hash_ck" CHECK ("token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "sign_in_throttles" (
	"key_hash" text PRIMARY KEY,
	"failure_count" integer NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"locked_until" timestamp with time zone,
	CONSTRAINT "sign_in_throttles_key_hash_ck" CHECK ("key_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "sign_in_throttles_failure_count_ck" CHECK ("failure_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_active_login_uq" ON "accounts" ("login") WHERE "status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_one_active_teacher_uq" ON "accounts" ("role") WHERE "role" = 'teacher' and "status" = 'active';--> statement-breakpoint
CREATE INDEX "sessions_account_idx" ON "sessions" ("account_id");--> statement-breakpoint
CREATE INDEX "sign_in_throttles_window_idx" ON "sign_in_throttles" ("window_started_at");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT;