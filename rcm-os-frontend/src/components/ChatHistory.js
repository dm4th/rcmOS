import React from 'react';

export function ChatHistory ({ messages, latestUserMessage, latestResponse, latestMessageId, selectedMessage, changeMessage }) {

    function handleSelectMessage(messageId) {
        changeMessage(messageId);
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

    const botMessageDisp = (response, key, messageId, latest) => {
        if (response.length > 0) {
            return (
                <div className="flex items-start mb-2 text-sm text-left text-gray-900 dark:text-gray-100">
                    <div key={key}>
                        {messageId === selectedMessage ? response : latest && !messageId ? response : "..."}
                    </div>
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
            <div onClick={() => handleSelectMessage(latestMessageId)} className={`relative mb-1 p-2 cursor-pointer border-2 bg-white hover:bg-gray-200 dark:bg-gray-900 hover:dark:bg-gray-700 rounded-md ${latestMessageId === selectedMessage ? 'border-gray-800 dark:border-gray-300' : 'border-gray-700 dark:border-gray-400'} `}>
                {userMessageDisp(latestUserMessage, 'u')}
                {botMessageDisp(latestResponse, 'm', latestMessageId, true)}
            </div>
        );
    }

    // if there are no historical messages and the latestmessages are both empty, return null
    if (messages.length === 0 && latestUserMessage === '' && latestResponse === '') return null;

    return (
        <div className='w-full p-4 border-2 rounded border-gray-800 dark:border-gray-300 bg-gray-100 dark:bg-gray-800'>
            <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">Chat History</h3>
            {latestMessageDisp()}
            {messages.slice().reverse().map((message, index) => (
                <div key={`c-${index}`} onClick={() => handleSelectMessage(message.messageId)} className={`relative mb-1 p-2 cursor-pointer border-2 bg-white hover:bg-gray-200 dark:bg-gray-900 hover:dark:bg-gray-700 rounded-md ${message.messageId === selectedMessage ? 'border-gray-800 dark:border-gray-300' : 'border-gray-700 dark:border-gray-400'} `}>
                    {userMessageDisp(message.prompt, `u-${index}`)}
                    {botMessageDisp(message.response, `m-${index}`, message.messageId, false)}
                </div>
            ))}
        </div>
    );
};
