ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "voided_at" timestamp with time zone;
ALTER TABLE "payments" ADD CONSTRAINT "payments_correction_payment_fk" FOREIGN KEY ("correction_of_payment_id") REFERENCES "public"."payments"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
