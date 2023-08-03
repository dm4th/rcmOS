import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabaseClient.ts';
import { kvMarkdownTableGenerator } from '../_shared/promptTemplates.ts';
import { kvSummaryTemplate } from '../_shared/letterSummaryTemplates.ts';
import { OpenAI } from "https://esm.sh/langchain/llms/openai";
import { LLMChain } from "https://esm.sh/langchain/chains";

const openai_api_key = Deno.env.get("OPENAI_API_KEY");

async function handler(req: Request) {
    // First Check for CORS request
    console.log("New kv request received at ", new Date().toISOString());
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
        console.log(`Processing KV Pairs on Page: ${pageNumber} with ${pageData.length} elements`);

        // Create a new model instance
        const model = new OpenAI({
            openAIApiKey: openai_api_key,
            temperature: 0.1,
            maxTokens: 200,
            frequencyPenalty: 0,
            presencePenalty: 0,
            modelName: "gpt-3.5-turbo",
        });

        // Generate page markdown table string 
        const markdownHeaders = ["Key", "Value", "Confidence", "Left", "Top", "Right", "Bottom"];
        interface Block {
            key: string;
            value: string;
            confidence: number;
            left: number;
            top: number;
            right: number;
            bottom: number;
        }
        // Generate array of arrays for the markdown table
        // One inner array for the top of the page, one for the middle, and one for the bottom
        const markdownArrayTemp = pageData.map((block: Block) => {
            return {
                key: block.key,
                value: block.value,
                confidence: block.confidence,
                left: block.left,
                top: block.top,
                right: block.right,
                bottom: block.bottom,
            };
        });
        const markdownArray = [
            markdownArrayTemp.filter((block: Block) => (block.top + block.bottom) / 2.0 <= 0.33),
            markdownArrayTemp.filter((block: Block) => (block.top + block.bottom) / 2.0 > 0.33 && (block.top + block.bottom) / 2.0 <= 0.66),
            markdownArrayTemp.filter((block: Block) => (block.top + block.bottom) / 2.0 > 0.66),
        ];

        // Loop over the markdownArray and generate a summary and title for each form section using the LLM
        // Then embed each summary and add to an array to push all rows at once to the database
        const insertRows = [];
        const kvPromises = [];
        const kvCoords = [];

        for (let i = 0; i < markdownArray.length; i++) {
            // skip empty sections
            if (markdownArray[i].length === 0) {
                continue;
            }
            const kvMarkdownArray = kvMarkdownTableGenerator(markdownHeaders, markdownArray[i]);

            // Loop over page section markdown tables and generate a summary and title for each section
            // add them to insertRows array when finished

            for (let j = 0; j < kvMarkdownArray.length; j++) {
                // push coordinates to kvCoords array
                kvCoords.push({
                    "left": kvMarkdownArray[j].left,
                    "top": kvMarkdownArray[j].top,
                    "right": kvMarkdownArray[j].right,
                    "bottom": kvMarkdownArray[j].bottom,
                });

                // Generate the prompt for the LLM
                const sectionPrompt = kvSummaryTemplate(pageNumber, i);

                // Create LLM Chain
                const sectionChain = new LLMChain({
                    llm: model,
                    prompt: sectionPrompt,
                });

                // Run the LLM Chain
                kvPromises.push(sectionChain.call({markdownTable: kvMarkdownArray[j].text}));
            }

            // Wait for all the LLM Chains to finish
            const kvResults = await Promise.all(kvPromises);

            // Loop over the results and add them to the insertRows array
            for (let j = 0; j < kvResults.length; j++) {
                const kvCoordinates = kvCoords[j];
                const kvOutputText = kvResults[j].text;

                console.log(`Page ${pageNumber} Section ${i}, ${j}\nOutput:\n${kvOutputText}`);

                // Generate embedding for the form section summary
                const embeddingUrl = "https://api.openai.com/v1/embeddings";
                const embeddingHeaders = {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${openai_api_key}`
                };

                const embeddingBody = JSON.stringify({
                    "input": kvOutputText,
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
                const valid = kvOutputText.split("VALID:")[1].split("REASON:")[0].trim().toLowerCase() === "yes";
                const reason = kvOutputText.split("REASON:")[1].trim();
    
                insertRows.push({
                    "letter_id": letterId,
                    "page_number": pageNumber,
                    "section_type": "table",
                    "section_number": i,
                    "sub_section_number": j,
                    "valid": valid,
                    "reason": reason,
                    "section_embedding": sectionEmbedding,
                    "left": kvCoordinates.left,
                    "top": kvCoordinates.top,
                    "right": kvCoordinates.right,
                    "bottom": kvCoordinates.bottom,
                });
            }
        }
        
        // Write the page summaries to the database
        const { data, error } = await supabaseClient
            .from("page_summaries")
            .insert(insertRows)
            .select();

        if (error) {
            console.log(error);
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