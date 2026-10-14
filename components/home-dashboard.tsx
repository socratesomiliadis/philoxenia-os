"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, Compass, DoorOpen, MapPin, UsersRound } from "lucide-react";
import { MissionSummary } from "./mission-summary";
import { useWorkspace } from "./workspace-context";
import { SanFranciscoIllustration } from "./brand";
import { Badge, IconTile, PageHeading, Panel, TextLink } from "./ui";
import { dateRangeLabel } from "@/lib/cohort-dates";

const features = [
  { href: "/opportunities", title: "Opportunities", detail: "Find events, founders, and startups that fit what you’re building.", icon: Compass },
  { href: "/sprint", title: "14-day Sprint", detail: "Make a plan for your stay, one meaningful step at a time.", icon: CalendarDays },
  { href: "/open-doors", title: "Open Doors", detail: "Get advice and introductions from people who’ve been there.", icon: DoorOpen },
];

export function HomeDashboard() {
  const { preview, viewer, cohorts } = useWorkspace();
  const cohort = cohorts.find((c) => c.status === "active") ?? cohorts.find((c) => c.status === "upcoming") ?? cohorts[0];
  const firstName = viewer?.name?.split(" ")[0];

  return <div className="space-y-6">
    <PageHeading title={firstName ? `Welcome in, ${firstName}.` : "Make this chapter yours."} description="Your people, your plans, and your next steps. All in one place." />

    <section className="grid min-w-0 gap-4 md:grid-cols-[1.2fr_1fr]">
      <div className="flex flex-col items-start justify-center rounded-[24px] border border-line bg-white p-7 sm:p-8 lg:p-9">
        <h2 className="max-w-lg text-[34px] leading-[1.15] font-medium tracking-[-0.045em] text-foreground sm:text-[44px]">A little direction.<br />A world of <span className="text-forest">possibility.</span></h2>
        <p className="mt-5 max-w-sm text-sm leading-7 text-muted">Two weeks in San Francisco. Find your people and make room for what comes next.</p>
        <Link href={preview ? "/preview/community" : "/community"} className="mt-7 inline-flex min-h-11 items-center gap-3 rounded-xl bg-forest px-4 py-3 text-sm font-medium text-accent-foreground shadow-control transition-[background-color,transform] duration-150 ease-ui hover:bg-forest/90 active:scale-[0.98]">Meet your community<ArrowUpRight className="size-4" aria-hidden /></Link>
      </div>
      <div className="flex min-w-0 items-center justify-center overflow-hidden rounded-[24px] bg-stone p-5 sm:p-7"><SanFranciscoIllustration className="h-auto max-h-64 w-full rounded-2xl" /></div>
    </section>

    <div className="grid items-stretch gap-4 xl:grid-cols-2">
      <Panel className="p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><IconTile icon={CalendarDays} tone="green" /><h2 className="text-base font-medium text-foreground">Your two weeks</h2></div>{preview ? <Badge>Sample cohort</Badge> : cohort ? <Badge tone={cohort.status === "active" ? "green" : "neutral"}>{cohort.status}</Badge> : <Badge>Not assigned</Badge>}</div>
        {cohort ? <div className="mt-6">
          <p className="text-sm text-muted">{cohort.name}</p>
          <p className="mt-2 text-2xl font-medium tracking-tight text-foreground">{dateRangeLabel(cohort.startDate, cohort.endDate)}</p>
          <p className="mt-3 flex items-center gap-1.5 text-xs leading-5 text-muted"><MapPin className="size-3.5 shrink-0" aria-hidden />San Francisco · Pacific Time</p>
          <div className="mt-6 grid grid-cols-14 gap-1" aria-label="Fourteen days in your Sprint">{Array.from({ length: 14 }, (_, i) => <div key={i} className="flex h-9 items-center justify-center rounded-md bg-soft text-[10px] tabular-nums text-muted">{i + 1}</div>)}</div>
        </div> : <div className="mt-6"><h3 className="text-xl font-medium tracking-tight text-foreground">Your stay is taking shape.</h3><p className="mt-3 text-sm leading-6 text-muted">{viewer?.isOrganizer ? "Create a cohort in the Command Center to bring your Hustlers together." : "Your organizer will assign your cohort and confirm your stay dates."}</p></div>}
        <div className="mt-6"><TextLink href={preview ? "/preview/organizer" : viewer?.isOrganizer ? "/organizer" : "/sprint"}>{viewer?.isOrganizer || preview ? "View cohort details" : "Explore your Sprint"}</TextLink></div>
      </Panel>

      <MissionSummary cohort={cohort} />
    </div>

    <section aria-labelledby="explore-heading">
      <h2 id="explore-heading" className="mb-4 text-lg font-medium tracking-tight text-foreground">Explore your workspace</h2>
      <div className="grid gap-4 md:grid-cols-3">{features.map(({ href, title, detail, icon }) => <Link key={href} href={preview ? `/preview${href}` : href} className="rounded-[24px] border border-line bg-white p-6 transition-colors duration-150 hover:border-forest/30"><div className="mb-5 flex items-center justify-between"><IconTile icon={icon} /><ArrowUpRight className="size-4 text-muted" aria-hidden /></div><h3 className="text-base font-medium text-foreground">{title}</h3><p className="mt-2 text-sm leading-6 text-muted">{detail}</p></Link>)}</div>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-4 px-1 py-2"><p className="flex items-center gap-2 text-sm text-muted"><UsersRound className="size-4 shrink-0" aria-hidden />A community in your corner.</p><a href="https://philoxenia.hustlehours.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-sm text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">The Philoxenia story<ArrowUpRight className="size-4" aria-hidden /></a></div>
  </div>;
}
