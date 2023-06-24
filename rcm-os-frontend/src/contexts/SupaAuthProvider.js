import { useEffect, useState, createContext, useContext } from 'react';
import { useUser, useSessionContext } from '@supabase/auth-helpers-react';

// Define the Default Role for non-logged in users here
const DEFAULT_ROLE = 'intro';

const UserContext = createContext(undefined);

const SupaContextProvider = (props) => {
    const { session, isLoading: isLoadingUser, supabaseClient: supabase } = useSessionContext();
    const user = useUser();
    const accessToken = session?.access_token ?? null;
    const [isLoadingData, setIsloadingData] = useState(false);
    const [availableDocuments, setAvailableDocuments] = useState(null);
    const [doc, setDoc] = useState(null);
    const [availableChats, setAvailableChats] = useState(null);
    const [chat, setChat] = useState(null);
    const [showLoginModal, setShowLoginModal] = useState(false);

    const getAvailableDocs = () => 
        supabase
            .from('medical_records')
            .select('id, file_name, content_embedding_progress')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

    const getChats = (d) =>
        supabase
            .from('document_chats')
            .select('id, title')
            .eq('record_id', d.id)
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

    const updateAvailableDocuments = async () => {
        if (!user) return;
        try {
            const response = await getAvailableDocs();
            if (response.data.length > 0) {
                // doc(s) exist
                const docs = response.data.map((d) => {
                    return { file_name: d.file_name, id: d.id, progress: d.content_embedding_progress };
                });
                setAvailableDocuments(docs);
            }
            else {
                // no docs exist
                setAvailableDocuments(null);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const changeDoc = async (docId) => {
        if (!user || !docId) return;
        let newDoc = availableDocuments.find((d) => d.id === docId);
        if (!newDoc) {
            // refresh available documents and try again
            await updateAvailableDocuments();
            newDoc = availableDocuments.find((d) => d.id === docId);
            // if still not found, return
            if (!newDoc) return;
        }
        setDoc(newDoc);
    }

    const updateAvailableChats = async () => {
        if (!user || !doc) return;
        try {
            const response = await getChats(doc);
            if (response.data.length > 0) {
                // chat history(s) exist
                const chats = response.data.map((chat) => {
                    return { title: chat.title, id: chat.id };
                });
                setAvailableChats(chats);
            }
            else {
                // no chat history(s) exist
                setAvailableChats(null);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const changeChat = async (chatId) => {
        if (!user || !chatId || chatId === '') setChat(null);
        else {
            let newChat = availableChats.find((chat) => chat.id === chatId);
            if (!chat) {
                // refresh previous chats and try again
                await updateAvailableChats();
                newChat = availableChats.find((chat) => chat.id === chatId);
                // if still not found, return
                if (!newChat) return;
            }
            setChat(newChat);
        };
    };

    const writeChatTitle = async (newTitle) => {
        if (chat.title === newTitle) return;
        const { data: chatTitleData, error: chatTitleError } = await supabase
            .from('document_chats')
            .update({ title: newTitle })
            .eq('id', chat.id)
            .select();
        if (chatTitleError) throw chatTitleError;
        // update previous chat history now with new title
        const updatedAvailableChats = availableChats.map((chat) => {
            if (chat.id === chatTitleData[0].id) {
                return { ...chat, title: chatTitleData[0].title };
            }
            return chat;
        });
        setAvailableChats(updatedAvailableChats);
        setChat({ ...chat, title: chatTitleData[0].title });
    };

    const handleLogin = () => {
        setShowLoginModal(true);
    };

    const handleCloseModal = () => {
        setShowLoginModal(false);
    };

    useEffect(() => {
        if (user) {
            handleCloseModal();
        }
    }, [user]);

    useEffect(() => {

        if (user && !isLoadingData) {
            // Login - get user details and chat history
            setIsloadingData(true);
            Promise.allSettled([updateAvailableDocuments()]).then((results) => {
                const availableDocsPromise = results[0];
                if (availableDocsPromise.status === 'fulfilled') {
                    if (availableDocsPromise.value) {
                        setDoc(availableDocsPromise.value[0]);
                    }
                }
            });
            Promise.allSettled([updateAvailableChats()]).then((results) => {
                const availableChatsPromise = results[0];
                if (availableChatsPromise.status === 'fulfilled') {
                    if (availableChatsPromise.value) {
                        setChat(availableChatsPromise.value[0]);
                    }
                }
            });
            setIsloadingData(false);
        } else if (!user && !isLoadingUser && !isLoadingData) {
            // Logout - reset state
            setAvailableDocuments(null);
            setDoc(null);
            setAvailableChats(null);
            setChat(null);
        }
    }, [user, isLoadingUser]);

    useEffect(() => {
        if (doc && user) {
            Promise.allSettled([updateAvailableChats()]).then((results) => {
                const availableChatsPromise = results[0];
                if (availableChatsPromise.status === 'fulfilled') {
                    if (availableChatsPromise.value) {
                        setChat(availableChatsPromise.value[0]);
                    }
                }
            });
        }
        else {
            setAvailableChats([]);
            setChat(null);
        }
    }, [doc]);

    const value = {
        accessToken,
        user,
        isLoading: isLoadingUser || isLoadingData,
        availableDocuments,
        doc,
        availableChats,
        chat,
        showLoginModal,
        changeDoc,
        changeChat,
        writeChatTitle,
        handleLogin,
        handleCloseModal,
        supabaseClient: supabase,
    };

    return <UserContext.Provider value={value} {...props} />;
};

const useSupaUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error(`useSupaUser must be used within a SupaContextProvider.`);
    }
    return context;
};

export { SupaContextProvider, useSupaUser };
