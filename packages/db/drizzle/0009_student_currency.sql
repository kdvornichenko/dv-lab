CREATE TYPE "public"."currency" AS ENUM('RUB', 'KZT');
ALTER TABLE "students" ADD COLUMN "currency" "currency" DEFAULT 'RUB' NOT NULL;
