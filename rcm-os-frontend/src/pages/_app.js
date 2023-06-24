import '@/styles/globals.css'
import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { SupaContextProvider } from '@/contexts/SupaAuthProvider.js';
import { Layout } from '@/components/Layout';

export default function App({ Component, pageProps }) {
    const supabase = createClientComponentClient();

    return (
        <SessionContextProvider supabaseClient={supabase} initialSession={pageProps.initialSession}>
            <SupaContextProvider>
                <ThemeProvider>
                    <Layout>
                        <Component {...pageProps} />
                    </Layout>
                </ThemeProvider>
            </SupaContextProvider>
        </SessionContextProvider>
    );
}
