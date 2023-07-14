import { useState, useEffect } from 'react';
import React from 'react';

import { CSSTransition } from 'react-transition-group';

import { Intro } from '@/components/Intro';
import { ClaimsDashboard } from '@/components/ClaimsDashboard';
import { ClaimInputModal } from '@/components/ClaimInputModal';

import { useSupaUser } from '@/contexts/SupaAuthProvider';


export default function Home() {

    const { user, isLoading } = useSupaUser();

    const [transitioningState, setTransitioningState] = useState(false);

    const [inputModalOpen, setInputModalOpen] = useState(false);
    const [inputModalState, setInputModalState] = useState('claim'); // claim, letter, medical, policy, data

    useEffect(() => {
        setInputModalOpen(false);
        setInputModalState('claim');
    }, [user]); 

    const toggleInputModal = () => {
        setInputModalOpen(!inputModalOpen);
        setInputModalState('claim');
    };

    const handleInputModalNextState = () => {
        switch (inputModalState) {
            case 'claim':
                setInputModalState('letter');
                break;
            case 'letter':
                setInputModalState('medical');
                break;
            case 'medical':
                setInputModalState('policy');
                break;
            case 'policy':
                setInputModalState('data');
                break;
            case 'data':
                setInputModalState('claim');
                toggleInputModal();
                break;
            default:
                setInputModalState('claim');
                break;
        }
    };

    return (
        <div className="flex h-full bg-white dark:bg-gray-900">
            <CSSTransition
                in={!user && !transitioningState && !isLoading}
                timeout={300}
                classNames="fade"
                unmountOnExit={true}
            >
                <main className="flex flex-col items-center justify-center w-9/12 flex-1 text-center overflow-auto">
                    <Intro />
                </main>
            </CSSTransition>
            <CSSTransition
                in={user && !transitioningState && !isLoading}
                timeout={300}
                classNames="fade"
                unmountOnExit={true}
            >
                <main className="flex flex-col items-center justify-start w-full flex-1 m-4 text-center overflow-auto">
                    <ClaimsDashboard onNewClaim={toggleInputModal} />
                </main>
            </CSSTransition>
            {inputModalOpen && 
                <CSSTransition
                    in={inputModalOpen}
                    timeout={300}
                    classNames="fade"
                    unmountOnExit={true}
                >
                    <ClaimInputModal onClose={toggleInputModal} modalStage={inputModalState} onHandleNextStage={handleInputModalNextState} />
                </CSSTransition>
            }
        </div>
    )
}