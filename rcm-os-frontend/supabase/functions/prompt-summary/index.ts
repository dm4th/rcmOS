import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabaseClient.ts';
import { letterReSummaryTemplate } from '../_shared/letterSummaryTemplates.ts';
import { OpenAI } from "https://esm.sh/langchain/llms/openai";
import { LLMChain } from "https://esm.sh/langchain/chains";
import { CallbackManager } from "https://esm.sh/langchain/callbacks";

const openai_api_key = Deno.env.get("OPENAI_API_KEY");

async function handler(req: Request) {
    // First Check for CORS request
    console.log("New text request received at ", new Date().toISOString());
    if (req.method === "OPTIONS") {
        console.log("Handling CORS request: ", req.url);
        return new Response(null, {
            status: 204,
            headers: new Headers(corsHeaders),
        });
    } 

    try {
        const { prompt, summary, letterId } = await req.json();
        console.log(`Re-Summarizing letter ${letterId}`);
        console.log(`Prompt:\n${prompt}`);
        console.log(`Summary:\n${summary}`);

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

        // Retrieve claim denial reasons from the database
        const { data: claimDenialReasons, error: claimDenialReasonsError } = await supabaseClient
            .from('letter_sections')
            .select('reason')
            .eq('letter_id', letterId)
            .is('valid', true);
        if (claimDenialReasonsError) {
          throw new Error(claimDenialReasonsError.message);
        }

        const claimDenialReasonsArray = claimDenialReasons.map((reason: any) => `REASON: ${reason.reason}`);

        // Generate prompt for the LLM to summarize the letter
        const letterPrompt = letterReSummaryTemplate(claimDenialReasonsArray, prompt, summary);

        // Create a new model instance & LLM chain with streaming enabled
        const encoder = new TextEncoder();
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();

        const model = new OpenAI({
            openAIApiKey: openai_api_key,
            temperature: 0.1,
            maxTokens: 200,
            frequencyPenalty: 0,
            presencePenalty: 0,
            modelName: "gpt-3.5-turbo",
            streaming: true,
            callbackManager: CallbackManager.fromHandlers({
                handleLLMStart: async () => {
                    await writer.ready;
                    await writer.write(encoder.encode(`data: ${JSON.stringify({ start: true })}\n\n`));
                },
                handleLLMNewToken: async (token) => {
                    await writer.ready;
                    await writer.write(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
                },
                handleLLMEnd: async (output) => {
                    await writer.ready;
                    await writer.close();
                    const summaryText = output.generations[0][0].text;
                    const { error: letterUpdateError } = await supabaseClient
                        .from('claim_documents')
                        .update({ summary: summaryText })
                        .match({'document_id': letterId, 'document_type': 'denial_letter'});
                    if (letterUpdateError) {
                    throw new Error(letterUpdateError.message);
                    }
                },
                handleLLMError: async (error) => {
                    await writer.ready;
                    await writer.abort(error);
                    console.error(error);
                    throw new Error(error);
                }
            })
        });
        const llmChain = new LLMChain({
            llm: model,
            prompt: letterPrompt,
        });

        // Run the LLM Chain - Async operations will be handled in callbacks
        llmChain.call({});
        

        // Return 200 response with the letter summary
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