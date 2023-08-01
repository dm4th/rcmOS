import { useState, useEffect } from 'react';
import React from 'react';

import { CSSTransition } from 'react-transition-group';

import { Intro } from '@/components/Intro';
import { ClaimsDashboard } from '@/components/ClaimsDashboard';
import { ClaimInputModal } from '@/components/ClaimInputModal';

import { useSupaUser } from '@/contexts/SupaAuthProvider';


export default function Home() {

    const { user, isLoading } = useSupaUser();

    const [inputModalOpen, setInputModalOpen] = useState(false);

    useEffect(() => {
        setInputModalOpen(false);
    }, [user]); 

    const toggleInputModal = () => {
        setInputModalOpen(!inputModalOpen);
    };

    return (
        <div className="flex h-full bg-white dark:bg-gray-900">
            <CSSTransition
                in={!user && !isLoading}
                timeout={300}
                classNames="fade"
                unmountOnExit={true}
            >
                <main className="flex flex-col items-center justify-center w-9/12 flex-1 text-center overflow-auto">
                    <Intro />
                </main>
            </CSSTransition>
            <CSSTransition
                in={user && !isLoading}
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
                    <ClaimInputModal onClose={toggleInputModal} />
                </CSSTransition>
            }
        </div>
    )
}