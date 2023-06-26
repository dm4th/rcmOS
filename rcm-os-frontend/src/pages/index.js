import { useState, useEffect } from 'react';
import React from 'react';

import { CSSTransition } from 'react-transition-group';

import { Intro } from '@/components/Intro';
import { Processing } from '@/components/Processing';

import { useSupaUser } from '@/contexts/SupaAuthProvider';

// import { processFile } from '@/lib/fileProcessing.js';

import { uploadFileAWS, pollJobAWS, getResultsAWS } from '@/lib/aws';
import { createFileSupabase, handleTextSummarySupabase, handleTableSummarySupabase, handleKvSummarySupabase } from '@/lib/supabase';



const awsProcessingStages = [
    { stage: 'Uploading Document to AWS S3', progress: 0, max: 100, active: true },
    { stage: 'Processing Document with AWS Textract', progress: 0, max: 100, active: false },
    { stage: 'Retrieving Textract Analysis Results', progress: 0, max: 100, active: false },
];

const supabaseProcessingStages = [
    { stage: 'Uploading Document to SupaBase Storage', progress: 0, max: 100, active: false },
    { stage: 'Generating Text Summaries & Embeddings', progress: 0, max: 100, active: false },
    { stage: 'Generating Table Summaries & Embeddings', progress: 0, max: 100, active: false },
    { stage: 'Generating Key-Value Summaries & Embeddings', progress: 0, max: 100, active: false },
];



export default function Home() {

    const { user, supabaseClient } = useSupaUser();

    const [appStage, setAppStage] = useState('intro'); // ['intro', 'processing', 'chat']

    const [file, setFile] = useState(null);
    const [uploadStageAWS, setUploadStageAWS] = useState(awsProcessingStages);
    const [uploadStageSupabase, setUploadStageSupabase] = useState(supabaseProcessingStages);

    const [supabaseId, setSupabaseId] = useState(null);

    useEffect(() => {
        if (appStage === 'processing') {
            processFile(file);
        } else {
            setUploadStageAWS(awsProcessingStages);
            setUploadStageSupabase(supabaseProcessingStages);
        }
    }, [appStage]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setFile(file);
        setAppStage('processing');
    };

    const handleFileDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        setFile(file);
        setAppStage('processing');
    };

    const handleTestingButtonClick = () => {
        setFile(null);
        setAppStage('processing');
    };

    const processFile = async (file) => {
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
                setSupabaseId(filePromise.value);
                recordId = filePromise.value;
            }
        });

        if (!recordId) {
            alert('Supabase Error');
            return;
        }

        // Step 3: 
        awsStage = 2;
        setUploadStageAWS((prevState) => {
            const newState = [...prevState];
            newState[awsStage].active = true;
            return newState;
        });
        // TODO: ASYNC FOR TEXT & DOC ANALYSIS CONCURRENCY
        const { returnLineBlocks: textBlocks, returnTableBlocks, returnKvBlocks } = await getResultsAWS(jobId, awsStage, setUploadStageAWS);

        // tableBlocks aleady set of as array of arrays (one inner array per page)
        // Other blocks need to be converted to array of arrays, with one inner array containing all blocks for a given page
        let tableBlocks = [];
        for (var i = 0; i < returnTableBlocks.length; i++) {
            const tablePage = returnTableBlocks[i].page;
            while (tableBlocks.length < tablePage) {
                tableBlocks.push([]);
            }
            tableBlocks[tablePage-1].push(returnTableBlocks[i]);
        }

        let kvBlocks = [];
        for (var i = 0; i < returnKvBlocks.length; i++) {
            const kvPage = returnKvBlocks[i].page;
            while (kvBlocks.length < kvPage) {
                kvBlocks.push([]);
            }
            kvBlocks[kvPage-1].push(returnKvBlocks[i]);
        }

        // Step 4: Async Execution
        setUploadStageSupabase((prevState) => {
            const newState = [...prevState];
            newState[1].active = true;
            newState[2].active = true;
            newState[3].active = true;
            return newState;
        });
        await Promise.allSettled([
            handleTextSummarySupabase(textBlocks, recordId, supabaseClient, 1, setUploadStageSupabase),
            handleTableSummarySupabase(tableBlocks, recordId, supabaseClient, 2, setUploadStageSupabase),
            handleKvSummarySupabase(kvBlocks, recordId, supabaseClient, 3, setUploadStageSupabase),
        ]).then((results) => {
            const textPromise = results[0];
            const tablePromise = results[1];
            const kvPromise = results[2];

            if (textPromise.status === 'fulfilled') {
                setUploadStageSupabase((prevState) => {
                    const newState = [...prevState];
                    newState[1].progress = 100;
                    return newState;
                });
            }

            if (tablePromise.status === 'fulfilled') {
                setUploadStageSupabase((prevState) => {
                    const newState = [...prevState];
                    newState[2].progress = 100;
                    return newState;
                });
            }

            if (kvPromise.status === 'fulfilled') {
                setUploadStageSupabase((prevState) => {
                    const newState = [...prevState];
                    newState[3].progress = 100;
                    return newState;
                });
            }
        });

        setAppStage('chat');

    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-white dark:bg-gray-900">
            <main className="flex flex-col items-center justify-center w-9/12 flex-1 text-center">
                {appStage === 'intro' && (
                    <CSSTransition
                        in={appStage === 'intro'}
                        timeout={300}
                        classNames="slide-up"
                        unmountOnExit
                    >
                        <Intro handleFileChange={handleFileChange} handleFileDrop={handleFileDrop} handleTestingButtonClick={handleTestingButtonClick} />
                    </CSSTransition>
                )}
                {appStage === 'processing' && (
                    <CSSTransition
                        in={appStage === 'processing'}
                        timeout={300}
                        classNames="slide-up"
                        unmountOnExit
                    >
                        <Processing uploadStageAWS={uploadStageAWS} uploadStageSupabase={uploadStageSupabase} />
                    </CSSTransition>
                )}
                {appStage === 'chat' && (
                    <CSSTransition
                        in={appStage === 'chat'}
                        timeout={300}
                        classNames="slide-up"
                        unmountOnExit
                    >
                        <div className="flex flex-col items-center justify-center mt-6">
                            <p> Chat </p>
                        </div>
                    </CSSTransition>
                )}
            </main>
        </div>
    )
}