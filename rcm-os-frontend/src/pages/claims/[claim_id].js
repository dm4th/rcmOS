import { useState, useEffect } from 'react';
import React from 'react';
import { useRouter } from 'next/router';

import { CSSTransition } from 'react-transition-group';

// Components
import { Sidebar } from '@/components/Sidebar'
import { MedicalRecordInputModal } from '@/components/MedicalRecordInputModal';

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
    const [appStage, setAppStage] = useState('base'); // ['base', 'medical_record', 'denial_letter', 'other_document']
    const [transitioningState, setTransitioningState] = useState(false);
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);

    // Claim State Variables
    const [claimTitle, setClaimTitle] = useState(null);
    const [claimStatus, setClaimStatus] = useState(null);
    const [claimDenialSummary, setClaimDenialSummary] = useState(null);
    const [claimDocuments, setClaimDocuments] = useState(null);
    const [claimDataElements, setClaimDataElements] = useState(null);

    // Uploading & Processing New Files State Variables
    const [progressValues, setProgressValues] = useState(null);
    const [progressTitle, setProgressTitle] = useState('');

    useEffect(() => {
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

        async function getClaimDocuments() {
            const { data, error } = await supabaseClient
                .from('claim_document_view')
                .select('document_id, document_type, file_name, summary')
                .eq('claim_id', claimId);

            if (error) {
                console.error(error);
                return;
            }
            const documents = {
                denialLetters: data.filter(doc => doc.document_type === 'denial_letter'),
                medicalRecords: data.filter(doc => doc.document_type === 'medical_record'),
                otherDocuments: data.filter(doc => doc.document_type === 'other_document'),
            }
            setClaimDocuments(documents);
            setClaimDenialSummary(documents.denialLetters[0].summary);
            return;
        }

        async function getClaimDataElements() {
            const { data: documentData, error: documentError } = await supabaseClient
                .from('claim_document_view')
                .select('document_id')
                .eq('claim_id', claimId);

            if (documentError) {
                console.error(documentError);
                return;
            }

            // dedupe document ids
            const documentIds = [...new Set(documentData.map(doc => doc.document_id))];

            const { data: dataElementData, error: dataElementError } = await supabaseClient
                .from('document_data_elements')
                .select('id, document_id, field_id, field_name, field_value, confidence')
                .in('document_id', documentIds)
                .order('field_name', { ascending: true })
                .order('confidence', { ascending: false });

            if (dataElementError) {
                console.error(dataElementError);
                return;
            }
            console.log(dataElementData);

            const dataElements = {};
            dataElementData.forEach(element => {
                if (!dataElements[element.field_name]) {
                    dataElements[element.field_name] = [];
                }
                dataElements[element.field_name].push(element);
            });
            setClaimDataElements(dataElements);
            return;
        }


        checkClaimAuthorization();
        getClaimDocuments();
        getClaimDataElements();
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

    const newRecordHandler = () => {
        changeAppState('medical_record');
    };

    const closeInputModal = () => {
        changeAppState('base');
    };

    const headerArray = ['Denial Letters', 'Medical Records', 'Other Docs', 'Data Elements'];

    const elementArray = [
        claimDocuments?.denialLetters.map(doc => {return {id: doc.document_id, elementName: doc.file_name,};}),
        claimDocuments?.medicalRecords.map(doc => {return {id: doc.document_id, elementName: doc.file_name,};}),
        claimDocuments?.otherDocuments.map(doc => {return {id: doc.document_id, elementName: doc.file_name,};}),
        Object.keys(claimDataElements || {}).map(element => {return {id: element[0].id, elementName: element[0].field_name, additionalFields: [elemment[0].value, element[0].confidence]}}),
        // claimDataElements?.map(element => {return {id: element[0].id, name: element[0].field_name, additionalFields: {value: element[0].value, confidence: element[0].confidence}};}),
    ];

    const triggerArray = [
        {newHandler: () => {console.log('new denial letter')}, onClickHandler: () => {console.log('click denial letter')}},
        {newHandler: newRecordHandler, onClickHandler: () => {console.log('click medical record')}},
        {newHandler: () => {console.log('new other document')}, onClickHandler: () => {console.log('click other document')}},
        {onClickHandler: () => {console.log('click data element')}},
    ];

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
                <Sidebar headers={headerArray} elements={elementArray} triggers={triggerArray} />
            </CSSTransition>
            <button onClick={toggleSidebar} className="flex justify-start m-1">
                <div className={`flex bg-gray-100 dark:bg-gray-800 rounded border-2 border-gray-700 dark:border-gray-300 cursor-pointer ${isSidebarVisible ? 'pr-2' : 'pl-2'}`}>
                    {isSidebarVisible ? <><ArrowLeft /><ArrowLeft /></> : <><ArrowRight /><ArrowRight /></>}
                </div>
            </button>
            <main className="flex flex-col items-center justify-center w-9/12 flex-1 text-center overflow-auto">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">{claimTitle}</h1>
                <div className="flex flex-row items-center justify-between w-full">
                    <p className="text-xl text-gray-700 dark:text-gray-300 mb-4">Status: {claimStatus}</p>
                    <p className="text-xl text-gray-700 dark:text-gray-300 mb-4">Denial Summary: {claimDenialSummary}</p>
                </div>
                <CSSTransition
                    in={appStage === 'base' && !transitioningState}
                    timeout={300}
                    classNames="fade"
                    unmountOnExit={true}
                >
                    <p className="text-xl italic text-red-700 dark:text-red-300 mb-4">Base View (In Development)</p>
                </CSSTransition>
            </main>
            <CSSTransition
                in={appStage === 'medical_record' && !transitioningState}
                timeout={300}
                classNames="fade"
                unmountOnExit={true}
            >
                <MedicalRecordInputModal onClose={closeInputModal} claimId={claimId} denialSummary={claimDenialSummary} />
            </CSSTransition>
        </div>
    )
}