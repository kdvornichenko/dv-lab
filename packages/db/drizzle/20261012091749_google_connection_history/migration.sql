ALTER TABLE "google_connections" DROP CONSTRAINT "google_connections_account_uq";--> statement-breakpoint
ALTER TABLE "google_connections" ADD COLUMN "retired_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "google_connections_current_uq" ON "google_connections" ("account_id") WHERE "retired_at" is null;--> statement-breakpoint
ALTER TABLE "google_connections" ADD CONSTRAINT "google_connections_retired_ck" CHECK ("retired_at" is null or ("state" = 'not_connected' and "encrypted_refresh_token" is null and "retired_at" >= "created_at"));