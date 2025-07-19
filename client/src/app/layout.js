import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  authors: [{ name: "Community Safety Network" }],
  creator: "Community Safety Network",
  publisher: "Community Safety Network",
  robots: "index, follow",
  openGraph: {
    title: "ICE Activity Tracker - Community Safety Alert System",
    description:
      "Anonymous community tool to report and track ICE activity. Help protect undocumented immigrants with real-time safety alerts.",
    type: "website",
    locale: "en_US",
    siteName: "ICE Activity Tracker",
  },
  twitter: {
    card: "summary_large_image",
    title: "ICE Activity Tracker - Community Safety Alert System",
    description:
      "Anonymous community tool to report and track ICE activity. Help protect undocumented immigrants with real-time safety alerts.",
    creator: "@CommunitySafety",
  },
  category: "Community Safety",
};

// Move viewport and themeColor to separate exports
export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export const themeColor = "#dc2626";

export default function RootLayout({ children }) {
  return children;
}
