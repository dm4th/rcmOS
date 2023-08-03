export const createDenialLetterSupabase = async (
    file, 
    claimId,
    processingId,
    textBlocks, 
    tableBlocks, 
    kvBlocks, 
    user, 
    supabaseClient, 
    summaryCallback
) => {
    // start by uploading the file to supabase storage
    // then create a new record in the denial_letters table
    // then send the data blocks to the summarize-<datatype> edge function
    // and finally use the summarize-letter edge function to summarize what the denial reason is

    // upload file to supabase storage
    const fileName = file.name;
    const fileUrl = `${user.id}/${fileName}`;
    const { error: uploadError } = await supabaseClient.storage
        .from('letters')
        .upload(fileUrl, file);
    if (uploadError) {
        if (uploadError.statusCode === '409') {
            console.log('File already exists in storage');
        }
        else {
            console.error(uploadError);
            return;
        }
    }

    // create new record in denial_letters table
    const { data: insertData, error: insertError } = await supabaseClient
        .from('denial_letters')
        .insert([{
            user_id: user.id,
            file_name: fileName,
            file_url: fileUrl,
            content_processing_progress: 0,
            content_processing_type: 'Textract',
            content_processing_id: processingId ? processingId : null,
            text_processing_progress: 0,
            table_processing_progress: 0,
            kv_processing_progress: 0,
            summary_processing_progress: 0,
        }])
        .select();
    if (insertError) {
        console.error(insertError);
        return;
    }
    const denialLetterId = insertData[0].id;

    // create new linking record in claim_documents table
    const { error: claimDocError } = await supabaseClient
        .from('claim_documents')
        .insert([{
            claim_id: claimId,
            document_id: denialLetterId,
            document_type: 'denial_letter',
            user_id: user.id,
        }]);
    if (claimDocError) {
        console.error(claimDocError);
        return;
    };

    // send data blocks to summarize-<datatype> edge function
    const summaryCallbackWithSupabase = async (processingProgress, processType) => {
        summaryCallback(processingProgress, processType);
        const { error: updateError } = await supabaseClient
            .rpc('letter_progress', {progress: processingProgress, letter_id: denialLetterId, data_type: processType});
        if (updateError) {
            console.error(updateError);
        }
    };

    await Promise.allSettled([
        summarizeLetterText(textBlocks, denialLetterId, supabaseClient, summaryCallbackWithSupabase),
        summarizeLetterTables(tableBlocks, denialLetterId, supabaseClient, summaryCallbackWithSupabase),
        summarizeLetterForms(kvBlocks, denialLetterId, supabaseClient, summaryCallbackWithSupabase),
    ]).then((results) => {
        const textResponse = results[0];
        const tableResponse = results[1];
        const kvResponse = results[2];

        if (textResponse.status === 'fulfilled') {
            summaryCallbackWithSupabase(100, 'text');
        }

        if (tableResponse.status === 'fulfilled') {
            summaryCallbackWithSupabase(100, 'table');
        }

        if (kvResponse.status === 'fulfilled') {
            summaryCallbackWithSupabase(100, 'kv');
        }
    });

    // summarize denial letter
    const summaryBody = {
        letterId: denialLetterId
    };
    const denialLetterSummaryData = await supabaseClient.functions.invoke('summarize-letter', {
        body: JSON.stringify(summaryBody),
    });
    summaryCallbackWithSupabase(100, 'summary');

    // Return the denial letter ID
    return { denialLetterId, denialLetterSummary: denialLetterSummaryData.data.summary };
};

