CREATE POLICY "Enable ALL access for anon" 
ON "public"."page_summaries"
TO anon
USING (true)
WITH CHECK (true);