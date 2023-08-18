import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabaseClient.ts';
import { kvMarkdownTableGenerator } from '../_shared/promptTemplates.ts';
import { kvSummaryTemplate, kvSectionTemplate } from '../_shared/letterSummaryTemplates.ts';
import { commonDataElementsMarkdown } from '../_shared/dataElements.ts';
import { z } from "https://esm.sh/zod";
import { ChatOpenAI } from "https://esm.sh/langchain/chat_models/openai";
import { LLMChain } from "https://esm.sh/langchain/chains";
import { StructuredOutputParser, OutputFixingParser } from "https://esm.sh/langchain/output_parsers";


const openai_api_key = Deno.env.get("OPENAI_API_KEY");

function getPageSectionDescription(pageNumber: number, sectionNumber: number) {
    switch (sectionNumber) {
        case 0:
            return `The top section of page ${pageNumber}`;
        case 1:
            return `The middle section of page ${pageNumber}`;
        case 2:
            return `The bottom section of page ${pageNumber}`;
        default:
            return `A section of page ${pageNumber}`;
    }
}

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

        // Retrieve common data elements from the database
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
            title: z.string().describe('Your generated title for this input form. Keep it short and as descriptive as possible.'),
            summary: z.string().describe('Your generated summary of the input form. Be as descriptive as possible.'),
            relevant: z.boolean().describe('Only true if the input form has information that is relevant to the MEDICAL reason for the claim denial. Defer to false if not 100% certain of the medical reasoning. The reason must be medical and not administrative.'),
            reason: z.string().describe('A summary of the MEDICAL reason for the claim denial (or just "None" if the input form is not relevant to the medical reason for the claim denial)'),
            elements: z.array(z.object({
                id: z.string().describe('The ID of the data element you have found a value for in the processed input form.'),
                field: z.string().describe('The field of the data element matching the text in the field column of the common data elements table. Any data that you believe matches a common data element should be included in the output.'),
                element_summary: z.string().describe('A step-by-step reasoning of why this data element matches the field in the common data elements table, even if your confidence in your answer is low. Please be sure to cite the common data elements description field to help you with this.'),
                value: z.string().describe('The value of the data element that caused you to believe there was a match to a common data element. Be sure to provide your output in the output specified in the "Additional LLM Instructions" column of the common data elements table if available, and leverage your intuitive strenghts as an LLM to infer what the correct value may be to fit the specified format. If no value is present in "Additional LLM Instructions" feel free to format as you found the output in the data table. If you cannot provide your value in a specified format, your return value should be "N/A".'),
                confidence: z.number().min(0).max(1).describe('A number between 0 and 1 representing the confidence you have that this particular piece of data fits the described data element. Low confidence scores are welcome, the goal is to find all the data elements in the denial letter.'),
                left: z.number().min(0).max(1).describe('The left coordinate value from the record you wish to cite for the common data element match.'),
                top: z.number().min(0).max(1).describe('The top coordinate value from the record you wish to cite for the common data element match.'),
                width: z.number().min(0).max(1).describe('The width coordinate value from the record you wish to cite for the common data element match.'),
                height: z.number().min(0).max(1).describe('The height coordinate value from the record you wish to cite for the common data element match.'),
            })).optional().describe('An array of data elements found in the input form that match a field in the common data elements table. If no data elements are found, this field will not be present. Data present in the denial letter can pertain to multiple common data elements. Err on the side of including potential data elements.'),
        });
        const outputParser = StructuredOutputParser.fromZodSchema(outputSchema);

        // Create LangChain Output Parser object
        const outputFixingParser = OutputFixingParser.fromLLM(
            model,
            outputParser
        );

        // Create prompt template for LLM chain
        const prompt = kvSectionTemplate(outputFixingParser);

        // Create LLM Chain
        const llmChain = new LLMChain({
            llm: model,
            prompt: prompt,
            outputParser: outputFixingParser,
        });

        // Embedding constants
        const embeddingUrl = "https://api.openai.com/v1/embeddings";
        const embeddingHeaders = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openai_api_key}`
        };

        // Loop over the markdownArray and generate a summary and title for each form section using the LLM
        // Then embed each summary and add to an array to push all rows at once to the database
        const citationInputRows = [];
        const summaryInsertRows = [];
        const dataElementInsertRows = [];
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

                // Call the LLM chain
                kvPromises.push(llmChain.call({
                    pageDesc: getPageSectionDescription(pageNumber, i),
                    markdownTable: kvMarkdownArray[j].text,
                    dataElementsTable: dataElementsMarkdown,
                }));
            }

            // Wait for all the LLM Chains to finish
            const kvResults = await Promise.all(kvPromises);

            // Loop over the results and add them to the insertRows array
            for (let j = 0; j < kvResults.length; j++) {
                const kvCoordinates = kvCoords[j];
                const kvOutput = kvResults[j].text;

                console.log(`Page ${pageNumber} Section ${i}, ${j}`);
                console.log(kvOutput);
                const title = kvOutput.title;
                const summary = kvOutput.summary;
                const relevant = kvOutput.relevant;
                const reason = kvOutput.reason;
                const elements = kvOutput.elements;

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
                    "left": kvCoordinates.left,
                    "top": kvCoordinates.top,
                    "right": kvCoordinates.right,
                    "bottom": kvCoordinates.bottom,
                });

                if (relevant) {
                    // Generate embedding for the form section summary
                    const embeddingUrl = "https://api.openai.com/v1/embeddings";
                    const embeddingHeaders = {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${openai_api_key}`
                    };

                    const embeddingBody = JSON.stringify({
                        "input": reason,
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
        
                    summaryInsertRows.push({
                        "letter_id": letterId,
                        "page_number": pageNumber,
                        "section_type": "table",
                        "section_number": i,
                        "sub_section_number": j,
                        "reason": reason,
                        "section_embedding": sectionEmbedding,
                        "left": kvCoordinates.left,
                        "top": kvCoordinates.top,
                        "right": kvCoordinates.right,
                        "bottom": kvCoordinates.bottom,
                    });
                }

                if (elements) {
                    for (let e = 0; e < elements.length; e++) {
                        dataElementInsertRows.push({
                            "document_type": "denial_letter",
                            "document_id": letterId,
                            "page_number": pageNumber,
                            "section_type": "kv",
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
        
        // Write the page summaries to the database
        const { data, error } = await supabaseClient
            .from("letter_sections")
            .insert(summaryInsertRows)
            .select();
        if (error) {
            console.log(error);
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