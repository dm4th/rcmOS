import { createClient } from '@supabase/supabase-js';

export const createFileSupabase = async (jobIds, file, stage, setUploadStage) => {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // check if a record with this jobId already exists in the medical_records table
    // if so, set the id using setSupabaseId and return
    // else: 
        // 1. upload the file to supabase storage 
        // 2. create a new record and set the id using setSupabaseId

    // check for existing record
    const { data, error } = await supabase
        .from('medical_records')
        .select('id')
        .eq('text_job_id', jobIds.text)
        .eq('analysis_job_id', jobIds.analysis);
    if (error) {
        alert(error);
        return;
    }

    if (data.length > 0) {
        setUploadStage((prevState) => {
            const newState = [...prevState];
            newState[stage].progress = 100;
            return newState;
        });
        return data[0].id;
    }

    // upload file to supabase storage
    const fileUrl = `records/${file.name}`;
    const { error: uploadError } = await supabase.storage
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
    const { data: insertData, error: insertError } = await supabase
        .from('medical_records')
        .insert([{ 
            text_job_id: jobIds.text,
            analysis_job_id: jobIds.analysis,
            file_name: file.name,
            file_url: fileUrl,
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

export const handleSummarySupabase = async (blocks, recordId, stage, setUploadStage) => {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const totalPages = blocks[blocks.length - 1][0].Page;
    for (const pageData of blocks) {
        const currentPage = pageData[0].Page;
        console.log(`Processing page ${currentPage}`);

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

        console.log(requestBody);

        const { data, error } = await supabase.functions.invoke('process-page', {
            body: JSON.stringify(requestBody),
        });
        if (error) {
            console.log(error);
            return;
        }
        console.log(`Page ${currentPage} data sent to Supabase Edge Function`);
        console.log(data);

        setUploadStage((prevState) => {
            const newState = [...prevState];
            newState[stage].progress = Math.floor((currentPage / totalPages) * 100);
            return newState;
        });
    }
};

export const handleTextSupabase = async (blocks, recordId, stage, setUploadStage) => {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    //flatten blocks array, filter for line blocks only, filter for 99% and greater confidence
    const textBlocks = blocks.flat();
    const lineBlocks = textBlocks.filter((block) => block.BlockType === 'LINE').filter((block) => block.Confidence >= 99);

    // set the max progress to the number of lines
    setUploadStage((prevState) => {
        const newState = [...prevState];
        newState[stage].maxProgress = lineBlocks.length;
        return newState;
    });

    for (const line in lineBlocks) {
        console.log(`Processing line ${line}`);
        const preProcessedLineData = {
            page_number: lineBlocks[line].Page,
            confidence: lineBlocks[line].Confidence,
            text: lineBlocks[line].Text,
            left: lineBlocks[line].Geometry.BoundingBox.Left,
            top: lineBlocks[line].Geometry.BoundingBox.Top,
            width: lineBlocks[line].Geometry.BoundingBox.Width,
            height: lineBlocks[line].Geometry.BoundingBox.Height,
        };

        // Send line data and record id to Supabase Edge Function
        const requestBody = {
            lineData: preProcessedLineData,
            recordId,
        };

        console.log(requestBody);

        const { error } = await supabase.functions.invoke('process-word', {
            body: JSON.stringify(requestBody),
        });
        if (error) {
            console.log(error);
            return;
        }

        setUploadStage((prevState) => {
            const newState = [...prevState];
            newState[stage].progress = Math.floor((line / lineBlocks.length) * 100);
            return newState;
        });
    }
};