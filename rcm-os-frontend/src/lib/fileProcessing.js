import { uploadFileAWS, pollJobAWS, getResultsAWS } from '@/lib/aws';
import { createFileSupabase, handleTextSummarySupabase, handleTableSummarySupabase, handleKvSummarySupabase } from '@/lib/supabase';

export const processFile = async (file, user, supabaseClient, changeDoc, changeChat, setUploadStageAWS, setUploadStageSupabase) => {
    // Helper function to go through each stage of the processing cycle
    // Some parts between AWS and SupaBase can be done in parallel

    // Step 1:
        // AWS: Upload file to S3 and begin Textract OCR Job
    // Step 2: 
        // AWS: Poll for completed Textract Job
        // SupaBase: Uplpad file to SupaBase Storage, Create new record of pointer to storage & textract Job Id
    // Step 3:
        // AWS: Retrieve Processed Textract Job Blocks
    // Step 4:
        // SupaBase: Generate Section summaries for each page, upload summary & Embeddings to Supabase from text blocks
        // SupaBase: Generate summaries for each table and page, upload summary & Embeddings to Supabase from analysis blocks
        // SupaBase: Generate summaries for collections of Key-Value pairs on each page, upload summary & Embeddings to Supabase from analysis blocks


    // Step 1:
    let awsStage = 0;
    const jobId = await uploadFileAWS(file, awsStage, setUploadStageAWS);

    let recordId = null;
    let fileName = null;
    setUploadStageAWS((prevState) => {
        const newState = [...prevState];
        newState[awsStage].active = true;
        return newState;
    });
    setUploadStageSupabase((prevState) => {
        const newState = [...prevState];
        newState[0].active = true;
        return newState;
    });
    await Promise.allSettled([
        pollJobAWS(jobId, awsStage, setUploadStageAWS),
        createFileSupabase(jobId, file, user, supabaseClient, 0, setUploadStageSupabase)
    ]).then((results) => {
        const pollPromise = results[0];
        const filePromise = results[1];

        if (pollPromise.status === 'fulfilled') {
            const pages = pollPromise.value;
            if (!pages) { 
                alert('Textract Error');
            }
        }

        if (filePromise.status === 'fulfilled') {
            recordId = filePromise.value.id;
            fileName = filePromise.value.file_name;
        }
    });

    if (!recordId) {
        alert('Supabase Error');
        return;
    }

    // Step 3: 
    // awsStage = 2;
    // setUploadStageAWS((prevState) => {
    //     const newState = [...prevState];
    //     newState[awsStage].active = true;
    //     return newState;
    // });
    // // TODO: ASYNC FOR TEXT & DOC ANALYSIS CONCURRENCY
    // const { returnLineBlocks: textBlocks, returnTableBlocks, returnKvBlocks } = await getResultsAWS(jobId, awsStage, setUploadStageAWS);

    // // tableBlocks aleady set of as array of arrays (one inner array per page)
    // // Other blocks need to be converted to array of arrays, with one inner array containing all blocks for a given page
    // let tableBlocks = [];
    // for (var i = 0; i < returnTableBlocks.length; i++) {
    //     const tablePage = returnTableBlocks[i].page;
    //     while (tableBlocks.length < tablePage) {
    //         tableBlocks.push([]);
    //     }
    //     tableBlocks[tablePage-1].push(returnTableBlocks[i]);
    // }

    // let kvBlocks = [];
    // for (var i = 0; i < returnKvBlocks.length; i++) {
    //     const kvPage = returnKvBlocks[i].page;
    //     while (kvBlocks.length < kvPage) {
    //         kvBlocks.push([]);
    //     }
    //     kvBlocks[kvPage-1].push(returnKvBlocks[i]);
    // }

    // // Step 4: Async Execution
    // setUploadStageSupabase((prevState) => {
    //     const newState = [...prevState];
    //     newState[1].active = true;
    //     newState[2].active = true;
    //     newState[3].active = true;
    //     return newState;
    // });
    // await Promise.allSettled([
    //     handleTextSummarySupabase(textBlocks, recordId, supabaseClient, 1, setUploadStageSupabase),
    //     handleTableSummarySupabase(tableBlocks, recordId, supabaseClient, 2, setUploadStageSupabase),
    //     handleKvSummarySupabase(kvBlocks, recordId, supabaseClient, 3, setUploadStageSupabase),
    // ]).then((results) => {
    //     const textPromise = results[0];
    //     const tablePromise = results[1];
    //     const kvPromise = results[2];

    //     if (textPromise.status === 'fulfilled') {
    //         setUploadStageSupabase((prevState) => {
    //             const newState = [...prevState];
    //             newState[1].progress = 100;
    //             return newState;
    //         });
    //     }

    //     if (tablePromise.status === 'fulfilled') {
    //         setUploadStageSupabase((prevState) => {
    //             const newState = [...prevState];
    //             newState[2].progress = 100;
    //             return newState;
    //         });
    //     }

    //     if (kvPromise.status === 'fulfilled') {
    //         setUploadStageSupabase((prevState) => {
    //             const newState = [...prevState];
    //             newState[3].progress = 100;
    //             return newState;
    //         });
    //     }
    // });

    // update medical record content_embedding_progress to 100
    const { error: progressError } = await supabaseClient
        .from('medical_records')
        .update({ content_embedding_progress: 100 })
        .eq('id', recordId);
    if (progressError) {
        console.error(progressError);
        return;
    }
    await changeDoc(recordId);

    // create a new chat record for the document
    const { data: chatData, error: chatError } = await supabaseClient
        .from('document_chats')
        .insert([{ 
            record_id: recordId,
            user_id: user.id,
            title: 'Initial Chat',
        }])
        .select();
    if (chatError) {
        console.error(chatError);
        return;
    }
    await changeChat(chatData[0].id);

};