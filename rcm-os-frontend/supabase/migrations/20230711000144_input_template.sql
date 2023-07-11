-- Create Table to store input_templates

CREATE TABLE "public"."input_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "role" "text" NOT NULL,
    "goal" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."input_templates" OWNER TO "postgres";

ALTER TABLE ONLY "public"."input_templates"
    ADD CONSTRAINT "input_templates_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."input_templates"
    ADD CONSTRAINT "input_templates_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."input_templates" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable CRUD for authenticated users only" ON "public"."input_templates" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

GRANT ALL ON TABLE "public"."input_templates" TO "anon";
GRANT ALL ON TABLE "public"."input_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."input_templates" TO "service_role";


-- Change records table to include id of the input template used to create the page summaries

ALTER TABLE "public"."medical_records" ADD COLUMN "template_id" "uuid";

ALTER TABLE "public"."medical_records" ADD CONSTRAINT "medical_records_template_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."input_templates"("id");


-- Change page summaries table to include id of the input template used to create the page summaries

ALTER TABLE "public"."page_summaries" ADD COLUMN "template_id" "uuid";

ALTER TABLE "public"."page_summaries" ADD CONSTRAINT "page_summaries_template_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."input_templates"("id");