CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

-- Create public.medical_records Table
CREATE TABLE "public"."medical_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "textract_job_id" "text" NOT NULL,
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

-- Create public.pages Table
CREATE TABLE "public"."pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "record_id" "uuid" NOT NULL,
    "page_number" "int4" NOT NULL,
    "text_representation" "text" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "summary_embedding" "public"."vector" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."pages" OWNER TO "postgres";

ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_fkey" FOREIGN KEY ("record_id") REFERENCES "public"."medical_records"("id");

ALTER TABLE "public"."pages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable ALL for service-role only" 
ON "public"."pages" 
TO "service_role" 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Enable read access for anon" 
ON "public"."pages"
AS PERMISSIVE FOR SELECT
TO anon
USING (true);

CREATE POLICY "Enable insert access for anon" 
ON "public"."pages"
AS PERMISSIVE FOR INSERT
TO anon
WITH CHECK (true);


-- Create public.page_sections Table
CREATE TABLE "public"."page_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "location" "text" NOT NULL,
    "embedding" "public"."vector" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."page_sections" OWNER TO "postgres";

ALTER TABLE ONLY "public"."page_sections"
    ADD CONSTRAINT "page_sections_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."page_sections"
    ADD CONSTRAINT "page_sections_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id");

ALTER TABLE "public"."page_sections" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable ALL for service-role only"
ON "public"."page_sections"
TO "service_role"
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable read access for anon"
ON "public"."page_sections"
AS PERMISSIVE FOR SELECT
TO anon
USING (true);

CREATE POLICY "Enable insert access for anon"
ON "public"."page_sections"
AS PERMISSIVE FOR INSERT
TO anon
WITH CHECK (true);