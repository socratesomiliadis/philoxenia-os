"use client";

import { useState, type ComponentProps } from "react";
import { TabsContent } from "./ui/tabs";

// Load a section on its first visit, then retain its filters and local state.
export function OrganizerPanel({ active, children, ...props }: ComponentProps<typeof TabsContent> & { active: boolean }) {
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  return <TabsContent {...props} keepMounted>{visited ? children : null}</TabsContent>;
}
