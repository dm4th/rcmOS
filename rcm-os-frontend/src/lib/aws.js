// deno-lint-ignore-file no-async-promise-executor
import axios from 'axios';

export const handleFileAWS = async (
    file, 
    setUploadStage, 
    setUploadProgress, 
    createFileSupabase, 
    handlePageSupabase, 
    setUploadStageSupabase, 
    setUploadProgressSupabase,
    supabaseId,
    setSupabaseId
) => {
    // If there's no file sent to the function, we are testing and will use a local file
    let jobId;
    if (!file) {
        jobId = "e1e46135476447b62ef5ce57b78c7e253440f2e97abd22c02bc583f50e30a2e3";
        console.log(`Using hardcoded jobId: ${jobId}`);
    } else {
        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file.');
            return;
        }

        // Request Pre-Signed URL from API Gateway - Lambda Function
        console.log('Requesting Pre-Signed URL from API Gateway - Lambda Function');
        const urlRes = await axios.post(process.env.NEXT_PUBLIC_AWS_UPLOAD_FUNCTION_URL, {
            fileName: file.name,
        });
        const url = JSON.parse(urlRes.data.body).url;
        console.log(`Upload URL: ${url}`);

        // Upload PDF to S3 Bucket
        setUploadStage('Uploading Record to S3 for Preprocessing');
        setUploadProgress(0);
        const uploadRes = await axios.put(url, file, {
            headers: {
                'Content-Type': 'application/pdf',
            },
            onUploadProgress: (progressEvent) => {
                const { loaded, total } = progressEvent;
                const percent = Math.floor((loaded / total) * 100);
                setUploadProgress(percent);
            },
        });

        if (uploadRes.status !== 200) {
            alert('Error uploading file to S3');
            setUploadStage(null);
            setUploadProgress(0);
            return;
        }

        // Kick off Textract Processing
        setUploadStage('Starting Record Processing with AWS Textract');
        setUploadProgress(0);
        const textractRes = await axios.post(process.env.NEXT_PUBLIC_AWS_TEXTRACT_FUNCTION_URL, {
            S3Object: {
                Bucket: process.env.NEXT_PUBLIC_S3_BUCKET,
                Name: file.name,
            },
        });
        jobId = JSON.parse(textractRes.data.body).JobId;    // TODO: turn into const once testing code is removed
        console.log(`Textract Job ID: ${jobId}`);
    }
    createFileSupabase(jobId, setUploadStageSupabase, setUploadProgressSupabase, setSupabaseId);


    // Poll Textract Job Status
    setUploadStage('Processing Document with AWS Textract');
    setUploadProgress(0);
    let jobStatus = 'IN_PROGRESS';
    let statusRes;
    while (jobStatus === 'IN_PROGRESS') {
        // poll every 1 seconds
        await new Promise((resolve) => {
            setTimeout(resolve, 1000);
        });
        statusRes = await axios.post(process.env.NEXT_PUBLIC_AWS_TEXTRACT_FUNCTION_URL, {
            JobId: jobId,
        });
        jobStatus = JSON.parse(statusRes.data.body).JobStatus;
        setUploadProgress((prevProgress) => prevProgress + 1);
    }

    console.log('Textract Job Complete');

    // Retrieve Full Textract Results
    setUploadStage('Retrieving Textract Results');
    setUploadProgress(0);
    let nextToken = null;
    let first = true;
    let totalPages = 0;
    let oldBlocks = [];

    return new Promise( async (resolve, reject) => {
        try {
            while (first || nextToken) {
                let nextRes;
                if (first) {
                    first = false;
                    nextRes = statusRes;
                    totalPages = JSON.parse(nextRes.data.body).Metadata.Pages;
                } else {
                    nextRes = await axios.post(process.env.NEXT_PUBLIC_AWS_TEXTRACT_FUNCTION_URL, {
                        JobId: jobId,
                        NextToken: nextToken,
                    });
                }
                const nextSuccessData = JSON.parse(nextRes.data.body);
        
                // Parse Returned Blocks for finished pages and pass them to the 
                const newBlocks = nextSuccessData.Blocks.filter((block) => block.BlockType !== 'WORD');
                const { completedPages, leftoverBlocks } = handlePageAWS(oldBlocks, newBlocks);
                oldBlocks = leftoverBlocks;
                for (let i = 0; i < completedPages.length; i++) {
                    handlePageSupabase(completedPages[i], supabaseId, setUploadStageSupabase, setUploadProgressSupabase, totalPages);
                }
        
                // Update Progress and track Next Token
                nextToken = nextSuccessData.NextToken;
                const nextMaxPage = nextSuccessData.Blocks[nextSuccessData.Blocks.length - 1].Page;
                setUploadProgress(Math.floor((nextMaxPage / totalPages) * 100));
            }

            // Handle any leftover blocks
            handlePageSupabase(oldBlocks, supabaseId, setUploadStageSupabase, setUploadProgressSupabase, totalPages);
        
            console.log('Textract Results Retrieved');
            setUploadStage('Textract Results Retrieved');
            setUploadProgress(100);
            resolve();
        } catch (error) {
            console.log(error);
            reject(error);
        }
    });
};

const handlePageAWS = (oldBlocks, newBlocks) => {
    // Create return array
    const completedPages = [];

    // Loop through newBlocks
    // If we find a new page, extend the old blocks array by all of the prevrious newBlocks items before the new page
    // Then add that extended array to the completedPages array
    // Then set the current page to the new page we found, set oldBlocks to null, and continue
    // If we don't find a new page, add the new block to the oldBlocks array and return it as part of the funciton return object
    for (let i = 0; i < newBlocks.length; i++) {
        const block = newBlocks[i];
        if (block.BlockType === 'PAGE') {
            if (oldBlocks.length > 0) {
                completedPages.push(oldBlocks);
                oldBlocks = [];
            }
            oldBlocks.push(block);
        } else {
            oldBlocks.push(block);
        }
    }
    const leftoverBlocks = oldBlocks;
    return { completedPages, leftoverBlocks };
};
