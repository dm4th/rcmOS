-- Create PDF storage bucket for denial letters
INSERT INTO storage.buckets (id, name)
VALUES ('letters', 'Denial Letters');

CREATE POLICY "Anon to Read Denial Letters"
ON storage.objects for SELECT
TO anon
USING ( bucket_id = 'letters' );

CREATE POLICY "Anon to Write Denial Letters"
ON storage.objects for INSERT
TO anon
WITH CHECK ( bucket_id = 'letters' );

CREATE POLICY "Enable Delete for Service Role on Denial Letters"
ON "storage"."objects"
AS PERMISSIVE
FOR DELETE
TO PUBLIC
USING (true);

CREATE POLICY "Give users access to delete their own denial letters"
ON "storage"."objects"
AS PERMISSIVE
FOR DELETE
TO PUBLIC
USING (((bucket_id = 'Denial Letters'::text) AND ((auth.uid())::text = (storage.foldername(name))[0])));

CREATE POLICY "Give users access to update their own denial letters"
ON "storage"."objects"
AS PERMISSIVE
FOR UPDATE
TO PUBLIC
USING (((bucket_id = 'Denial Letters'::text) AND ((auth.uid())::text = (storage.foldername(name))[0])));

CREATE POLICY "Give users access to create their own denial letters"
ON "storage"."objects"
AS PERMISSIVE
FOR INSERT
TO PUBLIC
WITH CHECK (((bucket_id = 'Denial Letters'::text) AND ((auth.uid())::text = (storage.foldername(name))[0])));

CREATE POLICY "Give users access to read their own denial letters"
ON "storage"."objects"
AS PERMISSIVE
FOR SELECT
TO PUBLIC
USING (((bucket_id = 'Denial Letters'::text) AND ((auth.uid())::text = (storage.foldername(name))[0])));

CREATE POLICY "Authenticated to Upload Denial Letters" 
ON storage.objects for INSERT
TO authenticated
WITH CHECK ( bucket_id = 'letters' AND auth.uid() IS NOT NULL );

CREATE POLICY "Authenticated to Read Denial Letters"
ON storage.objects for SELECT
TO authenticated
USING ( bucket_id = 'letters' AND auth.uid() = SPLIT_PART(name, '/', 1)::uuid);

-- Create table to store denial letter information

CREATE TABLE "public"."denial_letters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "summary" "text",
    "content_processing_progress" "numeric" NOT NULL,
    "content_processing_type" "text" NOT NULL,
    "content_processing_id" "text",
    "text_processing_progress" "numeric" NOT NULL,
    "table_processing_progress" "numeric" NOT NULL,
    "kv_processing_progress" "numeric" NOT NULL,
    "summary_processing_progress" "numeric" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."denial_letters" OWNER TO "postgres";

ALTER TABLE ONLY "public"."denial_letters"
    ADD CONSTRAINT "denial_letters_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."denial_letters"
    ADD CONSTRAINT "denial_letters_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."denial_letters" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable ALL for service-role only" 
ON "public"."denial_letters" 
TO "service_role" 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Enable read access for anon" 
ON "public"."denial_letters"
AS PERMISSIVE FOR SELECT
TO anon
USING (true);

CREATE POLICY "Enable update access for anon" 
ON "public"."denial_letters"
AS PERMISSIVE FOR UPDATE
TO anon
USING (true);

CREATE POLICY "Enable insert access for anon" 
ON "public"."denial_letters"
AS PERMISSIVE FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Enable CRUD for authenticated users only" 
ON "public"."denial_letters" 
TO "authenticated" 
USING (("auth"."uid"() = "user_id")) 
WITH CHECK (("auth"."uid"() = "user_id"));

-- Increment progress function for denial letters
CREATE FUNCTION letter_progress ("progress" numeric, "letter_id" uuid, "data_type" text) 
RETURNS void 
LANGUAGE "plpgsql"
AS
$$
BEGIN
  IF "data_type" = 'text' THEN
    UPDATE "public"."denial_letters"
    SET "text_processing_progress" = "progress",
        "content_processing_progress" = ("progress" + "table_processing_progress" + "kv_processing_progress" + "summary_processing_progress") / 4.0
    WHERE "id" = "letter_id";
  ELSIF "data_type" = 'table' THEN
    UPDATE "public"."denial_letters"
    SET "table_processing_progress" = "progress",
        "content_processing_progress" = ("text_processing_progress" + "progress" + "kv_processing_progress" + "summary_processing_progress") / 4.0
    WHERE "id" = "letter_id";
  ELSIF "data_type" = 'kv' THEN
    UPDATE "public"."denial_letters"
    SET "kv_processing_progress" = "progress",
        "content_processing_progress" = ("text_processing_progress" + "table_processing_progress" + "progress" + "summary_processing_progress") / 4.0
    WHERE "id" = "letter_id";
  ELSIF "data_type" = 'summary' THEN
    UPDATE "public"."denial_letters"
    SET "summary_processing_progress" = "progress",
        "content_processing_progress" = ("text_processing_progress" + "table_processing_progress" + "kv_processing_progress" + "progress") / 4.0
    WHERE "id" = "letter_id";
  END IF;
