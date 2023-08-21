ALTER TABLE "public"."record_sections"
  DROP CONSTRAINT "record_sections_claim_fkey";

ALTER TABLE ONLY "public"."record_sections"
    ADD CONSTRAINT "record_sections_claim_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id");