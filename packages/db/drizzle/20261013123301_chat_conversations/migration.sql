CREATE TABLE "chat_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid NOT NULL,
	"title" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chat_conversations_title_ck" CHECK (char_length("title") between 1 and 160),
	CONSTRAINT "chat_conversations_revision_ck" CHECK ("revision" >= 1)
);
--> statement-breakpoint
CREATE INDEX "chat_conversations_account_updated_idx" ON "chat_conversations" ("account_id","updated_at" DESC NULLS LAST,"id") WHERE "deleted_at" is null;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT;