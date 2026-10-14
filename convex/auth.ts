import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => betterAuth({
  baseURL: process.env.SITE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: process.env.SITE_URL ? [process.env.SITE_URL] : [],
  database: authComponent.adapter(ctx),
  socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    },
  } : {},
  plugins: [convex({ authConfig })],
});

// This exposes configuration readiness, never credentials or user information.
export const readiness = query({
  args: {},
  handler: () => ({
    google: Boolean(process.env.SITE_URL && process.env.BETTER_AUTH_SECRET &&
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  }),
});
