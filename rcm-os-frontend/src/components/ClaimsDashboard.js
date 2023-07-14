import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useSupaUser } from '@/contexts/SupaAuthProvider';

export function ClaimsDashboard({ onNewClaim }) {
    const { 
        user, 
        isLoading, 
        availableClaims,
        updateAvailableClaims,
        writeClaimTitle
    } = useSupaUser();

    const [editingClaimId, setEditingClaimId] = useState(null);
    const [newName, setNewName] = useState(null);
    const router = useRouter();

    const handleClaimNameChange = async (claimId, name) => {
        await writeClaimTitle(claimId, name);
        setEditingClaimId(null);
        setNewName(null);
    };

    const handleClaimClick = (claimId) => {
        router.push(`/claims/${claimId}`);
    };

    return (
        <div className='items-start'>
            <div className="flex justify-between items-center mb-4 p-2 rounded ">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    Claims Dashboard
                </h1>
                <button onClick={onNewClaim} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    <span className="mr-2">Create New</span>
                    <span>+</span>
                </button>
            </div>
            <div className="overflow-x-auto rounded">
                <table className="w-full text-md text-gray-900 dark:text-gray-100 bg-gray-200 dark:bg-gray-800 shadow-md rounded mb-4">
                    <thead className='bg-gray-400 dark:bg-gray-600 border-b rounded'>
                        <tr className='rounded'>
                            <th className="text-left p-3 px-5">Claim Title</th>
                            <th className="text-left p-3 px-5">Claim Status</th>
                            <th className="text-left p-3 px-5">Medical Records</th>
                            <th className="text-left p-3 px-5">Denial Letters</th>
                            <th className="text-left p-3 px-5">Updated At</th>
                            <th className="text-left p-3 px-5">Created At</th>
                        </tr>
                    </thead>
                    <tbody>
                        {availableClaims.map((claim) => (
                            <tr className="border-b hover:bg-orange-100 bg-gray-100" key={claim.id}>
                                <td className="p-3 px-5 cursor-pointer" onClick={() => handleClaimClick(claim.id)}>{claim.title}</td>
                                <td className="p-3 px-5">{claim.status}</td>
                                <td className="p-3 px-5">{claim.medical_records.length}</td>
                                <td className="p-3 px-5">{claim.denial_letters.length}</td>
                                <td className="p-3 px-5">{claim.updated_at}</td>
                                <td className="p-3 px-5">{claim.created_at}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
