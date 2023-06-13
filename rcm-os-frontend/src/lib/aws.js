// deno-lint-ignore-file no-async-promise-executor
import axios from 'axios';

export const uploadFileAWS = async (file, stage, setUploadStage) => {
    if (!file) {
        // If no file is passed to the function, return hard-coded textract job id
        const jobId = "d3f5cdc94281b0c87501af5c692118e8b0fcb0635af5dfb3e4994e3f69e14d51";
        setUploadStage((prevState) => {
            const newState = [...prevState];
            newState[stage].progress = 100;
            return newState;
        });
        return jobId;
    }

    // If file type is not a pdf, return nothing
    if (file.type !== 'application/pdf') {
        alert('Please upload a PDF file.');
        return;
    }
    
    // Request Pre-Signed URL from API Gateway
    const urlRes = await axios.post(process.env.NEXT_PUBLIC_AWS_UPLOAD_FUNCTION_URL, {
        fileName: file.name,
    });
    const url = JSON.parse(urlRes.data.body).url;

    // Upload file to S3 with Pre-Signed URL
    const uploadRes = await axios.put(url, file, {
        headers: {
            'Content-Type': 'application/pdf',
        },
        onUploadProgress: (progressEvent) => {
            const { loaded, total } = progressEvent;
            const percent = Math.floor((loaded / total) * 100);
            setUploadStage((prevState) => {
                const newState = [...prevState];
                newState[stage].progress = percent;
                return newState;
            });
        },
    });

    if (uploadRes.status !== 200) {
        alert('Error uploading file to S3');
        return;
    }

    // Kick off Textract Processing
    const textractRes = await axios.post(process.env.NEXT_PUBLIC_AWS_TEXTRACT_FUNCTION_URL, {
        S3Object: {
            Bucket: process.env.NEXT_PUBLIC_S3_BUCKET,
            Name: file.name,
        },
    });
    const textJobId = JSON.parse(textractRes.data.body).TextJobId;
    const analysisJobId = JSON.parse(textractRes.data.body).AnalysisJobId;

    return {
        textJobId,
        analysisJobId
    };
};

export const pollJobAWS = async (jobIds, stage, setUploadStage) => {
    // Poll Textract Job Status
    let jobStatus = { text: 'IN_PROGRESS', analysis: 'IN_PROGRESS' };
    let textStatusRes;
    let analysisStatusRes;
    let uploadTracker = 0;
    while (jobStatus.text === 'IN_PROGRESS' && jobStatus.analysis === 'IN_PROGRESS') {
        // poll every 0.5 seconds
        await new Promise((resolve) => {
            setTimeout(resolve, 1000);
        });

        textStatusRes = await axios.post(process.env.NEXT_PUBLIC_AWS_TEXTRACT_FUNCTION_URL, {
            Job: 'Text',
            JobId: jobIds.textJobId,
        });
        jobStatus.text = JSON.parse(textStatusRes.data.body).JobStatus;
        analysisStatusRes = await axios.post(process.env.NEXT_PUBLIC_AWS_TEXTRACT_FUNCTION_URL, {
            Job: 'Analysis',
            JobId: jobIds.analysisJobId,
        });
        jobStatus.analysis = JSON.parse(analysisStatusRes.data.body).JobStatus;

        uploadTracker++;
        if (uploadTracker >= 95) {
            setUploadStage((prevState) => {
                const newState = [...prevState];
                newState[stage].stage = 'Processing Document with AWS Textract - Taking Longer than Expected';
                newState[stage].progress = 95;
                return newState;
            });
        }
        else setUploadStage((prevState) => {
            const newState = [...prevState];
            newState[stage].stage = 'Processing Document with AWS Textract';
            newState[stage].progress = uploadTracker;
            return newState;
        });
    }

    // If job status is not SUCCEEDED, return null
    if (jobStatus.text !== 'SUCCEEDED' || jobStatus.analysis !== 'SUCCEEDED') {
        alert('Error processing file with AWS Textract');
        return null;
    }

    setUploadStage((prevState) => {
        const newState = [...prevState];
        newState[stage].stage = 'Processing Document with AWS Textract';
        newState[stage].progress = 100;
        return newState;
    });
    return {
        textPages: JSON.parse(textStatusRes.data.body).Metadata.Pages,
        analysisPages: JSON.parse(analysisStatusRes.data.body).Metadata.Pages,
    };
};

export const getResultsAWS = async (jobId, stage, setUploadStage) => {
    // Retrieve Full Textract Results
    let nextToken = null;
    let first = true;
    let totalPages = 0;
    let oldBlocks = [];
    let returnBlocks = [];

    while (first || nextToken) {
        let jobRes;
        if (first) {
            first = false;
            jobRes = await axios.post(process.env.NEXT_PUBLIC_AWS_TEXTRACT_FUNCTION_URL, {
                JobId: jobId,
            });
            totalPages = JSON.parse(jobRes.data.body).Metadata.Pages;
        } else {
            jobRes = await axios.post(process.env.NEXT_PUBLIC_AWS_TEXTRACT_FUNCTION_URL, {
                JobId: jobId,
                NextToken: nextToken,
            });
        }
        const jobData = JSON.parse(jobRes.data.body);

        // Parse Returned Blocks for finished pages and pass them to the 
        const newBlocks = jobData.Blocks.filter((block) => block.BlockType !== 'WORD');
        const { completedPages, leftoverBlocks } = handlePageAWS(oldBlocks, newBlocks);
        oldBlocks = leftoverBlocks;
        returnBlocks = returnBlocks.concat(completedPages);

        // Update Progress and track Next Token
        nextToken = jobData.NextToken;
        const nextMaxPage = jobData.Blocks[jobData.Blocks.length - 1].Page - 1;
        setUploadStage((prevState) => {
            const newState = [...prevState];
            newState[stage].progress = Math.floor((nextMaxPage / totalPages) * 100);
            return newState;
        });
    }

    // Handle any leftover blocks
    returnBlocks = returnBlocks.concat(oldBlocks);

    setUploadStage((prevState) => {
        const newState = [...prevState];
        newState[stage].progress = 100;
        return newState;
    });
    return returnBlocks;
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
