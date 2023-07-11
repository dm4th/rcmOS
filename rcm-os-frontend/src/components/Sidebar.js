import React, { useState, useEffect } from 'react';

import { useSupaUser } from '@/contexts/SupaAuthProvider';

export function Sidebar({ setAppStage }) {

    const { 
        user, 
        isLoading, 
        availableDocuments, 
        doc, 
        changeDoc,
        writeDocTitle,
        availableChats, 
        chat, 
        changeChat,
        newChat,
        writeChatTitle,
        handleLogin 
    } = useSupaUser();

    const [editingDocId, setEditingDocId] = useState(null);
    const [editingChatId, setEditingChatId] = useState(null);
    const [newName, setNewName] = useState(null);

    const handleDocNameChange = async (docId, name) => {
        await writeDocTitle(docId, name);
        setEditingDocId(null);
        setNewName(null);
    };

    const handleChatNameChange = async (chatId, name) => {
        await writeChatTitle(chatId, name);
        setEditingChatId(null);
        setNewName(null);
    };

    const editDoc = (docId, docName) => {
        setEditingDocId(docId);
        setNewName(docName);
        setEditingChatId(null);
    };

    const editChat = (chatId, chatName) => {
        setEditingChatId(chatId);
        setNewName(chatName);
        setEditingDocId(null);
    };

    const handleNoNameChange = () => {
        setEditingDocId(null);
        setEditingChatId(null);
        setNewName(null);
    };

    function handleNewDoc() {
        changeDoc('new');
        setAppStage('intro');
    };

    function handleChangeDoc(newDoc) {
        changeDoc(newDoc);
        setAppStage('chat');
    };

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
        <>
            <div className="flex flex-col items-center justify-start h-full">
                <div className="flex justify-between items-center w-full">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        Documents
                    </h3>
                    <button className="border-2 border-gray-600 rounded p-1" onClick={handleNewDoc}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5 text-gray-800 dark:text-gray-200">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </button>
                </div>
                <div className="flex flex-col w-full">
                    <ul>
                        {availableDocuments && availableDocuments.map((d) => (
                            <li key={d.id} onClick={() => handleChangeDoc(d.id)} className={`flex-1 w-full text-gray-700 dark:text-gray-300 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 rounded p-2 my-1 flex justify-between items-center ${doc && doc.id === d.id ? 'border-2 border-gray-700 dark:border-gray-300' : ''}`}>
                                {editingDocId === d.id ? (
                                    <input 
                                        type="text" 
                                        value={newName} 
                                        onChange={(e) => setNewName(e.target.value)} 
                                        onBlur={handleNoNameChange}
                                        onKeyDown={(e) => e.key === 'Enter' && handleDocNameChange(editingDocId, newName)}
                                        className='rounded p-1 text-gray-700 bg-gray-100' />    
                                ) : (
                                    <span className="flex-grow">{d.file_name}</span>
                                )}
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" onClick={() => editDoc(d.id, d.file_name)} className="mx-2 h-3 w-3 fill-current cursor-pointer">
                                    <path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"/>
                                </svg>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <div className="flex flex-col items-center justify-start h-full">
                <div className="flex justify-between items-center w-full">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        Chats
                    </h3>
                    <button className="border-2 border-gray-600 rounded p-1" onClick={newChat}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5 text-gray-800 dark:text-gray-200">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </button>
                </div>
                <div className="flex flex-col w-full">
                    <ul>
                        {availableChats && availableChats.map((c) => (
                            <li key={c.id} onClick={() => changeChat(c.id)} className={`flex-1 w-full text-gray-700 dark:text-gray-300 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 rounded p-2 my-1 flex flex-fill items-center ${chat && chat.id === c.id ? 'border-2 border-gray-700 dark:border-gray-300' : ''}`}>
                                {editingChatId === c.id ? (
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        onBlur={handleNoNameChange}
                                        onKeyDown={(e) => e.key === 'Enter' && handleChatNameChange(editingChatId, newName)}
                                        className='rounded p-1 text-gray-700 bg-gray-100' />
                                ) : (
                                    <span className="flex-grow">{c.title}</span>
                                )}
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" onClick={() => editChat(c.id, c.title)} className="mx-2 h-3 w-3 fill-current">
                                    <path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z"/>
                                </svg>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </>
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
