import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabaseClient.ts';
import { pageSectionSummaryTemplate, textMarkdownTableGenerator } from '../_shared/promptTemplates.ts';
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
        const { pageData, recordId, inputTemplate } = await req.json();

        // First pull the page number from the pageData first element
        const pageNumber = pageData[0].page;
        console.log(`Processing Page: ${pageNumber} with ${pageData.length} elements`);

        // Generate page markdown table string - do not send the first element of the pageData array
        const markdownHeaders = ["Text", "Confidence", "Left", "Top", "Width", "Height"];
        interface Block {
            text: string;
            confidence: number;
            left: number;
            top: number;
            width: number;
            height: number;
        }
        const markdownArray = pageData.slice(1).map((block: Block) => {
            return [
                block.text,
                block.confidence,
                block.left,
                block.top,
                block.width,
                block.height,
            ];
        });
        const pageMarkdownArray = textMarkdownTableGenerator(markdownHeaders, markdownArray);

        // Create a new model instance
        const model = new OpenAI({
            openAIApiKey: openai_api_key,
            temperature: 0.1,
            maxTokens: 200,
            frequencyPenalty: 0,
            presencePenalty: 0,
            modelName: "gpt-3.5-turbo",
        });

        // Create async promises to summarize the page markdown using the LLM
        const pagePromises = [];
        for (let i = 0; i < pageMarkdownArray.length; i++) {
            const sectionPrompt = pageSectionSummaryTemplate(pageNumber, i, pageMarkdownArray[i].text, inputTemplate);

            // Create LLM Chain
            const sectionChain = new LLMChain({
                llm: model,
                prompt: sectionPrompt,
            });

            // Run the LLM Chain
            pagePromises.push(sectionChain.call({}));
        }

        // Wait for all the page section summaries to be generated
        const promiseResults = await Promise.all(pagePromises);

        // loop over the page sections, embed the summary and write to the database
        const insertRows = [];
        for (let i = 0; i < promiseResults.length; i++) {
            const sectionOutputText = promiseResults[i].text;
            console.log(`Page ${pageNumber} Section ${i}\nOutput:\n${sectionOutputText}`);

            // Generate embedding for the page section summary
            const embeddingUrl = "https://api.openai.com/v1/embeddings";
            const embeddingHeaders = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${openai_api_key}`
            };

            const embeddingBody = JSON.stringify({
                "input": sectionOutputText,
                "model": "text-embedding-ada-002",
            });

            // loop until the embedding is generated
            // if embeddingJson.data is undefined, then the embedding is not ready
            let calculateEmbedding = true;
            let summaryEmbedding;
            while (calculateEmbedding) {
                const embeddingResponse = await fetch(embeddingUrl, {
                    method: "POST",
                    headers: embeddingHeaders,
                    body: embeddingBody
                });
                const embeddingJson = await embeddingResponse.json();
                if (embeddingJson.data) {
                    summaryEmbedding = embeddingJson.data[0].embedding;
                    calculateEmbedding = false;
                } else {
                    console.log("Embedding not ready yet, waiting 1 second...");
                    console.log(embeddingResponse.status, embeddingResponse.statusText);
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            // Generate the title and summary
            const title = sectionOutputText.split("TITLE:")[1].split("SUMMARY:")[0].trim();
            const summary = sectionOutputText.split("SUMMARY:")[1].trim();

            insertRows.push({
                "record_id": recordId,
                "template_id": inputTemplate.id,
                "page_number": pageNumber,
                "section_type": "text",
                "section_number": i,
                "title": title,
                "summary": summary,
                "summary_embedding": summaryEmbedding,
                "left": pageMarkdownArray[i].left,
                "top": pageMarkdownArray[i].top,
                "right": pageMarkdownArray[i].right,
                "bottom": pageMarkdownArray[i].bottom,
            });
        }

        // Write the page summaries to the database
        const { data, error } = await supabaseClient
            .from("page_summaries")
            .insert(insertRows)
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