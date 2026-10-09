CREATE TYPE "public"."package_instance_status" AS ENUM('active', 'exhausted', 'cancelled');

CREATE TABLE "student_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" "package_instance_status" DEFAULT 'active' NOT NULL,
	"starts_at" date NOT NULL,
	"paid_at" date,
	"package_months" integer DEFAULT 0 NOT NULL,
	"lessons_per_week" integer DEFAULT 0 NOT NULL,
	"purchased_lesson_count" integer DEFAULT 0 NOT NULL,
	"purchased_lesson_units" numeric(12, 2) DEFAULT '0' NOT NULL,
	"lesson_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" "currency" DEFAULT 'RUB' NOT NULL,
	"exhausted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_packages_teacher_student_fk" FOREIGN KEY ("teacher_id","student_id") REFERENCES "public"."students"("teacher_id","id") ON DELETE cascade
);

ALTER TABLE "payments" ADD COLUMN "package_id" uuid;
ALTER TABLE "payments" ADD COLUMN "currency" "currency" DEFAULT 'RUB' NOT NULL;
ALTER TABLE "payments" ADD COLUMN "idempotency_key" text;

UPDATE "payments"
SET "currency" = "students"."currency"
FROM "students"
WHERE "payments"."teacher_id" = "students"."teacher_id"
	AND "payments"."student_id" = "students"."id";

CREATE TABLE "lesson_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"attendance_record_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"package_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"currency" "currency" DEFAULT 'RUB' NOT NULL,
	"lesson_units" numeric(12, 2) DEFAULT '1' NOT NULL,
	"attendance_status" "attendance_status" NOT NULL,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_charges_teacher_lesson_fk" FOREIGN KEY ("teacher_id","lesson_id") REFERENCES "public"."lessons"("teacher_id","id") ON DELETE cascade,
	CONSTRAINT "lesson_charges_teacher_student_fk" FOREIGN KEY ("teacher_id","student_id") REFERENCES "public"."students"("teacher_id","id") ON DELETE cascade
);

ALTER TABLE "payments" ADD CONSTRAINT "payments_package_id_student_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."student_packages"("id") ON DELETE set null;
ALTER TABLE "lesson_charges" ADD CONSTRAINT "lesson_charges_attendance_record_id_attendance_records_id_fk" FOREIGN KEY ("attendance_record_id") REFERENCES "public"."attendance_records"("id") ON DELETE cascade;
ALTER TABLE "lesson_charges" ADD CONSTRAINT "lesson_charges_package_id_student_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."student_packages"("id") ON DELETE set null;

CREATE INDEX "student_packages_student_status_idx" ON "student_packages" USING btree ("teacher_id","student_id","status");
CREATE UNIQUE INDEX "payments_teacher_idempotency_key_uniq" ON "payments" USING btree ("teacher_id","idempotency_key");
CREATE UNIQUE INDEX "lesson_charges_attendance_uniq" ON "lesson_charges" USING btree ("teacher_id","attendance_record_id");
CREATE INDEX "lesson_charges_student_lesson_idx" ON "lesson_charges" USING btree ("teacher_id","student_id","lesson_id");
CREATE INDEX "lesson_charges_package_idx" ON "lesson_charges" USING btree ("teacher_id","package_id");

WITH "package_students" AS (
	SELECT
		"students".*,
		(
			SELECT max("payments"."paid_at")
			FROM "payments"
			WHERE "payments"."teacher_id" = "students"."teacher_id"
				AND "payments"."student_id" = "students"."id"
				AND "payments"."currency" = "students"."currency"
				AND "payments"."amount" = "students"."package_total_price"
		) AS "package_paid_at",
		(
			SELECT min("lessons"."starts_at"::date)
			FROM "attendance_records"
			JOIN "lessons"
				ON "lessons"."teacher_id" = "attendance_records"."teacher_id"
				AND "lessons"."id" = "attendance_records"."lesson_id"
			WHERE "attendance_records"."teacher_id" = "students"."teacher_id"
				AND "attendance_records"."student_id" = "students"."id"
				AND "attendance_records"."billable" = true
				AND "attendance_records"."status" IN ('attended', 'no_show')
		) AS "first_billable_lesson_at"
	FROM "students"
	WHERE "billing_mode" = 'package'
		AND "package_months" > 0
		AND "package_lesson_count" > 0
)
INSERT INTO "student_packages" (
	"teacher_id",
	"student_id",
	"status",
	"starts_at",
	"paid_at",
	"package_months",
	"lessons_per_week",
	"purchased_lesson_count",
	"purchased_lesson_units",
	"lesson_price",
	"total_price",
	"currency"
)
SELECT
	"teacher_id",
	"id",
	'active',
	COALESCE("package_paid_at", "first_billable_lesson_at", CURRENT_DATE),
	"package_paid_at",
	"package_months",
	"package_lessons_per_week",
	"package_lesson_count",
	round(("package_lesson_count"::numeric * greatest("default_lesson_duration_minutes", 0)::numeric / 60), 2),
	round(greatest("default_lesson_price" - CASE WHEN "package_months" = 3 THEN 200 WHEN "package_months" = 5 THEN 400 ELSE 0 END, 0) * greatest("default_lesson_duration_minutes", 0)::numeric / 60, 2),
	"package_total_price",
	"currency"
FROM "package_students";

UPDATE "payments"
SET "package_id" = "student_packages"."id"
FROM "student_packages"
WHERE "payments"."package_id" IS NULL
	AND "payments"."teacher_id" = "student_packages"."teacher_id"
	AND "payments"."student_id" = "student_packages"."student_id"
	AND "payments"."currency" = "student_packages"."currency"
	AND "payments"."paid_at" = "student_packages"."paid_at"
	AND "payments"."amount" = "student_packages"."total_price";

INSERT INTO "lesson_charges" (
	"teacher_id",
	"attendance_record_id",
	"lesson_id",
	"student_id",
	"package_id",
	"amount",
	"currency",
	"lesson_units",
	"attendance_status",
	"created_at",
	"updated_at"
)
SELECT
	"attendance_records"."teacher_id",
	"attendance_records"."id",
	"attendance_records"."lesson_id",
	"attendance_records"."student_id",
	"student_packages"."id",
	round(
		CASE
			WHEN "students"."billing_mode" = 'package' THEN greatest("students"."default_lesson_price" - CASE WHEN "students"."package_months" = 3 THEN 200 WHEN "students"."package_months" = 5 THEN 400 ELSE 0 END, 0)
			ELSE "students"."default_lesson_price"
		END * greatest("lessons"."duration_minutes", 0)::numeric / 60,
		2
	),
	"students"."currency",
	round(greatest("lessons"."duration_minutes", 0)::numeric / 60, 2),
	"attendance_records"."status",
	"attendance_records"."updated_at",
	"attendance_records"."updated_at"
FROM "attendance_records"
JOIN "students"
	ON "students"."teacher_id" = "attendance_records"."teacher_id"
	AND "students"."id" = "attendance_records"."student_id"
JOIN "lessons"
	ON "lessons"."teacher_id" = "attendance_records"."teacher_id"
	AND "lessons"."id" = "attendance_records"."lesson_id"
LEFT JOIN "student_packages"
	ON "student_packages"."teacher_id" = "attendance_records"."teacher_id"
	AND "student_packages"."student_id" = "attendance_records"."student_id"
	AND "student_packages"."status" = 'active'
	AND "lessons"."starts_at"::date >= "student_packages"."starts_at"
WHERE "attendance_records"."billable" = true
	AND "attendance_records"."status" IN ('attended', 'no_show');
