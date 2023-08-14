import { useState, useEffect } from 'react';
import React from 'react';
import { useRouter } from 'next/router';

import { CSSTransition } from 'react-transition-group';

import { Intro } from '@/components/Intro';
import { Processing } from '@/components/Processing';
import { Sidebar } from '@/components/Sidebar';
import { ChatInterface } from '@/components/ChatInterface';
import { InputTemplateModal } from '@/components/InputTemplateModal';

import { useSupaUser } from '@/contexts/SupaAuthProvider';

export function getServerSideProps(context) {
    const claim_id = context.params.claim_id;
    return {
        props: {
            claimId: claim_id,
        },
    };
}

export default function ClaimPage({ claimId }) {
    const router = useRouter();

    const { user, supabaseClient } = useSupaUser();

    // UI State Variables
    const [appStage, setAppStage] = useState('base'); // ['base', 'uploading', 'processing', 'generating'
    const [transitioningState, setTransitioningState] = useState(false);
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);
    const [inputModalOpen, setInputModalOpen] = useState(false);

    // Claim State Variables
    const [claimTitle, setClaimTitle] = useState(null);
    const [claimStatus, setClaimStatus] = useState(null);

    // Uploading & Processing New Files State Variables
    const [progressValues, setProgressValues] = useState(null);
    const [progressTitle, setProgressTitle] = useState('');

    useEffect(() => {
        console.log(`Claim ID: ${claimId}`);
        async function checkClaimAuthorization() {
            if (!claimId) return;
            if (!user) {
                router.push('/');
                return;
            }
            const { data, error } = await supabaseClient
                .from('claims')
                .select('*')
                .eq('id', claimId)
                .single();
        
            if (error) {
                console.error(error);
                router.push('/unauthorized');
            }
            if (data.length === 0) {
                router.push('/unauthorized');
            }
            setClaimTitle(data.title);
            setClaimStatus(data.status);
            return;
        }
        checkClaimAuthorization();
    }, [user, claimId]);

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

    const toggleInputModal = () => {
        setInputModalOpen(!inputModalOpen);
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
                        in={appStage === 'base' && !transitioningState}
                        timeout={300}
                        classNames="fade"
                        unmountOnExit={true}
                    >
                        <div className="flex flex-col items-center justify-center w-full h-full">
                            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">{claimTitle}</h1>
                            <p className="text-xl text-gray-700 dark:text-gray-300 mb-4">{claimStatus}</p>
                        </div>
                    </CSSTransition>
            </main>
            {inputModalOpen && <InputTemplateModal onClose={toggleInputModal} onTemplateSelect={handleInputTemplateSelect} />}
        </div>
    )
}