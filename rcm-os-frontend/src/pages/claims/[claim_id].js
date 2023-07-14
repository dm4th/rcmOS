import { useState, useEffect } from 'react';
import React from 'react';

import { CSSTransition } from 'react-transition-group';

import { Intro } from '@/components/Intro';
import { Processing } from '@/components/Processing';
import { Sidebar } from '@/components/Sidebar';
import { ChatInterface } from '@/components/ChatInterface';
import { InputTemplateModal } from '@/components/InputTemplateModal';

import { useSupaUser } from '@/contexts/SupaAuthProvider';

import { uploadFileAWS, textractOCR } from '@/lib/aws';
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

    const { user, supabaseClient, availableDocuments, doc, changeDoc, chat, changeChat } = useSupaUser();

    const [appStage, setAppStage] = useState('intro'); // ['intro', 'processing', 'chat']
    const [transitioningState, setTransitioningState] = useState(false);

    const [file, setFile] = useState(null);
    const [jobId, setJobId] = useState(null);
    const [recordId, setRecordId] = useState(null);

    const [textBlocks, setTextBlocks] = useState(null);
    const [tableBlocks, setTableBlocks] = useState(null);
    const [kvBlocks, setKvBlocks] = useState(null);

    const [isSidebarVisible, setIsSidebarVisible] = useState(true);

    const [inputModalOpen, setInputModalOpen] = useState(false);
    const [inputTemplate, setInputTemplate] = useState(null);

    const [uploadStageAWS, setUploadStageAWS] = useState(awsProcessingStages);
    const [uploadStageSupabase, setUploadStageSupabase] = useState(supabaseProcessingStages);

    useEffect(() => {
        if (appStage !== 'processing') {
            // reset all states
            setUploadStageAWS(awsProcessingStages);
            setUploadStageSupabase(supabaseProcessingStages);
            setFile(null);
            setJobId(null);
            setRecordId(null);
            setTextBlocks(null);
            setTableBlocks(null);
            setKvBlocks(null);
            setInputTemplate(null);  
        }

        if (appStage === 'chat' && !doc) {
            changeDoc(availableDocuments[0]);
        }
    }, [appStage]);

    useEffect(() => {
        if (!user) {
            changeAppState('intro');
        }
    }, [user]);

    useEffect(() => {
        if (chat) {
            changeAppState('chat');
        }
    }, [chat]);

    useEffect(() => {
        if (file) {
            changeAppState('processing');
            uploadFileAWS(file, 0, setUploadStageAWS).then((jobId) => {
                setJobId(jobId);
            });
        }
    }, [file]);

    useEffect(() => {
        if (jobId && !inputTemplate) {
            toggleInputModal();
            textractOCR(jobId, 1, 2, setUploadStageAWS).then((ocrResult) => {
                if (!ocrResult) {
                    alert('AWS Error');
                }
                setTextBlocks(ocrResult.textBlocks);
                setTableBlocks(ocrResult.tableBlocks);
                setKvBlocks(ocrResult.kvBlocks);
            });
        }
    }, [jobId]);

    useEffect(() => {
        if (jobId && inputTemplate) {
            createFileSupabase(jobId, file, inputTemplate.id, user, supabaseClient, 0, setUploadStageSupabase).then((recordId) => {
                setRecordId(recordId);
            });
        }
    }, [inputTemplate, jobId]);

    useEffect(() => {
        if (recordId && textBlocks) {
            setUploadStageSupabase((prevState) => {
                const newState = [...prevState];
                newState[1].active=true;
                return newState;
            });
            handleTextSummarySupabase(textBlocks, recordId, inputTemplate, supabaseClient, 1, setUploadStageSupabase);
        }
    }, [recordId, textBlocks]);

    useEffect(() => {
        if (recordId && tableBlocks) {
            setUploadStageSupabase((prevState) => {
                const newState = [...prevState];
                newState[2].active=true;
                return newState;
            });
            handleTableSummarySupabase(tableBlocks, recordId, inputTemplate, supabaseClient, 2, setUploadStageSupabase);
        }
    }, [recordId, tableBlocks]);

    useEffect(() => {
        if (recordId && kvBlocks) {
            setUploadStageSupabase((prevState) => {
                const newState = [...prevState];
                newState[3].active=true;
                return newState;
            });
            handleKvSummarySupabase(kvBlocks, recordId, inputTemplate, supabaseClient, 3, setUploadStageSupabase);
        }
    }, [recordId, kvBlocks]);

    useEffect(() => {
        const createNewChat = async (id) => {
            // update medical record content_embedding_progress to 100
            const { data: progressData, error: progressError } = await supabaseClient
                .from('medical_records')
                .update({ content_embedding_progress: 100 })
                .eq('id', id)
                .select();
            if (progressError) {
                console.error(progressError);
                return;
            }
            await changeDoc(progressData[0].id);

            // create a new chat record for the document
            const { data: chatData, error: chatError } = await supabaseClient
                .from('document_chats')
                .insert([{ 
                    record_id: recordId,
                    user_id: user.id,
                    title: 'Initial Chat',
                }])
                .select();
            if (chatError) {
                console.error(chatError);
                return;
            }
            await changeChat(chatData[0].id);
        };


        if (uploadStageSupabase[1].progress === 100 && uploadStageSupabase[2].progress === 100 && uploadStageSupabase[3].progress === 100) {
            createNewChat(recordId);    
            changeAppState('chat');     
        }
    }, [uploadStageSupabase]);

    const changeAppState = (newState) => {
        setTransitioningState(true);
        setTimeout(() => {
            setAppStage(newState);
            setTransitioningState(false);
        }, 300);
    };

    const toggleSidebar = () => {
        setIsSidebarVisible(!isSidebarVisible);
    };

    const processFileAsync = async () => {
        changeAppState('processing');
        uploadFileAWS(null, 0, setUploadStageAWS).then((jobId) => {
            setJobId(jobId);
        });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        changeAppState('processing');
        setFile(file);
    };

    const handleFileDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        changeAppState('processing');
        setFile(file);
    };

    const handleTestingButtonClick = () => {
        changeAppState('processing');
        processFileAsync(null);
    };

    const toggleInputModal = () => {
        setInputModalOpen(!inputModalOpen);
    };

    const handleInputTemplateSelect = (template) => {
        setInputTemplate(template);
    };

    const ArrowLeft = () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5 text-gray-900 dark:text-gray-100 mr-[-8px]">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
    );
    
    const ArrowRight = () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5 text-gray-900 dark:text-gray-100 ml-[-8px]">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
    );
    


    return (
        <div className="flex h-full bg-white dark:bg-gray-900">
            <CSSTransition
                in={isSidebarVisible}
                timeout={300}
                classNames="sidebar"
                unmountOnExit={true}
            >
                <Sidebar setAppStage={changeAppState} />
            </CSSTransition>
            <button onClick={toggleSidebar} className="flex justify-start m-1">
                <div className={`flex bg-gray-100 dark:bg-gray-800 rounded border-2 border-gray-700 dark:border-gray-300 cursor-pointer ${isSidebarVisible ? 'pr-2' : 'pl-2'}`}>
                    {isSidebarVisible ? <><ArrowLeft /><ArrowLeft /></> : <><ArrowRight /><ArrowRight /></>}
                </div>
            </button>
            <main className="flex flex-col items-center justify-center w-9/12 flex-1 text-center overflow-auto">
                    <CSSTransition
                        in={appStage === 'intro' && !transitioningState}
                        timeout={300}
                        classNames="fade"
                        unmountOnExit={true}
                    >
                        <Intro handleFileChange={handleFileChange} handleFileDrop={handleFileDrop} handleTestingButtonClick={handleTestingButtonClick} />
                    </CSSTransition>
                    <CSSTransition
                        in={appStage === 'processing' && !transitioningState}
                        timeout={300}
                        classNames="fade"
                        unmountOnExit={true}
                    >
                        <Processing uploadStageAWS={uploadStageAWS} uploadStageSupabase={uploadStageSupabase} />
                    </CSSTransition>
                    <CSSTransition
                        in={appStage === 'chat' && !transitioningState}
                        timeout={300}
                        classNames="fade"
                        unmountOnExit={true}
                    >
                        <ChatInterface />
                    </CSSTransition>
            </main>
            {inputModalOpen && <InputTemplateModal onClose={toggleInputModal} onTemplateSelect={handleInputTemplateSelect} />}
        </div>
    )
}