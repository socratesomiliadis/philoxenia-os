"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { Target } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { MissionGoal } from "@/lib/mission";
import { useWorkspace, type Cohort } from "./workspace-context";
import { Badge, Panel, TextLink } from "./ui";
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
  return <Panel className="@container flex flex-col p-5 @min-[640px]:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2.5"><Target className="size-[18px] text-forest" aria-hidden /><h2 className="text-base font-medium text-foreground">{data?.confirmedGoals ? <Link href={href} className="rounded-sm underline decoration-forest/20 underline-offset-4 hover:decoration-forest">Your personal mission</Link> : organizer && unavailable ? "Cohort missions" : "Your personal mission"}</h2></div><Badge tone={data?.confirmedGoals ? "green" : "neutral"}>{data?.confirmedGoals ? "Confirmed" : organizer && unavailable ? "Organizer view" : data ? "In progress" : "Three goals"}</Badge></div>
    {loading ? <p role="status" className="mt-6 text-sm text-muted-foreground">Loading your mission…</p> : data?.confirmedGoals ? <div className="mt-5"><MissionGoals goals={data.confirmedGoals} layout="overview" /></div> : <>
      <h3 className="mt-5 text-2xl leading-8 font-medium tracking-tight text-foreground">{organizer && unavailable ? "Help each Hustler find a direction." : "Give your Sprint a direction."}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{unavailable ? organizer ? "Open a participant’s mission from the cohort roster to see their goals and what they’re working toward." : "Your organizer needs to confirm your cohort and stay dates before you can set a mission." : "Share what you’re building and what you hope to learn. Choose three goals to guide your two weeks."}</p>
      {!unavailable ? <div className="mt-auto pt-5"><TextLink href={href}>{data ? "Continue your mission" : "Set your personal mission"}</TextLink></div> : null}
    </>}
  </Panel>;
}
