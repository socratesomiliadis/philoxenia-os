import { describe, expect, it } from "vitest";
import { profileSchema } from "../lib/open-doors";

const profile = { bio: "Builder and coffee enthusiast", building: "Tools", interests: "Design", offering: "Feedback" };

describe("community profile validation", () => {
  it("accepts existing profiles, optional fields, and trimmed social URLs", () => {
    expect(profileSchema.parse(profile)).toEqual(profile);
    expect(profileSchema.parse({ ...profile, headline: " Designer ", socialLinks: { github: " https://github.com/builder ", website: "" } })).toMatchObject({ headline: "Designer", socialLinks: { github: "https://github.com/builder", website: "" } });
    expect(profileSchema.safeParse({ ...profile, socialLinks: { x: "https://twitter.com/builder", linkedin: "https://www.linkedin.com/in/builder" } }).success).toBe(true);
  });

  it.each([
    ["website", "javascript:alert(1)"], ["website", "data:text/html,hello"],
    ["website", "//example.com"], ["website", "example.com"], ["website", "https://user:password@example.com"],
    ["github", "https://github.com.evil.example/builder"], ["linkedin", "https://example.com"],
    ["x", "https://notx.com/builder"], ["instagram", "https://instagram.com@evil.example"],
  ])("rejects unsafe or mislabeled %s links: %s", (key, value) => {
    const result = profileSchema.safeParse({ ...profile, socialLinks: { [key]: value } });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(["socialLinks", key]);
  });
});
