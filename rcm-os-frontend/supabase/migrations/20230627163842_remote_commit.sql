CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


drop policy "Enable ALL access for anon" on "public"."page_summaries";

drop policy "Enable insert access for anon" on "public"."page_summaries";

drop policy "Enable read access for anon" on "public"."page_summaries";

alter table "public"."document_chat_history" drop constraint "document_chat_history_chat_fkey";

alter table "public"."document_chat_history" drop constraint "document_chat_history_record_fkey";

alter table "public"."document_chat_history" drop constraint "document_chat_history_user_fkey";

alter table "public"."page_summaries" drop constraint "page_summaries_fkey";

create table "public"."document_chat_citations" (
    "id" uuid not null default gen_random_uuid(),
    "chat_id" uuid not null,
    "record_id" uuid not null,
    "user_id" uuid not null,
    "index" integer not null,
    "type" text not null,
    "page" integer not null,
    "title" text,
    "summary" text,
    "left" numeric not null,
    "top" numeric not null,
    "right" numeric not null,
    "bottom" numeric not null,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."document_chat_citations" enable row level security;

alter table "public"."document_chat_history" drop column "citation_bottom";

alter table "public"."document_chat_history" drop column "citation_left";

alter table "public"."document_chat_history" drop column "citation_page";

alter table "public"."document_chat_history" drop column "citation_right";

alter table "public"."document_chat_history" drop column "citation_top";

CREATE UNIQUE INDEX document_chat_citations_pkey ON public.document_chat_citations USING btree (id);

alter table "public"."document_chat_citations" add constraint "document_chat_citations_pkey" PRIMARY KEY using index "document_chat_citations_pkey";

alter table "public"."document_chat_citations" add constraint "document_chat_citations_chat_id_fkey" FOREIGN KEY (chat_id) REFERENCES document_chats(id) ON DELETE CASCADE not valid;

alter table "public"."document_chat_citations" validate constraint "document_chat_citations_chat_id_fkey";

alter table "public"."document_chat_citations" add constraint "document_chat_citations_record_id_fkey" FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE CASCADE not valid;

alter table "public"."document_chat_citations" validate constraint "document_chat_citations_record_id_fkey";

alter table "public"."document_chat_citations" add constraint "document_chat_citations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE not valid;

alter table "public"."document_chat_citations" validate constraint "document_chat_citations_user_id_fkey";

alter table "public"."document_chat_history" add constraint "document_chat_history_chat_id_fkey" FOREIGN KEY (chat_id) REFERENCES document_chats(id) not valid;

alter table "public"."document_chat_history" validate constraint "document_chat_history_chat_id_fkey";

alter table "public"."document_chat_history" add constraint "document_chat_history_record_id_fkey" FOREIGN KEY (record_id) REFERENCES medical_records(id) not valid;

alter table "public"."document_chat_history" validate constraint "document_chat_history_record_id_fkey";

alter table "public"."document_chat_history" add constraint "document_chat_history_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) not valid;

alter table "public"."document_chat_history" validate constraint "document_chat_history_user_id_fkey";

alter table "public"."page_summaries" add constraint "page_summaries_record_id_fkey" FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE CASCADE not valid;

alter table "public"."page_summaries" validate constraint "page_summaries_record_id_fkey";

create policy "Enable CRUD for authenticated users"
on "public"."document_chat_citations"
as permissive
for all
to authenticated
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));


create policy "Enable insert for anon"
on "public"."document_chat_citations"
as permissive
for insert
to anon
with check (true);


create policy "Enable insert for anon"
on "public"."document_chat_history"
as permissive
for insert
to anon
with check (true);


create policy "Enable delete for authenticated"
on "public"."page_summaries"
as permissive
for delete
to authenticated
using (true);


create policy "Enable insert access for authenticated and anon"
on "public"."page_summaries"
as permissive
for insert
to authenticated, anon
with check (true);


create policy "Enable read access for authenticated and anon"
on "public"."page_summaries"
as permissive
for select
to authenticated, anon
using (true);



