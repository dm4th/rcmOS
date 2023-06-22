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
    const [userDetails, setUserDetails] = useState(null);
    const [chatRole, setChatRole] = useState(null);
    const [availableChatRoles, setAvailableChatRoles] = useState(null);
    const [previousChats, setPreviousChats] = useState([]);
    const [chat, setChat] = useState(null);

    const getUserDetails = () => 
        supabase
            .from('profiles')
            .select('username, full_name, avatar_url, email')
            .eq('id', user.id)
            .single();

    const getChatRoles = () => 
        supabase
            .from('chat_roles')
            .select('id, role')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

    const getAnonRole = () => 
        supabase
            .from("chat_roles")
            .select("id")
            .eq("role", DEFAULT_ROLE)
            .is("user_id", null)
            .single();
        
    const initializeChatRole = (user_id) =>
        supabase
            .from('chat_roles')
            .insert([{ user_id, role: DEFAULT_ROLE }])
            .select();

    const getPreviousChats = (role) =>
        supabase
            .from('chats')
            .select('id, title')
            .eq('role_id', role.id)
            .order('updated_at', { ascending: false });

    const updateUserDetails = async () => {
        if (!user) return;
        try {
            const response = await getUserDetails();
            setUserDetails(response.data);
        } catch (error) {
            console.error(error);
        }
    };

    const updateAvailableChatRoles = async () => {
        if (!user) return;
        try {
            const response = await getChatRoles();
            if (response.data.length > 0) {
                // chat role(s) exist
                const roles = response.data.map((role) => {
                    return { role: role.role, id: role.id };
                });
                setAvailableChatRoles(roles);
            }
            else {
                // no chat roles exist
                setAvailableChatRoles(null);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const updateChatRole = async (role) => {
        if (!user || !role) return;
        let roleToUpdate = availableChatRoles.find((r) => r.role === role);
        if (!roleToUpdate) {
            // refresh available chat roles and try again
            await updateAvailableChatRoles();
            roleToUpdate = availableChatRoles.find((r) => r.role === role);
            // if still not found, return
            if (!roleToUpdate) return;
        }
        setChatRole(roleToUpdate);
    }

    const changeChat = async (chatId) => {
        if (!chatId || chatId === '') setChat(null);
        else {
            const chat = previousChats.find((chat) => chat.id === chatId);
            if (!chat) {
                // refresh previous chats and try again
                Promise.allSettled([getPreviousChats(chatRole)]).then((results) => {
                    const previousChatsPromise = results[0];
                    if (previousChatsPromise.status === 'fulfilled') {
                        const newPreviousChats = previousChatsPromise.value.data;
                        setPreviousChats(newPreviousChats);
                        setChat(newPreviousChats.find((chatValue) => chatValue.id === chatId));
                    }
                });
            }
            setChat(chat);
        };
    };

    const writeChatTitle = async (newTitle) => {
        if (chat.title === newTitle) return;
        const { data: chatTitleData, error: chatTitleError } = await supabase
            .from('chats')
            .update({ title: newTitle })
            .eq('id', chat.id)
            .select();
        if (chatTitleError) throw chatTitleError;
        // update previous chat history now with new title
        const updatedPreviousChats = previousChats.map((chat) => {
            if (chat.id === chatTitleData[0].id) {
                return { ...chat, title: chatTitleData[0].title };
            }
            return chat;
        });
        setPreviousChats(updatedPreviousChats);
        setChat({ ...chat, title: chatTitleData[0].title });
    };


    useEffect(() => {

        if (user && !isLoadingData && !userDetails) {
            // Login - get user details and chat history
            setIsloadingData(true);
            Promise.allSettled([getUserDetails(), getChatRoles()]).then(
                (results) => {
                    const userDetailsPromise = results[0];
                    const chatRolePromise = results[1];

                    if (userDetailsPromise.status === 'fulfilled') 
                        setUserDetails(userDetailsPromise.value.data);

                    if (chatRolePromise.status === 'fulfilled') {
                        if (chatRolePromise.value.data.length > 0) {
                            // chat role(s) exist
                            const roles = chatRolePromise.value.data.map((role) => {
                                return { role: role.role, id: role.id };
                            });
                            setChatRole(roles[0]);
                            setAvailableChatRoles(roles);
                        }
                        else {
                            // Write intro role to DB for new user and set value to new role
                            Promise.allSettled([initializeChatRole(user.id)]).then(
                                (results) => {
                                    const newRolePromise = results[0];
                                    if (newRolePromise.status === 'fulfilled') {
                                        setChatRole({ role: newRolePromise.value.data.role, id: newRolePromise.value.data.id });
                                        setAvailableChatRoles([{ role: newRolePromise.value.data.role, id: newRolePromise.value.data.id }]);
                                    }
                                }
                            );
                        }
                    }

                    setIsloadingData(false);
                }
            );
        } else if (!user && !isLoadingUser && !isLoadingData) {
            // Logout - reset state
            setUserDetails(null);
            Promise.allSettled([getAnonRole()]).then((results) => {
                const anonRolePromise = results[0];
                if (anonRolePromise.status === 'fulfilled') {
                    setChatRole({ role: DEFAULT_ROLE, id: anonRolePromise.value.data.id });
                }
            });
        }
    }, [user, isLoadingUser]);

    useEffect(() => {
        if (chatRole && user) {
            Promise.allSettled([getPreviousChats(chatRole)]).then((results) => {
                const previousChatsPromise = results[0];
                if (previousChatsPromise.status === 'fulfilled' && previousChatsPromise.value.data) {
                    setPreviousChats(previousChatsPromise.value.data);
                }
            });
        }
        else {
            setPreviousChats([]);
        }
        setChat(null);
    }, [chatRole]);

    const value = {
        accessToken,
        user,
        userDetails,
        isLoading: isLoadingUser || isLoadingData,
        chatRole,
        availableChatRoles,
        previousChats,
        chat,
        updateUserDetails,
        updateChatRole,
        updateAvailableChatRoles,
        changeChat,
        writeChatTitle,
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
