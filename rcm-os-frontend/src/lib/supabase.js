import { createClient } from '@supabase/supabase-js';

export const createFileSupabase = async (jobId, file) => {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // check if a record with this jobId already exists in the medical_records table
    // if so, set the id using setSupabaseId and return
    // else: 
        // 1. upload the file to supabase storage 
        // 2. create a new record and set the id using setSupabaseId
    const { data, error } = await supabase
        .from('medical_records')
        .select('id')
        .eq('textract_job_id', jobId);
    if (error) {
        alert(error);
        return;
    }

    if (data.length > 0) {
        setSupabaseId(data[0].id);
        return data[0].id;
    }

    // TODO: upload file to supabase storage
    const fileUrl = `records/${file.name}`;
    const { error: uploadError } = await supabase.storage
        .from('records')
        .upload(fileUrl, file);
    if (uploadError) {
        alert(uploadError);
        return;
    }

    const { data: insertData, error: insertError } = await supabase
        .from('medical_records')
        .insert([{ 
            textract_job_id: jobId,
            file_name: file.name,
            file_url: fileUrl,
        }])
        .select();
    if (insertError) {
        alert(insertError);
        return;
    }
    return insertData[0].id;
};

export const handlePageSupabase = async (pageData, recordId, setUploadStage, setUploadProgress, totalPages) => {
    setUploadStage('Uploading Pages to Supabase');
    const currentPage = pageData[0].Page;

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
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const requestBody = {
        pageData: preProcessedPageData,
        recordId,
    };

    const { data, error } = await supabase.functions.invoke('process-page', {
        body: JSON.stringify(requestBody),
    });
    if (error) {
        console.log(error);
        return;
    }
    console.log(`Page ${currentPage} data sent to Supabase Edge Function`);
    console.log(data);

    const progress = Math.floor((currentPage / totalPages) * 100);
    setUploadProgress(progress);
};