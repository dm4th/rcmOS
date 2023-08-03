import React, { useState, useEffect, useRef } from 'react';

// Networking Imports
import { fetchEventSource } from '@microsoft/fetch-event-source';

export function DenialSummary({ summary, letterId, handleSubmit }) {

    const [currentSummary, setCurrentSummary] = useState(summary);
    const [summaryError, setSummaryError] = useState('');
    const [summaryPrompt, setSummaryPrompt] = useState('');

    const summaryRef = useRef(null);
    const summaryPromptRef = useRef(null);

    useEffect(() => {
        setCurrentSummary(summary);
    }, [summary]);

    useEffect(() => {
        if (summaryRef.current) {
            summaryRef.current.style.height = 'auto';
            summaryRef.current.style.height = `${summaryRef.current.scrollHeight}px`;
        }
    }, [currentSummary]);

    useEffect(() => {
        if (summaryPromptRef.current) {
            summaryPromptRef.current.style.height = 'auto';
            summaryPromptRef.current.style.height = `${summaryPromptRef.current.scrollHeight}px`;
        }
    }, [summaryPrompt]);

    const handleSummaryChange = (e) => {
        const currSummary = e.target.value;
        const currSummaryWords = currSummary.split(' ');
        if (currSummaryWords.length > 50) {
            setSummaryError('Please keep the summary to a maximum of 50 words');
        } else if (currSummaryWords.length < 1) {
            setSummaryError('Please enter a summary for the denial');
        } else {
            setSummaryError('');
        }
        setCurrentSummary(e.target.value);
    };

    const handleSummaryPromptChange = (e) => {
        setSummaryPrompt(e.target.value);
    };

    const handleSummarySubmit = () => {
        if (summaryError.length === 0) {
            handleSubmit(currentSummary);
        }
    };

    const handleSummaryPrompt = async () => {
        // Set up fetch parameters
        const functionURL = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL + 'prompt-summary';
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const postData = JSON.stringify({
            'prompt': summaryPrompt,
            'summary': currentSummary,
            'letterId': letterId,
        });
        // reset state
        setSummaryPrompt('');
        setCurrentSummary(''); 

        // make a call to the prompt-summary function
        // while we wait for a response from the function, we will display a loading message of '...' alternating 1, 2, and 3 dots
        // once we start to get tokens back from the funtion we can set it to the summary
        const loadingMessages = ['.', '..', '...'];
        let loadingMessageIndex = 0;
        const loadingMessageInterval = setInterval(() => {
            setCurrentSummary(loadingMessages[loadingMessageIndex]);
            loadingMessageIndex = (loadingMessageIndex + 1) % 3;
        }, 500);
        fetchEventSource(functionURL, {
            method: 'POST',
            headers: {
                'apikey': anonKey,
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + anonKey,
            },
            body: postData,
            onmessage: (event) => {
                clearInterval(loadingMessageInterval);
                const data = JSON.parse(event.data);
                if(data.start) {
                    setCurrentSummary('');
                }
                else if (data.token) {
                    setCurrentSummary((t) => t + data.token);
                }                   
            },
            onerror: (error) => {
                clearInterval(loadingMessageInterval);
                console.error(error);
            }
        });
    };

    return (
        <div className="flex flex-col justify-between m-2 ">
            <h3 className="text-lg font-bold mb-2">Claim Denial Summary</h3>
            <div className="border-b border-gray-400 dark:border-gray-600 w-full self-center"></div>
            <div className='flex flex-col justify-between m-1 py-2'>
                <label className="block text-gray-900 dark:text-gray-100 text-sm font-bold mb-2" htmlFor="title">
                    Insurance Claim Denial Summary
                </label>
                <textarea 
                    ref={summaryRef}
                    className="shadow appearance-none border rounded w-full py-2 px-3 mb-1 text-gray-900 leading-tight focus:ring-2 focus:shadow-outline" 
                    id="claim" 
                    type="text" 
                    value={currentSummary} 
                    onChange={handleSummaryChange} 
                />
                <p className="text-gray-600 dark:text-gray-400 text-xs italic">Confirm the Reason for the Insurance Claim Denial. Please try to keep this to a maximum of 2 sentences and 50 words.</p>
                {summaryError.length > 0 && <p className="text-red-500 text-xs italic">{summaryError}</p>}
            </div>
            <div className='flex flex-row justify-between m-1'>
                <div className="border-b border-gray-400 dark:border-gray-600 w-1/3 self-center"></div>
                <p className="text-gray-600 dark:text-gray-400 text-xs italic">OR</p>
                <div className="border-b border-gray-400 dark:border-gray-600 w-1/3 self-center"></div>
            </div>
            <div className='flex flex-col justify-between m-1 py-2'>
                <label className="block text-gray-900 dark:text-gray-100 text-sm font-bold mb-2" htmlFor="title">
                    Prompt for New Summary
                </label>
                <textarea 
                    ref={summaryPromptRef}
                    className="shadow appearance-none border rounded w-full py-2 px-3 mb-1 text-gray-900 leading-tight focus:ring-2 focus:shadow-outline" 
                    id="prompt" 
                    type="text" 
                    value={summaryPrompt} 
                    onChange={handleSummaryPromptChange} 
                />
                <p className="text-gray-600 dark:text-gray-400 text-xs italic">Prompt the AI to regenerate the summary with specified changes.</p>
            </div>
            <div className='flex flex-col justify-between m-1 pt-2'>
                <button className="mt-2 bg-green-700 hover:bg-green-500 dark:hover:bg-green-900 text-gray-900 dark:text-gray-100 font-bold py-2 px-4 rounded" onClick={handleSummaryPrompt}>
                    Regenerate Denial Summary with AI
                </button>
                <button className="my-2 bg-blue-500 hover:bg-blue-200 dark:hover:bg-blue-800 text-gray-900 dark:text-gray-100 font-bold py-2 px-4 rounded" onClick={handleSummarySubmit}>
                    Submit Denial Summary
                </button>
            </div>
        </div>
    );
};

