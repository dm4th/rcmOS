import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabaseClient.ts';
import { textMarkdownTableGenerator } from '../_shared/promptTemplates.ts';
import { textSectionTemplate } from '../_shared/letterSummaryTemplates.ts';
import { commonDataElementsMarkdown } from '../_shared/dataElements.ts';
import { z } from "https://esm.sh/zod";
import { ChatOpenAI } from "https://esm.sh/langchain/chat_models/openai";
import { LLMChain } from "https://esm.sh/langchain/chains";
import { StructuredOutputParser, OutputFixingParser } from "https://esm.sh/langchain/output_parsers";

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
            relevant: z.boolean().describe('Only true if the section of text is relevant to the MEDICAL reason for the claim denial. Defer to false if not 100% certain of the medical reasoning. The reason must be medical and not administrative.'),
            reason: z.string().describe('A summary of the MEDICAL reason for the claim denial (or just "None" if the section of text is not relevant to the medical reason for the claim denial)'),
            elements: z.array(z.object({
                id: z.string().describe('The ID of the data element you have found a value for in the processed text.'),
                field: z.string().describe('The field of the data element matching the text in the field column of the common data elements table. Any data that you believe matches a common data element should be included in the output.'),
                summary: z.string().describe('A step-by-step reasoning of why this data element matches the field in the common data elements table, even if your confidence in your answer is low. Please be sure to cite the common data elements description field to help you with this.'),
                value: z.string().describe('The value of the data element that caused you to believe there was a match to a common data element. Be sure to provide your output in the output specified in the "Additional LLM Instructions" column of the common data elements table if available. If no value is present in "Additional LLM Instructions" feel free to format as you found the output in the data table. If you cannot provide your value in a specified format, your return value should be "N/A".'),
                confidence: z.number().min(0).max(1).describe('A number between 0 and 1 representing the confidence you have that this particular piece of data fits the described data element. Low confidence scores are welcome, the gaol is to find all the data elements in the denial letter.'),
                left: z.number().min(0).max(1).describe('The left coordinate value from the record you wish to cite for the common data element match.'),
                top: z.number().min(0).max(1).describe('The top coordinate value from the record you wish to cite for the common data element match.'),
                width: z.number().min(0).max(1).describe('The width coordinate value from the record you wish to cite for the common data element match.'),
                height: z.number().min(0).max(1).describe('The height coordinate value from the record you wish to cite for the common data element match.'),
            })).optional().describe('An array of data elements found in the section of text that match a field in the common data elements table. If no data elements are found, this field will not be present. Data present in the denial letter can pertain to multiple common data elements.'),
        });
        const outputParser = StructuredOutputParser.fromZodSchema(outputSchema);

        // Create LangChain Output Parser object
        const outputFixingParser = OutputFixingParser.fromLLM(
            model,
            outputParser
        );

        // Create prompt template for LLM chain
        const prompt = textSectionTemplate(outputFixingParser);

        // Create LLM Chain
        const llmChain = new LLMChain({
            llm: model,
            prompt: prompt,
            outputParser: outputFixingParser,
        });

        // Create async promises to summarize the page markdown using the LLM
        const sectionPromises = [];
        for (let i = 0; i < pageMarkdownArray.length; i++) {
            // log the final prompt to the LLM in the console
            // console.log(await prompt.format({
            //     pageNumber: pageNumber,
            //     sectionNumber: i,
            //     markdownTable: pageMarkdownArray[i].text,
            //     dataElementsTable: dataElementsMarkdown
            // }));

            // Run the LLM Chain
            sectionPromises.push(llmChain.call({
                pageNumber: pageNumber,
                sectionNumber: i,
                markdownTable: pageMarkdownArray[i].text,
                dataElementsTable: dataElementsMarkdown,
            }));
        }

        // Wait for all the page section summaries to be generated
        const sectionResults = await Promise.all(sectionPromises);

        // loop over the page sections, embed the data, and write to the database
        const summaryInsertRows = [];
        const dataElementInsertRows = [];
        for (let i = 0; i < sectionResults.length; i++) {
            console.log(`Text Page ${pageNumber} Section ${i}\n`);
            console.log(sectionResults[i]);
            const relevant = sectionResults[i].text.relevant;
            const reason = sectionResults[i].text.reason;
            const elements = sectionResults[i].text.elements;

            if (relevant) {
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
                    "reason": reason,
                    "section_embedding": reasonEmbedding,
                    "left": pageMarkdownArray[i].left,
                    "top": pageMarkdownArray[i].top,
                    "right": pageMarkdownArray[i].right,
                    "bottom": pageMarkdownArray[i].bottom,
                });
            }

            if (elements) {
                for (let e = 0; e < elements.length; e++) {
                    dataElementInsertRows.push({
                        "document_type": "denial_letter",
                        "document_id": letterId,
                        "page_number": pageNumber,
                        "section_type": "text",
                        "section_number": i,
                        "field_id": elements[e].id,
                        "field_name": elements[e].field,
                        "field_value": elements[e].value,
                        "field_summary": elements[e].summary,
                        "confidence": elements[e].confidence,
                        "left": elements[e].left,
                        "top": elements[e].top,
                        "right": elements[e].width + elements[e].left,
                        "bottom": elements[e].height + elements[e].top,
                    });

                }
            }
        }

        // Filter out data elements that contain "None", "N/A", or "" as the value
        const filteredDataElementInsertRows = dataElementInsertRows.filter((element: any) => {
            return element.field_value !== "None" && element.field_value !== "N/A" && element.field_value !== "";
        });

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
            .from("document_data_elements")
            .insert(filteredDataElementInsertRows)
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