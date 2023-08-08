import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabaseClient.ts';
import { textMarkdownTableGenerator } from '../_shared/promptTemplates.ts';
import { textSectionTemplate } from '../_shared/letterSummaryTemplates.ts';
import { commonDataElementsMarkdown } from '../_shared/dataElements.ts';
// import { OpenAI } from "https://esm.sh/langchain/llms/openai";
// import { LLMChain } from "https://esm.sh/langchain/chains";
import { z } from "https://esm.sh/zod";
import { ChatOpenAI} from "https://esm.sh/langchain/chat_models/openai";
import { createExtractionChainFromZod } from "https://esm.sh/langchain/chains";
import { data } from 'autoprefixer';

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
        const { pageData, letterId } = await req.json();

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
        const model = new ChatOpenAI({
            openAIApiKey: openai_api_key,
            temperature: 0.1,
            maxTokens: 200,
            frequencyPenalty: 0,
            presencePenalty: 0,
            modelName: "gpt-3.5-turbo-0613",
        });

        // Create Zod schema for LangChain Function
        const { dataElementsTable, dataElementsMarkdown } = await commonDataElementsMarkdown(["denial_letter", "all"]);
        const outputSchema = z.object({
            relevant: z.boolean(),
            reason: z.string(),
            elements: z.array(z.object({
                field: z.string(),
                summary: z.string(),
                value: z.string(),
            })).optional(),
        });

        // STEP 1: Find Valid Medical Reasons for Claim Denial
        // STEP 2: Check letter sections against common data elements
        // Create async promises to summarize the page markdown using the LLM
        const sectionPromises = [];
        for (let i = 0; i < pageMarkdownArray.length; i++) {
            const sectionPrompt = textSectionTemplate(pageNumber, i, pageMarkdownArray[i].text, dataElementsMarkdown);
            // const dataElementPrompt = textDataTemplate(pageNumber, i);

            // Create LLM Chain
            const sectionChain = new createExtractionChainFromZod(outputSchema, model);

            // Run the LLM Chain
            sectionPromises.push(sectionChain.run(sectionPrompt));
        }

        // Wait for all the page section summaries to be generated
        const sectionResults = await Promise.all(sectionPromises);

        // loop over the page sections, embed the data, and write to the database
        const summaryInsertRows = [];
        const dataElementInsertRows = [];
        for (let i = 0; i < sectionResults.length; i++) {
            console.log(`Page ${pageNumber} Section ${i}\n`);
            console.log(sectionResults[i]);
            const valid = sectionResults[i].valid;
            const reason = sectionResults[i].reason;
            const elements = sectionResults[i].elements;

            // Generate embedding for the page section summary
            const embeddingUrl = "https://api.openai.com/v1/embeddings";
            const embeddingHeaders = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${openai_api_key}`
            };

            const reasonEmbeddingBody = JSON.stringify({
                "input": reason,
                "model": "text-embedding-ada-002",
            });

            // loop until the embedding is generated
            // if embeddingJson.data is undefined, then the embedding is not ready
            let reasonCalculateEmbedding = true;
            let reasonEmbedding;
            while (reasonCalculateEmbedding) {
                const embeddingResponse = await fetch(embeddingUrl, {
                    method: "POST",
                    headers: embeddingHeaders,
                    body: reasonEmbeddingBody
                });
                const embeddingJson = await embeddingResponse.json();
                if (embeddingJson.data) {
                    reasonEmbedding = embeddingJson.data[0].embedding;
                    reasonCalculateEmbedding = false;
                } else {
                    console.log("Embedding not ready yet, waiting 1 second...");
                    console.log(embeddingResponse.status, embeddingResponse.statusText);
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            summaryInsertRows.push({
                "letter_id": letterId,
                "page_number": pageNumber,
                "section_type": "text",
                "section_number": i,
                "valid": valid,
                "reason": reason,
                "section_embedding": reasonEmbedding,
                "left": pageMarkdownArray[i].left,
                "top": pageMarkdownArray[i].top,
                "right": pageMarkdownArray[i].right,
                "bottom": pageMarkdownArray[i].bottom,
            });

            if (elements) {
                for (let e = 0; e < elements.length; e++) {
                    const field = elements[e].field;
                    const summary = elements[e].summary;
                    const value = elements[e].value;

                    const dataElementEmbeddingBody = JSON.stringify({
                        "input": field + ': ' + summary,
                        "model": "text-embedding-ada-002",
                    });

                    // loop until the embedding is generated
                    let dataElementCalculateEmbedding = true;
                    let dataElementEmbedding;
                    while (dataElementCalculateEmbedding) {
                        const embeddingResponse = await fetch(embeddingUrl, {
                            method: "POST",
                            headers: embeddingHeaders,
                            body: dataElementEmbeddingBody
                        });
                        const embeddingJson = await embeddingResponse.json();
                        if (embeddingJson.data) {
                            dataElementEmbedding = embeddingJson.data[0].embedding;
                            dataElementCalculateEmbedding = false;
                        } else {
                            console.log("Embedding not ready yet, waiting 1 second...");
                            console.log(embeddingResponse.status, embeddingResponse.statusText);
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }

                    dataElementInsertRows.push({
                        "letter_id": letterId,
                        "page_number": pageNumber,
                        "section_type": "text",
                        "section_number": i,
                        "field": field,
                        "summary": summary,
                        "value": value,
                        "embedding": dataElementEmbedding,
                        "left": pageMarkdownArray[i].left,
                        "top": pageMarkdownArray[i].top,
                        "right": pageMarkdownArray[i].right,
                        "bottom": pageMarkdownArray[i].bottom,
                    });

                }
            }
        }


        // Write the page summaries to the database
        const { data: summaryData, error: summaryError } = await supabaseClient
            .from("letter_sections")
            .insert(summaryInsertRows)
            .select();
        if (summaryError) {
            throw new Error(summaryError.message);
        }

        // Write the page data elements to the database
        // const { error: dataElementError } = await supabaseClient
        //     .from("data_elements")
        //     .insert(dataElementInsertRows)
        // if (dataElementError) {
        //     throw new Error(dataElementError.message);
        // }

        // Return 200 response with the page summary data
        const headers = new Headers(corsHeaders);
        headers.set("Content-Type", "application/json");
        return new Response(JSON.stringify({ summaryData }), {
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