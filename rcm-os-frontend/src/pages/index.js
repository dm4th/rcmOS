import React from 'react';
import axios from 'axios';
import AWS from 'aws-sdk';

export default function Home() {

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        handleFile(file);
    };

    const handleFileDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        handleFile(file);
    };

    const handleFile = (file) => {
        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file.');
            return;
        }

        // Configure AWS S3
        AWS.config.update({
            region: process.env.NEXT_PUBLIC_S3_REGION,
            accessKeyId: process.env.NEXT_PUBLIC_S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.NEXT_PUBLIC_S3_SECRET_ACCESS_KEY
        });

        const s3 = new AWS.S3();
        const params = {
            Bucket: process.env.NEXT_PUBLIC_S3_BUCKET,
            Key: file.name,
            Body: file
        };

        s3.upload(params, (err, data) => {
            if (err) {
                console.error(err);
                return;
            }

            console.log(data);
        });
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
                        <span className="mt-2 text-base leading-normal">Upload Records</span>
                        <input type='file' className="hidden" onChange={handleFileChange} />
                    </label>
                </div>
            </main>
        </div>
    )
}