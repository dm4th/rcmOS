import React, { useState, useEffect } from 'react';
import { Viewer, Worker, SpecialZoomLevel, ViewMode } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
// import { searchPlugin } from '@react-pdf-viewer/search';
import { highlightPlugin, Trigger } from '@react-pdf-viewer/highlight';

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

    // create instance of highlight plugin
    const renderHighlight = (props) => {
        const highlightArea = {
            left: currentCitation.left * 100.0,
            top: currentCitation.top * 100.0,
            height: (currentCitation.bottom - currentCitation.top) * 100.0,
            width: (currentCitation.right - currentCitation.left) * 100.0,
            pageIndex: currentCitation.page,
        };
        let highlightColor;
        switch (currentCitation.type) {
            case 'text':
                // yellow
                highlightColor = 'yellow';
                break;
            case 'table':
                // green
                highlightColor = 'green';
                break;
            case 'key-value':
                // blue
                highlightColor = 'blue';
                break;
            default:
                // red
                highlightColor = 'red';
                break;
        };
        const hightlightStyle = (Object.assign(
            {},
            {
                background: highlightColor,
                opacity: 0.3,
            },
            props.getCssProperties(highlightArea, props.rotation)
        ));
        return (
            <div key='highlight' className="highlight-area" style={hightlightStyle} />
        );
    };

    const highlightPluginInstance = highlightPlugin({ 
        renderHighlight,
        trigger: Trigger.None 
    });

    // interface HighlightArea {
    //     left: number;
    //     top: number;
    //     height: number;
    //     width: number;
    //     pageIndex: number;
    // };
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

    const citationInformation = () => {
        if (currentCitation) {
            let similarityColor;
            let similarityText;
            const roundedSimilarity = Math.round(currentCitation.similarity * 100);
            if (currentCitation.similarity > 0.82) {
                similarityColor = 'text-green-700 dark:text-green-400';
                similarityText = 'Strong Match';
            }
            else if (currentCitation.similarity > 0.79) {
                similarityColor = 'text-yellow-700 dark:text-yellow-400';
                similarityText = 'Good Match';
            }
            else if (currentCitation.similarity > 0.75) {
                similarityColor = 'text-orange-700 dark:text-orange-400';
                similarityText = 'Fair Match';
            }
            else {
                similarityColor = 'text-red-700 dark:text-red-400';
                similarityText = 'Weak Match';
            }
            return (
                <div className='flex justify-between w-full'>
                    <p className='text-sm font-bold'>{currentCitation.title}</p>
                    <p className='text-sm font-bold'>page {currentCitation.page}</p>
                    <p className={`text-sm font-bold ${similarityColor}`}>{similarityText} - {roundedSimilarity}</p>
                </div>
            );
        }
        else {
            return (
                <></>
            );
        }
    };

    const PDFViewer = () => {
        if (file && currentCitation) {
            console.log(currentCitation);
            return (
                <div className='h-full w-full overflow-auto rounded-xl'>
                    <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.7.107/build/pdf.worker.js">
                        <Viewer
                            theme={{ theme: 'auto' }}
                            fileUrl={file}
                            defaultScale={SpecialZoomLevel.PageFit}
                            viewMode={ViewMode.SinglePage}
                            initialPage={currentCitation ? currentCitation.page-1 : 0}
                            plugins={[highlightPluginInstance, defaultLayoutPluginInstance]}
                            
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
        <div className="flex flex-col h-full m-8 p-4 border-2 rounded border-gray-800 dark:border-gray-300 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            {citationInformation()}
            {PDFViewer()}
        </div>
    );
};
