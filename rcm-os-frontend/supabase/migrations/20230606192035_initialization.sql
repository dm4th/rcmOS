CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

CREATE TABLE "public"."medical_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "s3_key" "text",
    "textract_job_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."medical_records" OWNER TO "postgres";

ALTER TABLE ONLY "public"."medical_records"
    ADD CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."medical_records" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable ALL access for service-role only" ON "public"."medical_records" TO "service_role" USING (true) WITH CHECK (true);