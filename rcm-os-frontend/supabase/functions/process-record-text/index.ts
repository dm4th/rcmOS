import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabaseClient.ts';
import GPT3Tokenizer from 'https://esm.sh/gpt3-tokenizer';
import { textMarkdownTableGenerator } from '../_shared/promptTemplates.ts';
import { textSectionTemplate } from '../_shared/recordProcessingTemplates.ts';
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
        const { pageData, claimId, recordId, summary } = await req.json();

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
        const { dataElementsTable, dataElementsMarkdown } = await commonDataElementsMarkdown(["medical_record", "all"]);

        // Create a new model instance
        const model = new ChatOpenAI({
            openAIApiKey: openai_api_key,
            temperature: 0,
            frequencyPenalty: 0,
            presencePenalty: 0,
            modelName: "gpt-3.5-turbo-16k",
        });

        // Create Zod schema for LangChain Function
        const outputSchema = z.object({
            title: z.string().describe('Your generated title describing this section of text. Keep it short and as descriptive as possible.'),
            summary: z.string().describe('Your generated summary of the section of text. Be as descriptive as possible.'),
            analysis: z.string().describe('Your expert analysis as a Medical Documentation Specialist regarding this section of text and whether or not it is valuable to generating a successful insurance claim denial.'),
            relevance: z.number().min(0).max(1).describe("A number between 0 and 1 representing how important this section of text and your accompanying analysis is to generating a successful insurance claim denial."),
            elements: z.array(z.object({
                id: z.string().describe('The ID of the data element you have found a value for in the processed text.'),
                field: z.string().describe('The field of the data element matching the text in the field column of the common data elements table. Any data that you believe matches a common data element should be included in the output.'),
                element_summary: z.string().describe('A step-by-step reasoning of why this data element matches the field in the common data elements table, even if your confidence in your answer is low. Please be sure to cite the common data elements description field to help you with this.'),
                value: z.string().describe('The value of the data element that caused you to believe there was a match to a common data element. Be sure to provide your output in the output specified in the "Additional LLM Instructions" column of the common data elements table if available, and leverage your intuitive strenghts as an LLM to infer what the correct value may be to fit the specified format. If no value is present in "Additional LLM Instructions" feel free to format as you found the output in the data table. If you cannot provide your value in a specified format, your return value should be "N/A".'),
                confidence: z.number().min(0).max(1).describe('A number between 0 and 1 representing the confidence you have that this particular piece of data fits the described data element. Low confidence scores are welcome, the goal is to find all the data elements in the denial letter.'),
                left: z.number().min(0).max(1).describe('The left coordinate value from the record you wish to cite for the common data element match.'),
                top: z.number().min(0).max(1).describe('The top coordinate value from the record you wish to cite for the common data element match.'),
                width: z.number().min(0).max(1).describe('The width coordinate value from the record you wish to cite for the common data element match.'),
                height: z.number().min(0).max(1).describe('The height coordinate value from the record you wish to cite for the common data element match.'),
            })).optional().describe('An array of data elements found in the section of text that match a field in the common data elements table. If no data elements are found, this field will not be present. Data present in the denial letter can pertain to multiple common data elements. Err on the side of including potential data elements.'),
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

        // Embedding constants
        const embeddingUrl = "https://api.openai.com/v1/embeddings";
        const embeddingHeaders = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openai_api_key}`
        };

        const gpt3Tokenizer = new GPT3Tokenizer({ type: 'gpt3' });

        // Create async promises to summarize the page markdown using the LLM
        const sectionPromises = [];
        for (let i = 0; i < pageMarkdownArray.length; i++) {
            // log the final prompt to the LLM in the console
            const fullPrompt = await prompt.format({
                pageNumber: pageNumber,
                sectionNumber: i,
                reasonForDenial: summary,
                markdownTable: pageMarkdownArray[i].text,
                dataElementsTable: dataElementsMarkdown
            });
            const promptTokens = gpt3Tokenizer.encode(fullPrompt).length;

            console.log(fullPrompt);
            console.log(`\n\n`);
            console.log(promptTokens);
            console.log(`\n\n`);

            // Run the LLM Chain
            sectionPromises.push(llmChain.call({
                pageNumber: pageNumber,
                sectionNumber: i,
                reasonForDenial: summary,
                markdownTable: pageMarkdownArray[i].text,
                dataElementsTable: dataElementsMarkdown,
            }));
        }

        // Wait for all the page section summaries to be generated
        const sectionResults = await Promise.all(sectionPromises);

        // loop over the page sections, embed the data, and write to the database
        const citationInputRows = [];
        const summaryInsertRows = [];
        const dataElementInsertRows = [];
        for (let i = 0; i < sectionResults.length; i++) {
            console.log(`Text Page ${pageNumber} Section ${i}\n`);
            console.log(sectionResults[i]);
            const title = sectionResults[i].text.title;
            const summary = sectionResults[i].text.summary;
            const relevance = sectionResults[i].text.relevance;
            const analysis = sectionResults[i].text.analysis;
            const elements = sectionResults[i].text.elements;

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
                "document_type": "medical_record",
                "document_id": recordId,
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

            if (relevance && relevance > 0) {

                const analysisEmbeddingBody = JSON.stringify({
                    "input": analysis,
                    "model": "text-embedding-ada-002",
                });

                // loop until the embedding is generated
                // if embeddingJson.data is undefined, then the embedding is not ready
                let analysisCalculateEmbedding = true;
                let analysisEmbedding;
                while (analysisCalculateEmbedding) {
                    const embeddingResponse = await fetch(embeddingUrl, {
                        method: "POST",
                        headers: embeddingHeaders,
                        body: analysisEmbeddingBody
                    });
                    const embeddingJson = await embeddingResponse.json();
                    if (embeddingJson.data) {
                        analysisEmbedding = embeddingJson.data[0].embedding;
                        analysisCalculateEmbedding = false;
                    } else {
                        console.log("Embedding not ready yet, waiting 1 second...");
                        console.log(embeddingResponse.status, embeddingResponse.statusText);
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }

                summaryInsertRows.push({
                    "claim_id": claimId,
                    "record_id": recordId,
                    "page_number": pageNumber,
                    "section_type": "text",
                    "section_number": i,
                    "relevance": relevance,
                    "analysis": analysis,
                    "analysis_embedding": analysisEmbedding,
                    "left": pageMarkdownArray[i].left,
                    "top": pageMarkdownArray[i].top,
                    "right": pageMarkdownArray[i].right,
                    "bottom": pageMarkdownArray[i].bottom,
                });
            }

            if (elements) {
                for (let e = 0; e < elements.length; e++) {
                    dataElementInsertRows.push({
                        "document_type": "medical_record",
                        "document_id": recordId,
                        "page_number": pageNumber,
                        "section_type": "text",
                        "section_number": i,
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

        console.log(summaryInsertRows);

        // Write the page summaries to the database
        const { data: summaryData, error: summaryError } = await supabaseClient
            .from("record_sections")
            .insert(summaryInsertRows)
            .select();
        if (summaryError) {
            throw new Error(summaryError.message);
        }

        // Write the page data elements to the database
        const { error: dataElementError } = await supabaseClient
            .from("document_data_elements")
            .insert(filteredDataElementInsertRows);
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