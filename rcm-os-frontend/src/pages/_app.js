import '@/styles/globals.css'
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { Layout } from '@/components/Layout';

export default function App({ Component, pageProps }) {
    return (
        <ThemeProvider>
            <Layout>
                <Component {...pageProps} />
            </Layout>
        </ThemeProvider>
    );
}
