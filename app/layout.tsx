import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Fraunces } from 'next/font/google';
import { AuthProvider } from '@/components/auth/auth-provider';
import { Toaster } from '@/components/ui/sonner';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-sans',
});
const display = Fraunces({
  subsets: ['latin'],
  weight: ['600'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'Perhentian Bay Chalet | Portal Ejen B2B',
  description:
    'Portal tempahan B2B Perhentian Bay Chalet & Perhentian Gateway. Harga bersih tetap, hold bilik automatik, bot & van dalam satu tempahan.',
  openGraph: {
    images: [{ url: 'https://bolt.new/static/og_default.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: [{ url: 'https://bolt.new/static/og_default.png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ms">
      <body className={`${sans.variable} ${display.variable} font-sans`}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster richColors position="top-right" theme="light" />
      </body>
    </html>
  );
}
