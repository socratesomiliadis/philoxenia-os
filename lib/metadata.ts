import type { Metadata } from "next";

export const siteName = "Philoxenia OS";
export const siteTitle = `${siteName} — Your next chapter`;
export const siteDescription = "Your personal workspace for two weeks of building, connecting, and opening doors in San Francisco. By Hustle Hours.";
export const siteUrl = new URL(process.env.SITE_URL || "https://philoxenia-os.socrates.fyi");

const shareImage = {
  url: "/images/philoxenia-os-og.png",
  width: 978,
  height: 550,
  alt: "Philoxenia OS wordmark over the Golden Gate Bridge rising through San Francisco fog.",
};

export function createPageMetadata({
  title,
  description = siteDescription,
  path,
}: {
  title?: string;
  description?: string;
  path: string;
}): Metadata {
  const shareTitle = title ? `${title} | ${siteName}` : siteTitle;

  // Supply complete social objects: Next.js replaces nested metadata per route.
  return {
    title: title ?? siteTitle,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName,
      title: shareTitle,
      description,
      url: path,
      images: [{ ...shareImage, type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: [shareImage],
    },
  };
}
