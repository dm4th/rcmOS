ALTER TABLE "public"."page_summaries"
ADD COLUMN "document_type" text NOT NULL;

ALTER TABLE "public"."page_summaries"
DROP CONSTRAINT "page_summaries_record_id_fkey";

ALTER TABLE "public"."page_summaries"
RENAME COLUMN "record_id" TO "document_id";

ALTER TABLE "public"."claims"
ADD COLUMN "summary" text DEFAULT ''::text NOT NULL;

-- Alter the medical_records table and associated objects to look more like the denial_letters table
ALTER TABLE "public"."medical_records"
  ADD COLUMN "content_processing_type" text NOT NULL,
  ADD COLUMN "content_processing_id" text,
  ADD COLUMN "content_processing_progress" numeric DEFAULT 0.0 NOT NULL,
  ADD COLUMN "text_processing_progress" numeric DEFAULT 0.0 NOT NULL,
  ADD COLUMN "table_processing_progress" numeric DEFAULT 0.0 NOT NULL,
  ADD COLUMN "kv_processing_progress" numeric DEFAULT 0.0 NOT NULL;

CREATE OR REPLACE VIEW "public"."claim_document_view" AS (
    SELECT
        claim_documents.user_id,
        claim_documents.claim_id,
        claim_documents.document_id,
        claim_documents.document_type,
        denial_letters.file_name,
        denial_letters.file_url,
        denial_letters.content_processing_progress,
        COALESCE(claim_documents.summary, denial_letters.summary) AS summary
    FROM claim_documents
    JOIN denial_letters ON claim_documents.document_id = denial_letters.id
    WHERE claim_documents.document_type = 'denial_letter'
    UNION
    SELECT
        claim_documents.user_id,
        claim_documents.claim_id,
        claim_documents.document_id,
        claim_documents.document_type,
        medical_records.file_name,
        medical_records.file_url,
        medical_records.content_processing_progress,
        claim_documents.summary
    FROM claim_documents
    JOIN medical_records ON claim_documents.document_id = medical_records.id
    WHERE claim_documents.document_type = 'medical_record'
);

ALTER TABLE "public"."medical_records"
  DROP COLUMN "template_id",
  DROP COLUMN "content_embedding_progress",
  DROP COLUMN "textract_job_id";

-- Remove the template_id column from the page_summaries table
ALTER TABLE "public"."page_summaries"
  DROP COLUMN "template_id";

-- Drop the input_templates table
DROP TABLE "public"."input_templates";

-- Increment progress function for denial letters
CREATE FUNCTION record_progress ("progress" numeric, "record_id" uuid, "data_type" text) 
RETURNS void 
LANGUAGE "plpgsql"
AS
$$
BEGIN
  IF "data_type" = 'text' THEN
    UPDATE "public"."denial_letters"
    SET "text_processing_progress" = "progress",
        "content_processing_progress" = ("progress" + "table_processing_progress" + "kv_processing_progress") / 3.0
    WHERE "id" = "record_id";
  ELSIF "data_type" = 'table' THEN
    UPDATE "public"."denial_letters"
    SET "table_processing_progress" = "progress",
        "content_processing_progress" = ("text_processing_progress" + "progress" + "kv_processing_progress") / 3.0
    WHERE "id" = "record_id";
  ELSIF "data_type" = 'kv' THEN
    UPDATE "public"."denial_letters"
    SET "kv_processing_progress" = "progress",
        "content_processing_progress" = ("text_processing_progress" + "table_processing_progress" + "progress") / 3.0
    WHERE "id" = "record_id";
  END IF;
END;
$$;

-- Add a denial summary column to the claims table
ALTER TABLE "public"."claims"
ADD COLUMN "denial_summary" text;

-- Create table to store medical record section information

CREATE TABLE "public"."record_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "page_number" "int4" NOT NULL,
    "section_type" "text" NOT NULL,
    "section_number" "int4" NOT NULL,
    "sub_section_number" "int4",
    "relevance" "float4" NOT NULL,
    "analysis" "text" NOT NULL,
    "analysis_embedding" "public"."vector" NOT NULL,
    "left" "float4" NOT NULL,
    "top" "float4" NOT NULL,
    "right" "float4" NOT NULL,
    "bottom" "float4" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."record_sections" OWNER TO "postgres";

ALTER TABLE ONLY "public"."record_sections"
    ADD CONSTRAINT "record_sections_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."record_sections"
    ADD CONSTRAINT "record_sections_record_fkey" FOREIGN KEY ("record_id") REFERENCES "public"."medical_records"("id");

ALTER TABLE ONLY "public"."record_sections"
    ADD CONSTRAINT "record_sections_claim_fkey" FOREIGN KEY ("record_id") REFERENCES "public"."claims"("id");

ALTER TABLE "public"."record_sections" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable ALL for service-role only" 
ON "public"."record_sections" 
TO "service_role" 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Enable read access for anon" 
ON "public"."record_sections"
AS PERMISSIVE FOR SELECT
TO anon
USING (true);

CREATE POLICY "Enable insert access for anon" 
ON "public"."record_sections"
AS PERMISSIVE FOR INSERT
TO anon
WITH CHECK (true);