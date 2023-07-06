create policy "Enable read access for anon"
on "public"."document_chat_citations"
as permissive
for select
to anon
using (true);


create policy "Enable read access for anon"
on "public"."document_chat_history"
as permissive
for select
to anon
using (true);



