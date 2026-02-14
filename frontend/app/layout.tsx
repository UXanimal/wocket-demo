import type { Metadata, Viewport } from "next";
import { Nunito, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Wocket — NYC Building Safety Data",
  description: "Everything about your NYC building — violations, permits, C of O status, and more. DOB · HPD · ECB — all in one place.",
  openGraph: {
    title: "Wocket — NYC Building Safety Data",
    description: "Everything about your NYC building — violations, permits, C of O status, and more.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Wocket — NYC Building Safety Data" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wocket — NYC Building Safety Data",
    description: "Everything about your NYC building — violations, permits, C of O status, and more.",
    images: ["/og-image.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${inter.variable}`}>
      <body className="min-h-screen font-inter">{children}<Analytics /></body>
    </html>
  );
}
