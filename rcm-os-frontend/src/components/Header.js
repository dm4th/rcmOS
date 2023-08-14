import { useContext } from 'react';
import { useRouter } from 'next/router';
import { ThemeContext } from '@/contexts/ThemeContext';
import { useSupaUser } from '@/contexts/SupaAuthProvider';

export function Header() {
    const router = useRouter();
    const { theme, toggleTheme } = useContext(ThemeContext);
    const { user, supabaseClient, handleLogin } = useSupaUser();

    const userButton = user ? (
        <button
            className="bg-red-900 dark:bg-red-400 text-white mx-2 px-4 py-2 rounded-md"
            onClick={() => supabaseClient.auth.signOut()}
        >
            Sign Out
        </button>
    ) : (
        <button
            className="bg-green-900 dark:bg-green-400 text-white mx-2 px-4 py-2 rounded-md"
            onClick={handleLogin}
        >
            Sign In
        </button>
    );

    return (
        <header className="flex justify-between items-center font-bold p-4 border-b-2 border-gray-800 dark:border-gray-300 bg-gray-200 dark:bg-gray-800">
            <div className="flex items-center">
            {userButton}
            {router.pathname !== '/' && (
                <button
                    className="bg-blue-600 text-white mx-2 px-4 py-2 rounded-md mr-4"
                    onClick={() => router.push('/')}
                >
                    Back to Dashboard
                </button>
            )}
            </div>
            <div>
                <button onClick={toggleTheme} className="focus:outline-none">
                    {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </button>
            </div>
        </header>
    );
}

const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-6 w-6 text-gray-800 dark:text-gray-300">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
);

const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.38V12a9.002 9.002 0 01-8 8.99 7.523 7.523 0 01-4.288-1.033 9.004 9.004 0 0011.288-7.957z" />
    </svg>
);
