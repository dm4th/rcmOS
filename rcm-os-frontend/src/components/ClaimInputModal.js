// React imports
import React, { useState, useEffect } from 'react';

// Component Imports
import { CSSTransition } from 'react-transition-group';
import { ClaimInput } from '@/components/claims/ClaimInput';

// Context Imports
import { useSupaUser } from '@/contexts/SupaAuthProvider';

export function ClaimInputModal({ onClose, modalStage, onHandleNextStage }) {

    const { user, supabaseClient } = useSupaUser();

    const [transitioningState, setTransitioningState] = useState(false);

    const [claimId, setClaimId] = useState(null);

    const handleNextStage = () => {
        setTransitioningState(true);
        setTimeout(() => {
            onHandleNextStage();
            setTransitioningState(false);
        }, 300);
    };

    const handleNewClaim = async (title) => {
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
            setClaimId(data[0].id);
            handleNextStage();
        }
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
            </div>
        </div>
    );
}