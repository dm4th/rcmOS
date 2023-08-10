import { useContext } from 'react';
import { ThemeContext } from '@/contexts/ThemeContext';
import { useSupaUser } from '@/contexts/SupaAuthProvider';

export function Header() {
    const { theme, toggleTheme } = useContext(ThemeContext);
    const { user, supabaseClient, handleLogin } = useSupaUser();

    const userButton = user ? (
        <button
            className="bg-red-900 dark:bg-red-400 text-white dark:text-gray-900 px-4 py-2 rounded-md"
            onClick={() => supabaseClient.auth.signOut()}
        >
            Sign Out
        </button>
    ) : (
        <button
            className="bg-green-900 dark:bg-green-400 text-white dark:text-gray-900 px-4 py-2 rounded-md"
            onClick={handleLogin}
        >
            Sign In
        </button>
    );

    return (
        <header className="flex justify-between items-center p-4 border-b-2 border-gray-800 dark:border-gray-300 bg-gray-200 dark:bg-gray-800">
            {userButton}
            <div>
                <label className="text-gray-900 dark:text-white">
                    <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} className="m-2" />
                    Dark Mode
                </label>
            </div>
        </header>
    );
}