import { v } from "convex/values";

export const answersValidator = v.object({ building: v.string(), outcomes: v.string(), industries: v.array(v.string()), offering: v.string() });
export const goalValidator = v.object({ title: v.string(), target: v.number(), metric: v.string(), deadline: v.string(), firstActions: v.array(v.string()) });
export const sourceValidator = v.union(v.literal("ai"), v.literal("template"));
export const fallbackValidator = v.union(v.literal("unconfigured"), v.literal("unavailable"), v.literal("requested"));
