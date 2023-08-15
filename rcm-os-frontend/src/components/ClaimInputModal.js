// React imports
import React, { useState, useEffect, use } from 'react';

// Component Imports
import { CSSTransition } from 'react-transition-group';
import { ClaimInput } from '@/components/claims/ClaimInput';
import { FileProcessing } from '@/components/FileProcessing';
import { DenialSummary } from '@/components/claims/DenialSummary';
import { ClaimRoute } from '@/components/claims/ClaimRoute';

// Context Imports
import { useSupaUser } from '@/contexts/SupaAuthProvider';

// Library Imports
import { textractOCR, uploadAWS } from '@/lib/aws';
import { createDenialLetterSupabase } from '@/lib/supabase';

export function ClaimInputModal({ onClose }) {

    const { user, updateAvailableClaims, supabaseClient } = useSupaUser();

    const [modalStage, setModalStage] = useState('claim'); // claim, denialProcessing, denialSummary, closeOut
    const [transitioningState, setTransitioningState] = useState(false);

    const [progressValues, setProgressValues] = useState(null);
    const [progressTitle, setProgressTitle] = useState('');

    const [claimIdState, setClaimIdState] = useState(null);

    const [denialLetterId, setDenialLetterId] = useState(null);
    const [denialLetterSummary, setDenialLetterSummary] = useState('');

    const handleNextStage = () => {
        setTransitioningState(true);
        setTimeout(() => {
            setModalStage((prevModalStage) => {
                console.log(`Moving from stage: ${prevModalStage}`);
                switch (prevModalStage) {
                    case 'claim':
                        return 'denialProcessing';
                    case 'denialProcessing':
                        return 'denialSummary'
                    case 'denialSummary':
                        return 'closeOut'
                    default:
                        return 'claim'
                }
            });
            setTransitioningState(false);
        }, 300);
    };

    const handleNewClaim = async (title, selectedDenialLetter, uploadedDenialLetter) => {
        // Create New Claim
        try {
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
                throw error;
            } 

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

            // Update claim status to processing and refresh available claims
            const { error: processingUpdateError } = await supabaseClient
                .from('claims')
                .update({ status: 'processing' })
                .match({'id': claimId})
            if (processingUpdateError) {
                throw processingUpdateError;
            }
            await updateAvailableClaims();

            // Move to next stage - denial letter summary
            handleNextStage();
        } catch (error) {
            console.error(error);
        }
    };

    const handleSummarySubmit = async (summary) => {
        const { error } = await supabaseClient
            .from('claim_documents')
            .update({ summary: summary })
            .match({'claim_id': claimIdState, 'document_id': denialLetterId, 'document_type': 'denial_letter'})
        if (error) {
            console.error(error);
        }
        handleNextStage();
    }

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
        const { jobId } = await uploadAWS(file, 'letter', uploadCallback);
        // console.log(jobId);
        // const jobId = '0dad206b21ad262a52ddde2a767cb53018a63962526d3f40c1bfa19363f614a3';
        uploadCallback(100);

        // Perform OCR on the File using Textract
        const { textBlocks, tableBlocks, kvBlocks } = await textractOCR(jobId, pollingCallback, processingCallback);

        // Parse and Summarize OCR data
        const { denialLetterId, denialLetterSummary } = await createDenialLetterSupabase(
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

        setDenialLetterId(denialLetterId);
        setDenialLetterSummary(denialLetterSummary);
        setClaimIdState(claimId);
    };

    const handleSelctedDenialLetter = async (denialLetterId, claimId) => {
        // Need to implement:
        setProgressTitle('Retrieving Denial Letter Information');
        setProgressValues([
            { text: 'Duplicating Record', progress: 0},
            { text: 'Retrieve Denial Summary', progress: 0},
        ]);
        const duplicationCallback = (progress) => {
            setProgressValues((prev) => {
                const newProgressValues = [...prev];
                newProgressValues[0].progress = progress;
                return newProgressValues;
            });
        };
        const retrievalCallback = (progress) => {
            setProgressValues((prev) => {
                const newProgressValues = [...prev];
                newProgressValues[1].progress = progress;
                return newProgressValues;
            });
        };
        // 1. Create a new claim documents record to link the new claim with the old denial letter
        const { data: duplicationData, error: duplicationError } = await supabaseClient
            .from('claim_documents')
            .insert([
                {
                    claim_id: claimId,
                    document_id: denialLetterId,
                    document_type: 'denial_letter',
                    user_id: user.id,
                },
            ])
            .select();
        if (duplicationError) {
            console.error(duplicationError);
        }
        duplicationCallback(100);
        // 3. Retrieve the old denial letter summary
        const denialId = duplicationData[0].document_id;
        const { data: denialData, error: denialError } = await supabaseClient
            .from('denial_letters')
            .select('summary')
            .eq('id', denialId);
        if (denialError) {
            console.error(denialError);
        }
        retrievalCallback(100);
        setDenialLetterId(denialId);
        setDenialLetterSummary(denialData[0].summary);
        setClaimIdState(claimId);
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
                    <FileProcessing progressTitle={progressTitle} progressValues={progressValues} />
                </CSSTransition>
                <CSSTransition
                    in={modalStage === 'denialSummary' && !transitioningState}
                    timeout={300}
                    classNames="fade"
                    unmountOnExit={true}
                >
                    <DenialSummary summary={denialLetterSummary} letterId={denialLetterId} handleSubmit={handleSummarySubmit}  />
                </CSSTransition>
                <CSSTransition
                    in={modalStage === 'closeOut' && !transitioningState}
                    timeout={300}
                    classNames="fade"
                    unmountOnExit={true}
                >
                    <ClaimRoute claimId={claimIdState} onClose={onClose}  />
                </CSSTransition>
            </div>
        </div>
    );
}