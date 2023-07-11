// React imports
import React, { useState, useEffect } from 'react';

// Component Imports
import { CSSTransition } from 'react-transition-group';

// Context Imports
import { useSupaUser } from '@/contexts/SupaAuthProvider';

export function InputTemplateModal({ onClose, onTemplateSelect }) {

    // Get Supabase User context
    const { user, supabaseClient } = useSupaUser();

    const [templates, setTemplates] = useState([]);
    const [templateLoading, setTemplateLoading] = useState(false);

    const [modalState, setModalState] = useState('select'); // 'select', 'create'
    const [transitioningState, setTransitioningState] = useState(false);

    const [selectedTemplate, setSelectedTemplate] = useState(null);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [role, setRole] = useState("");
    const [goal, setGoal] = useState("");

    const [descriptionExamples, setDescriptionExamples] = useState([]);
    const [roleExamples, setRoleExamples] = useState([]);
    const [goalExamples, setGoalExamples] = useState([]);

    const [titleError, setTitleError] = useState("");
    const [descriptionError, setDescriptionError] = useState("");
    const [roleError, setRoleError] = useState("");
    const [goalError, setGoalError] = useState("");

    const getTemplates = async () => {
        setTemplateLoading(true);
        const { data, error } = await supabaseClient
            .from('input_templates')
            .select('id, title, description, role, goal')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (error) {
            console.error(error);
        } else {
            if (data.length === 0) {
                setTemplates([]);
                setModalState('create');
            }
            else {
                setTemplates(data);
                setSelectedTemplate(data[0]);
                setModalState('select');
            }
        }
        setTemplateLoading(false);
    };

    const nextState = () => {
        if (modalState === 'select') {
            setSelectedTemplate(null);
            changeState('create');
        }
        else if (modalState === 'create') {
            handleCreateTemplate();
            onClose();
        }
    };

    const prevState = () => {
        if (modalState === 'create') {
            changeState('select');
            setSelectedTemplate(templates[0]);
        }
        else {
            console.error("prev state err");
        }
    };

    const changeState = (state) => {
        setTransitioningState(true);
        setTimeout(() => {
            setModalState(state);
            setTransitioningState(false);
        }, 300);
    };

    const handleSelectTemplate = () => {
        onTemplateSelect(selectedTemplate);
        onClose();
    };

    const handleCreateTemplate = async () => {
        const { data, error } = await supabaseClient
            .from('input_templates')
            .insert([{ 
                user_id: user.id, 
                title, 
                description, 
                role, 
                goal 
            }])
            .select();
        if (error) {
            console.error(error);
        } else {
            const newTemplate = data[0];
            onTemplateSelect({
                id: newTemplate.id,
                title: newTemplate.title,
                description: newTemplate.description,
                role: newTemplate.role,
                goal: newTemplate.goal
            });
            onClose();
        }
    };

    const handleInputChange = (setter) => (e) => {
        setter(e.target.value);
    };
    
    const handleDescriptionExamplesToggle = () => {
        if (descriptionExamples.length === 0) {
            setDescriptionExamples(["patient medical records.","accident insurance claim.","public company form 10-K."]);
        }
        else {
            setDescriptionExamples([]);
        }
    };

    const handleRoleExamplesToggle = () => {
        if (roleExamples.length === 0) {
            setRoleExamples(["Medical Documentation Specialist","Paralegal","Equity Analyst"]);
        }
        else {
            setRoleExamples([]);
        }
    };

    const handleGoalExamplesToggle = () => {
        if (goalExamples.length === 0) {
            setGoalExamples(["Understand the patient's medical history.","Extract relevant information for a claims lawsuit I'm working on.","Develop a buy / sell recommendation for a stock"]);
        }
        else {
            setGoalExamples([]);
        }
    };

    useEffect(() => {
        getTemplates();
    }, []);

    useEffect(() => {
        if (templates.some((template) => template.title === title)) {
            setTitleError("You already have a template with this title. Please Choose Another.");
        }
        else {
            setTitleError("");
        }
    }, [title]);

    useEffect(() => {
        if (description.split(" ").length > 25) {
            setDescriptionError("Please limit your description to 25 words for better performance.");
        }
        else {
            setDescriptionError("");
        }
    }, [description]);

    useEffect(() => {
        if (role.split(" ").length > 10) {
            setRoleError("Please limit your role to 10 words for better performance.");
        }
        else {
            setRoleError("");
        }
    }, [role]);

    useEffect(() => {
        if (goal.split(" ").length > 25) {
            setGoalError("Please limit your goal to 25 words for better performance.");
        }
        else {
            setGoalError("");
        }
    }, [goal]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black dark:bg-white opacity-50"></div>
            {!templateLoading && 
            <div className="p-5 rounded-lg shadow-lg relative w-96 h-7/8 overflow-auto bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                <CSSTransition
                    in={modalState === 'select' && !transitioningState}
                    timeout={300}
                    classNames="fade"
                    unmountOnExit={true}
                >
                    <div className="flex flex-col justify-between m-2 ">
                        <h3 className="text-lg font-bold mb-2">Select an Existing Template</h3>
                        <select className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline" id="template" value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
                            {templates.map((template) => (
                                <option key={template.id} value={template}>{template.title}</option>
                            ))}
                        </select>
                        <button className="mt-2 bg-blue-500 hover:bg-blue-200 dark:hover:bg-blue-800 text-gray-900 dark:text-gray-100 font-bold py-2 px-4 rounded" onClick={handleSelectTemplate}>
                            Select Template
                        </button>
                        <div className="flex justify-between mt-2 w-full">
                            <div className="border-b border-gray-400 dark:border-gray-600 w-1/3 self-center"></div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">or</p>
                            <div className="border-b border-gray-400 dark:border-gray-600 w-1/3 self-center"></div>
                        </div>
                        <button className="mt-2 bg-blue-500 hover:bg-blue-200 dark:hover:bg-blue-800 text-gray-900 dark:text-gray-100 font-bold py-2 px-4 rounded" onClick={() => nextState()}>Create Template</button>
                    </div>
                </CSSTransition>
                <CSSTransition
                    in={modalState === 'create' && !transitioningState}
                    timeout={300}
                    classNames="fade"
                    unmountOnExit={true}
                >
                    <div className='h-full'>
                        <div className="flex justify-between">
                            <h3 className="text-lg font-bold w-2/3">Create a New Template</h3>
                            {templates.length > 0 && 
                            <button className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-1 px-3 rounded inline-flex items-center" onClick={() => prevState()}>
                                Back
                            </button>
                            }
                        </div>
                        <div className='flex flex-col justify-between m-1 py-2'>
                            <label className="block text-gray-900 dark:text-gray-100 text-sm font-bold mb-2" htmlFor="title">
                                Template Title
                            </label>
                            <input className="shadow appearance-none border rounded w-full py-2 px-3 mb-1 text-gray-900 leading-tight focus:ring-2 focus:shadow-outline" id="title" type="text" value={title} onChange={handleInputChange(setTitle)} />
                            <p className="text-gray-600 dark:text-gray-400 text-xs italic">A unique title for your template</p>
                            {titleError.length > 0 && <p className="text-red-500 text-xs italic">{titleError}</p>}
                        </div>
                        <div className='flex flex-col justify-between m-1 py-2'>
                            <label className="block text-gray-900 dark:text-gray-100 text-sm font-bold mb-2" htmlFor="description">
                                Document Description
                            </label>
                            <input className="shadow appearance-none border rounded w-full py-2 px-3 mb-1 text-gray-900 leading-tight focus:ring-2 focus:shadow-outline" id="description" type="text" value={description} onChange={handleInputChange(setDescription)} />
                            <p className="text-gray-600 dark:text-gray-400 text-xs italic">Describe the Target Document</p>
                            <p className="text-gray-600 dark:text-gray-400 text-xs italic underline hover:cursor-pointer" onClick={handleDescriptionExamplesToggle}>Examples</p>
                            {descriptionExamples.length > 0 && <ul className="ml-4 list-disc list-inside text-gray-600 dark:text-gray-400 text-xs italic">
                                {descriptionExamples.map((example) => (
                                    <li key={example}>{example}</li>
                                ))}
                            </ul>}
                            {descriptionError.length > 0 && <p className="text-red-500 text-xs italic">{descriptionError}</p>}
                        </div>
                        <div className='flex flex-col justify-between m-1 py-2'>
                            <label className="block text-gray-900 dark:text-gray-100 text-sm font-bold mb-2" htmlFor="role">
                                Analysis Role
                            </label>
                            <input className="shadow appearance-none border rounded w-full py-2 px-3 mb-1 text-gray-900 leading-tight focus:ring-2 focus:shadow-outline" id="role" type="text" value={role} onChange={handleInputChange(setRole)} />
                            <p className="text-gray-600 dark:text-gray-400 text-xs italic">Create a Role for your Template</p>
                            <p className="text-gray-600 dark:text-gray-400 text-xs italic underline hover:cursor-pointer" onClick={handleRoleExamplesToggle}>Examples</p>
                            {roleExamples.length > 0 && <ul className="ml-4 list-disc list-inside text-gray-600 dark:text-gray-400 text-xs italic">
                                {roleExamples.map((example) => (
                                    <li key={example}>{example}</li>
                                ))}
                            </ul>}
                            {roleError.length > 0 && <p className="text-red-500 text-xs italic">{roleError}</p>}
                        </div>
                        <div className='flex flex-col justify-between m-1 py-2'>
                            <label className="block text-gray-900 dark:text-gray-100 text-sm font-bold mb-2" htmlFor="goal">
                                Analysis Goal
                            </label>
                            <input className="shadow appearance-none border rounded w-full py-2 px-3 mb-1 text-gray-900 leading-tight focus:ring-2 focus:shadow-outline" id="goal" type="text" value={goal} onChange={handleInputChange(setGoal)} />
                            <p className="text-gray-600 dark:text-gray-400 text-xs italic">Set a Goal for Your Template</p>
                            <p className="text-gray-600 dark:text-gray-400 text-xs italic underline hover:cursor-pointer" onClick={handleGoalExamplesToggle}>Examples</p>
                            {goalExamples.length > 0 && <ul className="ml-4 list-disc list-inside text-gray-600 dark:text-gray-400 text-xs italic">
                                {goalExamples.map((example) => (
                                    <li key={example}>{example}</li>
                                ))}
                            </ul>}
                            {goalError.length > 0 && <p className="text-red-500 text-xs italic">{goalError}</p>}
                        </div>
                        <div className="flex flex-col items-center justify-center">
                            <button className="my-2 bg-blue-500 hover:bg-blue-200 dark:hover:bg-blue-800 text-gray-900 dark:text-gray-100 font-bold py-2 px-4 rounded" onClick={handleCreateTemplate}>
                                Create Template
                            </button>
                            <p className="text-red-500 text-xs italic">You Cannot Go Back After Creation</p>
                        </div>
                    </div>
                </CSSTransition>
            </div>
            }
        </div>
    );
}