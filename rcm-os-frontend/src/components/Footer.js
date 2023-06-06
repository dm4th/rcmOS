// components/Footer.js
import Link from 'next/link';

export function Footer() {

    const linkClass = 'ml-6 text-sm text-white hover:text-gray-300 dark:text-gray-500 dark:hover:text-gray-900';

    return (
        <footer className="flex items-center justify-center w-full h-24 border-t bg-gray-800 dark:bg-gray-200">
            <Link href="/about" className={linkClass}>
                About
            </Link>
            <Link href="/contact" className={linkClass}>
                Contact
            </Link>
        </footer>
    );
}
