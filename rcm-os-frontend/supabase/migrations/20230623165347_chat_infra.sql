-- Create Public Users table

CREATE TABLE "public"."profiles" (
    "id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text" NOT NULL
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone." ON "public"."profiles" FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile." ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));

CREATE POLICY "Users can update own profile." ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));

GRANT ALL ON TABLE "public"."profiles" TO "anon";

GRANT ALL ON TABLE "public"."profiles" TO "authenticated";

GRANT ALL ON TABLE "public"."profiles" TO "service_role";

-- Database function and associated trigger to handle user creation in the public profiles table

CREATE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

CREATE TRIGGER "on_auth_user_created"
    AFTER INSERT ON "auth"."users"
    FOR EACH ROW
    EXECUTE PROCEDURE "public"."handle_new_user"();

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";


-- Create Table to store document chats

CREATE TABLE "public"."document_chats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "record_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."document_chats" OWNER TO "postgres";

ALTER TABLE ONLY "public"."document_chats"
    ADD CONSTRAINT "document_chats_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."document_chats"
    ADD CONSTRAINT "document_chats_record_fkey" FOREIGN KEY ("record_id") REFERENCES "public"."medical_records"("id");

ALTER TABLE ONLY "public"."document_chats"
    ADD CONSTRAINT "document_chats_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."document_chats" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable CRUD for authenticated users only" ON "public"."document_chats" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

GRANT ALL ON TABLE "public"."document_chats" TO "anon";
GRANT ALL ON TABLE "public"."document_chats" TO "authenticated";
GRANT ALL ON TABLE "public"."document_chats" TO "service_role";

-- Create Table to store document chat history

CREATE TABLE "public"."document_chat_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chat_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "prompt" "text" NOT NULL,
    "response" "text" NOT NULL,
    "citation_page" "int4",
    "citation_left" "int4",
    "citation_top" "int4",
    "citation_right" "int4",
    "citation_bottom" "int4",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."document_chat_history" OWNER TO "postgres";

ALTER TABLE ONLY "public"."document_chat_history"
    ADD CONSTRAINT "document_chat_history_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."document_chat_history"
    ADD CONSTRAINT "document_chat_history_chat_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."document_chats"("id");

ALTER TABLE ONLY "public"."document_chat_history"
    ADD CONSTRAINT "document_chat_history_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."document_chat_history"
    ADD CONSTRAINT "document_chat_history_record_fkey" FOREIGN KEY ("record_id") REFERENCES "public"."medical_records"("id");

ALTER TABLE "public"."document_chat_history" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable CRUD for authenticated users only" ON "public"."document_chat_history" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

GRANT ALL ON TABLE "public"."document_chat_history" TO "anon";
GRANT ALL ON TABLE "public"."document_chat_history" TO "authenticated";
GRANT ALL ON TABLE "public"."document_chat_history" TO "service_role";

-- Change records table to include id of the user that uploaded the record

ALTER TABLE "public"."medical_records" ADD COLUMN "user_id" "uuid" NOT NULL;

ALTER TABLE "public"."medical_records" ADD CONSTRAINT "medical_records_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

-- Remove current row level security policies for the records table

CREATE POLICY "Enable CRUD for authenticated users only" ON "public"."medical_records" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

GRANT ALL ON TABLE "public"."medical_records" TO "anon";
GRANT ALL ON TABLE "public"."medical_records" TO "authenticated";
GRANT ALL ON TABLE "public"."medical_records" TO "service_role";

-- Create policies for storage upload and read for authenticated users

CREATE POLICY "Authenticated to Upload Read Medical Records" 
ON storage.objects for INSERT
TO authenticated
WITH CHECK ( bucket_id = 'records' AND auth.uid() IS NOT NULL );

CREATE POLICY "Authenticated to Read Medical Records"
ON storage.objects for SELECT
TO authenticated
USING ( bucket_id = 'records' AND auth.uid() = SPLIT_PART(name, '/', 1)::uuid);

