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
        <header className="flex justify-between items-center p-4 bg-gray-800 dark:bg-gray-200">
            {userButton}
            <div>
                <label className="text-white dark:text-gray-900">
                    <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
                    Dark Mode
                </label>
            </div>
        </header>
    );
}