"use client";

import { useSyncExternalStore } from "react";

const sections = ["cohorts", "participants", "opportunities", "imports", "open-doors", "settings"] as const;
export type OrganizerSection = typeof sections[number];

function readSection(): OrganizerSection {
  const value = window.location.hash.slice(1);
  return sections.find((section) => section === value) ?? "cohorts";
}

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback);
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener("popstate", callback);
  };
}

export function useOrganizerSection() {
  return useSyncExternalStore(subscribe, readSection, () => "cohorts" as const);
}

export function navigateOrganizer(section: OrganizerSection) {
  if (readSection() === section) return;
  window.history.pushState(null, "", `#${section}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
