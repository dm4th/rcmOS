import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabaseClient.ts';
import { chatRolePrompt, chatHistoryTemplate, documentCitationTemplate, humanMessageTemplate } from '../_shared/promptTemplates.ts';
import { ChatOpenAI } from "https://esm.sh/langchain/chat_models/openai";
import { ConversationChain } from "https://esm.sh/langchain/chains";
import { ChatPromptTemplate } from "https://esm.sh/langchain/prompts";
import { CallbackManager } from "https://esm.sh/langchain/callbacks";

const openai_api_key = Deno.env.get("OPENAI_API_KEY");

async function handler(req: Request) {
    // First Check for CORS request
    console.log("New request received at ", new Date().toISOString());
    if (req.method === "OPTIONS") {
        console.log("Handling CORS request: ", req.url);
        return new Response(null, {
            status: 204,
            headers: new Headers(corsHeaders),
        });
    } 

    try {
        const { prompt: promptInit, chat_id, record_id, input_template, user_id } = await req.json();
        const prompt = promptInit.trim();
        console.log("Prompt: ", prompt);
        console.log("Chat ID: ", chat_id);
        console.log("Record ID: ", record_id);
        console.log(input_template);
        console.log("User ID: ", user_id);

        // check that the prompt passes openAi moderation checks
        const moderationUrl = "https://api.openai.com/v1/moderations";
        const moderationHeaders = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openai_api_key}`
        };
        const moderationBody = JSON.stringify({
            "input": prompt,
        });
        const moderationResponse = await fetch(moderationUrl, {
            method: "POST",
            headers: moderationHeaders,
            body: moderationBody
        });
        if (moderationResponse.status !== 200) {
            throw new Error("Failed to check prompt against moderation");
        }
        const moderationJson = await moderationResponse.json();
        const [ moderationResults ] = moderationJson.results;
        if (moderationResults.flagged) {
            throw new Error("Prompt failed moderation checks");
        }
        console.log("Prompt passed moderation checks");

        // generate embedding for the user prompt
        const embeddingUrl = "https://api.openai.com/v1/embeddings";
        const embeddingHeaders = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openai_api_key}`
        };
        const embeddingBody = JSON.stringify({
            "input": prompt,
            "model": "text-embedding-ada-002",
        });
        const embeddingResponse = await fetch(embeddingUrl, {
            method: "POST",
            headers: embeddingHeaders,
            body: embeddingBody
        });
        if (embeddingResponse.status !== 200) {
            throw new Error("Failed to generate prompt embeddings");
        }
        const embeddingJson = await embeddingResponse.json();
        const promptEmbedding = embeddingJson.data[0].embedding;

        // find similarities to stored document summaries
        const { data: matchData, error: matchError } = await supabaseClient.rpc(
            "document_similarity", 
            { 
                embedding: promptEmbedding,
                record_id: record_id,
                match_threshold: 0.60,
                match_count: 3,
            });
        if (matchError) {
            console.error(matchError);
            throw new Error("Failed to match prompt embedding");
        }
        console.log(matchData);

        interface Citation {
            type: string;
            page: number;
            title: string;
            summary: string;
            left: number;
            top: number;
            right: number;
            bottom: number;
            similarity: number;
        }
        let citations: Citation[] = [];
        if (matchData.length > 0) {
            const citationMaxSimilarity = matchData[0].similarity;
            citations = matchData.filter((c: Citation) => c.similarity >= citationMaxSimilarity- 0.02);
        }
        console.log(citations);

        // retrieve chat history
        const { data: chatHistory, error: chatHistoryError } = await supabaseClient
            .from("document_chat_history")
            .select("prompt, response")
            .eq("chat_id", chat_id)
            .order("created_at", { ascending: false });
        if (chatHistoryError) {
            throw chatHistoryError;
        }



        const chatPromptTemplate = ChatPromptTemplate.fromPromptMessages([
            chatRolePrompt(input_template),
            chatHistoryTemplate(chatHistory),
            documentCitationTemplate(citations),
            humanMessageTemplate,
        ]);

        // convert the LLM callback events into SSE events
        const encoder = new TextEncoder();
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();

        const chat_model = new ChatOpenAI({
            openAIApiKey: openai_api_key,
            temperature: 0.1,
            maxTokens: 1000,
            modelName: "gpt-3.5-turbo",
            streaming: true,
            callbackManager: CallbackManager.fromHandlers({
                handleLLMNewToken: async (token: string) => {
                    await writer.ready;
                    await writer.write(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
                },
                handleLLMEnd: async (output: Any) => {
                    // update chat history for this chat id
                    const out_text = output.generations[0][0].text;
                    const { data: historyWriteData, error: historyWriteError } = await supabaseClient
                        .from("document_chat_history")
                        .insert([{ 
                            chat_id: chat_id, 
                            user_id: user_id, 
                            record_id: record_id, 
                            prompt: prompt, 
                            response: out_text 
                        }])
                        .select();
                    if (historyWriteError) {
                        console.error(historyWriteError);
                    }
                    const history_id = historyWriteData[0].id;

                    // write history_id out to SSE stream
                    await writer.ready;
                    await writer.write(encoder.encode(`data: ${JSON.stringify({ history_id })}\n\n`));
                    await writer.ready;
                    await writer.close();

                    // update document citations for this chat message
                    const citationInsertRows = citations.map((c: Citation, i: number) => {
                        return {
                            chat_id: chat_id,
                            record_id: record_id,
                            user_id: user_id,
                            index: i,
                            type: c.type,
                            page: c.page,
                            title: c.title,
                            summary: c.summary,
                            left: c.left,
                            top: c.top,
                            right: c.right,
                            bottom: c.bottom,
                            similarity: c.similarity,
                            chat_history_id: history_id,
                        };
                    });
                    const { error: citationWriteError } = await supabaseClient
                        .from("document_chat_citations")
                        .insert(citationInsertRows);
                    if (citationWriteError) {
                        console.error(citationWriteError);
                    }
                },
                handleLLMError: async (error) => {
                    await writer.ready;
                    await writer.abort(error);
                }
            })
        });

        const conversationChain = new ConversationChain({ 
            prompt: chatPromptTemplate, 
            llm: chat_model
        });

        // We don't need to wait for the response to be fully generated
        // because we can utilize the handleLLMCallback to close the stream
        conversationChain.call({ human_prompt: prompt }).catch((error) => console.error(error));

        const headers = new Headers(corsHeaders);
        headers.set("Content-Type", "text/event-stream");
        headers.set("Cache-Control", "no-cache");
        headers.set("Connection", "keep-alive");

        return new Response(stream.readable, {
            status: 200,
            headers: headers
        });

    } catch (error) {
        console.error(error);
        const headers = new Headers(corsHeaders);
        headers.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: headers
        });
    }
}

const server = serve(handler);