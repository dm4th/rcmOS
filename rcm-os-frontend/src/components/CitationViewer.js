import React, { useEffect } from 'react';
import { Viewer, Worker, SpecialZoomLevel, ViewMode } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { highlightPlugin, Trigger } from '@react-pdf-viewer/highlight';

// Import the styles
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import '@react-pdf-viewer/highlight/lib/styles/index.css';

import { useSupaUser } from '@/contexts/SupaAuthProvider.js';

export function CitationViewer ({ selectedCitation, citationLoading }) {

    const { file } = useSupaUser();

    // create instance of default layout plugin
    const defaultLayoutPluginInstance = defaultLayoutPlugin();

    // create instance of highlight plugin
    const highlightColor = (type) => {
        switch (type) {
            case 'text':
                // yellow
                return 'yellow';
            case 'table':
                // green
                return 'green';
            case 'key-value':
                // blue
                return 'blue';
            default:
                // red
                return 'red';
        };
    };

    const renderHighlights = (props) => {
        const { pageIndex, rotation, getCssProperties } = props;
        if (!selectedCitation || selectedCitation.page-1 !== pageIndex) return <></>;
        const citationBorders = {
            pageIndex: selectedCitation.page-1,
            left: Math.max(selectedCitation.left-0.01, 0)*100.0,
            top: Math.max(selectedCitation.top-0.01, 0)*100.0,
            height: Math.min(selectedCitation.bottom+0.02 - selectedCitation.top, 1)*100.0,
            width: Math.min(selectedCitation.right+0.02 - selectedCitation.left, 1)*100.0,
        };
        return (
            <div>
                <div
                    key={`highlight-${selectedCitation.id}`}
                    className="highlight__area rounded-2xl"
                    style={Object.assign(
                        {},
                        {
                            background: highlightColor(selectedCitation.type),
                            opacity: 0.4,
                        },
                        getCssProperties(citationBorders, rotation)
                    )}
                />
            </div>
        );
    };

    const highlightPluginInstance = highlightPlugin({ 
        renderHighlights,
        trigger: Trigger.None 
    });
    const { jumpToHighlightArea } = highlightPluginInstance;

    const PDFViewer = () => {
        if (file && selectedCitation) {
            return (
                <div className='h-full w-full overflow-auto rounded-md'>
                    <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.7.107/build/pdf.worker.js">
                        <Viewer
                            theme={{ theme: 'auto' }}
                            fileUrl={file}
                            defaultScale={SpecialZoomLevel.PageFit}
                            viewMode={ViewMode.SinglePage}
                            initialPage={selectedCitation ? selectedCitation.page-1 : 0}
                            plugins={[ highlightPluginInstance, defaultLayoutPluginInstance ]}
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

    useEffect(() => {
        if (selectedCitation) {
            const citationHighlightArea = {
                pageIndex: selectedCitation.page-1,
                left: Math.max(selectedCitation.left-0.01, 0)*100.0,
                top: Math.max(selectedCitation.top-0.01, 0)*100.0,
                height: Math.min(selectedCitation.bottom+0.02 - selectedCitation.top, 1)*100.0,
                width: Math.min(selectedCitation.right+0.02 - selectedCitation.left, 1)*100.0,
            }
            highlightPluginInstance.jumpToHighlightArea(citationHighlightArea);
        }
    }, [selectedCitation]);

    if (citationLoading) return (
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
            {PDFViewer()}
        </div>
    );
};