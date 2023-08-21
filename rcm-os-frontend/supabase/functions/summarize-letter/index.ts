import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabaseClient.ts';
import { letterSummaryTemplate } from '../_shared/letterSummaryTemplates.ts';
import { OpenAI } from "https://esm.sh/langchain/llms/openai";
import { LLMChain } from "https://esm.sh/langchain/chains";

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
        const { letterId } = await req.json();
        console.log(`Summarizing letter ${letterId}`);

        // Retrieve claim denial reasons from the database
        const { data: claimDenialReasons, error: claimDenialReasonsError } = await supabaseClient
            .from('letter_sections')
            .select('reason')
            .eq('letter_id', letterId);
        if (claimDenialReasonsError) {
          throw new Error(claimDenialReasonsError.message);
        }

        const claimDenialReasonsArray = claimDenialReasons.map((reason: any) => `REASON: ${reason.reason}`);

        // Generate prompt for the LLM to summarize the letter
        const letterPrompt = letterSummaryTemplate(claimDenialReasonsArray);

        // Create a new model instance & LLM chain
        const model = new OpenAI({
            openAIApiKey: openai_api_key,
            temperature: 0.1,
            frequencyPenalty: 0,
            presencePenalty: 0,
            modelName: "gpt-3.5-turbo-16k",
        });
        const llmChain = new LLMChain({
            llm: model,
            prompt: letterPrompt,
        });

        // Run the LLM Chain
        const { text: letterSummary } = await llmChain.call({});
        console.log(`Letter Summary:\n${letterSummary}`);

        // Update the letter instance in the database with the newly generated summary
        const { error: letterUpdateError } = await supabaseClient
          .from('denial_letters')
          .update({ summary: letterSummary })
          .match({'id': letterId})
        if (letterUpdateError) {
          throw new Error(letterUpdateError.message);
        }

        // Return 200 response with the letter summary
        const headers = new Headers(corsHeaders);
        headers.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ summary: letterSummary }), {
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