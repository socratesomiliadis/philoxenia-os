import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";

export const authComponent = createClient<DataModel>(components.betterAuth);

async function sendAuthEmail(email: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new Error("Authentication email is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Authentication email could not be sent.");
}

export const createAuth = (ctx: GenericCtx<DataModel>) => betterAuth({
  // The Next.js auth proxy forwards the original host/protocol. Resolve callbacks
  // per request so localhost and the hosted app can share this deployment.
  baseURL: process.env.SITE_URL ? {
    allowedHosts: [process.env.SITE_URL, ...(process.env.AUTH_TRUSTED_ORIGINS ?? "").split(",")]
      .map((origin) => origin.trim()).filter(Boolean),
    fallback: process.env.SITE_URL,
  } : undefined,
  secret: process.env.BETTER_AUTH_SECRET,
  advanced: { trustedProxyHeaders: true, disableOriginCheck: false },
  database: authComponent.adapter(ctx),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail(user.email, "Reset your Philoxenia password",
        `Set a new password for your Philoxenia account:\n\n${url}\n\nThis link expires in one hour. If you did not request this, you can ignore this email.`);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail(user.email, "Verify your Philoxenia email",
        `Verify your email address to continue to Philoxenia:\n\n${url}\n\nIf you did not create an account, you can ignore this email.`);
    },
  },
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
    emailAndPassword: Boolean(process.env.SITE_URL && process.env.BETTER_AUTH_SECRET &&
      process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    google: Boolean(process.env.SITE_URL && process.env.BETTER_AUTH_SECRET &&
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  }),
});
