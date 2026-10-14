"use client";

import { createContext, useContext } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

export type Viewer = NonNullable<FunctionReturnType<typeof api.users.viewer>>;
export type Cohort = FunctionReturnType<typeof api.cohorts.list>[number];
export type Workspace = { preview: boolean; viewer: Viewer | null; cohorts: Cohort[] };

export const WorkspaceContext = createContext<Workspace | null>(null);

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("Workspace context is missing.");
  return workspace;
}

export const previewCohort = {
  _id: "preview-cohort", name: "Cohort 01 · The first chapter", description: "Two weeks of building, connecting, and opening doors.",
  startDate: "2026-11-02", endDate: "2026-11-15", timezone: "America/Los_Angeles", status: "upcoming",
} as Cohort;
