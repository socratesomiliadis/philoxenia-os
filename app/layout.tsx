import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist } from "next/font/google";
import { Providers } from "@/components/providers";
import { createPageMetadata, siteName, siteTitle, siteUrl } from "@/lib/metadata";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  ...createPageMetadata({ path: "/" }),
  metadataBase: siteUrl,
  applicationName: siteName,
  creator: "Hustle Hours",
  publisher: "Hustle Hours",
  robots: { index: false, follow: false },
  title: { default: siteTitle, template: `%s | ${siteName}` },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full"><Suspense fallback={<div role="status" className="flex min-h-screen items-center justify-center bg-canvas text-sm text-muted">Opening Philoxenia…</div>}><Providers>{children}</Providers></Suspense></body>
    </html>
  );
}
