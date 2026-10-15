// Only accept public image hosts used by Luma; never pass arbitrary URLs to the image optimizer.
export function lumaImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2000) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && ["images.lumacdn.com", "images.unsplash.com"].includes(url.hostname) && !url.port && !url.username && !url.password) return url.toString();
  } catch { /* Missing or malformed artwork should not prevent importing an event. */ }
}

export function parseLumaEventImage(html: string): string | undefined {
  // Prefer the original cover artwork over the social preview, which can include event text.
  const data = html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (data) try {
    const page = JSON.parse(data[1]);
    const image = lumaImageUrl(page?.props?.pageProps?.initialData?.data?.event?.cover_url);
    if (image) return image;
  } catch { /* Public metadata remains a fallback if Luma changes its page data. */ }

  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = new Map([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map((match) => [match[1].toLowerCase(), match[3]]));
    if (attributes.get("property") !== "og:image" && attributes.get("name") !== "twitter:image") continue;
    const value = attributes.get("content")?.replace(/&(?:amp|quot|apos|#39|#x27);/gi, (entity) => entity.toLowerCase() === "&amp;" ? "&" : entity.toLowerCase() === "&quot;" ? '"' : "'");
    const image = lumaImageUrl(value);
    if (image) return image;
  }
}
