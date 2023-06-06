import { useContext } from 'react';
import { ThemeContext } from '@/contexts/ThemeContext';

export function Header() {
    const { theme, toggleTheme } = useContext(ThemeContext);

    return (
        <header className="flex justify-between items-center p-4 bg-gray-800 dark:bg-gray-200">
            <h1 className="text-white dark:text-gray-900">rcmOS</h1>
            <div>
                <label className="text-white dark:text-gray-900">
                    <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
                    Dark Mode
                </label>
            </div>
        </header>
    );
}