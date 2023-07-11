import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabaseClient.ts';
import { tableSectionSummaryTemplate, tableMarkdownTableGenerator } from '../_shared/promptTemplates.ts';
import { OpenAI } from "https://esm.sh/langchain/llms/openai";
import { LLMChain } from "https://esm.sh/langchain/chains";

const TABLE_SUMMARY_CONFIDENCE_THRESHOLD = 0.5;

const openai_api_key = Deno.env.get("OPENAI_API_KEY");

async function handler(req: Request) {
    // First Check for CORS request
    console.log("New table request received at ", new Date().toISOString());
    if (req.method === "OPTIONS") {
        console.log("Handling CORS request: ", req.url);
        return new Response(null, {
            status: 204,
            headers: new Headers(corsHeaders),
        });
    } 

    try {
        const { pageData, recordId, inputTemplate } = await req.json();

        // Create table level constants
        const pageNumber = pageData[0].page;
        const markdownHeaders = ["Text", "Confidence", "Column Index", "Row Index", "Column Span", "Row Span"];

        // Create a new model instance
        const model = new OpenAI({
            openAIApiKey: openai_api_key,
            temperature: 0.1,
            maxTokens: 200,
            frequencyPenalty: 0,
            presencePenalty: 0,
            modelName: "gpt-3.5-turbo",
        });

        // Create insertRows array to store the new rows to be inserted into the database and tablePromises array to hold LLM summary async promises
        const insertRows = [];
        const tablePromises = [];

        // Loop over each table object in the pageData array and generate a summary and title for each table section using the LLM
        for (let i = 0; i < pageData.length; i++) {
            const table = pageData[i];

            // Skip tables with low confidence
            if (table.confidence < TABLE_SUMMARY_CONFIDENCE_THRESHOLD) continue;

            let tablePrompt = `Description: Table ${i+1} on page ${pageNumber}:\n`;
            if (table.title) tablePrompt += `Title: ${table.title} - Title of the Table\n`;
            if (table.footer) tablePrompt += `Footer: ${table.footer} - Footer text at the bottom of the table\n`;
            // Round confidence to 4 decimal places
            if (table.confidence) tablePrompt += `Confidence: ${table.confidence.toFixed(4).toString()} - Confidence in the accuracy of the data pulled using machine learning\n`;
            if (table.left) tablePrompt += `Left: ${table.left.toFixed(4).toString()} - Left-most position of the table on the page it was pulled from, with 0 being the left edge of the page and 100 being the right edge.\n`;
            if (table.top) tablePrompt += `Top: ${table.top.toFixed(4).toString()} - Top-most position of the table on the page it was pulled from, with 0 being the top edge of the page and 100 being the bottom edge.\n`;
            if (table.right) tablePrompt += `Right: ${table.right.toFixed(4).toString()} - Right-most position of the table on the page it was pulled from\n`;
            if (table.bottom) tablePrompt += `Bottom: ${table.bottom.toFixed(4).toString()} - Bottom-most position of the table on the page it was pulled from\n`;

            // Generate a markdown table describing the cells in the table
            const tableMarkdownArray = tableMarkdownTableGenerator(markdownHeaders, table.cells, tablePrompt);

            // Loop over table sections and generate a summary for each
            for (let j = 0; j < tableMarkdownArray.length; j++) {
                const tableSectionPrompt = tableSectionSummaryTemplate(tablePrompt, j, tableMarkdownArray[j], inputTemplate);

                // Create LLM Chain
                const llmChain = new LLMChain({
                    llm: model,
                    prompt: tableSectionPrompt,
                });

                // Add LLM Chain Run to Promises Array
                tablePromises.push(llmChain.call({}));
            }

            // Retrieve the LLM summarization results
            const tableSummaries = await Promise.all(tablePromises);

            // loop over the table sections, embed the summary and write to the database
            for (let j = 0; j < tableSummaries.length; j++) {
                const tableSummaryText = tableSummaries[j].text;
                console.log(`Page ${pageNumber} Table ${i} Section ${j}\nOutput:\n${tableSummaryText}`);

                // Generate embedding for the table section summary
                const embeddingUrl = "https://api.openai.com/v1/embeddings";
                const embeddingHeaders = {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${openai_api_key}`
                };

                const embeddingBody = JSON.stringify({
                    "input": tableSummaryText,
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
                const title = tableSummaryText.split("TITLE:")[1].split("SUMMARY:")[0].trim();
                const summary = tableSummaryText.split("SUMMARY:")[1].trim();

                insertRows.push({
                    "record_id": recordId,
                    "template_id": inputTemplate.id,
                    "page_number": pageNumber,
                    "section_type": "table",
                    "section_number": i,
                    "sub_section_number": j,
                    "title": title,
                    "summary": summary,
                    "summary_embedding": summaryEmbedding,
                    "left": table.left,
                    "top": table.top,
                    "right": table.right,
                    "bottom": table.bottom,
                });
            }
        }

        // Write the table summaries to the database
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