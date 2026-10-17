CREATE TABLE "chat_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"prompt" text NOT NULL,
	"student" boolean DEFAULT false NOT NULL,
	"tools" jsonb NOT NULL,
	"blocks" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_commands_name_ck" CHECK ("name" ~ '^/[a-z][a-z0-9_-]{0,31}$'),
	CONSTRAINT "chat_commands_description_ck" CHECK (char_length("description") between 1 and 120),
	CONSTRAINT "chat_commands_prompt_ck" CHECK (char_length("prompt") between 1 and 8000),
	CONSTRAINT "chat_commands_status_ck" CHECK ("status" in ('active', 'archived')),
	CONSTRAINT "chat_commands_revision_ck" CHECK ("revision" >= 1),
	CONSTRAINT "chat_commands_tools_ck" CHECK (jsonb_typeof("tools") = 'array'),
	CONSTRAINT "chat_commands_blocks_ck" CHECK (jsonb_typeof("blocks") = 'array')
);
--> statement-breakpoint
ALTER TABLE "teacher_settings" ADD COLUMN "notify_assistant" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_commands_active_name_uq" ON "chat_commands" ("account_id","name") WHERE "status" = 'active';--> statement-breakpoint
CREATE INDEX "chat_commands_account_idx" ON "chat_commands" ("account_id","status");--> statement-breakpoint
ALTER TABLE "chat_commands" ADD CONSTRAINT "chat_commands_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT;