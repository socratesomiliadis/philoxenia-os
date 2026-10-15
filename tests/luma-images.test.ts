import { describe, expect, it } from "vitest";
import { lumaImageUrl, parseLumaEventImage } from "../lib/luma-images";

const cover = "https://images.lumacdn.com/uploads/event-cover.png";

describe("Luma event artwork", () => {
  it("prefers original cover artwork and falls back to public social metadata", () => {
    const metadata = '<meta content="https://images.lumacdn.com/social.png?width=800&amp;height=420" property="og:image">';
    const data = { props: { pageProps: { initialData: { data: { event: { cover_url: cover } } } } } };
    expect(parseLumaEventImage(`${metadata}<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`)).toBe(cover);
    expect(parseLumaEventImage(metadata)).toBe("https://images.lumacdn.com/social.png?width=800&height=420");
    expect(parseLumaEventImage(`<script id="__NEXT_DATA__">invalid</script>${metadata}`)).toContain("/social.png");
    expect(parseLumaEventImage("<meta name='twitter:image' content='https://images.unsplash.com/photo-123'>")).toBe("https://images.unsplash.com/photo-123");
  });

  it("ignores missing artwork and URLs outside the permitted image hosts", () => {
    for (const value of ["http://images.lumacdn.com/cover.png", "https://images.lumacdn.com.evil.example/cover.png", "https://127.0.0.1/cover.png", "https://images.lumacdn.com:8443/cover.png", "https://user:pass@images.lumacdn.com/cover.png", "data:image/svg+xml,test"]) {
      expect(lumaImageUrl(value)).toBeUndefined();
      expect(parseLumaEventImage(`<meta property="og:image" content="${value}">`)).toBeUndefined();
    }
    expect(parseLumaEventImage("<html>No cover image</html>")).toBeUndefined();
  });
});
