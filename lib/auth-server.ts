import "server-only";
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

export function getServerAuth() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!convexUrl || !convexSiteUrl) return null;
  return convexBetterAuthNextJs({ convexUrl, convexSiteUrl });
}
