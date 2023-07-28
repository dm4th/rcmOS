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
import { createDenialLetterSupabase } from '@/lib/supabase';

export function ClaimInputModal({ onClose, modalStage, onHandleNextStage }) {

    const { user, updateAvailableClaims, supabaseClient } = useSupaUser();

    const [transitioningState, setTransitioningState] = useState(false);

    const [progressValues, setProgressValues] = useState(null);
    const [progressTitle, setProgressTitle] = useState('');

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
            const claimId = data[0].id;

            // Move to next stage - denial letter processing
            handleNextStage();

            // if both selected and uploaded denial letter, upload the uploaded one
            if (uploadedDenialLetter) await handleDenialLetterUpload(uploadedDenialLetter, claimId);
            else if (selectedDenialLetter) await handleSelctedDenialLetter(selectedDenialLetter, claimId);
            else console.error('No denial letter selected or uploaded');
        }
    };

    const handleDenialLetterUpload = async (file, claimId) => {
        // Need to implement:
        // 1. Upload file to AWS using the lib function
        setProgressTitle('Processing Denial Letter on AWS');
        setProgressValues([
            { text: 'Uploading File to AWS', progress: 0},
            { text: 'Performing OCR on File', progress: 0},
            { text: 'Extracting Data from OCR Job', progress: 0},
            { text: 'Generating Denial Summary', progress: 0, textProgress: 0, tableProgress: 0, kvProgress: 0, summaryProgress: 0},
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
        const summaryCallback = (progress, type) => {
            setProgressValues((prev) => {
                const newProgressValues = [...prev];
                switch (type) {
                    case 'text':
                        newProgressValues[3].textProgress = progress;
                        break;
                    case 'table':
                        newProgressValues[3].tableProgress = progress;
                        break;
                    case 'kv':
                        newProgressValues[3].kvProgress = progress;
                        break;
                    case 'summary':
                        newProgressValues[3].summaryProgress = progress;
                        break;
                    default:
                        break;
                }
                newProgressValues[3].progress = (newProgressValues[3].textProgress + newProgressValues[3].tableProgress + newProgressValues[3].kvProgress + newProgressValues[3].summaryProgress)/4;
                return newProgressValues;
            });
        };

        // Upload the file to AWS and Kick Off Processing
        // const { jobId, jobType, jobOutput } = await uploadAWS(file, 'letter', uploadCallback);
        // const { jobId } = await uploadAWS(file, 'letter', uploadCallback);
        // console.log(jobId);
        const jobId = 'af29cf7a4e0b55c02333e107da29301d9982e64bf3a33bb43315f352990b5ae5';
        uploadCallback(100);

        // Perform OCR on the File using Textract
        const { textBlocks, tableBlocks, kvBlocks } = await textractOCR(jobId, pollingCallback, processingCallback);

        // Parse and Summarize OCR data
        const denialLetterId = await createDenialLetterSupabase(
            file, 
            claimId,
            jobId,
            textBlocks, 
            tableBlocks, 
            kvBlocks, 
            user, 
            supabaseClient, 
            summaryCallback
        );

        console.log(denialLetterId);

    };

    const handleSelctedDenialLetter = async (denialLetterId, claimId) => {
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