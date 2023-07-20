// React imports
import React, { useState, useEffect } from 'react';

// Component Imports
import { CSSTransition } from 'react-transition-group';
import { ClaimInput } from '@/components/claims/ClaimInput';
import { ClaimProcessing } from '@/components/claims/ClaimProcessing';

// Context Imports
import { useSupaUser } from '@/contexts/SupaAuthProvider';

// Library Imports
import { uploadAWS } from '@/lib/aws';

export function ClaimInputModal({ onClose, modalStage, onHandleNextStage }) {

    const { user, supabaseClient } = useSupaUser();

    const [transitioningState, setTransitioningState] = useState(false);

    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
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
        setProgressText('Uploading Denial Letter to AWS');
        const { jobId, jobType } = await uploadAWS(file, 'letter', setProgress);
        // 2. Make sure the file is uploaded to AWS and the processing job is kicked off
        // 3. Change the processing function on the Lambda to check for faster text-only processing
        // 4. Update the denial letter table with the new file name and the claim id
        // 5. Return the new ID and change the state
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
                    <ClaimProcessing progressText={progressText} progress={progress} />
                </CSSTransition>
            </div>
        </div>
    );
}