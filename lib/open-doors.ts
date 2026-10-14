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
export const profileSchema = z.object({ bio: z.string().trim().max(1000), building: z.string().trim().max(200), interests: z.string().trim().max(300), offering: z.string().trim().max(500) });
export type CommunityInput = z.infer<typeof profileSchema>;
export const requestStatuses = ["pending", "alternative", "agreed", "declined", "withdrawn", "completed"] as const;
export const requestLabels = { pending: "Awaiting reply", alternative: "Alternative proposed", agreed: "Support agreed", declined: "Declined", withdrawn: "Withdrawn", completed: "Support completed" };
export function reservesCapacity(status: string) { return status === "alternative" || status === "agreed"; }
