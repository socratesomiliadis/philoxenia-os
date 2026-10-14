"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { Toast, toast } from "@heroui/react";
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
  useEffect(() => {
    if (modalOpen) toast.pauseAll();
    else toast.resumeAll();
    return () => toast.resumeAll();
  }, [modalOpen]);
  const content = <NotificationModalContext value={registerModal}>{children}<Toast.Provider placement="bottom end" width="min(420px, calc(100vw - 32px))" maxVisibleToasts={3} aria-hidden={modalOpen || undefined} className={`${modalOpen ? "hidden!" : ""} [&_.toast]:rounded-2xl [&_.toast]:border-line [&_.toast]:bg-white [&_.toast__content]:min-w-0 [&_.toast__title]:text-sm [&_.toast__title]:wrap-anywhere [&_.toast__description]:text-xs [&_.toast__description]:wrap-anywhere`} /></NotificationModalContext>;
  if (!client) return content;
  return <ConvexBetterAuthProvider client={client} authClient={authClient}>{content}</ConvexBetterAuthProvider>;
}
