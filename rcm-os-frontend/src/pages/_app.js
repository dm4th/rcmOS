import '@/styles/globals.css'
import { useState } from 'react';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { SupaContextProvider } from '@/contexts/SupaAuthProvider.js';
import { Layout } from '@/components/Layout';

export default function App({ Component, pageProps }) {
    const [supabaseClient] = useState(() => createPagesBrowserClient());

    return (
        <SessionContextProvider supabaseClient={supabaseClient} initialSession={pageProps.initialSession}>
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
