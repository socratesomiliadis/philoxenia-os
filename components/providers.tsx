"use client";

import { useState, type ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "@/lib/auth-client";

export const backendConfigured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL && process.env.NEXT_PUBLIC_CONVEX_SITE_URL);

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => backendConfigured ? new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!) : null);
  if (!client) return children;
  return <ConvexBetterAuthProvider client={client} authClient={authClient}>{children}</ConvexBetterAuthProvider>;
}
