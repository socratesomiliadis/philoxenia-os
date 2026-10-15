"use client";

import Link from "next/link";
import { MissionSummary } from "./mission-summary";
import { useWorkspace } from "./workspace-context";
import { Badge, PageHeading, Panel } from "./ui";
import { dateRangeLabel } from "@/lib/cohort-dates";

export function HomeDashboard() {
  const { preview, viewer, cohorts } = useWorkspace();
  const cohort = cohorts.find((c) => c.status === "active") ?? cohorts.find((c) => c.status === "upcoming") ?? cohorts[0];
  const firstName = viewer?.name?.split(" ")[0];

  const organizerOnly = !preview && viewer?.isOrganizer && (!cohort || !viewer.participantCohortIds.includes(cohort._id));
  return <div className="@container"><div className="space-y-6 @min-[640px]:space-y-8">
    <PageHeading title={firstName ? `Welcome in, ${firstName}.` : "Make this chapter yours."} action={<Link href={organizerOnly ? "/organizer" : preview ? "/preview/sprint" : "/sprint"} className="inline-flex min-h-11 max-w-full items-center rounded-xl bg-forest px-4 py-3 text-sm font-medium text-white shadow-control transition-[background-color,transform] duration-150 ease-ui hover:bg-forest/90 active:scale-[0.98] motion-reduce:transform-none">{organizerOnly ? "Open Command Center" : "Open your Sprint"}</Link>} />
    <Panel className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 p-5 @min-[640px]:p-6">
      <div className="min-w-0">
        <h2 className="text-sm text-muted">Your stay</h2>
        {cohort ? <p className="mt-2 text-2xl leading-8 font-medium tracking-tight tabular-nums text-foreground">{dateRangeLabel(cohort.startDate, cohort.endDate)}</p> : <p className="mt-2 max-w-md text-sm leading-6 text-muted">{viewer?.isOrganizer ? "Create a cohort to set the stay dates." : "Your organizer will confirm your cohort and stay dates."}</p>}
      </div>
      <div className="min-w-0 space-y-2 @min-[640px]:text-end">
        {preview ? <Badge>Sample cohort</Badge> : cohort ? <Badge tone={cohort.status === "active" ? "green" : "neutral"}>{cohort.status === "active" ? "In progress" : cohort.status === "upcoming" ? "Upcoming" : "Completed"}</Badge> : <Badge>Not assigned</Badge>}
        {cohort ? <p className="text-xs leading-5 text-muted wrap-anywhere">{cohort.name} · San Francisco</p> : null}
      </div>
    </Panel>
    <MissionSummary cohort={cohort} />
  </div></div>;
}
