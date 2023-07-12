// React imports
import React, { useState, useEffect } from 'react';

// Networking Imports
import { fetchEventSource } from '@microsoft/fetch-event-source';

// Context Imports
import { useSupaUser } from '@/contexts/SupaAuthProvider';

// Component Imports
import { CitationViewer } from '@/components/CitationViewer';
import { ChatBox } from '@/components/ChatBox';
import { ChatHistory } from '@/components/ChatHistory';

export function ChatInterface({ }) {

    // Get Supabase User context
    const { user, doc, inputTemplate, chat, supabaseClient } = useSupaUser();

    const [initialized, setInitialized] = useState(false);
    const [messages, setMessages] = useState([]);
    const [latestUserMessage, setLatestUserMessage] = useState('');
    const [latestResponse, setLatestResponse] = useState('');
    const [latestMessageId, setLatestMessageId] = useState(null);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [citations, setCitations] = useState([]);
    const [selectedCitation, setSelectedCitation] = useState(null);
    const [citationLoading, setCitationLoading] = useState(false);

    const resetChatState = () => {
        setInitialized(false);
        setMessages([]);
        setLatestUserMessage('');
        setLatestResponse('');
        setLatestMessageId(null);
        setSelectedMessage(null);
        setCitations([]);
        setSelectedCitation(null);
    }

    const getCitations = async (messageId) => {
        setCitationLoading(true);
        const { data, error } = await supabaseClient
            .from('document_chat_citations')
            .select('*')
            .eq('chat_history_id', messageId)
            .order('index', { ascending: true });
        if (error) {
            console.error(error);
        } else {
            if (data.length === 0) {
                setCitations([]);
                setSelectedCitation(null);
            }
            else {
                const citationArray = data.map((c) => {
                    return {
                        index: c.index,
                        type: c.type,
                        page: c.page,
                        title: c.title,
                        summary: c.summary,
                        left: c.left,
                        top: c.top,
                        right: c.right,
                        bottom: c.bottom,
                        similarity: c.similarity,
                    }
                });
                setCitations(citationArray);
                setSelectedCitation(citationArray[0]);
            }
        }
        setCitationLoading(false);
    }

    const onUserInput = async (userPrompt) => {
        if (initialized) {
            setMessages((prevMessages) => [
                ...prevMessages,
                {
                    prompt: latestUserMessage,
                    response: latestResponse,
                    messageId: latestMessageId,
                }
            ]);
        }
        setInitialized(true);
        setLatestUserMessage(userPrompt);
        setLatestResponse('');
        setLatestMessageId(null);
        setSelectedMessage(null);
        setCitations([]);
        setSelectedCitation(null);

        // Send user input to backend
        const chatUrl = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL + 'document-chat';
        const postData = JSON.stringify({
            prompt: userPrompt,
            chat_id: chat.id,
            record_id: doc.id,
            input_template: inputTemplate,
            user_id: user.id,
        });
        await fetchEventSource(chatUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            },
            body: postData,
            onmessage: (event) => {
                const data = JSON.parse(event.data);
                if (data.history_id) {
                    setLatestMessageId(data.history_id);
                    setSelectedMessage(data.history_id);
                    getCitations(data.history_id);
                }
                if (data.token) {
                    setLatestResponse((t) => t + data.token);
                }
            }
        });
    }

    const handleCitationClick = (citation) => {
        setSelectedCitation(citation);
    }

    useEffect(() => {
        if (!chat) {
            resetChatState();
            return;
        }

        const fetchMessages = async () => {
            const { data: messages, error } = await supabaseClient
                .from('document_chat_history')
                .select('*')
                .eq('chat_id', chat.id)
                .order('created_at', { ascending: false });
            if (error) {
                console.error(error);
                alert(error.message);
            } else {
                if (messages.length === 0) {
                    resetChatState();
                }
                else {
                    const messageArray = messages.map((m) => {
                        return {
                            prompt: m.prompt,
                            response: m.response,
                            messageId: m.id
                        }
                    });
                    setMessages(messageArray.slice(1).reverse());
                    setLatestUserMessage(messages[0].prompt);
                    setLatestResponse(messages[0].response);
                    setLatestMessageId(messages[0].id);
                    setSelectedMessage(messages[0].id);
                    getCitations(messages[0].id);
                }
            }
        }
        fetchMessages();
    }, [chat]);

    useEffect(() => {
        if (!selectedMessage) {
            setCitations([]);
            setSelectedCitation(null);
            return;
        }
        getCitations(selectedMessage);
    }, [selectedMessage]);

    return (
        <div className="flex h-full w-full overflow-hidden">
            <div className="flex flex-col w-2/5 h-full p-4 mv-4 pr-0.5">
                <ChatBox onUserInput={onUserInput} />
                <ChatHistory 
                    messages={messages} 
                    latestUserMessage={latestUserMessage} 
                    latestResponse={latestResponse} 
                    latestMessageId={latestMessageId} 
                    selectedMessage={selectedMessage} 
                    changeMessage={setSelectedMessage} 
                    citations={citations}
                    selectedCitation={selectedCitation}
                    changeCitation={handleCitationClick}
                />
            </div>
            <div className="flex flex-col justify-center w-3/5 h-full p-4 mv-4 pl-0.5">
                <CitationViewer selectedCitation={selectedCitation} citationLoading={citationLoading} />
            </div>
        </div>
    );
}