"use client";

import Link from "next/link";
import { useWorkspace } from "./workspace-context";
import { PageHeading } from "./ui";
import { HomeOverview } from "./home-widgets";
import { ArrowUpRight } from "lucide-react";

export function HomeDashboard() {
  const { preview, viewer, cohorts } = useWorkspace();
  const cohort = cohorts.find((c) => c.status === "active") ?? cohorts.find((c) => c.status === "upcoming") ?? cohorts.at(-1);
  const firstName = viewer?.name?.split(" ")[0];

  const organizerOnly = !preview && viewer?.isOrganizer && (!cohort || !viewer.participantCohortIds.includes(cohort._id));
  return <div className="@container"><div className="space-y-6 @min-[640px]:space-y-8">
    <PageHeading title={firstName ? `Welcome in, ${firstName}.` : "Make this chapter yours."} action={<Link href={organizerOnly ? "/organizer" : preview ? "/preview/sprint" : "/sprint"} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-medium text-white shadow-control transition-[background-color,transform] duration-150 ease-ui hover:bg-forest/90 active:scale-[0.98] motion-reduce:transform-none">{organizerOnly ? "Open Command Center" : "Open your Sprint"}<ArrowUpRight className="size-4" aria-hidden /></Link>} />
    <HomeOverview cohort={cohort} organizerOnly={Boolean(organizerOnly)} />
  </div></div>;
}
