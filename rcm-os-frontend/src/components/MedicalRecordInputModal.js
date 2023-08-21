// React imports
import React, { useEffect, useState } from 'react';

// Component Imports
import { CSSTransition } from 'react-transition-group';
import { FileProcessing } from '@/components/FileProcessing';
import { MedicalRecordInput } from '@/components/records/MedicalRecordInput';
import { RecordRoute } from '@/components/RecordRoute';

// Context Imports
import { useSupaUser } from '@/contexts/SupaAuthProvider';

// Library Imports
import { uploadAWS, textractOCR } from '@/lib/aws';
import { createMedicalRecordSupabase } from '@/lib/supabase';

export function MedicalRecordInputModal({ onClose, claimId, denialSummary }) {

    const { user, supabaseClient } = useSupaUser();

    const [modalStage, setModalStage] = useState('input'); // input, processing, route, closeOut
    const [transitioningState, setTransitioningState] = useState(false);

    const [progressValues, setProgressValues] = useState(null);
    const [progressTitle, setProgressTitle] = useState('');

    const [recordIdState, setRecordIdState] = useState(null);
    const [relevantSectionsCount, setRelevantSectionsCount] = useState(null);
    const [dataElementsCount, setDataElementsCount] = useState(null);

    useEffect(() => {
        if (recordIdState) {
            const fetchRelevanceData = async () => {
                const { data: relevantSectionsData, error: relevantSectionsError } = await supabaseClient
                    .from('record_sections')
                    .select('id')
                    .eq('record_id', recordIdState);
                if (relevantSectionsError) {
                    console.error(relevantSectionsError);
                }
                setRelevantSectionsCount(relevantSectionsData.length);

                const { data: dataElementsData, error: dataElementsError } = await supabaseClient
                    .from('document_data_elements')
                    .select('id')
                    .eq('document_id', recordIdState);
                if (dataElementsError) {
                    console.error(dataElementsError);
                }
                setDataElementsCount(dataElementsData.length);
            };
            fetchRelevanceData();
        }
    }, [recordIdState]);

    const handleNextStage = () => {
        setTransitioningState(true);
        setTimeout(() => {
            setModalStage((prevModalStage) => {
                switch (prevModalStage) {
                    case 'input':
                        return 'processing';
                    case 'processing':
                        return 'route'
                    case 'route':
                        return 'closeOut'
                    default:
                        return 'input'
                }
            });
            setTransitioningState(false);
        }, 300);
    };

    const handleNewRecord = async (selectedRecord, uploadedRecord) => {
        // Create New Claim
        try {

            console.log('New Record');
            
            handleNextStage();

            // if both selected and uploaded medical record, upload the uploaded one
            if (uploadedRecord) await handleRecordUpload(uploadedRecord, claimId);
            else if (selectedRecord) await handleSelctedDenialLetter(selectedRecord, claimId);
            else console.error('No denial letter selected or uploaded');

            // Move to next stage - denial letter summary
            handleNextStage();
        } catch (error) {
            console.error(error);
        }
    };

    const handleRecordUpload = async (file, claimId) => {
        // Need to implement:
        // 1. Upload file to AWS using the lib function
        setProgressTitle('Processing Medical Record on AWS');
        setProgressValues([
            { text: 'Securely Uploading Record to AWS', progress: 0},
            { text: 'Performing OCR on Record', progress: 0},
            { text: 'Extracting Data from OCR Job', progress: 0},
            { text: 'Searching for Appeal Evidence', progress: 0, textProgress: 0, tableProgress: 0, kvProgress: 0, summaryProgress: 0},
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
        const extractionCallback = (progress) => {
            setProgressValues((prev) => {
                const newProgressValues = [...prev];
                newProgressValues[2].progress = progress;
                return newProgressValues;
            });
        };
        const processingCallback = (progress, type) => {
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
                    default:
                        break;
                }
                newProgressValues[3].progress = (newProgressValues[3].textProgress + newProgressValues[3].tableProgress + newProgressValues[3].kvProgress + newProgressValues[3].summaryProgress)/4;
                return newProgressValues;
            });
        };

        // Upload the file to AWS and Kick Off Processing
        // const { jobId } = await uploadAWS(file, 'record', uploadCallback);
        // console.log(`Textract ID for Medical Record:\t ${jobId}`);
        const jobId = '87692eab8db984de62ec614641675ff2ca00f8847c71db1bf6665aec65a11d1f';
        uploadCallback(100);

        // Perform OCR on the File using Textract
        const { textBlocks, tableBlocks, kvBlocks } = await textractOCR(jobId, pollingCallback, extractionCallback);

        // Parse and Summarize OCR data
        const { medicalRecordId, denialLetterSummary } = await createMedicalRecordSupabase(
            file, 
            claimId,
            jobId,
            denialSummary,
            textBlocks, 
            tableBlocks, 
            kvBlocks, 
            user, 
            supabaseClient, 
            processingCallback
        );

        setRecordIdState(medicalRecordId);
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
                    in={modalStage === 'input' && !transitioningState}
                    timeout={300}
                    classNames="fade"
                    unmountOnExit={true}
                >
                    <MedicalRecordInput handleSubmit={handleNewRecord} />
                </CSSTransition>
                <CSSTransition
                    in={modalStage === 'processing' && !transitioningState}
                    timeout={300}
                    classNames="fade"
                    unmountOnExit={true}
                >
                    <FileProcessing progressTitle={progressTitle} progressValues={progressValues} />
                </CSSTransition>
                <CSSTransition
                    in={modalStage === 'route' && !transitioningState}
                    timeout={300}
                    classNames="fade"
                    unmountOnExit={true}
                >
                    <RecordRoute claimId={claimId} documentId={recordIdState} documentType={'Medical Record'} onClose={onClose} />
                </CSSTransition>
            </div>
        </div>
    );
}