const summarizeLetterText = async (blocks, letterId, supabaseClient, summaryCallback) => {

    const totalPages = blocks[blocks.length - 1][0].Page;
    for (const pageData of blocks) {
        if (pageData.length === 0) {
            continue;
        }
        const currentPage = pageData[0].Page;
        console.log(`Summarizing Letter Text page ${currentPage}`);

        const preProcessedPageData = pageData.map((block) => {
            if (block.BlockType === 'PAGE') {
                return {
                    blockType: block.BlockType,
                    page: block.Page,
                };
            }
            return {
                blockType: block.BlockType,
                confidence: block.Confidence,
                text: block.Text,
                left: block.Geometry.BoundingBox.Left,
                top: block.Geometry.BoundingBox.Top,
                width: block.Geometry.BoundingBox.Width,
                height: block.Geometry.BoundingBox.Height,
                page: block.Page,
            };
        });

        // Send page data and page id to Supabase Edge Function
        const requestBody = {
            pageData: preProcessedPageData,
            letterId
        };

        // Step into loop where there is a 3 second wait after a 504 error in case the server takes too long to respond
        let running = true;
        while (running) {
            try {
                await supabaseClient.functions.invoke('summarize-text', {
                    body: JSON.stringify(requestBody),
                });
                running = false;
            }
            catch (error) {
                if (error.statusCode === 504) {
                    console.log('Timeout Error - Retrying in 3 seconds');
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
                else if (error instanceof TypeError && error.message === 'Failed to fetch') {
                    console.log('Network Error - Retrying in 3 seconds');
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
                else {
                    console.error(error);
                    return;
                }
            }
        }
        const progress = Math.floor((currentPage / totalPages) * 100);
        summaryCallback(progress, "text");
    }
};

const summarizeLetterTables = async (blocks, letterId, supabaseClient, summaryCallback) => {

    const totalPages = blocks.length;
    for (const pageData of blocks) {
        if (pageData.length === 0) {
            continue;
        }
        const currentPage = pageData[0].page;
        console.log(`Processing Tables page ${currentPage}`);

        const preProcessedPageData = pageData.map((block) => {
            return {
                page: block.page,
                confidence: block.confidence,
                left: block.left,
                top: block.top,
                right: block.right,
                bottom: block.bottom,
                title: block.title,
                footer: block.footer,
                cells: block.cells
            };
        });

        // Send page data and page id to Supabase Edge Function
        const requestBody = {
            pageData: preProcessedPageData,
            letterId,
        };

        // Step into loop where there is a 3 second wait after a 504 error in case the server takes too long to respond
        let running = true;
        while (running) {
            try {
                await supabaseClient.functions.invoke('summarize-table', {
                    body: JSON.stringify(requestBody),
                });
                running = false;
            }
            catch (error) {
                if (error.statusCode === 504) {
                    console.log('Timeout Error - Retrying in 3 seconds');
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
                else if (error instanceof TypeError && error.message === 'Failed to fetch') {
                    console.log('Network Error - Retrying in 3 seconds');
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
                else {
                    console.error(error);
                    return;
                }
            }
        }

        const progress = Math.floor((currentPage / totalPages) * 100);
        summaryCallback(progress, "table");
    }

};

const summarizeLetterForms = async (blocks, letterId, supabaseClient, summaryCallback) => {

    const totalPages = blocks.length;
    for (const pageData of blocks) {
        if (pageData.length === 0) {
            continue;
        }
        const currentPage = pageData[0].page;
        console.log(`Processing Key-Value page ${currentPage}`);

        const preProcessedPageData = pageData.map((block) => {
            return {
                page: block.page,
                confidence: Math.min(block.keyConfidence, block.valueConfidence),
                left: block.left,
                top: block.top,
                right: block.right,
                bottom: block.bottom,
                key: block.key,
                value: block.value,
            };
        });

        // Send page data and record id to Supabase Edge Function
        const requestBody = {
            pageData: preProcessedPageData,
            letterId
        };

        // Step into loop where there is a 3 second wait after a 504 error in case the server takes too long to respond
        let running = true;
        while (running) {
            try {
                await supabaseClient.functions.invoke('summarize-kv', {
                    body: JSON.stringify(requestBody),
                });
                running = false;
            }
            catch (error) {
                if (error.statusCode === 504) {
                    console.log('Timeout Error - Retrying in 3 seconds');
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
                else if (error instanceof TypeError && error.message === 'Failed to fetch') {
                    console.log('Network Error - Retrying in 3 seconds');
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
                else {
                    console.error(error);
                    return;
                }
            }
        }

        const progress = Math.floor((currentPage / totalPages) * 100);
        summaryCallback(progress, "kv");
    }

};
    


export const createFileSupabase = async (jobId, file, inputTemplateId, user, supabaseClient, stage, setUploadStage) => {

    // check if a record with this jobId already exists in the medical_records table
    // if so, set the id using setSupabaseId and return
    // else: 
        // 1. Get an input template id from the input_templates table - prompt the user to create a new one if none exist
        // 2. upload the file to supabase storage 
        // 3. create a new record and set the id using setSupabaseId

    // check for existing record
    setUploadStage((prevState) => {
        const newState = [...prevState];
        newState[stage].active=true;
        return newState;
    });

    const { data: existingRecord, error: existingRecordError } = await supabaseClient
        .from('medical_records')
        .select('*')
        .eq('textract_job_id', jobId)
        .eq('template_id', inputTemplateId);
    if (existingRecordError) {
        console.error(existingRecordError);
        return;
    }
    if (existingRecord.length > 0) {
        console.log('record already exists in medical_records table');

        // reset summary embeddings
        const { error: resetError } = await supabaseClient
            .from('page_summaries')
            .delete()
            .eq('record_id', existingRecord[0].id);
        if (resetError) {
            console.error(resetError);
            return;
        }

        setUploadStage((prevState) => {
            const newState = [...prevState];
            newState[stage].progress = 100;
            return newState;
        });
        return existingRecord[0].id;
    }

    // upload file to supabase storage
    let fileUrl;
    let fileName;
    if (file) {
        fileName = file.name;
        fileUrl = `${user.id}/${fileName}`;
        const { error: uploadError } = await supabaseClient.storage
            .from('records')
            .upload(fileUrl, file);
        if (uploadError) {
            if (uploadError.statusCode === '409') {
                console.log('File already exists in storage');
            }
            else {
                console.error(uploadError);
                return;
            }
        }
    }
    else {
        fileName = 'Sample_Inpt_HR.pdf';
        fileUrl = `${user.id}/${fileName}`;
    }
    setUploadStage((prevState) => {
        const newState = [...prevState];
        newState[stage].progress = 50;
        return newState;
    });

    // create new record in medical_records table
    console.log('inserting record with template id: ', inputTemplateId);
    const { data: insertData, error: insertError } = await supabaseClient
        .from('medical_records')
        .insert([{ 
            textract_job_id: jobId,
            user_id: user.id,
            file_name: fileName,
            file_url: fileUrl,
            content_embedding_progress: 0,
            template_id: inputTemplateId,
        }])
        .select();
    if (insertError) {
        console.error(insertError);
        return;
    }
    setUploadStage((prevState) => {
        const newState = [...prevState];
        newState[stage].progress = 100;
        return newState;
    });
    return insertData[0].id;
};

export const handleTextSummarySupabase = async (blocks, recordId, inputTemplate, supabaseClient, stage, setUploadStage) => {

    console.log('text', blocks);

    const totalPages = blocks[blocks.length - 1][0].Page;
    for (const pageData of blocks) {
        if (pageData.length === 0) {
            continue;
        }
        const currentPage = pageData[0].Page;
        console.log(`Processing Text page ${currentPage}`);

        const preProcessedPageData = pageData.map((block) => {
            if (block.BlockType === 'PAGE') {
                return {
                    blockType: block.BlockType,
                    page: block.Page,
                };
            }
            return {
                blockType: block.BlockType,
                confidence: block.Confidence,
                text: block.Text,
                left: block.Geometry.BoundingBox.Left,
                top: block.Geometry.BoundingBox.Top,
                width: block.Geometry.BoundingBox.Width,
                height: block.Geometry.BoundingBox.Height,
                page: block.Page,
            };
        });

        // Send page data and page id to Supabase Edge Function
        const requestBody = {
            pageData: preProcessedPageData,
            recordId,
            inputTemplate,
        };

        // Step into loop where there is a 3 second wait after a 504 error in case the server takes too long to respond
        let running = true;
        while (running) {
            try {
                await supabaseClient.functions.invoke('process-page', {
                    body: JSON.stringify(requestBody),
                });
                running = false;
            }
            catch (error) {
                if (error.statusCode === 504) {
                    console.log('Timeout Error - Retrying in 3 seconds');
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
                else if (error instanceof TypeError && error.message === 'Failed to fetch') {
                    console.log('Network Error - Retrying in 3 seconds');
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
                else {
                    console.error(error);
                    return;
                }
            }
        }

        setUploadStage((prevState) => {
            const newState = [...prevState];
            newState[stage].progress = Math.floor((currentPage / totalPages) * 100);
            return newState;
        });
    }
};

export const handleTableSummarySupabase = async (blocks, recordId, inputTemplate, supabaseClient, stage, setUploadStage) => {

    console.log('table', blocks);

    const totalPages = blocks.length;
    for (const pageData of blocks) {
        if (pageData.length === 0) {
            continue;
        }
        const currentPage = pageData[0].page;
        console.log(`Processing Tables page ${currentPage}`);

        const preProcessedPageData = pageData.map((block) => {
            return {
                page: block.page,
                confidence: block.confidence,
                left: block.left,
                top: block.top,
                right: block.right,
                bottom: block.bottom,
                title: block.title,
                footer: block.footer,
                cells: block.cells
            };
        });

        // Send page data and page id to Supabase Edge Function
        const requestBody = {
            pageData: preProcessedPageData,
            recordId,
            inputTemplate,
        };

        // Step into loop where there is a 3 second wait after a 504 error in case the server takes too long to respond
        let running = true;
        while (running) {
            try {
                await supabaseClient.functions.invoke('process-table', {
                    body: JSON.stringify(requestBody),
                });
                running = false;
            }
            catch (error) {
                if (error.statusCode === 504) {
                    console.log('Timeout Error - Retrying in 3 seconds');
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
                else if (error instanceof TypeError && error.message === 'Failed to fetch') {
                    console.log('Network Error - Retrying in 3 seconds');
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
                else {
                    console.error(error);
                    return;
                }
            }
        }

        setUploadStage((prevState) => {
            const newState = [...prevState];
            newState[stage].progress = Math.floor((currentPage / totalPages) * 100);
            return newState;
        });
    }
};

export const handleKvSummarySupabase = async (blocks, recordId, inputTemplate, supabaseClient, stage, setUploadStage) => {

    console.log('kv', blocks);

    const totalPages = blocks.length;
    for (const pageData of blocks) {
        if (pageData.length === 0) {
            continue;
        }
        const currentPage = pageData[0].page;
        console.log(`Processing Key-Value page ${currentPage}`);

        const preProcessedPageData = pageData.map((block) => {
            return {
                page: block.page,
                confidence: Math.min(block.keyConfidence, block.valueConfidence),
                left: block.left,
                top: block.top,
                right: block.right,
                bottom: block.bottom,
                key: block.key,
                value: block.value,
            };
        });

        // Send page data and record id to Supabase Edge Function
        const requestBody = {
            pageData: preProcessedPageData,
            recordId,
            inputTemplate
        };

        // Step into loop where there is a 3 second wait after a 504 error in case the server takes too long to respond
        let running = true;
        while (running) {
            try {
                await supabaseClient.functions.invoke('process-kv', {
                    body: JSON.stringify(requestBody),
                });
                running = false;
            }
            catch (error) {
                if (error.statusCode === 504) {
                    console.log('Timeout Error - Retrying in 3 seconds');
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
                else if (error instanceof TypeError && error.message === 'Failed to fetch') {
                    console.log('Network Error - Retrying in 3 seconds');
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
                else {
                    console.error(error);
                    return;
                }
            }
        }

        setUploadStage((prevState) => {
            const newState = [...prevState];
            newState[stage].progress = Math.floor((currentPage / totalPages) * 100);
            return newState;
        });
    }
};