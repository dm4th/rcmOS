// React imports
import React, { useState, useEffect } from 'react';

// Component Imports
import { CSSTransition } from 'react-transition-group';
import { ClaimInput } from '@/components/claims/ClaimInput';
import { ClaimProcessing } from '@/components/claims/ClaimProcessing';

// Context Imports
import { useSupaUser } from '@/contexts/SupaAuthProvider';

// Library Imports
import { textractOCR, uploadAWS } from '@/lib/aws';

export function ClaimInputModal({ onClose, modalStage, onHandleNextStage }) {

    const { user, updateAvailableClaims, supabaseClient } = useSupaUser();

    const [transitioningState, setTransitioningState] = useState(false);

    const [progressValues, setProgressValues] = useState(null);
    const [progressTitle, setProgressTitle] = useState('');
    const [claimId, setClaimId] = useState(null);

    const handleNextStage = () => {
        setTransitioningState(true);
        setTimeout(() => {
            onHandleNextStage();
            setTransitioningState(false);
        }, 300);
    };

    const handleNewClaim = async (title, selectedDenialLetter, uploadedDenialLetter) => {
        // Create New Claim
        const { data, error } = await supabaseClient
            .from('claims')
            .insert([
                {
                    title: title,
                    status: 'uploading',
                    user_id: user.id,
                },
            ])
            .select();
        if (error) {
            console.log(error);
        } else {
            // Update available claims
            await updateAvailableClaims();

            // Save claimId for later and start to process the new denial letter
            setClaimId(data[0].id);

            // Move to next stage - denial letter processing
            handleNextStage();

            // if both selected and uploaded denial letter, upload the uploaded one
            if (uploadedDenialLetter) await handleDenialLetterUpload(uploadedDenialLetter);
            else if (selectedDenialLetter) await handleSelctedDenialLetter(selectedDenialLetter);
            else console.error('No denial letter selected or uploaded');
        }
    };

    const handleDenialLetterUpload = async (file) => {
        // Need to implement:
        // 1. Upload file to AWS using the lib function
        setProgressTitle('Processing Denial Letter on AWS');
        setProgressValues([
            { text: 'Uploading File to AWS', progress: 0},
            { text: 'Performing OCR on File', progress: 0},
            { text: 'Extracting Data from OCR Job', progress: 0},
            { text: 'Generating Denial Summary', progress: 0},
        ]);
        const uploadCallback = (progress) => {
            setProgressValues((prev) => {
                const newProgressValues = [...prev];
                newProgressValues[0].progress = progress;
                return newProgressValues;
            });
        };
        const pollingCallback = (progress) => {
            setProgressValues((prev) => {
                const newProgressValues = [...prev];
                newProgressValues[1].progress = progress;
                return newProgressValues;
            });
        };
        const processingCallback = (progress) => {
            setProgressValues((prev) => {
                const newProgressValues = [...prev];
                newProgressValues[2].progress = progress;
                return newProgressValues;
            });
        };
        const summaryCallback = (progressIncrement) => {
            setProgressValues((prev) => {
                const newProgressValues = [...prev];
                newProgressValues[3].progress += progressIncrement;
                return newProgressValues;
            });
        };

        // Upload the file to AWS and Kick Off Processing
        // const { jobId, jobType, jobOutput } = await uploadAWS(file, 'letter', uploadCallback);
        // const { jobId } = await uploadAWS(file, 'letter', uploadCallback);
        const jobId = 'e6c9326a7866300972750ed7e323d15bf34d0ab6b551e12d68ba373f3110b537';
        uploadCallback(100);

        // Perform OCR on the File using Textract
        const { textBlocks, tableBlocks, kvBlocks } = await textractOCR(jobId, pollingCallback, processingCallback);
        console.log(textBlocks);
        console.log(tableBlocks);
        console.log(kvBlocks);

        // Upload the OCR results to Supabase
        
    };

    const handleSelctedDenialLetter = async (denialLetterId) => {
        // Need to implement:
        // 1. Retrieve all relevant info from the denial letter table 
        // 2. Create a new denial letter record with the same information and updated claim ID
        // 3. Return the new ID and change the state
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black dark:bg-white opacity-50"></div>
            <div className="p-5 rounded-lg shadow-lg relative w-96 h-7/8 overflow-auto bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                <button 
                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded" 
                    onClick={onClose}
                >
                    X
                </button>
                <CSSTransition
                    in={modalStage === 'claim' && !transitioningState}
                    timeout={300}
                    classNames="fade"
                    unmountOnExit={true}
                >
                    <ClaimInput handleSubmit={handleNewClaim} />
                </CSSTransition>
                <CSSTransition
                    in={modalStage === 'denialProcessing' && !transitioningState}
                    timeout={300}
                    classNames="fade"
                    unmountOnExit={true}
                >
                    <ClaimProcessing progressTitle={progressTitle} progressValues={progressValues} />
                </CSSTransition>
            </div>
        </div>
    );
}