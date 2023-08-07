import { useRouter } from 'next/router';
import { useSupaUser } from '@/contexts/SupaAuthProvider';

export function ClaimRoute({ claimId, onClose }) {

    const { user, updateAvailableClaims, supabaseClient } = useSupaUser();
    const router = useRouter();

    const changeClaimStatus = async () => {
        const { data, error } = await supabaseClient
            .from('claims')
            .update({ status: 'ready' })
            .eq('id', claimId);
        if (error) {
            console.error(error);
        }
        else {
            await updateAvailableClaims();
        }
    };

    const handleClaimClick = async () => {
        await changeClaimStatus();
        router.push(`/claims/${claimId}`);
    };

    const handleOnClose = async () => {
        await changeClaimStatus();
        onClose();
    };

    return (
        <div className="flex flex-col justify-between m-2 ">
            <h3 className="text-lg font-bold mb-2">Denial Letter Processing Complete</h3>
            <button className="mt-2 bg-green-700 hover:bg-green-500 dark:hover:bg-green-900 text-gray-900 dark:text-gray-100 font-bold py-2 px-4 rounded" onClick={handleClaimClick}>
                Go To Claim Page
            </button>
            <button className="my-2 bg-blue-500 hover:bg-blue-200 dark:hover:bg-blue-800 text-gray-900 dark:text-gray-100 font-bold py-2 px-4 rounded" onClick={handleOnClose}>
                Back to Claims Dashboard
            </button>
        </div>
    );
}
