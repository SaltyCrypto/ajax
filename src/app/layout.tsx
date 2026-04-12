import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-display',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Ajax — YouTube Astrology',
  description: 'Discover your taste DNA across YouTube and Spotify. Your algorithms reveal who you really are.',
  openGraph: {
    title: 'Ajax — YouTube Astrology',
    description: 'Your algorithms reveal who you really are.',
    siteName: 'Ajax',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ajax — YouTube Astrology',
    description: 'Your algorithms reveal who you really are.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-body min-h-screen">
        {children}
      </body>
    </html>
  );
}
