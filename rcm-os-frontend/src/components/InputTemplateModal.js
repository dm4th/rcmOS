// React imports
import React, { useState, useEffect } from 'react';

// Context Imports
import { useSupaUser } from '@/contexts/SupaAuthProvider';

export function InputTemplateModal({ onClose, onTemplateSelect }) {

    // Get Supabase User context
    const { user, supabaseClient } = useSupaUser();

    const [templates, setTemplates] = useState([]);
    const [templateLoading, setTemplateLoading] = useState(false);

    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [role, setRole] = useState("");
    const [goal, setGoal] = useState("");
    const [questions, setQuestions] = useState(Array(5).fill(""));

    const getTemplates = async () => {
        setTemplateLoading(true);
        const { data, error } = await supabaseClient
            .from('input_templates')
            .select('id, title')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (error) {
            console.error(error);
        } else {
            if (data.length === 0) {
                setTemplates([]);
            }
            else {
                setTemplates(data);
            }
        }
        setTemplateLoading(false);
    };

    const handleSelectTemplate = () => {
        onTemplateSelect(selectedTemplate);
        onClose();
    };

    const handleNoTemplate = () => {
        // TODO: Create a new template
        onClose();
    };

    const handleInputChange = (setter) => (e) => {
        setter(e.target.value);
    };

    useEffect(() => {
        getTemplates();
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black dark:bg-white opacity-50" onClick={handleNoTemplate}></div>
            <div className="p-5 rounded-lg shadow-lg relative w-96 bg-gray-100 dark:bg-gray-900">
                <button className="absolute top-2 right-2" onClick={handleNoTemplate}>X</button>
                {templates.length > 0 && 
                    <div className="mb-4">
                        <label className="block text-gray-900 dark:text-gray-100 text-sm font-bold mb-2" htmlFor="template">
                            Select a Template
                        </label>
                        <select className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 dark:text-gray-100 leading-tight focus:outline-none focus:shadow-outline" id="template" value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
                            {templates.map((template) => (
                                <option key={template.id} value={template.id}>{template.title}</option>
                            ))}
                        </select>
                        <button className="mt-2 bg-gray-700 dark:bg-gray-300 hover:bg-gray-800 dark:hover:bg-gray-200 text-gray-900 dark:text-gray-100 font-bold py-2 px-4 rounded" onClick={handleSelectTemplate}>
                            Select
                        </button>
                    </div>
                }
                <div>
                    <label className="block text-gray-900 dark:text-gray-100 text-sm font-bold mb-2" htmlFor="title">
                        Title
                    </label>
                    <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 dark:text-gray-100 leading-tight focus:outline-none focus:shadow-outline" id="title" type="text" value={title} onChange={handleInputChange(setTitle)} />
                </div>
                {/* ... repeat for other fields ... */}
            </div>
        </div>
    );
}