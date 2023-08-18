import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabaseClient.ts';
import { tableMarkdownTableGenerator } from '../_shared/promptTemplates.ts';
import { tableSectionTemplate } from '../_shared/letterSummaryTemplates.ts';
import { commonDataElementsMarkdown } from '../_shared/dataElements.ts';
import { z } from "https://esm.sh/zod";
import { ChatOpenAI } from "https://esm.sh/langchain/chat_models/openai";
import { LLMChain } from "https://esm.sh/langchain/chains";
import { StructuredOutputParser, OutputFixingParser } from "https://esm.sh/langchain/output_parsers";


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
        const { pageData, letterId } = await req.json();

        // Create table level constants
        const pageNumber = pageData[0].page;
        const markdownHeaders = ["Text", "Confidence", "Column Index", "Row Index", "Column Span", "Row Span"];

        // Commond data elements markdown table
        const { dataElementsTable, dataElementsMarkdown } = await commonDataElementsMarkdown(["denial_letter", "all"]);

        // Create a new model instance
        const model = new ChatOpenAI({
            openAIApiKey: openai_api_key,
            temperature: 0,
            frequencyPenalty: 0,
            presencePenalty: 0,
            modelName: "gpt-3.5-turbo",
        });

        // Create Zod schema for LangChain Function
        const outputSchema = z.object({
            title: z.string().describe('Your generated title for this table. Keep it short and as descriptive as possible.'),
            summary: z.string().describe('Your generated summary of the table. Be as descriptive as possible.'),
            relevant: z.boolean().describe('Only true if the section of tabular data is relevant to the MEDICAL reason for the claim denial. Defer to false if not 100% certain of the medical reasoning. The reason must be medical and not administrative.'),
            reason: z.string().describe('A summary of the MEDICAL reason for the claim denial (or just "None" if the table has nothing relevant to the medical reason for the claim denial)'),
            elements: z.array(z.object({
                id: z.string().describe('The ID of the data element you have found a value for in the table.'),
                field: z.string().describe('The field of the data element matching the text in the field column of the common data elements table. Any data that you believe matches a common data element should be included in the output.'),
                element_summary: z.string().describe('A step-by-step reasoning of why this data element matches the field in the common data elements table, even if your confidence in your answer is low. Please be sure to cite the common data elements description field to help you with this.'),
                value: z.string().describe('The value of the data element that caused you to believe there was a match to a common data element. Be sure to provide your output in the output specified in the "Additional LLM Instructions" column of the common data elements table if available, and leverage your intuitive strenghts as an LLM to infer what the correct value may be to fit the specified format. If no value is present in "Additional LLM Instructions" feel free to format as you found the output in the data table. If you cannot provide your value in a specified format, your return value should be "N/A".'),
                confidence: z.number().min(0).max(1).describe('A number between 0 and 1 representing the confidence you have that this particular piece of data fits the described data element. Low confidence scores are welcome, the goal is to find all the data elements in the denial letter.'),
                left: z.number().min(0).max(1).describe('The left coordinate value from the record you wish to cite for the common data element match.'),
                top: z.number().min(0).max(1).describe('The top coordinate value from the record you wish to cite for the common data element match.'),
                width: z.number().min(0).max(1).describe('The width coordinate value from the record you wish to cite for the common data element match.'),
                height: z.number().min(0).max(1).describe('The height coordinate value from the record you wish to cite for the common data element match.'),
            })).optional().describe('An array of data elements found in the tablular data that match a field in the common data elements table. If no data elements are found, this field will not be present. Data present in the denial letter can pertain to multiple common data elements. Err on the side of including potential data elements.'),
        });
        const outputParser = StructuredOutputParser.fromZodSchema(outputSchema);

        // Create LangChain Output Parser object
        const outputFixingParser = OutputFixingParser.fromLLM(
            model,
            outputParser
        );

        // Create prompt template for the LLM to summarize the table
        const prompt = tableSectionTemplate(outputFixingParser);

        // Create the prompt chain to call the LLM
        const llmChain = new LLMChain({
            llm: model,
            prompt: prompt,
            outputParser: outputFixingParser,
        });

        // Create embedding headers and url
        const embeddingUrl = "https://api.openai.com/v1/embeddings";
        const embeddingHeaders = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openai_api_key}`
        };

        // Create insertRows array to store the new rows to be inserted into the database and tablePromises array to hold LLM summary async promises
        const citationInputRows = [];
        const summaryInsertRows = [];
        const dataElementInsertRows = [];
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

            // Loop over table sections and call the LLM chain for each section
            for (let j = 0; j < tableMarkdownArray.length; j++) {
                // Add LLM Chain Run to Promises Array
                tablePromises.push(llmChain.call({
                    sectionNumber: j,
                    tablePrompt: tablePrompt,
                    markdownTable: tableMarkdownArray[j],
                    dataElementsTable: dataElementsMarkdown,
                }));
            }

            // Retrieve the LLM summarization results
            const tableSections = await Promise.all(tablePromises);

            // loop over the table sections, embed the summary and write to the database
            for (let j = 0; j < tableSections.length; j++) {
                console.log(`Table Page ${pageNumber} Table ${i} Section ${j}`);
                console.log(tableSections[j]);
                const title = tableSections[j].text.title;
                const summary = tableSections[j].text.summary;
                const relevant = tableSections[j].text.relevant;
                const reason = tableSections[j].text.reason;
                const elements = tableSections[j].text.elements;

                const summaryEmbeddingBody = JSON.stringify({
                    "input": summary,
                    "model": "text-embedding-ada-002",
                });
    
                // loop until the embedding is generated
                // if embeddingJson.data is undefined, then the embedding is not ready
                let summaryCalculateEmbedding = true;
                let summaryEmbedding;
                while (summaryCalculateEmbedding) {
                    const embeddingResponse = await fetch(embeddingUrl, {
                        method: "POST",
                        headers: embeddingHeaders,
                        body: summaryEmbeddingBody
                    });
                    const embeddingJson = await embeddingResponse.json();
                    if (embeddingJson.data) {
                        summaryEmbedding = embeddingJson.data[0].embedding;
                        summaryCalculateEmbedding = false;
                    } else {
                        console.log("Embedding not ready yet, waiting 1 second...");
                        console.log(embeddingResponse.status, embeddingResponse.statusText);
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
    
                citationInputRows.push({
                    "document_type": "denial_letter",
                    "document_id": letterId,
                    "page_number": pageNumber,
                    "section_type": "text",
                    "section_number": i,
                    "title": title,
                    "summary": summary,
                    "summary_embedding": summaryEmbedding,
                    "left": table.left,
                    "top": table.top,
                    "right": table.right,
                    "bottom": table.bottom,
                });

                if (relevant) {
                    // Generate embedding for the table section verdict
                    const reasonEmbeddingBody = JSON.stringify({
                        "input": reason,
                        "model": "text-embedding-ada-002",
                    });

                    // loop until the embedding is generated
                    // if embeddingJson.data is undefined, then the embedding is not ready
                    let calculateEmbedding = true;
                    let reasonEmbedding;
                    while (calculateEmbedding) {
                        const embeddingResponse = await fetch(embeddingUrl, {
                            method: "POST",
                            headers: embeddingHeaders,
                            body: reasonEmbeddingBody
                        });
                        const embeddingJson = await embeddingResponse.json();
                        if (embeddingJson.data) {
                            reasonEmbedding = embeddingJson.data[0].embedding;
                            calculateEmbedding = false;
                        } else {
                            console.log("Embedding not ready yet, waiting 1 second...");
                            console.log(embeddingResponse.status, embeddingResponse.statusText);
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }
        
                    summaryInsertRows.push({
                        "letter_id": letterId,
                        "page_number": pageNumber,
                        "section_type": "table",
                        "section_number": i,
                        "sub_section_number": j,
                        "reason": reason,
                        "section_embedding": reasonEmbedding,
                        "left": table.left,
                        "top": table.top,
                        "right": table.right,
                        "bottom": table.bottom,
                    });
                }

                if (elements) {
                    for (let e = 0; e < elements.length; e++) {
                        dataElementInsertRows.push({
                            "document_type": "denial_letter",
                            "document_id": letterId,
                            "page_number": pageNumber,
                            "section_type": "table",
                            "section_number": i,
                            "sub_section_number": j,
                            "field_id": elements[e].id,
                            "field_name": elements[e].field,
                            "field_value": elements[e].value,
                            "field_summary": elements[e].element_summary,
                            "confidence": elements[e].confidence,
                            "left": elements[e].left,
                            "top": elements[e].top,
                            "right": elements[e].width + elements[e].left,
                            "bottom": elements[e].height + elements[e].top,
                        });
                    }
                }
            }
        }

        // Filter out data elements that contain "None", "N/A", or "" as the value
        const filteredDataElementInsertRows = dataElementInsertRows.filter((element: any) => {
            return element.field_value !== "None" && element.field_value !== "N/A" && element.field_value !== "";
        });

        // Write the page citations to the database
        const { error: citationError } = await supabaseClient
            .from("page_summaries")
            .insert(citationInputRows);
        if (citationError) {
            throw new Error(citationError.message);
        }

        // Write the table summaries to the database
        const { data, error } = await supabaseClient
            .from("letter_sections")
            .insert(summaryInsertRows)
            .select();
        if (error) {
            throw new Error(error.message);
        }

        // Write the page data elements to the database
        const { error: dataElementError } = await supabaseClient
            .from("document_data_elements")
            .insert(filteredDataElementInsertRows)
        if (dataElementError) {
            throw new Error(dataElementError.message);
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