"use client";

import { useQuery } from "convex/react";
import { Target } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { MissionGoal } from "@/lib/mission";
import { useWorkspace, type Cohort } from "./workspace-context";
import { Badge, IconTile, Panel, TextLink } from "./ui";
import { MissionGoals } from "./mission-goals";

export function MissionSummary({ cohort }: { cohort?: Cohort }) {
  const { preview, viewer } = useWorkspace();
  if (preview) return <Summary href="/preview/onboarding" />;
  if (!cohort || !viewer?.profile) return <Summary unavailable organizer={viewer?.isOrganizer} />;
  return <ConnectedSummary cohort={cohort} />;
}

function ConnectedSummary({ cohort }: { cohort: Cohort }) {
  const { viewer } = useWorkspace();
  // Organizers can manage a cohort without participating in it.
  const ownMembership = viewer?.participantCohortIds.includes(cohort._id);
  const data = useQuery(api.onboarding.get, ownMembership ? { cohortId: cohort._id } : "skip");
  if (!ownMembership) return <Summary unavailable organizer={viewer?.isOrganizer} />;
  return <Summary data={data} loading={data === undefined} />;
}

function Summary({ data, href = "/onboarding", loading, unavailable, organizer }: { data?: { confirmedGoals?: MissionGoal[] } | null; href?: string; loading?: boolean; unavailable?: boolean; organizer?: boolean }) {
  return <Panel className="p-6 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><IconTile icon={Target} tone="warm" /><h2 className="text-base font-medium text-foreground">Your personal mission</h2></div><Badge tone={data?.confirmedGoals ? "green" : "neutral"}>{data?.confirmedGoals ? "Confirmed" : data ? "In progress" : "Three goals"}</Badge></div>
    {loading ? <p role="status" className="mt-6 text-sm text-muted">Loading your mission…</p> : data?.confirmedGoals ? <div className="mt-6"><MissionGoals goals={data.confirmedGoals} /><div className="mt-6"><TextLink href={href}>Review your mission</TextLink></div></div> : <>
      <h3 className="mt-6 text-2xl font-medium tracking-tight text-foreground">Big ambitions. Clear next steps.</h3>
      <p className="mt-3 max-w-md text-sm leading-7 text-muted">{unavailable ? organizer ? "Review a Hustler’s onboarding answers and confirmed mission from their cohort roster." : "Ask your organizer to assign a cohort and confirm your stay dates. Then you can set three goals for your two weeks." : "Share what you’re building and what you want from your stay. Turn that into three concrete goals, with first steps you can take."}</p>
      {!unavailable ? <div className="mt-6"><TextLink href={href}>{data ? "Continue your mission" : "Set your personal mission"}</TextLink></div> : organizer ? <div className="mt-6"><TextLink href="/organizer">Open the Command Center</TextLink></div> : null}
    </>}
  </Panel>;
}
