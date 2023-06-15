import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabaseClient.ts';
import { pageSectionSummaryTemplate, markdownTableGenerator } from '../_shared/promptTemplates.ts';
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
        const { pageData, recordId } = await req.json();

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

        // Loop over each table object in the pageData array and generate a summary and title for each table section using the LLM
        const tableSections = [];
        for (let i = 0; i < pageData.length; i++) {
            const table = pageData[i];
            if (table.confidence < 0.5) continue;
            let tablePrompt = `Table ${i+1} on page ${pageNumber}:\n`;
            if (table.title) tablePrompt += `Title: ${table.title}\n`;
            if (table.footer) tablePrompt += `Footer: ${table.footer}\n`;
            // Round confidence to 4 decimal places
            if (table.confidence) tablePrompt += `Confidence: ${table.confidence.toFixed(4)}\n`;

        // Generate page markdown table array for each table object in the pageData array
        
        interface Cell {
            text: string;
            confidence: number;
            columnIndex: number;
            rowIndex: number;
            columnSpan: number;
            rowSpan: number;
        }
        const markdownArray = pageData.map((cell: Cell) => {
            return [
                cell.text,
                cell.confidence,
                cell.columnIndex,
                cell.rowIndex,
                cell.columnSpan,
                cell.rowSpan,
            ];
        });
        console.log(markdownArray);
        const tableMarkdownArray = markdownTableGenerator(markdownHeaders, markdownArray);
        console.log(tableMarkdownArray);

        // Loop over the page markdown and generate a summary and title for each section using the LLM
        const tableSections = [];
        for (let i = 0; i < pageMarkdownArray.length; i++) {
            const sectionPrompt = pageSectionSummaryTemplate(page, i, pageMarkdownArray[i].text);

            // Create LLM Chain
            const sectionChain = new LLMChain({
                llm: model,
                prompt: sectionPrompt,
            });

            // Run the LLM Chain
            const sectionOutput = await sectionChain.call({});
            const sectionOutputText = sectionOutput.text;

            console.log(`Page ${pageNumber} Section ${i}\nOutput:\n${sectionOutputText}`);

            pageSections.push(sectionOutputText);
        }

        console.log(pageSections);

        // loop over the page sections, embed the summary and write to the database
        const insertRows = [];
        for (let i = 0; i < pageSections.length; i++) {
            // Generate embedding for the page section summary
            const embeddingUrl = "https://api.openai.com/v1/embeddings";
            const embeddingHeaders = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${openai_api_key}`
            };

            const embeddingBody = JSON.stringify({
                "input": pageSections[i],
                "model": "text-embedding-ada-002",
            });

            const embeddingResponse = await fetch(embeddingUrl, {
                method: "POST",
                headers: embeddingHeaders,
                body: embeddingBody
            });
            const embeddingJson = await embeddingResponse.json();
            const summaryEmbedding = embeddingJson.data[0].embedding;

            // Generate the title and summary
            const title = pageSections[i].split("TITLE:")[1].split("SUMMARY:")[0].trim();
            const summary = pageSections[i].split("SUMMARY:")[1].trim();

            insertRows.push({
                "record_id": recordId,
                "page_number": pageNumber,
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