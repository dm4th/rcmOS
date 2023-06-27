drop function if exists "public"."document_similarity"(embedding vector, match_threshold double precision, match_count integer);

alter table "public"."document_chat_citations" add column "chat_history_id" uuid not null;

alter table "public"."document_chat_citations" add column "similarity" numeric;

alter table "public"."document_chat_citations" add constraint "document_chat_citations_chat_history_id_fkey" FOREIGN KEY (chat_history_id) REFERENCES document_chat_history(id) ON DELETE CASCADE not valid;

alter table "public"."document_chat_citations" validate constraint "document_chat_citations_chat_history_id_fkey";


