import { useState, useEffect } from 'react';
import React from 'react';

import { CSSTransition, Transition } from 'react-transition-group';

import { Intro } from '@/components/Intro';
import { Processing } from '@/components/Processing';
import { Sidebar } from '@/components/Sidebar';
import { ChatInterface } from '@/components/ChatInterface';

import { useSupaUser } from '@/contexts/SupaAuthProvider';

import { processFile } from '@/lib/fileProcessing';

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

    const { user, supabaseClient, changeDoc, chat, changeChat } = useSupaUser();

    const [appStage, setAppStage] = useState('intro'); // ['intro', 'processing', 'chat']
    const [transitioningState, setTransitioningState] = useState(false);

    const [file, setFile] = useState(null);
    const [uploadStageAWS, setUploadStageAWS] = useState(awsProcessingStages);
    const [uploadStageSupabase, setUploadStageSupabase] = useState(supabaseProcessingStages);

    useEffect(() => {
        const processFileAsync = async () => {
            // Helper function to go through each stage of the processing cycle
            await processFile(file, user, supabaseClient, changeDoc, changeChat, setUploadStageAWS, setUploadStageSupabase);
            changeAppState('chat');
        };

        if (appStage === 'processing') {
            processFileAsync();
        } else {
            setUploadStageAWS(awsProcessingStages);
            setUploadStageSupabase(supabaseProcessingStages);
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

    const changeAppState = (newState) => {
        setTransitioningState(true);
        setTimeout(() => {
            setAppStage(newState);
            setTransitioningState(false);
        }, 300);
    }

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setFile(file);
        changeAppState('processing');
    };

    const handleFileDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        setFile(file);
        changeAppState('processing');
    };

    const handleTestingButtonClick = () => {
        setFile(null);
        changeAppState('processing');
    };


    return (
        <div className="flex h-full bg-white dark:bg-gray-900">
            <Sidebar setAppStage={changeAppState}/>
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
        </div>
    )
}