END;
$$;

-- Create table to store denial letter section information

CREATE TABLE "public"."letter_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "letter_id" "uuid" NOT NULL,
    "page_number" "int4" NOT NULL,
    "section_type" "text" NOT NULL,
    "section_number" "int4" NOT NULL,
    "sub_section_number" "int4",
    "reason" "text" NOT NULL,
    "section_embedding" "public"."vector" NOT NULL,
    "left" "float4" NOT NULL,
    "top" "float4" NOT NULL,
    "right" "float4" NOT NULL,
    "bottom" "float4" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."letter_sections" OWNER TO "postgres";

ALTER TABLE ONLY "public"."letter_sections"
    ADD CONSTRAINT "letter_sections_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."letter_sections"
    ADD CONSTRAINT "letter_sections_fkey" FOREIGN KEY ("letter_id") REFERENCES "public"."denial_letters"("id");

ALTER TABLE "public"."letter_sections" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable ALL for service-role only" 
ON "public"."letter_sections" 
TO "service_role" 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Enable read access for anon" 
ON "public"."letter_sections"
AS PERMISSIVE FOR SELECT
TO anon
USING (true);

CREATE POLICY "Enable insert access for anon" 
ON "public"."letter_sections"
AS PERMISSIVE FOR INSERT
TO anon
WITH CHECK (true);

-- Create Table to store claim information

CREATE TABLE "public"."claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."claims" OWNER TO "postgres";

ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."claims"
    ADD CONSTRAINT "claims_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."claims" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable CRUD for authenticated users only" ON "public"."claims" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Enable read access for anon" 
ON "public"."claims"
AS PERMISSIVE FOR SELECT
TO anon
USING (true);

CREATE POLICY "Enable update access for anon" 
ON "public"."claims"
AS PERMISSIVE FOR UPDATE
TO anon
USING (true);

CREATE POLICY "Enable insert access for anon" 
ON "public"."claims"
AS PERMISSIVE FOR INSERT
TO anon
WITH CHECK (true);

GRANT ALL ON TABLE "public"."claims" TO "anon";
GRANT ALL ON TABLE "public"."claims" TO "authenticated";
GRANT ALL ON TABLE "public"."claims" TO "service_role";

-- Create table to store claim <--> document relationships

CREATE TABLE "public"."claim_documents" (
    "user_id" "uuid" NOT NULL,
    "claim_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "summary" "text"
);

ALTER TABLE "public"."claim_documents" OWNER TO "postgres";

ALTER TABLE ONLY "public"."claim_documents"
    ADD CONSTRAINT "claim_documents_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."claim_documents"
    ADD CONSTRAINT "claim_documents_claim_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id");

ALTER TABLE "public"."claim_documents" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable CRUD for authenticated users only" ON "public"."claim_documents" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Enable ALL for service-role only" 
ON "public"."claim_documents" 
TO "service_role" 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Enable read access for anon" 
ON "public"."claim_documents"
AS PERMISSIVE FOR SELECT
TO anon
USING (true);

CREATE POLICY "Enable update access for anon" 
ON "public"."claim_documents"
AS PERMISSIVE FOR UPDATE
TO anon
USING (true);

CREATE POLICY "Enable insert access for anon" 
ON "public"."claim_documents"
AS PERMISSIVE FOR INSERT
TO anon
WITH CHECK (true);

GRANT ALL ON TABLE "public"."claim_documents" TO "anon";
GRANT ALL ON TABLE "public"."claim_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."claim_documents" TO "service_role";

-- Create a view to more easily query claim document information

CREATE VIEW "public"."claim_document_view" AS (
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
        medical_records.content_embedding_progress AS content_processing_progress,
        claim_documents.summary
    FROM claim_documents
    JOIN medical_records ON claim_documents.document_id = medical_records.id
    WHERE claim_documents.document_type = 'medical_record'
);