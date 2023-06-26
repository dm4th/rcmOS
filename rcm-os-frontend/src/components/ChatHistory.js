import React from 'react';

export function ChatHistory ({ messages, latestUserMessage, latestResponse }) {

    const userMessageDisp = (message, key) => {
        return (
            <div className="flex items-start mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-6 w-6 text-gray-500 dark:text-white">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div key={key} className="text-gray-700">
                    {message}
                </div>
            </div>
        );
    }

    const botMessageDisp = (response, key) => {
        if (response.length > 0) {
            return (
                <div className="flex items-start mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-6 w-6 text-blue-500 dark:text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01" />
                    </svg>
                    <div key={key} className="text-blue-700" dangerouslySetInnerHTML={{__html: response}}></div>
                </div>
            )
        } else {
            return (
                <div className="flex items-center justify-center h-6 w-6 relative mb-2">
                    <svg className="animate-spin h-5 w-5 text-blue-500 dark:text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
            <div className={styles.convoBlock}>
                {userMessageDisp(latestUserMessage, 'u')}
                {botMessageDisp(latestResponse, 'm')}
            </div>
        );
    }

    // if (messages.length === 0) and latestUserMessage is an empty string return null;
    if (messages.length === 0 && latestUserMessage === '') return null;

    return (
        <div className={styles.convoHistoryContainer}>
            <h2 className={utilStyles.headingLg}>Chat History</h2>
            {latestMessageDisp()}
            {messages.slice().reverse().map((message, index) => (
                <div key={`c-${index}`} className={styles.convoBlock}>
                    {userMessageDisp(message.user.text, `u-${index}`)}
                    {botMessageDisp(message.model.text, `m-${index}`)}
                </div>
            ))}
        </div>
    );
};
