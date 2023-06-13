import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabaseClient.ts';
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
        console.log("text request received");
        const { lineData, recordId } = await req.json();
        console.log(lineData);
        console.log(recordId);

        const lineText = lineData.text;

        // First pull the page number from the pageData first element
        console.log(`Processing Line: ${lineData.text} on page ${lineData.page_number}`);

        // Generate embedding for the page text
        const embeddingUrl = "https://api.openai.com/v1/embeddings";
        const embeddingHeaders = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openai_api_key}`
        };

        const embeddingBody = JSON.stringify({
            "input": lineText,
            "model": "text-embedding-ada-002",
        });

        // generate embeddings for the text
        // if no data found in the response, skip embedding this line and move on
        let embeddingSuccess = false;
        let textEmbedding;
        while (!embeddingSuccess) {
            const embeddingResponse = await fetch(embeddingUrl, {
                method: "POST",
                headers: embeddingHeaders,
                body: embeddingBody
            });
            const embeddingJson = await embeddingResponse.json();

            if (embeddingJson.data) {
                embeddingSuccess = true;
                textEmbedding = embeddingJson.data[0].embedding;
            }
        }

        // Write the page summaries to the database
        const { data, error } = await supabaseClient
            .from("page_sections")
            .insert({
                "record_id": recordId,
                "page_number": lineData.page_number,
                "text": lineText,
                "embedding": textEmbedding,
                "left": lineData.left,
                "top": lineData.top,
                "right": lineData.left + lineData.width,
                "bottom": lineData.top + lineData.height
            })
            .select();

        if (error) {
            throw new Error(error.message);
        }

        // Return 200 response with the page summary data
        const headers = new Headers(corsHeaders);
        headers.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ data }), {
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