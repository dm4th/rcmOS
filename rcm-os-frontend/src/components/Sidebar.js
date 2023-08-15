import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSupaUser } from '@/contexts/SupaAuthProvider';

export function Sidebar({ headers, elements, triggers }) {

    const router = useRouter();

    const { user, isLoading, handleLogin } = useSupaUser();

    const [showingElements, setShowingElements] = useState(null);

    const toggleDropdown = (i) => {
        if (showingElements === i) {
            setShowingElements(null);
        } else {
            setShowingElements(i);
        }
    };

    const LeftArrowIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5 text-gray-800 dark:text-gray-200">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
    );

    const DownArrowIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5 text-gray-800 dark:text-gray-200">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
    );

    const loggedOutDisplay = (
        <>
            <div className="flex flex-col items-center justify-center">
                <h3 className="text-xl font-bold my-2 px-2 text-gray-900 dark:text-gray-100">
                    Login to Continue
                </h3>
                <button onClick={handleLogin} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
                    Sign In
                </button>
            </div>
        </>
    );

    const loggedInDisplay = (
        <div className="flex flex-col">
            {headers && headers.map((h, i) => (
                <div className={`flex flex-col items-start justify-start mb-2 ${showingElements === i ? 'flex-grow' : ''}`}>
                    <div key={h} className="flex justify-between items-center w-full">
                        {triggers && triggers[i].newHandler ? (
                            <button className={`border-2 rounded mr-2 p-1 ${elements[i]?.length > 0 ? "border-gray-600" : "border-red-900 dark:border-red-400"}`} onClick={triggers[i].newHandler}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className={`h-5 w-5 ${elements[i]?.length > 0 ? "text-gray-800 dark:text-gray-200" : "text-red-900 dark:text-red-400"} `}>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </button>
                        ) : (
                            <div className='mx-5'></div>
                        )}
                        <h3 className="text-large text-left font-bold flex-grow text-gray-900 dark:text-gray-100">
                            {h}
                        </h3>
                        <button className="ml-2 p-1" onClick={() => toggleDropdown(i)}>
                            {showingElements === i ? <DownArrowIcon /> : <LeftArrowIcon />}
                        </button>
                    </div>
                {showingElements === i && elements[i]?.length > 0 && (
                    <div className="flex flex-col w-full">
                        <ul>
                            {elements[i].map((e) => (
                                <li key={e.id} onClick={() => router.push(`/claims/documents/${e.id}`)} className={`flex-1 w-full text-gray-700 dark:text-gray-300 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 rounded p-2 my-1 flex justify-between items-center border-2 border-gray-700 dark:border-gray-300`}>
                                    <span className="flex-grow text-xs">{e.elementName}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                </div>
            ))}
        </div>
    );

    const contentDisplay = () => {
        if (isLoading) {
            return(<p className="text-2xl text-gray-900 dark:text-white">Loading...</p>);
        } else if (user) {
            return(loggedInDisplay);
        } else {
            return(loggedOutDisplay);
        }
    };



    return (
        <div className="flex flex-col justify-between h-screen overflow-y-auto border-r-2 p-2 border-gray-800 dark:border-gray-300 bg-gray-100 dark:bg-gray-800 w-56 overflow-auto whitespace-normal">
            {contentDisplay()}
        </div>
    );
}
