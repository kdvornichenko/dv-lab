CREATE TABLE "chat_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"teacher_message_id" uuid NOT NULL,
	"assistant_message_id" uuid,
	"state" text NOT NULL,
	"model" text NOT NULL,
	"effort" text NOT NULL,
	"issue" text,
	"requests" integer DEFAULT 0 NOT NULL,
	"seq" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_turns_state_ck" CHECK ("state" in ('accepted', 'running', 'completed', 'stopped', 'interrupted', 'failed')),
	CONSTRAINT "chat_turns_requests_ck" CHECK ("requests" >= 0),
	CONSTRAINT "chat_turns_seq_ck" CHECK ("seq" >= 0)
);
--> statement-breakpoint
ALTER TABLE "chat_usage_attempts" ADD COLUMN "turn_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_turns_active_uq" ON "chat_turns" ("conversation_id") WHERE "state" in ('accepted', 'running');--> statement-breakpoint
CREATE UNIQUE INDEX "chat_turns_teacher_message_uq" ON "chat_turns" ("teacher_message_id");--> statement-breakpoint
CREATE INDEX "chat_turns_state_idx" ON "chat_turns" ("state");--> statement-breakpoint
CREATE INDEX "chat_usage_attempts_turn_idx" ON "chat_usage_attempts" ("turn_id");--> statement-breakpoint
ALTER TABLE "chat_turns" ADD CONSTRAINT "chat_turns_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "chat_turns" ADD CONSTRAINT "chat_turns_conversation_id_chat_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "chat_turns" ADD CONSTRAINT "chat_turns_teacher_message_id_chat_messages_id_fkey" FOREIGN KEY ("teacher_message_id") REFERENCES "chat_messages"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "chat_turns" ADD CONSTRAINT "chat_turns_assistant_message_id_chat_messages_id_fkey" FOREIGN KEY ("assistant_message_id") REFERENCES "chat_messages"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "chat_usage_attempts" ADD CONSTRAINT "chat_usage_attempts_turn_id_chat_turns_id_fkey" FOREIGN KEY ("turn_id") REFERENCES "chat_turns"("id") ON DELETE RESTRICT;