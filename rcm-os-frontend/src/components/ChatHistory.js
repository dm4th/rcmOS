import React, { useState } from 'react';

export function ChatHistory ({ 
    messages, 
    latestUserMessage, 
    latestResponse, 
    latestMessageId, 
    selectedMessage, 
    changeMessage,
    citations,
    selectedCitation,
    changeCitation
}) {

    const [showCitations, setShowCitations] = useState(false);
    const [showCitationSummary, setShowCitationSummary] = useState(false);

    function handleSelectMessage(messageId) {
        if (messageId !== selectedMessage) {
            setShowCitationSummary(false);
            setShowCitations(false);
            changeMessage(messageId);
        }
    };

    function handleSelectCitation(citation) {
        changeCitation(citation);
    };

    function handleShowCitations() {
        setShowCitationSummary(false);
        setShowCitations(!showCitations);
    };

    function handleShowCitationSummary(citation) {
        if (citation === selectedCitation) {
            setShowCitationSummary(!showCitationSummary);
        }
        else {
            handleSelectCitation(citation);
            setShowCitationSummary(true);
        }
    };

    const userMessageDisp = (message, key) => {
        return (
            <div className="flex items-start mb-2 text-sm text-left text-gray-600 dark:text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div key={key}>
                    {message}
                </div>
            </div>
        );
    }

    const botMessageDisp = (response, key, messageId, latest, citations, selectedCitation, changeCitation) => {
        if (response.length > 0) {
            const words = response.split(" ");
            let skip = false;
            const parsedResponse = words.map((word, index) => {
                if (skip) {
                    skip = false;
                    return;
                }
                if ((word === "page" || word === "Page") && words[index + 1] && words[index + 1].match(/\d+\D?/)) {
                    const pageNumber = parseInt(words[index + 1].replace(/\D/g,''));
                    const punctuation = words[index + 1].replace(/\d/g,'');
                    const citation = citations.find(citation => citation.page === pageNumber);
                    if (citation) {
                        skip = true;
                        return (
                            <span key={index} className="text-blue-500 cursor-pointer" onClick={() => handleShowCitationSummary(citation)}>
                                {index !== 0 ? ' ' : ''}{word} {pageNumber}{punctuation}
                            </span>
                        );
                    }
                }
                return index !== 0 ? ` ${word}` : word;
            });

            return (
                <div className="flex w-full flex-col items-start">
                    <div key={key} className="w-full p-1 text-sm text-left text-gray-900 dark:text-gray-100">
                        {messageId === selectedMessage ? parsedResponse : latest && !messageId ? parsedResponse : "..."}
                    </div>
                    {messageId === selectedMessage ? citationDisp(citations, selectedCitation, changeCitation) : latest && !messageId ? citationDisp(citations, selectedCitation, changeCitation) : <></>}
                </div>
            )
        } else {
            return (
                <div className="flex items-center justify-center h-6 w-6 relative mb-2 text-sm text-gray-900 dark:text-gray-100">
                    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 1.044.183 2.051.507 3h1.986c-.326-.949-.493-1.955-.493-3z"></path>
                    </svg>
                </div>
            );
        }
    }

    const latestMessageDisp = () => {
        if (latestUserMessage === '') return null;
        return (
            <div onClick={() => handleSelectMessage(latestMessageId)} className={`relative mb-1 p-2 cursor-pointer border-2 bg-white dark:bg-gray-900 rounded-md ${latestMessageId === selectedMessage ? 'border-gray-800 dark:border-gray-300' : 'border-gray-700 dark:border-gray-400 hover:bg-gray-200 hover:dark:bg-gray-700'} `}>
                {userMessageDisp(latestUserMessage, 'u')}
                {botMessageDisp(latestResponse, 'm', latestMessageId, true, citations, selectedCitation, changeCitation)}
            </div>
        );
    }

    const similarityDisp = (similarity) => {
        if (similarity > 0.82) {
            return {
                similarityColor: 'text-green-700 dark:text-green-400',
                similarityText: `${Math.round(similarity * 100)}`,
                similarityTitle: 'This score indicates a high similarity between the user input and the document content.' 
            };
        }
        else if (similarity > 0.79) {
            return {
                similarityColor: 'text-yellow-700 dark:text-yellow-400',
                similarityText: `${Math.round(similarity * 100)}`,
                similarityTitle: 'This score indicates a moderate similarity between the user input and the document content.'
            };
        }
        else if (similarity > 0.75) {
            return {
                similarityColor: 'text-orange-700 dark:text-orange-400',
                similarityText: `${Math.round(similarity * 100)}`,
                similarityTitle: 'This score indicates a low similarity between the user input and the document content.'
            };
        }
        else {
            return {
                similarityColor: 'text-red-700 dark:text-red-400',
                similarityText: `${Math.round(similarity * 100)}`,
                similarityTitle: 'This score indicates a very low similarity between the user input and the document content.'
            };
        }
    }

    const citationDisp = (citations, selectedCitation, changeCitation) => {
        if (citations.length === 0) return null;
        if (!showCitations) {
            // Render citations description, including the number of citations, a list of pages, the top similarity strength, and a button to show citations
            const pages = citations.map(citation => citation.page);
            const uniquePages = [...new Set(pages)];
            const { similarityColor, similarityText, similarityTitle } = similarityDisp(citations[0].similarity);
            return (
                <div className="w-full flex justify-between items-center text-xs text-left italic text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 p-2 rounded">
                    <div className="mr-1">{citations.length} Citations</div>
                    <span className="mr-1">
                        Pages: {uniquePages.map((page, index) => (
                                <span key={`p-${index}`} className="mr-1">{page}, </span>
                        ))}
                    </span>
                    <div title={similarityTitle} className={`flex items-center ${similarityColor}`}>{similarityText}</div>
                    <button onClick={() => handleShowCitations()} className="flex items-center justify-center h-5 w-5 relative text-sm text-gray-900 dark:text-gray-100">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
            );
        } else {
            // Render citations list, including a button to hide citations
            // For each citation, render the citation title, the page, the citation strength, and the citation summary if it is the selectedCitation
            // Each citation is a button that can be clicked to select the citation
            return (
                <div className="w-full flex-col justify-between items-center text-xs text-left italic text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 p-2 rounded">
                    <div className="flex justify-end items-center">
                        <button onClick={() =>  handleShowCitations()} className="h-5 w-5 text-sm text-gray-900 dark:text-gray-100">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                        </button>
                    </div>
                    {citations.map((citation, index) => {
                        const { similarityColor, similarityText, similarityTitle } = similarityDisp(citation.similarity);
                        return (
                            <div key={`cit-${index}`} className={`flex flex-col items-center justify-between p-2 cursor-pointer rounded-md hover:bg-gray-400 hover:dark:bg-gray-500`} onClick={() => handleSelectCitation(citation)}>
                                <div className="flex w-full justify-between p-1">
                                    <div className="font-bold w-3/4">{citation.title}</div>
                                    <div className="text-xs w-1/12">p. {citation.page}</div>
                                    <div title={similarityTitle} className={`text-xs w-1/12 ${similarityColor}`}>{similarityText}</div>
                                    <button onClick={() => handleShowCitationSummary(citation)} className="w-4 h-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={citation === selectedCitation && showCitationSummary ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                                        </svg>
                                    </button>
                                </div>
                                <div className="flex w-full flex-col items-end">
                                    {citation === selectedCitation && showCitationSummary && <div className="text-xs">{citation.summary}</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }
    };




    // if there are no historical messages and the latestmessages are both empty, return null
    if (messages.length === 0 && latestUserMessage === '' && latestResponse === '') return null;

    return (
        <div className='w-full overflow-auto p-4 mt-4 border-2 rounded border-gray-800 dark:border-gray-300 bg-gray-100 dark:bg-gray-800'>
            <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">Chat History</h3>
            {latestMessageDisp()}
            {messages.slice().reverse().map((message, index) => (
                <div key={`c-${index}`} onClick={() => handleSelectMessage(message.messageId)} className={`relative mb-1 p-2 cursor-pointer border-2 bg-white dark:bg-gray-900 rounded-md ${message.messageId === selectedMessage ? 'border-gray-800 dark:border-gray-300' : 'border-gray-700 dark:border-gray-400 hover:bg-gray-200 hover:dark:bg-gray-700'} `}>
                    {userMessageDisp(message.prompt, `u-${index}`)}
                    {botMessageDisp(message.response, `m-${index}`, message.messageId, false, citations, selectedCitation, changeCitation)}
                </div>
            ))}
        </div>
    );
};
