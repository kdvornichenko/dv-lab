CREATE TABLE IF NOT EXISTS "pet_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL REFERENCES "teacher_profiles"("id") ON DELETE cascade,
	"enabled" boolean DEFAULT true NOT NULL,
	"sound_enabled" boolean DEFAULT false NOT NULL,
	"activity_level" text DEFAULT 'normal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pet_settings_activity_level_check" CHECK ("activity_level" IN ('reduced', 'normal', 'playful'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "pet_settings_teacher_uniq"
	ON "pet_settings" ("teacher_id");
