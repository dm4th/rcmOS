CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

-- Create PDF storage bucket
INSERT INTO storage.buckets (id, name)
VALUES ('records', 'Medical Records');

CREATE POLICY "Anon to Read Medical Records"
ON storage.objects for SELECT
TO anon
USING ( bucket_id = 'records' );

CREATE POLICY "Anon to Write Medical Records"
ON storage.objects for INSERT
TO anon
WITH CHECK ( bucket_id = 'records' );

-- Create public.medical_records Table
CREATE TABLE "public"."medical_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "textract_job_id" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "content_embedding_progress" "int4" DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."medical_records" OWNER TO "postgres";

ALTER TABLE ONLY "public"."medical_records"
    ADD CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id");

ALTER TABLE "public"."medical_records" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable ALL for service-role only" 
ON "public"."medical_records" 
TO "service_role" 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Enable read access for anon" 
ON "public"."medical_records"
AS PERMISSIVE FOR SELECT
TO anon
USING (true);

CREATE POLICY "Enable insert access for anon" 
ON "public"."medical_records"
AS PERMISSIVE FOR INSERT
TO anon
WITH CHECK (true);

-- Create public.page_summaries Table
CREATE TABLE "public"."page_summaries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "record_id" "uuid" NOT NULL,
    "page_number" "int4" NOT NULL,
    "section_type" "text" NOT NULL,
    "section_number" "int4" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "summary_embedding" "public"."vector" NOT NULL,
    "left" "float4" NOT NULL,
    "top" "float4" NOT NULL,
    "right" "float4" NOT NULL,
    "bottom" "float4" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."page_summaries" OWNER TO "postgres";

ALTER TABLE ONLY "public"."page_summaries"
    ADD CONSTRAINT "page_summaries_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."page_summaries"
    ADD CONSTRAINT "page_summaries_fkey" FOREIGN KEY ("record_id") REFERENCES "public"."medical_records"("id");

ALTER TABLE "public"."page_summaries" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable ALL for service-role only" 
ON "public"."page_summaries" 
TO "service_role" 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Enable read access for anon" 
ON "public"."page_summaries"
AS PERMISSIVE FOR SELECT
TO anon
USING (true);

CREATE POLICY "Enable insert access for anon" 
ON "public"."page_summaries"
AS PERMISSIVE FOR INSERT
TO anon
WITH CHECK (true);