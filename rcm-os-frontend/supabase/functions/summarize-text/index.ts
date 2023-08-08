import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabaseClient.ts';
import { textMarkdownTableGenerator } from '../_shared/promptTemplates.ts';
import { textSummaryTemplate, textDataTemplate } from '../_shared/letterSummaryTemplates.ts';
import { commonDataElementsMarkdown } from '../_shared/dataElements.ts';
import { OpenAI } from "https://esm.sh/langchain/llms/openai";
import { LLMChain } from "https://esm.sh/langchain/chains";
// import { ChatOpenAI} from "https://esm.sh/langchain/chat_models/openai";
// import { createExtractionChainFromZod } from "https://esm.sh/langchain/chains";

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
        const model = new OpenAI({
            openAIApiKey: openai_api_key,
            temperature: 0.1,
            maxTokens: 200,
            frequencyPenalty: 0,
            presencePenalty: 0,
            modelName: "gpt-3.5-turbo-0613",
        });

        // Create Zod schema for LangChain Function
        const dataElementMarkdown = await commonDataElementsMarkdown(["denial_letter", "all"]);


        // STEP 1: Find Valid Medical Reasons for Claim Denial
        // STEP 2: Check letter sections against common data elements
        // Create async promises to summarize the page markdown using the LLM
        const summaryPromises = [];
        const dataElementPromises = [];
        for (let i = 0; i < pageMarkdownArray.length; i++) {
            const summaryPrompt = textSummaryTemplate(pageNumber, i);
            const dataElementPrompt = textDataTemplate(pageNumber, i);

            // Create LLM Chain
            const summaryChain = new LLMChain({
                llm: model,
                prompt: summaryPrompt,
            });
            const dataElementChain = new LLMChain({
                llm: model,
                prompt: dataElementPrompt,
            });

            // Run the LLM Chain
            summaryPromises.push(summaryChain.call({markdownTable: pageMarkdownArray[i].text}));
            dataElementPromises.push(dataElementChain.call({markdownTable: pageMarkdownArray[i].text, dataElementMarkdown: dataElementMarkdown}));
        }

        // Wait for all the page section summaries to be generated
        const summaryResults = await Promise.all(summaryPromises);
        const dataElementResults = await Promise.all(dataElementPromises);

        // loop over the page sections, embed the data, and write to the database
        const summaryInsertRows = [];
        for (let i = 0; i < summaryResults.length; i++) {
            const sectionOutputText = summaryResults[i].text;
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
            let sectionEmbedding;
            while (calculateEmbedding) {
                const embeddingResponse = await fetch(embeddingUrl, {
                    method: "POST",
                    headers: embeddingHeaders,
                    body: embeddingBody
                });
                const embeddingJson = await embeddingResponse.json();
                if (embeddingJson.data) {
                    sectionEmbedding = embeddingJson.data[0].embedding;
                    calculateEmbedding = false;
                } else {
                    console.log("Embedding not ready yet, waiting 1 second...");
                    console.log(embeddingResponse.status, embeddingResponse.statusText);
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            // Generate the validity and reason for the page section summary
            const valid = sectionOutputText.split("VALID:")[1].split("REASON:")[0].trim().toLowerCase() === "yes";
            const reason = sectionOutputText.split("REASON:")[1].trim();

            summaryInsertRows.push({
                "letter_id": letterId,
                "page_number": pageNumber,
                "section_type": "text",
                "section_number": i,
                "valid": valid,
                "reason": reason,
                "section_embedding": sectionEmbedding,
                "left": pageMarkdownArray[i].left,
                "top": pageMarkdownArray[i].top,
                "right": pageMarkdownArray[i].right,
                "bottom": pageMarkdownArray[i].bottom,
            });
        }

        // loop over the page sections, embed the data, and write to the database
        const dataElementInsertRows = [];
        for (let i = 0; i < dataElementResults.length; i++) {
            const sectionOutputText = dataElementResults[i].text;
            console.log(`Page ${pageNumber} Section ${i}\nOutput:\n${sectionOutputText}`);
            if (sectionOutputText.includes("NONE")) {
                continue;
            }

            // Need to check the text for multiple instances of FIELD
            const fieldArray = sectionOutputText.split("FIELD:");
            const summaryArray = sectionOutputText.split("SUMMARY:");
            const fieldSummaryArray = [];
            for (let j = 0; j < fieldArray.length; j++) {
                const field = fieldArray[j].split("SUMMARY:")[0].trim();
                const summary = summaryArray[j].trim();
                fieldSummaryArray.push({
                    "field": field,
                    "summary": summary,
                });
            }

            // Generate embedding for the each data element pairing
            const embeddingUrl = "https://api.openai.com/v1/embeddings";
            const embeddingHeaders = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${openai_api_key}`
            };

            for (let j = 0; j < fieldSummaryArray.length; j++) {
                const embeddingBody = JSON.stringify({
                    "input": fieldSummaryArray[j].field + ': ' + fieldSummaryArray[j].summary,
                    "model": "text-embedding-ada-002",
                });

                // loop until the embedding is generated
                // if embeddingJson.data is undefined, then the embedding is not ready
                let calculateEmbedding = true;
                let sectionEmbedding;
                while (calculateEmbedding) {
                    const embeddingResponse = await fetch(embeddingUrl, {
                        method: "POST",
                        headers: embeddingHeaders,
                        body: embeddingBody
                    });
                    const embeddingJson = await embeddingResponse.json();
                    if (embeddingJson.data) {
                        sectionEmbedding = embeddingJson.data[0].embedding;
                        calculateEmbedding = false;
                    } else {
                        console.log("Embedding not ready yet, waiting 1 second...");
                        console.log(embeddingResponse.status, embeddingResponse.statusText);
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
                fieldSummaryArray[j].embedding = sectionEmbedding;

                dataElementInsertRows.push({
                    "letter_id": letterId,
                    "page_number": pageNumber,
                    "section_type": "text",
                    "section_number": i,
                    "field": fieldSummaryArray[j].field,
                    "summary": fieldSummaryArray[j].summary,
                    "embedding": fieldSummaryArray[j].embedding,
                    "left": pageMarkdownArray[i].left,
                    "top": pageMarkdownArray[i].top,
                    "right": pageMarkdownArray[i].right,
                    "bottom": pageMarkdownArray[i].bottom,
                });
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
        const { error: dataElementError } = await supabaseClient
            .from("data_elements")
            .insert(dataElementInsertRows)
        if (dataElementError) {
            throw new Error(dataElementError.message);
        }

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