"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { toast, useSonner } from "sonner";
import { Toaster } from "./ui/sonner";

export function WorkspaceToaster({ paused }: { paused: boolean }) {
  const { toasts } = useSonner();
  const durations = useRef(new Map<string | number, number>());

  useEffect(() => {
    if (paused) {
      // Sonner has no pause-all API. Keep both existing and new notifications
      // alive behind overlays, then give them time to be read after dismissal.
      for (const notification of toasts) {
        if (durations.current.has(notification.id) || notification.duration === Infinity) continue;
        durations.current.set(notification.id, notification.duration ?? 4000);
        toast(notification.title, { ...notification, duration: Infinity });
      }
    } else {
      for (const notification of toasts) {
        const duration = durations.current.get(notification.id);
        if (duration !== undefined) toast(notification.title, { ...notification, duration });
      }
      durations.current.clear();
    }
  }, [paused, toasts]);

  return <div aria-hidden={paused || undefined} inert={paused || undefined}>
    <Toaster position="bottom-right" visibleToasts={3} duration={4000} offset={16} mobileOffset={16}
      style={{ "--width": "min(420px, calc(100vw - 32px))", fontFamily: "var(--font-geist-sans), sans-serif" } as CSSProperties}
      className={paused ? "hidden!" : ""}
      toastOptions={{ classNames: { toast: "rounded-2xl! border-line! bg-white!", content: "min-w-0", title: "text-sm! wrap-anywhere", description: "text-xs! text-muted-foreground! wrap-anywhere", actionButton: "bg-forest! text-white!" } }} />
  </div>;
}
