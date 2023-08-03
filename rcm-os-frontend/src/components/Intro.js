import { useSupaUser } from '../contexts/SupaAuthProvider';

export function Intro() {
    const { user, isLoading, handleLogin } = useSupaUser();

    const content = isLoading ? (
        <div>
            <p className="text-2xl text-gray-900 dark:text-white">Loading...</p>
        </div>
    ) :  (
        <div>
            <p className="mt-3 text-2xl text-gray-900 dark:text-white">
                Please Sign In to Begin
            </p>
            <button onClick={handleLogin} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
                Sign In
            </button>
        </div>
    );

    return (
        <div>
            <h1 className="text-6xl font-bold text-gray-900 dark:text-white">
                Welcome to rcmOS
            </h1>
            {content}
        </div>
    );
}
