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
    const { user, doc, chat, supabaseClient } = useSupaUser();

    const [messages, setMessages] = useState([]);
    const [latestUserMessage, setLatestUserMessage] = useState('');
    const [latestResponse, setLatestResponse] = useState('');
    const [citation, setCitation] = useState(null);

    const onUserInput = async (userPrompt) => {
        setMessages((prevMessages) => [
            ...prevMessages,
            {
                prompt: latestUserMessage,
                response: latestResponse,
                citations: citation,
            }
        ]);
        setLatestUserMessage(userPrompt);
        setLatestResponse('');

        // Send user input to backend
        const chatUrl = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL + 'chat';
        const postData = JSON.stringify({
            prompt: userPrompt,
            chatId: chat.id,
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
                if (data.citation) {
                    setCitation(data.citation);
                }
                if (data.token) {
                    setLatestResponse((t) => t + data.token);
                }
            }
        });
    }

    useEffect(() => {
        if (!chat) {
            setMessages([]);
            setLatestUserMessage('');
            setLatestResponse('');
            setCitation(null);
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
                    setMessages([]);
                    setLatestUserMessage('');
                    setLatestResponse('');
                    setCitation(null);
                }
                else {
                    const messageArray = messages.map((m) => {
                        return {
                            prompt: m.prompt,
                            response: m.response,
                            citation: {
                                url: doc.file_url,
                                page: m.citation_page,
                                left: m.citation_left,
                                top: m.citation_top,
                                right: m.citation_right,
                                bottom: m.citation_bottom,
                            }
                        }
                    });
                    setMessages(messageArray.slice(1).reverse());
                    setLatestUserMessage(messages[0].prompt);
                    setLatestResponse(messages[0].response);
                    setCitation({
                        url: doc.file_url,
                        page: messages[0].citation_page,
                        left: messages[0].citation_left,
                        top: messages[0].citation_top,
                        right: messages[0].citation_right,
                        bottom: messages[0].citation_bottom,
                    });
                }
            }
        }
        fetchMessages();
    }, [chat]);

    return (
        <div className="flex h-full w-full">
            <div className="flex flex-col w-2/5 h-full p-4 mt-4">
                <ChatBox onUserInput={onUserInput} />
                <div className="mt-4 overflow-auto">
                    <ChatHistory messages={messages} latestUserMessage={latestUserMessage} latestResponse={latestResponse} />
                </div>
            </div>
            <div className="flex flex-col justify-center w-3/5 h-full">
                <CitationViewer citation={citation} />
            </div>
        </div>
    );
}