import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

// Run through `pnpm build:release` in Vercel's Production environment only.
// Convex injects the URL selected by the deployment key before this script runs.
const require = createRequire(import.meta.url);
function fail(message) { console.error(message); process.exit(1); }
if (process.env.VERCEL_ENV !== "production") fail("Release builds require Vercel's Production environment. Use pnpm build for development/preview.");
if (!process.env.CONVEX_DEPLOY_KEY?.startsWith("prod:")) fail("Set a Convex production deploy key in Vercel's Production environment.");
const cloudUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
if (!/^https:\/\/[a-z0-9-]+\.convex\.cloud$/.test(cloudUrl)) fail("Convex must supply a cloud deployment URL before building the production frontend.");
const siteUrl = cloudUrl.replace(/\.cloud$/, ".site");
if (process.env.NEXT_PUBLIC_CONVEX_SITE_URL && process.env.NEXT_PUBLIC_CONVEX_SITE_URL !== siteUrl) fail("NEXT_PUBLIC_CONVEX_SITE_URL does not match the selected Convex deployment. Update the Production environment.");
const result = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build"], {
  stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_CONVEX_SITE_URL: siteUrl },
});
if (result.error) fail("Could not start the Next.js production build.");
process.exit(result.status ?? 1);
