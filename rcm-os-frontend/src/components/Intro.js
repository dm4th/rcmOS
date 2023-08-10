import { useSupaUser } from '../contexts/SupaAuthProvider';

export function Intro({ handleFileChange, handleFileDrop, handleTestingButtonClick }) {
    const { user, isLoading, handleLogin } = useSupaUser();

    const content = isLoading ? (
        <div>
            <p className="text-2xl text-gray-900 dark:text-white">Loading...</p>
        </div>
    ) : user ? (
        <div>
            <p className="mt-3 text-2xl text-gray-900 dark:text-white">
                Upload a PDF to get started.
            </p>
            <div className="flex items-center justify-center mt-6">
                <label 
                    className="w-64 flex flex-col items-center px-4 py-6 bg-white text-blue rounded-lg shadow-lg tracking-wide uppercase border border-blue cursor-pointer hover:bg-blue hover:text-white dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 dark:border-gray-700 dark:shadow-none"
                    onDrop={handleFileDrop}
                    onDragOver={(e) => e.preventDefault()}
                >
                    <svg className="w-8 h-8" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M17 10h-4V0H7v10H3l7 7 7-7z" />
                    </svg>
                    <span className="mt-2 text-base leading-normal">Upload Document</span>
                    <input type='file' className="hidden" onChange={handleFileChange} />
                </label>
            </div>
            {/* <button onClick={handleTestingButtonClick} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
                Run LLM Processing with Pre-Processed Textract Record
            </button> */}
        </div>
    ) : (
        <div>
            <p className="mt-3 text-2xl text-gray-900 dark:text-white">
                Please Sign In to Upload
            </p>
            <button onClick={handleLogin} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
                Sign In
            </button>
        </div>
    );

    return (
        <div>
            <h1 className="text-6xl font-bold text-gray-900 dark:text-white">
                Welcome to DocWow
            </h1>

            {content}
        </div>
    );
}
