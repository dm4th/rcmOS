import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

import { useSupaUser } from '@/contexts/SupaAuthProvider';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

export function Layout({ children }) {
    const { showLoginModal, handleCloseModal, supabaseClient } = useSupaUser();

    return (
        <div>
            <div className="flex flex-col min-h-screen">
                <Header />
                    <main className="flex-grow h-screen">{children}</main>
                <Footer />
            </div>
            {showLoginModal && (
                <div className="fixed inset-0 z-10 overflow-y-auto backdrop-blur-md flex items-center justify-center">
                    <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl p-4 transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                        <button onClick={handleCloseModal} className="absolute top-2 right-2 text-sm px-2 py-1 hover:bg-gray-200 rounded">
                            X
                        </button>
                        <Auth
                            supabaseClient={supabaseClient}
                            appearance={{ theme: ThemeSupa }}
                            providers={[]}
                            theme="light"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
