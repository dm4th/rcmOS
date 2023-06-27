// components/Footer.js
import Link from 'next/link';

export function Footer() {

    const linkClass = 'ml-6 text-sm text-gray-500 hover:text-gray-900 dark:text-white dark:hover:text-gray-300';

    return (
        <footer className="flex items-center justify-center w-full h-24 border-t-2 border-gray-800 dark:border-gray-300 bg-gray-200 dark:bg-gray-800">
            <Link href="/about" className={linkClass}>
                About
            </Link>
            <Link href="/contact" className={linkClass}>
                Contact
            </Link>
        </footer>
    );
}
