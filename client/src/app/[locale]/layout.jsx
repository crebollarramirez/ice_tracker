import {NextIntlClientProvider} from 'next-intl';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';
import {getMessages} from 'next-intl/server';
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "ICE Activity Tracker - Community Safety Alert System",
  description:
    "Anonymous community-driven tool to report and track ICE (Immigration and Customs Enforcement) activity. Help protect undocumented immigrants and their families by sharing real-time safety alerts.",
  keywords:
    "ICE tracker, immigration safety, community alerts, undocumented immigrants, ICE activity, safety tool, immigration enforcement, community protection",
  authors: [{ name: "Community Member" }],
  creator: "Community Member",
  publisher: "Community Member",
  robots: "index, follow",
  icons: {
    icon: [
      { url: '/app-icon.png', sizes: '32x32', type: 'image/png' },
      { url: '/app-icon.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/app-icon.png',
    apple: '/app-icon.png',
    other: {
      rel: 'apple-touch-icon-precomposed',
      url: '/app-icon.png',
    },
  },
  manifest: '/manifest.json',
  openGraph: {
    title: "ICE Activity Tracker - Community Safety Alert System",
    description:
      "Anonymous community tool to report and track ICE activity. Help protect undocumented immigrants with real-time safety alerts.",
    type: "website",
    locale: "en_US",
    siteName: "ICE Activity Tracker",
    images: ['/app-icon.png'],
  },
  twitter: {
    card: "summary_large_image",
    title: "ICE Activity Tracker - Community Safety Alert System",
    description:
      "Anonymous community tool to report and track ICE activity. Help protect undocumented immigrants with real-time safety alerts.",
    images: ['/app-icon.png'],
  },
};
 
export default async function LocaleLayout({children, params}) {
  // Ensure that the incoming `locale` is valid
  const {locale} = await params;
  if (!routing.locales.includes(locale)) {
    notFound();
  }
 
  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();
 
  return (
    <html lang={locale}>
      <head>
        <link rel="icon" href="/app-icon.png" type="image/png" />
        <link rel="shortcut icon" href="/app-icon.png" />
        <link rel="apple-touch-icon" href="/app-icon.png" />
        <meta name="theme-color" content="#dc2626" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ICE Tracker" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}