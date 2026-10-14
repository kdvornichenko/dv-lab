CREATE TABLE "push_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_deliveries_kind_ck" CHECK ("kind" in ('lesson_soon', 'pays_soon')),
	CONSTRAINT "push_deliveries_key_ck" CHECK (char_length("key") between 1 and 300)
);
--> statement-breakpoint
CREATE TABLE "push_payment_alerts" (
	"account_id" uuid,
	"student_id" uuid,
	"armed" boolean NOT NULL,
	"last_state" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_payment_alerts_pk" PRIMARY KEY("account_id","student_id"),
	CONSTRAINT "push_payment_alerts_last_state_ck" CHECK ("last_state" in ('plenty', 'pays_soon', 'none_left', 'owes', 'not_set'))
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"device_label" text,
	"second_time_zone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "push_subscriptions_endpoint_ck" CHECK (char_length("endpoint") between 12 and 2048 and "endpoint" like 'https://%'),
	CONSTRAINT "push_subscriptions_p256dh_ck" CHECK (char_length("p256dh") between 1 and 200),
	CONSTRAINT "push_subscriptions_auth_ck" CHECK (char_length("auth") between 1 and 100),
	CONSTRAINT "push_subscriptions_device_label_ck" CHECK ("device_label" is null or char_length("device_label") between 1 and 120),
	CONSTRAINT "push_subscriptions_second_time_zone_ck" CHECK ("second_time_zone" is null or char_length("second_time_zone") between 1 and 64)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "push_deliveries_key_uq" ON "push_deliveries" ("account_id","kind","key");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_uq" ON "push_subscriptions" ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_account_idx" ON "push_subscriptions" ("account_id");--> statement-breakpoint
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "push_payment_alerts" ADD CONSTRAINT "push_payment_alerts_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "push_payment_alerts" ADD CONSTRAINT "push_payment_alerts_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT;