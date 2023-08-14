import React from 'react';
import { useRouter } from 'next/router';

export default function Unauthorized() {

    const router = useRouter();

    const onHomeClick = () => {
        router.push('/');
    }

    return (
        <div className='flex flex-col h-full bg-white dark:bg-gray-900 text-center'>
            <h1 className="text-gray-900 dark:text-gray-100 text-4xl font-bold m-4">Unauthorized</h1>
            <p className="text-gray-900 dark:text-gray-100 text-sm font-bold m-4">You do not have permission to view this page.</p>
            <p className="cursor-pointer text-blue-500 text-sm font-bold hover:underline m-4" onClick={() => onHomeClick()}>Back to Home</p>
        </div>
    );
}
