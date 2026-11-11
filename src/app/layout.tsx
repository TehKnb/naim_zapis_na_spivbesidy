import { GeistSans } from 'geist/font/sans';
import type { Metadata, Viewport } from 'next';
import { Navbar } from '@/components/navbar';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Групові співбесіди', template: '%s · Групові співбесіди' },
  description: 'Адмінпанель для керування груповими співбесідами',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={GeistSans.variable}>
      <body className="min-h-screen font-sans">
        <Providers>
          <Navbar />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8 lg:px-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
