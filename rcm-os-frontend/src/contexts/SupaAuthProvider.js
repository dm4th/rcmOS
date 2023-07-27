import { useEffect, useState, createContext, useContext } from 'react';
import { useUser, useSessionContext } from '@supabase/auth-helpers-react';

// Define the Default Role for non-logged in users here
const DEFAULT_TEMPLATE = {
    id: 'default',
    title: 'Default Template',
    description: "patient medical records",
    role: "Medical Documentation Specialist",
    goal: "Understand the patient's medical history"
};
    

const UserContext = createContext(undefined);

const SupaContextProvider = (props) => {
    const { session, isLoading: isLoadingUser, supabaseClient: supabase } = useSessionContext();
    const user = useUser();
    const accessToken = session?.access_token ?? null;
    const [isLoadingData, setIsloadingData] = useState(false);
    const [availableClaims, setAvailableClaims] = useState([]);
    const [claim, setClaim] = useState(null);
    const [availableDocuments, setAvailableDocuments] = useState([]);
    const [doc, setDoc] = useState(null);
    const [file, setFile] = useState(null);
    const [inputTemplate, setInputTemplate] = useState(null);
    const [availableChats, setAvailableChats] = useState([]);
    const [chat, setChat] = useState(null);
    const [showLoginModal, setShowLoginModal] = useState(false);

    const getAvailableClaims = async () => {
        if (!user) return;
        const { data: claimsData, error: claimsError } = await supabase
            .from('claims')
            .select('id, title, status, created_at, updated_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (claimsError) throw claimsError;
        if (claimsData.length > 0) {
            const claims = await Promise.all(claimsData.map(async (claim) => {
                const { data: documentData, error: documentError } = await supabase
                    .from('claim_documents')
                    .select('*')
                    .eq('claim_id', claim.id);
                if (documentError) throw documentError;
                if (documentData.length === 0) return { title: claim.title, id: claim.id, status: claim.status, created_at: claim.created_at, updated_at: claim.updated_at, denial_letters: [], medical_records: [] };
                const documents = documentData.map((doc) => {
                    return { file_name: doc.file_name, id: doc.document_id, progress: doc.content_processing_progress, url: doc.file_url, type: doc.type, summary: doc.summary };
                });
                const denialLetters = documents.filter((doc) => doc.type === 'denial_letter');
                const medicalRecords = documents.filter((doc) => doc.type === 'medical_record');
                return { title: claim.title, id: claim.id, status: claim.status, created_at: claim.created_at, updated_at: claim.updated_at, denial_letters: denialLetters, medical_records: medicalRecords };
            }));
            return claims;
        }
    }
    
    const getAvailableDocs = () => 
        supabase
            .from('medical_records')
            .select('id, file_name, file_url, template_id, content_embedding_progress')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

    const getInputTemplate = (templateId) =>
        supabase
            .from('input_templates')
            .select('id, title, description, role, goal')
            .eq('id', templateId);

    const getChats = (d) =>
        supabase
            .from('document_chats')
            .select('id, title')
            .eq('record_id', d.id)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

    const createNewChat = async (d) => 
        supabase
            .from('document_chats')
            .insert([{
                record_id: d.id,
                user_id: user.id,
                title: `Chat ${availableChats.length + 1}`,
            }])
            .select();

    const changeDocName = async (docId, newName) =>
        supabase
            .from('medical_records')
            .update({ file_name: newName })
            .eq('id', docId);

    const changeChatName = async (chatId, newName) =>
        supabase
            .from('document_chats')
            .update({ title: newName })
            .eq('id', chatId);

    const updateAvailableClaims = async () => {
        if (!user) return;
        try {
            const claimData = await getAvailableClaims();
            if (claimData) {
                // claim(s) exist
                const claims = claimData.map((claim) => {
                    return { title: claim.title, id: claim.id, status: claim.status, created_at: claim.created_at, updated_at: claim.updated_at, denial_letters: claim.denial_letters, medical_records: claim.medical_records };
                });
                setAvailableClaims(claims);
                return claims;
            }
            else {
                // no claims exist
                setAvailableClaims([]);
                return null;
            }
        } catch (error) {
            console.error(error);
        }
    };

    const updateAvailableDocuments = async () => {
        if (!user) return;
        try {
            const response = await getAvailableDocs();
            if (response.data.length > 0) {
                // doc(s) exist
                const docs = response.data.map((d) => {
                    return { file_name: d.file_name, id: d.id, progress: d.content_embedding_progress, url: d.file_url, template_id: d.template_id };
                });
                setAvailableDocuments(docs);
                return docs;
            }
            else {
                // no docs exist
                setAvailableDocuments([]);
                return null;
            }
        } catch (error) {
            console.error(error);
        }
    };

    const changeDoc = async (docId) => {
        if (!user || !docId) return;
        if (docId === 'new') {
            setDoc(null);
            setInputTemplate(null);
            return;
        }
        let newDoc = availableDocuments.find((d) => d.id === docId);
        if (!newDoc) {
            // refresh available documents and try again
            await updateAvailableDocuments();
            newDoc = availableDocuments.find((d) => d.id === docId);
            // if still not found, return
            if (!newDoc) return;
        }
        setDoc(newDoc);

        if (newDoc.template_id) {
            const { data: templateData, error: templateError } = await getInputTemplate(newDoc.template_id);
            if (templateError) throw templateError;
            setInputTemplate(templateData[0]);
        }

        else setInputTemplate(null);
    }

    const writeDocTitle = async (docId, newTitle) => {
        await changeDocName(docId, newTitle);
        await updateAvailableDocuments();
    };

    const getFileUrl = async () => {
        // store PDF file in state for rendering in PDF viewer
        if (!user || !doc) return;
        try {
            const { data: fileData, error: fileError } = await supabase
                .storage
                .from('records')
                .getPublicUrl(doc.url);
            if (fileError) throw fileError;
            const fileUrl = fileData.publicUrl;
            return fileUrl;
        } catch (error) {
            console.error(error);
        }
    };

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
                return chats;
            }
            else {
                // no chat history(s) exist
                setAvailableChats([]);
                return null;
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

    const newChat = async () => {
        if (!user || !doc) return;
        const { data: newChatData, error: newChatError } = await createNewChat(doc);
        if (newChatError) throw newChatError;
        // add the new chat to the top of available chats
        const updatedAvailableChats = [{ title: newChatData[0].title, id: newChatData[0].id }, ...availableChats];
        setAvailableChats(updatedAvailableChats);
        setChat({ title: newChatData[0].title, id: newChatData[0].id });
    };

    const writeChatTitle = async (chatId, newTitle) => {
        await changeChatName(chatId, newTitle);
        await updateAvailableChats();
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
            setClaim(null);
            Promise.allSettled([updateAvailableClaims()]).then((results) => {
                const availableClaimsPromise = results[0];
                if (availableClaimsPromise.status !== 'fulfilled') {
                    console.error(availableClaimsPromise.reason);
                }
            });
            setIsloadingData(false);
        } else if (!user && !isLoadingUser && !isLoadingData) {
            // Logout - reset state
            setAvailableDocuments([]);
            setDoc(null);
            setAvailableChats([]);
            setChat(null);
        }
    }, [user, isLoadingUser]);

    useEffect(() => {
        if (doc && user) {
            const fetchChatsAndFile = async () => {
                const chats = await updateAvailableChats();
                const fileUrl = await getFileUrl();
                let template = null;
                if (doc.template_id) {
                    template = await getInputTemplate(doc.template_id);
                }
    
                if (chats) {
                    setChat(chats[0]);
                }
    
                if (fileUrl) {
                    setFile(fileUrl);
                }

                if (template) {
                    setInputTemplate(template.data[0]);
                }
                else {
                    setInputTemplate(DEFAULT_TEMPLATE);
                }
            };
    
            fetchChatsAndFile();
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
        availableClaims,
        availableDocuments,
        doc,
        file,
        inputTemplate,
        availableChats,
        chat,
        showLoginModal,
        updateAvailableClaims,
        updateAvailableDocuments,
        changeDoc,
        writeDocTitle,
        changeChat,
        writeChatTitle,
        newChat,
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
