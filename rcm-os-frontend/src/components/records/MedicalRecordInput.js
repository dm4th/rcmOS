// Context Imports
import { useSupaUser } from '@/contexts/SupaAuthProvider';
import React, { useState, useEffect } from 'react';

export function MedicalRecordInput({ handleSubmit }) {

    // Get Supabase User context
    const { user, supabaseClient } = useSupaUser();

    // Set up state for the form
    const [medicalRecords, setMedicalRecords] = useState([]);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [uploadedRecord, setUploadedRecord] = useState(null);
    const [uploadedFileName, setUploadedFileName] = useState(null);
    const [submitError, setSubmitError] = useState('');

    // Handle form submission
    const handleRecordLink = () => { 
        if (!selectedRecord && !uploadedRecord) {
            setSubmitError('Please select a previously uploaded medical record or upload a new one');
        }
        else {
            handleSubmit(selectedRecord, uploadedRecord);
        }
    };

    // Handle file upload
    const handleFileUpload = (e) => {
        setUploadedRecord(e.target.files[0]);
        setUploadedFileName(e.target.files[0].name);
    };

    // Handle file drag and drop
    const handleFileDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        setUploadedRecord(file);
        setUploadedFileName(file.name);
    };

    useEffect(() => {
        console.log('Initial Use Effect')
        const fetchRecords = async () => {
            const { data, error } = await supabaseClient
                .from('medical_records')
                .select('id, file_name')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            if (error) {
                console.error(error);
            } else {
                setMedicalRecords(data);
            }
        };
        fetchRecords();
    }, []);

    useEffect(() => {
        if (uploadedRecord) {
            setSelectedRecord(null);
            setSubmitError('');
        }
    }, [uploadedRecord]);

    useEffect(() => {
        if (selectedRecord) {
            setUploadedRecord(null);
            setUploadedFileName(null);
            setSubmitError('');
        }
    }, [selectedRecord]);

    return (
        <div className="flex flex-col justify-between m-2 ">
            <h3 className="text-lg font-bold mb-2">Link a Medical Record</h3>
            <div className="border-b border-gray-400 dark:border-gray-600 w-full self-center"></div>
            {medicalRecords.length > 0 && (
            <div className='flex flex-col justify-between m-1 py-2'>
                <label className="block text-gray-900 dark:text-gray-100 text-sm font-bold mb-2" htmlFor="file-list">
                    Select Pre-Processed Denial Letter
                </label>
                <select className="shadow appearance-none border rounded w-full py-2 px-3 mb-1 text-gray-900 leading-tight focus:ring-2 focus:shadow-outline" id="file-list" value={selectedRecord} onChange={(e) => setSelectedRecord(e.target.value)}>
                    <option className='text-gray-700' value={null}>...</option>
                    {medicalRecords.map((file) => (
                        <option key={file.id} value={file.id}>{file.file_name}</option>
                    ))}
                </select>
            </div>
            )}
            {medicalRecords.length > 0 && (
                <div className='flex flex-row justify-between m-1'>
                    <div className="border-b border-gray-400 dark:border-gray-600 w-1/3 self-center"></div>
                    <p className="text-gray-600 dark:text-gray-400 text-xs italic">OR</p>
                    <div className="border-b border-gray-400 dark:border-gray-600 w-1/3 self-center"></div>
                </div>
            )}
            <div className='flex flex-col justify-between m-1 py-2'>
                <div className="flex flex-col items-center justify-center">
                    <label 
                        className="w-64 flex flex-col items-center px-4 py-6 bg-white text-blue rounded-lg shadow-lg tracking-wide uppercase border border-blue cursor-pointer hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 dark:border-gray-700 dark:shadow-none"
                        onDrop={handleFileDrop}
                        onDragOver={(e) => e.preventDefault()}
                    >
                        <svg className="w-8 h-8" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path d="M17 10h-4V0H7v10H3l7 7 7-7z" />
                        </svg>
                        <span className="mt-2 text-base leading-normal">Upload Medical Record</span>
                        <input type='file' className="hidden" onChange={handleFileUpload} />
                    </label>
                    {uploadedFileName && (<p className="text-gray-600 dark:text-gray-400 text-xs italic ml-2">{uploadedFileName}</p>)}
                </div>
            </div>
            <button className="my-2 bg-blue-500 hover:bg-blue-200 dark:hover:bg-blue-800 text-gray-900 dark:text-gray-100 font-bold py-2 px-4 rounded" onClick={handleRecordLink}>
                Link Record to Claim
            </button>
            {submitError.length > 0 && <p className="text-red-500 text-xs italic">{submitError}</p>}
        </div>
    );
};

