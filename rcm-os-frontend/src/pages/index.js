import { useState, useEffect } from 'react';
import React from 'react';

import { handleFileAWS } from '@/lib/aws';
import { createFileSupabase, handlePageSupabase } from '@/lib/supabase';

export default function Home() {

    const [appStage, setAppStage] = useState('intro'); // ['intro', 'processing', 'chat']

    const [uploadStageAWS, setUploadStageAWS] = useState(null);
    const [uploadProgressAWS, setUploadProgressAWS] = useState(0);

    const [supabaseId, setSupabaseId] = useState(null); 
    const [uploadStageSupabase, setUploadStageSupabase] = useState(null);
    const [uploadProgressSupabase, setUploadProgressSupabase] = useState(0);

    useEffect(() => {
        setUploadStageAWS(null);
        setUploadProgressAWS(0);
        setUploadStageSupabase(null);
        setUploadProgressSupabase(0);
    }, [appStage]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setAppStage('processing');
        handleFileAWS(
            file, 
            setUploadStageAWS, 
            setUploadProgressAWS,
            createFileSupabase,
            handlePageSupabase,
            setUploadStageSupabase,
            setUploadProgressSupabase,
            supabaseId,
            setSupabaseId
        );
        setAppStage('chat');
    };

    const handleFileDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        setAppStage('processing');
        handleFileAWS(
            file, 
            setUploadStageAWS, 
            setUploadProgressAWS,
            createFileSupabase,
            handlePageSupabase,
            setUploadStageSupabase,
            setUploadProgressSupabase,
            supabaseId,
            setSupabaseId
        );
        setAppStage('chat');
    };

    const handleTestingButtonClick = () => {
        setAppStage('processing');
        handleFileAWS(
            null, 
            setUploadStageAWS, 
            setUploadProgressAWS,
            createFileSupabase,
            handlePageSupabase,
            setUploadStageSupabase,
            setUploadProgressSupabase,
            supabaseId,
            setSupabaseId
        );
        setAppStage('chat');
    };

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
                {supabaseId && (
                    <div className="flex flex-col items-center justify-center mt-6">
                        <p className="text-2xl text-gray-900 dark:text-white">
                            Supabase ID: {supabaseId} 
                        </p>
                    </div>
                )}
            </main>
        </div>
    )
}