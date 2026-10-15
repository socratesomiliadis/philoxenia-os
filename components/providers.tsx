"use client";

import { useCallback, useState, type ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { WorkspaceToaster } from "./workspace-toaster";
import { TooltipProvider } from "./ui/tooltip";
import { NotificationModalContext } from "./notification-context";
import { authClient } from "@/lib/auth-client";

export const backendConfigured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL && process.env.NEXT_PUBLIC_CONVEX_SITE_URL);

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => backendConfigured ? new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!) : null);
  const [modalCount, setModalCount] = useState(0);
  const registerModal = useCallback(() => {
    setModalCount((count) => count + 1);
    return () => setModalCount((count) => Math.max(0, count - 1));
  }, []);
  const modalOpen = modalCount > 0;
  const content = <NotificationModalContext value={registerModal}><TooltipProvider>{children}</TooltipProvider><WorkspaceToaster paused={modalOpen} /></NotificationModalContext>;
  if (!client) return content;
  return <ConvexBetterAuthProvider client={client} authClient={authClient}>{content}</ConvexBetterAuthProvider>;
}
