import React from 'react';

export function CitationViewer ({ citation }) {

    const citationView = citation ? (
        <ul>
            {citation.map((c, i) => (
                <li key={i}>
                    <p>{c}</p>
                </li>
            ))}
        </ul>
    ) : (
        <p>No citation available.</p>
    );


    return (
        <div className="h-full m-8 p-8 border-2 rounded border-gray-800 dark:border-gray-300 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            {citation}
        </div>
    );
};
