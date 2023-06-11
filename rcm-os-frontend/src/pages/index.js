import { useState, useEffect } from 'react';
import React from 'react';

import { uploadFileAWS, pollJobAWS, handleFileAWS } from '@/lib/aws';
import { createFileSupabase, handlePageSupabase } from '@/lib/supabase';
import { pollJobAWS } from '../lib/aws.js';

export default function Home() {

    const [appStage, setAppStage] = useState('intro'); // ['intro', 'processing', 'chat']

    const [uploadStageAWS, setUploadStageAWS] = useState(null);
    const [uploadProgressAWS, setUploadProgressAWS] = useState(null);

    const [supabaseId, setSupabaseId] = useState(null); 
    const [uploadStageSupabase, setUploadStageSupabase] = useState(null);
    const [uploadProgressSupabase, setUploadProgressSupabase] = useState(null);

    useEffect(() => {
        setUploadStageAWS(null);
        setUploadProgressAWS(0);
        setUploadStageSupabase(null);
        setUploadProgressSupabase(0);
    }, [appStage]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setAppStage('processing');
        processFile(file);
        setAppStage('chat');
    };

    const handleFileDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        setAppStage('processing');
        handleFileAWS(file);
        setAppStage('chat');
    };

    const handleTestingButtonClick = () => {
        setAppStage('processing');
        processFile(null)
        setAppStage('chat');
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
            // SupaBase: Generate Section summaries for each page, upload summary & actual textual embeddings, upload to SupaBase

        // Step 1:
        const textractId = await uploadFileAWS(file, setUploadStageAWS, setUploadProgressAWS);

        // Step 2:
        Promise.allSettled([
            pollJobAWS(textractId),
            createFileSupabase(textractId, file)
        ]).then((results) => {
            const pollPromise = results[0];
            const filePromise = results[1];

            if (pollPromise.status === 'fulfilled') {
                const pageCount = pollPromise.value;
                setUploadStageAWS(`Textract Processed ${pageCount} Pages`);
            }

            if (filePromise.status === 'fulfilled') {
                setSupabaseId(filePromise.value);
            }
        });
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-white dark:bg-gray-900">
            <main className="flex flex-col items-center justify-center w-9/12 flex-1 text-center">
                <h1 className="text-6xl font-bold text-gray-900 dark:text-white">
                    Welcome to rcmOS
                </h1>

                <p className="mt-3 text-2xl text-gray-900 dark:text-white">
                    Upload a medical record to get started.
                </p>

                <div className="flex items-center justify-center mt-6">
                    <label 
                        className="w-64 flex flex-col items-center px-4 py-6 bg-white text-blue rounded-lg shadow-lg tracking-wide uppercase border border-blue cursor-pointer hover:bg-blue hover:text-white dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 dark:border-gray-700 dark:shadow-none"
                        onDrop={handleFileDrop}
                        onDragOver={(e) => e.preventDefault()}
                    >
                        <svg className="w-8 h-8" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path d="M17 10h-4V0H7v10H3l7 7 7-7z" />
                        </svg>
                        <span className="mt-2 text-base leading-normal">Upload Record</span>
                        <input type='file' className="hidden" onChange={handleFileChange} />
                    </label>
                </div>
                <button onClick={handleTestingButtonClick} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
                    Run LLM Processing with Pre-Processed Textract Record
                </button>
                {uploadStageAWS && (
                    <div className="flex flex-col items-center justify-center mt-6">
                        <p className="text-2xl text-gray-900 dark:text-white">
                            {uploadStageAWS} {uploadProgressAWS !== 0 && ` - ${uploadProgressAWS}%`} 
                        </p>
                    </div>
                )}
                {uploadStageSupabase && (
                    <div className="flex flex-col items-center justify-center mt-6">
                        <p className="text-2xl text-gray-900 dark:text-white">
                            {uploadStageSupabase} {uploadProgressSupabase !== 0 && ` - ${uploadProgressSupabase}%`} 
                        </p>
                    </div>
                )}
            </main>
        </div>
    )
}