import React, { useState, useEffect } from 'react';
import { Viewer, Worker, SpecialZoomLevel, ViewMode } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { searchPlugin } from '@react-pdf-viewer/search';
import { highlightPlugin } from '@react-pdf-viewer/highlight';

// Import the styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';

import { useSupaUser } from '@/contexts/SupaAuthProvider.js';

export function CitationViewer ({ selectedMessage }) {

    const { doc, file, supabaseClient } = useSupaUser();

    const [loading, setLoading] = useState(false);
    const [citations, setCitations] = useState([]);
    const [citationIndex, setCitationIndex] = useState(0);
    const [currentCitation, setCurrentCitation] = useState(null);

    // create instance of default layout plugin
    const defaultLayoutPluginInstance = defaultLayoutPlugin();

    // create instance of search plugin
    const searchPluginInstance = searchPlugin();

    // create instance of highlight plugin
    const highlightPluginInstance = highlightPlugin();
    const { highlight } = searchPluginInstance;

    useEffect(() => {
        const getCitations = async () => {
            const { data, error } = await supabaseClient
                .from('document_chat_citations')
                .select('*')
                .eq('chat_history_id', selectedMessage)
                .order('index', { ascending: true });
            if (error) {
                console.error(error);
            } else {
                if (data.length === 0) {
                    setCitations([]);
                }
                else {
                    const citationArray = data.map((c) => {
                        return {
                            index: c.index,
                            type: c.type,
                            page: c.page,
                            title: c.title,
                            summary: c.summary,
                            left: c.left,
                            top: c.top,
                            right: c.right,
                            bottom: c.bottom,
                            similarity: c.similarity,
                        }
                    });
                    setCitations(citationArray);
                    setCitationIndex(0);
                    setCurrentCitation(citationArray[0]);
                }
            }
            setLoading(false);
        }
        if (selectedMessage) {
            setLoading(true);
            getCitations();
        }
        else {
            setCitations([]);
            setCitationIndex(0);
            setCurrentCitation(null);
        }
    }, [selectedMessage]);

    useEffect(() => {
        if (currentCitation) {
            let highlightColor;
            switch (currentCitation.type) {
                case 'text':
                    // yellow
                    highlightColor = 'rgba(255, 255, 0, 0.3)';
                    break;
                case 'table':
                    // green
                    highlightColor = 'rgba(0, 255, 0, 0.3)';
                    break;
                case 'key-value':
                    // blue
                    highlightColor = 'rgba(0, 0, 255, 0.3)';
                    break;
                default:
                    // red
                    highlightColor = 'rgba(255, 0, 0, 0.3)';
            };
            highlight({
                pageIndex: currentCitation.page,
                rects: [
                    {
                        left: currentCitation.left,
                        top: currentCitation.top,
                        width: currentCitation.right - currentCitation.left,
                        height: currentCitation.bottom - currentCitation.top,
                    },
                ],
                backgroundColor: highlightColor,
            });
        }
    }, [currentCitation]);

    const PDFViewer = () => {
        if (file && currentCitation) {
            console.log(currentCitation);
            return (
                <div className='relative items-center justify-center h-full w-full'>
                    <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.7.107/build/pdf.worker.js">
                        <Viewer
                            theme={{ theme: 'auto' }}
                            fileUrl={file}
                            defaultScale={SpecialZoomLevel.PageWidth}
                            viewMode={ViewMode.SinglePage}
                            initialPage={currentCitation ? currentCitation.page-1 : 0}
                            plugins={[highlightPluginInstance, searchPluginInstance, defaultLayoutPluginInstance]}
                            
                        />
                    </Worker>
                </div>
            );
        }
        else {        
            return (
                <></>
            );
        }
    }

    if (loading) return (
        <div className="h-full m-8 p-4 border-2 rounded border-gray-800 dark:border-gray-300 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <div className='relative items-center justify-center h-1/2 w-1/2'>
                <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 1.044.183 2.051.507 3h1.986c-.326-.949-.493-1.955-.493-3z"></path>
                </svg>
            </div>
        </div>
    );

    return (
        <div className="h-full m-8 p-4 border-2 rounded border-gray-800 dark:border-gray-300 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">            
            {selectedMessage}
            {PDFViewer()}
        </div>
    );
};
