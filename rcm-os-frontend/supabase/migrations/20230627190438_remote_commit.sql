alter table "public"."document_chats" drop constraint "document_chats_record_fkey";

alter table "public"."document_chats" drop constraint "document_chats_user_fkey";

drop function if exists "public"."document_similarity"(embedding vector, record_id text, match_threshold double precision, match_count integer);

alter table "public"."document_chats" add constraint "document_chats_record_id_fkey" FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE CASCADE not valid;

alter table "public"."document_chats" validate constraint "document_chats_record_id_fkey";

alter table "public"."document_chats" add constraint "document_chats_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) not valid;

alter table "public"."document_chats" validate constraint "document_chats_user_id_fkey";


create policy "Enable delete for service role"
on "storage"."objects"
as permissive
for delete
to public
using (true);


create policy "Give users access to own folder 1jdj3w3_0"
on "storage"."objects"
as permissive
for delete
to public
using (((bucket_id = 'Medical Records'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));


create policy "Give users access to own folder 1jdj3w3_1"
on "storage"."objects"
as permissive
for update
to public
using (((bucket_id = 'Medical Records'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));


create policy "Give users access to own folder 1jdj3w3_2"
on "storage"."objects"
as permissive
for insert
to public
with check (((bucket_id = 'Medical Records'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));


create policy "Give users access to own folder 1jdj3w3_3"
on "storage"."objects"
as permissive
for select
to public
using (((bucket_id = 'Medical Records'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



