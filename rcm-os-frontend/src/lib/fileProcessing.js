import { uploadFileAWS, textractOCR } from '@/lib/aws';
import { createFileSupabase, handleTextSummarySupabase, handleTableSummarySupabase, handleKvSummarySupabase } from '@/lib/supabase';

export const processFile = async (file, inputTemplateId, toggleInputModal, user, supabaseClient, changeDoc, changeChat, setUploadStageAWS, setUploadStageSupabase) => {
    // Helper function to go through each stage of the processing cycle
    // Some parts between AWS and SupaBase can be done in parallel

    // Step 1:
        // AWS: Upload file to S3 and begin Textract OCR Job
    // Step 2: 
        // AWS: Poll for completed Textract Job, Retrieve Processed Textract Job Blocks
        // SupaBase: Upload file to SupaBase Storage, Create new record of pointer to storage, textract Job Id, and Input Template Id
    // Step 3:
        // SupaBase: Generate Section summaries for each page, upload summary & Embeddings to Supabase from text blocks
        // SupaBase: Generate summaries for each table and page, upload summary & Embeddings to Supabase from analysis blocks
        // SupaBase: Generate summaries for collections of Key-Value pairs on each page, upload summary & Embeddings to Supabase from analysis blocks


    // Step 1:
    setUploadStageAWS((prevState) => {
        const newState = [...prevState];
        newState[0].active = true;
        return newState;
    });
    const jobId = await uploadFileAWS(file, 0, setUploadStageAWS);

    // Step 2:
    let recordId = null;
    let textBlocks = null;
    let returnTableBlocks = null;
    let returnKvBlocks = null;
    await Promise.allSettled([
        textractOCR(jobId, 1, 2, setUploadStageAWS),
        createFileSupabase(jobId, file, inputTemplateId, toggleInputModal, user, supabaseClient, 0, setUploadStageSupabase)
    ]).then((results) => {
        const ocrPromise = results[0];
        const filePromise = results[1];

        if (ocrPromise.status === 'fulfilled') {
            const ocrResult = ocrPromise.value;
            if (!ocrResult) {
                alert('AWS Error');
                return;
            }
            textBlocks = ocrResult.returnLineBlocks;
            returnTableBlocks = ocrResult.returnTableBlocks;
            returnKvBlocks = ocrResult.returnKvBlocks;
        }

        if (filePromise.status === 'fulfilled') {
            recordId = filePromise.value.id;
        }
    });

    if (!recordId) {
        alert('Supabase Error');
        return;
    }

    // tableBlocks aleady set of as array of arrays (one inner array per page)
    // Other blocks need to be converted to array of arrays, with one inner array containing all blocks for a given page
    // const tableBlocks = [];
    // for (let i = 0; i < returnTableBlocks.length; i++) {
    //     const tablePage = returnTableBlocks[i].page;
    //     while (tableBlocks.length < tablePage) {
    //         tableBlocks.push([]);
    //     }
    //     tableBlocks[tablePage-1].push(returnTableBlocks[i]);
    // }

    // const kvBlocks = [];
    // for (let i = 0; i < returnKvBlocks.length; i++) {
    //     const kvPage = returnKvBlocks[i].page;
    //     while (kvBlocks.length < kvPage) {
    //         kvBlocks.push([]);
    //     }
    //     kvBlocks[kvPage-1].push(returnKvBlocks[i]);
    // }

    // // Step 3: Async Execution
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

    // // update medical record content_embedding_progress to 100
    // const { error: progressError } = await supabaseClient
    //     .from('medical_records')
    //     .update({ content_embedding_progress: 100 })
    //     .eq('id', recordId);
    // if (progressError) {
    //     console.error(progressError);
    //     return;
    // }
    // await changeDoc(recordId);

    // // create a new chat record for the document
    // const { data: chatData, error: chatError } = await supabaseClient
    //     .from('document_chats')
    //     .insert([{ 
    //         record_id: recordId,
    //         user_id: user.id,
    //         title: 'Initial Chat',
    //     }])
    //     .select();
    // if (chatError) {
    //     console.error(chatError);
    //     return;
    // }
    // await changeChat(chatData[0].id);

};