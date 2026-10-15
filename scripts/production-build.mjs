import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

// Run through `pnpm build:release` in Vercel's Production environment only.
// Both frontends intentionally use the existing cloud development backend.
// Publish backend changes with `pnpm exec convex dev --once` before releasing.
const require = createRequire(import.meta.url);
function fail(message) { console.error(message); process.exit(1); }
if (process.env.VERCEL_ENV !== "production") fail("Release builds require Vercel's Production environment. Use pnpm build for development/preview.");
const cloudUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
if (cloudUrl !== "https://fine-starfish-961.convex.cloud") fail("Set NEXT_PUBLIC_CONVEX_URL to the shared development deployment: https://fine-starfish-961.convex.cloud.");
if (process.env.SITE_URL !== "https://philoxenia-os.socrates.fyi") fail("Set SITE_URL to https://philoxenia-os.socrates.fyi in Vercel Production.");
const siteUrl = cloudUrl.replace(/\.cloud$/, ".site");
if (process.env.NEXT_PUBLIC_CONVEX_SITE_URL && process.env.NEXT_PUBLIC_CONVEX_SITE_URL !== siteUrl) fail("NEXT_PUBLIC_CONVEX_SITE_URL does not match the selected Convex deployment. Update the Production environment.");
const result = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build"], {
  stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_CONVEX_SITE_URL: siteUrl },
});
if (result.error) fail("Could not start the Next.js production build.");
process.exit(result.status ?? 1);
