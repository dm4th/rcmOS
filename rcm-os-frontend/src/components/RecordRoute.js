import { useRouter } from 'next/router';

export function RecordRoute({ claimId, documentId, documentType, onClose }) {

    const router = useRouter();

    const handleRouteClick = async () => {
        router.push(`/claims/${claimId}/documents/${documentId}`);
    };

    const handleOnClose = async () => {
        await changeClaimStatus();
        onClose();
    };

    return (
        <div className="flex flex-col justify-between m-2 ">
            <h3 className="text-lg font-bold mb-2">{documentType} Processing Complete</h3>
            <button className="mt-2 bg-green-700 hover:bg-green-500 dark:hover:bg-green-900 text-gray-900 dark:text-gray-100 font-bold py-2 px-4 rounded" onClick={handleRouteClick}>
                Go To {documentType} Chat Page
            </button>
            <button className="my-2 bg-blue-500 hover:bg-blue-200 dark:hover:bg-blue-800 text-gray-900 dark:text-gray-100 font-bold py-2 px-4 rounded" onClick={handleOnClose}>
                Back to Claims Page
            </button>
        </div>
    );
}
