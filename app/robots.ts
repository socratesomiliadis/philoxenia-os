import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", disallow: "/" },
      {
        // Link previews need access to page metadata and the shared image.
        userAgent: ["facebookexternalhit", "Facebot", "Twitterbot", "LinkedInBot", "Slackbot", "Discordbot", "WhatsApp", "TelegramBot"],
        allow: "/",
        disallow: ["/api/", "/preview"],
      },
    ],
  };
}
