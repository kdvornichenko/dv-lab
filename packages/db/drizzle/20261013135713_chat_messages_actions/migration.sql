CREATE TABLE "chat_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"state" text NOT NULL,
	"target" jsonb,
	"before" jsonb,
	"after" jsonb,
	"result" jsonb NOT NULL,
	"calendar_request_id" uuid,
	"undo_request_id" uuid,
	"undo_calendar_request_id" uuid,
	"undo_result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_actions_kind_ck" CHECK ("kind" in ('mark', 'note', 'comment', 'calendar')),
	CONSTRAINT "chat_actions_state_ck" CHECK ("state" in ('proposed', 'submitted', 'applied', 'refused', 'undone'))
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"body" text NOT NULL,
	"mentions" jsonb DEFAULT '[]' NOT NULL,
	"blocks" jsonb DEFAULT '[]' NOT NULL,
	"request_id" uuid,
	"request_digest" text,
	"reply_to" uuid,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"redacted_at" timestamp with time zone,
	CONSTRAINT "chat_messages_role_ck" CHECK ("role" in ('teacher', 'assistant')),
	CONSTRAINT "chat_messages_body_ck" CHECK (("role" = 'teacher' and char_length("body") between 1 and 20000) or ("role" = 'assistant' and char_length("body") <= 200000))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "chat_actions_calendar_request_uq" ON "chat_actions" ("calendar_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_actions_undo_request_uq" ON "chat_actions" ("undo_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_actions_undo_calendar_request_uq" ON "chat_actions" ("undo_calendar_request_id");--> statement-breakpoint
CREATE INDEX "chat_actions_conversation_idx" ON "chat_actions" ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_actions_message_idx" ON "chat_actions" ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_account_request_uq" ON "chat_messages" ("account_id","request_id");--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_created_idx" ON "chat_messages" ("conversation_id","created_at","id");--> statement-breakpoint
CREATE INDEX "chat_messages_reply_to_idx" ON "chat_messages" ("reply_to");--> statement-breakpoint
ALTER TABLE "chat_actions" ADD CONSTRAINT "chat_actions_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "chat_actions" ADD CONSTRAINT "chat_actions_conversation_id_chat_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "chat_actions" ADD CONSTRAINT "chat_actions_message_id_chat_messages_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_reply_to_chat_messages_id_fkey" FOREIGN KEY ("reply_to") REFERENCES "chat_messages"("id") ON DELETE RESTRICT;