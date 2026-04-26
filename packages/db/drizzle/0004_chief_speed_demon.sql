ALTER TABLE "students" ADD COLUMN "first_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "last_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "special" text;--> statement-breakpoint
UPDATE "students"
SET
	"first_name" = split_part(btrim("full_name"), ' ', 1),
	"last_name" = coalesce(substring(btrim("full_name") from '^\S+\s+(.*)$'), '')
WHERE "first_name" = '' AND btrim("full_name") <> '';
