export const createFileSupabase = async (jobId, file, user, supabaseClient, stage, setUploadStage) => {

    // check if a record with this jobId already exists in the medical_records table
    // if so, set the id using setSupabaseId and return
    // else: 
        // 1. upload the file to supabase storage 
        // 2. create a new record and set the id using setSupabaseId

    // check for existing record
    const { data, error } = await supabaseClient
        .from('medical_records')
        .select('id, file_name')
        .eq('textract_job_id', jobId);
    if (error) {
        alert(error);
        return;
    }

    if (data.length > 0) {
        // If record is found, return the record id and reset all of the summary data in the page_summaries table
        const { error: resetError } = await supabaseClient
            .from('page_summaries')
            .delete()
            .eq('record_id', data[0].id);
        if (resetError) {
            console.error(resetError);
            return;
        }

        setUploadStage((prevState) => {
            const newState = [...prevState];
            newState[stage].progress = 100;
            return newState;
        });
        return data[0];
    }

    // upload file to supabase storage
    const fileUrl = `${user.id}/${file.name}`;
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
    setUploadStage((prevState) => {
        const newState = [...prevState];
        newState[stage].progress = 50;
        return newState;
    });

    // create new record in medical_records table
    const { data: insertData, error: insertError } = await supabaseClient
        .from('medical_records')
        .insert([{ 
            textract_job_id: jobId,
            user_id: user.id,
            file_name: file.name,
            file_url: fileUrl,
            content_embedding_progress: 0
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
    return insertData[0];
};

export const handleTextSummarySupabase = async (blocks, recordId, supabaseClient, stage, setUploadStage) => {

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

export const handleTableSummarySupabase = async (blocks, recordId, supabaseClient, stage, setUploadStage) => {

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

export const handleKvSummarySupabase = async (blocks, recordId, supabaseClient, stage, setUploadStage) => {

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