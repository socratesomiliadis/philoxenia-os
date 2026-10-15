"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { MissionGoals } from "./mission-goals";
import { Badge } from "./ui";

export function OrganizerMission({ cohortId, profileId }: { cohortId: Id<"cohorts">; profileId: Id<"profiles"> }) {
  const data = useQuery(api.onboarding.get, { cohortId, profileId });
  if (data === undefined) return <p role="status" className="text-sm text-muted-foreground">Loading mission…</p>;
  if (!data) return <p className="text-sm leading-7 text-muted-foreground">This Hustler hasn’t started onboarding yet.</p>;
  return <div className="space-y-6"><Badge tone={data.confirmedGoals ? "green" : "neutral"}>{data.confirmedGoals ? "Confirmed mission" : `Onboarding · Step ${Math.min(data.step + 1, 4)} of 4`}</Badge>{data.confirmedGoals ? <MissionGoals goals={data.confirmedGoals} /> : <p className="text-sm text-muted-foreground">No confirmed mission yet.</p>}<dl className="space-y-5">{[["Building", data.answers.building], ["SF ambitions", data.answers.outcomes], ["Interests", data.answers.industries.join(", ")], ["Can offer", data.answers.offering]].map(([label, value]) => <div key={label}><dt className="text-sm font-medium">{label}</dt><dd className="mt-1 text-sm leading-7 whitespace-pre-wrap wrap-anywhere text-muted-foreground">{value || "Not answered yet"}</dd></div>)}</dl></div>;
}
