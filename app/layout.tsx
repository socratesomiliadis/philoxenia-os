import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Instrument_Serif } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const displayFont = Instrument_Serif({
  variable: "--font-philoxenia-display",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: { default: "Philoxenia OS — Your next chapter", template: "%s | Philoxenia OS" },
  description: "Your personal workspace for two weeks of building, connecting, and opening doors in San Francisco. By Hustle Hours.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="min-h-full"><Suspense fallback={<div role="status" className="flex min-h-screen items-center justify-center bg-canvas text-sm text-muted">Opening Philoxenia…</div>}><Providers>{children}</Providers></Suspense></body>
    </html>
  );
}
