CREATE TABLE "chat_budget_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_before" date NOT NULL,
	"time_zone" text NOT NULL,
	"spent_nano" bigint DEFAULT 0 NOT NULL,
	"held_nano" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_budget_periods_spent_ck" CHECK ("spent_nano" >= 0),
	CONSTRAINT "chat_budget_periods_held_ck" CHECK ("held_nano" >= 0),
	CONSTRAINT "chat_budget_periods_range_ck" CHECK ("ends_before" > "starts_on")
);
--> statement-breakpoint
CREATE TABLE "chat_usage_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"model" text NOT NULL,
	"effort" text NOT NULL,
	"pricing" jsonb NOT NULL,
	"max_input_tokens" integer NOT NULL,
	"max_output_tokens" integer NOT NULL,
	"reserved_nano" bigint NOT NULL,
	"state" text NOT NULL,
	"usage" jsonb,
	"cost_nano" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_usage_attempts_state_ck" CHECK ("state" in ('reserved', 'dispatched', 'settled', 'unknown', 'released')),
	CONSTRAINT "chat_usage_attempts_reserved_ck" CHECK ("reserved_nano" >= 0),
	CONSTRAINT "chat_usage_attempts_cost_ck" CHECK ("cost_nano" is null or "cost_nano" >= 0)
);
--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD COLUMN "model_override" text;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD COLUMN "effort_override" text;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_budget_periods_account_starts_uq" ON "chat_budget_periods" ("account_id","starts_on");--> statement-breakpoint
CREATE INDEX "chat_usage_attempts_conversation_idx" ON "chat_usage_attempts" ("conversation_id");--> statement-breakpoint
CREATE INDEX "chat_usage_attempts_period_idx" ON "chat_usage_attempts" ("period_id","state");--> statement-breakpoint
ALTER TABLE "chat_budget_periods" ADD CONSTRAINT "chat_budget_periods_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "chat_usage_attempts" ADD CONSTRAINT "chat_usage_attempts_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "chat_usage_attempts" ADD CONSTRAINT "chat_usage_attempts_conversation_id_chat_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "chat_usage_attempts" ADD CONSTRAINT "chat_usage_attempts_period_id_chat_budget_periods_id_fkey" FOREIGN KEY ("period_id") REFERENCES "chat_budget_periods"("id") ON DELETE RESTRICT;