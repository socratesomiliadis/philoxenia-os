"use client";

import { createContext, useContext, useEffect } from "react";

export const NotificationModalContext = createContext<(() => () => void) | null>(null);

// Overlays keep focus and pointer access to their actions. Notifications resume
// when the last overlay closes, including when its route unmounts.
export function useModalNotifications(open = true) {
  const register = useContext(NotificationModalContext);
  useEffect(() => open ? register?.() : undefined, [open, register]);
}
