// components/Layout.js
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export function Layout({ children }) {
    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow">{children}</main>
            <Footer />
        </div>
    );
}
