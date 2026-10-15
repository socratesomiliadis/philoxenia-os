import { z } from "zod";

export const supportKinds = ["mentorship", "portfolio", "introduction", "other"] as const;
export const supportLabels = { mentorship: "Mentorship", portfolio: "Portfolio review", introduction: "Introduction", other: "Other support" };
export const offerSchema = z.object({
  kind: z.enum(supportKinds), title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(20, "Describe the support in at least 20 characters.").max(2000),
  availability: z.string().trim().min(3).max(500), capacity: z.number().int().min(1).max(50),
  connection: z.string().trim().max(1000), published: z.boolean(),
}).superRefine((offer, ctx) => {
  if (offer.kind === "introduction" && offer.connection.length < 20) ctx.addIssue({ code: "custom", message: "Describe your actual connection and the introduction you can facilitate.", path: ["connection"] });
});
export type OfferInput = z.infer<typeof offerSchema>;
export const requestSchema = z.object({ goal: z.string().trim().min(10, "Explain your goal in at least 10 characters.").max(1000), fit: z.string().trim().min(10, "Explain why this offer fits in at least 10 characters.").max(1000) });
export const socialPlatforms = [
  { key: "website", label: "Website", placeholder: "https://yourname.com" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/yourname" },
  { key: "github", label: "GitHub", placeholder: "https://github.com/yourname" },
  { key: "x", label: "X", placeholder: "https://x.com/yourname" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourname" },
] as const;

function socialUrl(label: string, hosts: readonly string[] = []) {
  return z.string().trim().max(2048, `${label} links can be up to 2,048 characters.`).refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password &&
        (!hosts.length || hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)));
    } catch { return false; }
  }, `Enter a full ${label === "Website" ? "website" : label} URL starting with https://.`).optional();
}

export const socialLinksSchema = z.object({
  website: socialUrl("Website"), linkedin: socialUrl("LinkedIn", ["linkedin.com"]),
  github: socialUrl("GitHub", ["github.com"]), x: socialUrl("X", ["x.com", "twitter.com"]),
  instagram: socialUrl("Instagram", ["instagram.com"]),
});
export const profileSchema = z.object({
  bio: z.string().trim().max(1000, "Keep your bio to 1,000 characters."),
  headline: z.string().trim().max(100, "Keep your headline to 100 characters.").optional(),
  location: z.string().trim().max(100, "Keep your location to 100 characters.").optional(),
  building: z.string().trim().max(200), interests: z.string().trim().max(300), offering: z.string().trim().max(500),
  socialLinks: socialLinksSchema.optional(),
});
export type CommunityInput = z.infer<typeof profileSchema>;
export const requestStatuses = ["pending", "alternative", "agreed", "declined", "withdrawn", "completed"] as const;
export const requestLabels = { pending: "Awaiting reply", alternative: "Alternative proposed", agreed: "Support agreed", declined: "Declined", withdrawn: "Withdrawn", completed: "Support completed" };
export function reservesCapacity(status: string) { return status === "alternative" || status === "agreed"; }
