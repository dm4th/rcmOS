import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { timezoneOptions } from '../_shared/timezone.ts';
import { supabaseClient } from '../_shared/supabaseClient.ts';
import { pageSummaryTemplate } from '../_shared/promptTemplates.ts';
import { OpenAI } from "https://esm.sh/langchain/llms/openai";
import { LLMChain } from "https://esm.sh/langchain/chains";
import { ChatPromptTemplate } from "https://esm.sh/langchain/prompts";
import { CallbackManager } from "https://esm.sh/langchain/callbacks";

const openai_api_key = Deno.env.get("OPENAI_API_KEY");

async function handler(req: Request) {
    // First Check for CORS request
    console.log("New request received at ", new Date().toISOString());
    if (req.method === "OPTIONS") {
        console.log("Handling CORS request: ", req.url);
        return new Response(null, {
            status: 204,
            headers: new Headers(corsHeaders),
        });
    } 

    try {
        const { pageData, supabaseId } = await req.json();
        console.log("pageData: ", pageData);
        console.log("supabaseId: ", supabaseId);

        // First pull the page number from the pageData first element
        const pageNumber = pageData[0].Page.toString();

        // Generate page markdown table string
        // Initialize as a markdown table header with column names:
        // Text, Confidence, Left, Top, Width, Height
        let pageMarkdown = "| Text | Confidence | Left | Top | Width | Height |\n";
        // loop over all but the first row of pageData to fill in the table
        for (let i = 1; i < pageData.length; i++) {
            const row = pageData[i];
            const rowGeometry = row.Geometry.BoundingBox;
            pageMarkdown += `| ${row.Text} | ${row.Confidence} | ${rowGeometry.Left} | ${rowGeometry.Top} | ${rowGeometry.Width} | ${rowGeometry.Height} |\n`;
        }

        // Generate prompt for OpenAI LLM
        const prompt = pageSummaryTemplate();

        // Create a new model instance
        const model = new OpenAI({
            openAIApiKey: openai_api_key,
            temperature: 0.1,
            maxTokens: 200,
            frequencyPenalty: 0,
            presencePenalty: 0,
            modelName: "gpt-3.5-turbo",
        });

        // Create LLM Chain
        const chain = new LLMChain({
            llm: model,
            prompt: prompt,
        });

        // Run the LLM Chain
        const output = await chain.call({pageMarkdown, pageNumber});

        // Pull the title and summary from the response
        // The title will be the text immediately following TITLE: and before the first newline
        // Summary will be right after the SUMMARY: tag in the text
        const title = output.split("TITLE:")[1].split("\n")[0];
        const summary = output.split("SUMMARY:")[1].split("\n")[0];

        // Write the page to the 



        // generate embedding for the user prompt
        const embeddingUrl = "https://api.openai.com/v1/embeddings";
        const embeddingHeaders = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openai_api_key}`
        };
        const embeddingBody = JSON.stringify({
            "input": await summarizeChatHistory(verified_chat_history, prompt),
            "model": "text-embedding-ada-002",
        });
        const embeddingResponse = await fetch(embeddingUrl, {
            method: "POST",
            headers: embeddingHeaders,
            body: embeddingBody
        });
        if (embeddingResponse.status !== 200) {
            throw new Error("Failed to generate prompt embeddings");
        }
        const embeddingJson = await embeddingResponse.json();
        const promptEmbedding = embeddingJson.data[0].embedding;

        // find similarities to stored documents
        const { data: match_data, error: match_error } = await supabaseClient.rpc(
            "document_similarity", 
            { 
                embedding: promptEmbedding,
                match_threshold: 0.6,
                match_count: 10,
            });
        if (match_error) {
            console.error(match_error);
            throw new Error("Failed to match prompt embedding");
        }
        
        const chatPromptTemplate = ChatPromptTemplate.fromPromptMessages([
            employerSystemMessageTemplate,
            chatHistoryTemplate(verified_chat_history),
            documentMatchTemplate(match_data),
            humanMessageTemplate,
        ]);

        // Check if we would like to stream results or wait for full completion
        const streaming = req.headers.get("accept") === "text/event-stream";
    
        if (streaming) {
            console.log("Streaming response for prompt: ", prompt);
            // For a streaming response we use TransformStream to convert 
            // the LLM callback events into SSE events
            const encoder = new TextEncoder();
            const stream = new TransformStream();
            const writer = stream.writable.getWriter();

            const chat_model = new ChatOpenAI({
                openAIApiKey: openai_api_key,
                temperature: 0.3,
                maxTokens: 1000,
                modelName: "gpt-3.5-turbo",
                streaming: streaming,
                callbackManager: CallbackManager.fromHandlers({
                    handleLLMStart: async () => {
                        await writer.ready;
                        await writer.write(encoder.encode(`data: ${JSON.stringify({ chat_id: verified_chat_id })}\n\n`));
                    },
                    handleLLMNewToken: async (token) => {
                        await writer.ready;
                        await writer.write(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
                    },
                    handleLLMEnd: async (output) => {
                        await writer.ready;
                        await writer.close();

                        // update chat history for this chat id
                        const out_text = output.generations[0][0].text;
                        const { error } = await supabaseClient
                            .from("chat_history")
                            .insert([{ chat_id: verified_chat_id, user_id: user_id, role_id: verified_role_id, prompt: prompt, response: out_text }]);
                        if (error) {
                            console.error(error);
                        }
                    },
                    handleLLMError: async (error) => {
                        await writer.ready;
                        await writer.abort(error);
                    }
                })
            });

            const conversationChain = new ConversationChain({ 
                prompt: chatPromptTemplate, 
                llm: chat_model
            });

            // We don't need to wait for the response to be fully generated
            // because we can utilize the handleLLMCallback to close the stream
            conversationChain.call({ human_prompt: prompt }).catch((error) => console.error(error));

            const headers = new Headers(corsHeaders);
            headers.set("Content-Type", "text/event-stream");
            headers.set("Cache-Control", "no-cache");
            headers.set("Connection", "keep-alive");

            return new Response(stream.readable, {
                status: 200,
                headers: headers
            });
        
        } else {
            console.log("Retrieving response for prompt: ", prompt);
            console.log(prompt);
            // No need to stream results, just wait for the full response
            const chat_model = new ChatOpenAI({
                openAIApiKey: openai_api_key,
                temperature: 0.3,
                maxTokens: 1000,
                modelName: "gpt-3.5-turbo"
            });

            const llmChain = new LLMChain({ 
                prompt: chatPromptTemplate, 
                llm: chat_model,
                verbose: true
            });

            const llmResponse = await llmChain.call({ human_prompt: prompt });
            const responseText = await llmResponse.text();
            
            const headers = new Headers(corsHeaders);
            headers.set("Content-Type", "application/json");
            // headers.set("Cache-Control", "no-cache");
            // headers.set("Connection", "keep-alive");

            // console.log("Response: ", response);
            // console.log("Headers: ", headers);

            return new Response(JSON.stringify({data: responseText}), {
                status: 200,
                headers: headers
            });
        }

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