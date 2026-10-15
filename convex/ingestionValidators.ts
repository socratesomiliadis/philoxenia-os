import { v } from "convex/values";
import { opportunityFields } from "./opportunityValidators";
export const providerValidator = v.union(v.literal("luma"), v.literal("serpapi"));
export const sourceProviderValidator = v.union(providerValidator, v.literal("yc"));
export const importedRecordValidator = v.object({ sourceId: v.string(), canonicalUrl: v.string(), opportunity: v.object(opportunityFields), cancelled: v.optional(v.boolean()), approvalRequired: v.optional(v.boolean()) });
