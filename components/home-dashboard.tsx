"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, Compass, DoorOpen, MapPin, UsersRound } from "lucide-react";
import { MissionSummary } from "./mission-summary";
import { useWorkspace } from "./workspace-context";
import { SanFranciscoIllustration } from "./brand";
import { Badge, PageHeading, Panel, TextLink } from "./ui";
import { dateRangeLabel } from "@/lib/cohort-dates";

const features = [
  { href: "/opportunities", title: "Opportunities", detail: "Find events, founders, and startups that fit what you’re building.", icon: Compass },
  { href: "/sprint", title: "14-day Sprint", detail: "Make a plan for your stay, one meaningful step at a time.", icon: CalendarDays },
  { href: "/open-doors", title: "Open Doors", detail: "Request alumni advice, reviews, and introductions.", icon: DoorOpen },
];

export function HomeDashboard() {
  const { preview, viewer, cohorts } = useWorkspace();
  const cohort = cohorts.find((c) => c.status === "active") ?? cohorts.find((c) => c.status === "upcoming") ?? cohorts[0];
  const firstName = viewer?.name?.split(" ")[0];

  const organizerOnly = !preview && viewer?.isOrganizer && (!cohort || !viewer.participantCohortIds.includes(cohort._id));
  const homeHref = (path: string) => preview ? `/preview${path}` : path;
  return <div className="@container"><div className="space-y-6 @min-[640px]:space-y-8">
    <PageHeading title={firstName ? `Welcome in, ${firstName}.` : "Make this chapter yours."} description="A little direction for your people, your plans, and what comes next." />
    <section className="grid min-w-0 items-center gap-6 rounded-2xl bg-sage/60 p-6 @min-[640px]:p-8 @min-[760px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" aria-label="Your next step">
      <div className="min-w-0">
        <p className="mb-3 flex items-center gap-2 text-xs font-medium text-forest"><MapPin className="size-3.5" aria-hidden />Two weeks in San Francisco</p>
        <h2 className="max-w-xl text-[28px] leading-[1.15] font-medium tracking-[-0.045em] text-foreground @min-[640px]:text-[36px]">{organizerOnly ? "Bring your cohort together." : "Make room for what matters."}</h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted">{organizerOnly ? "Welcome your Hustlers, help them find a direction, and build a shared schedule." : "Good conversations. Useful feedback. A next step worth taking. Make a plan for your two weeks."}</p>
        <Link href={organizerOnly ? "/organizer" : homeHref("/sprint")} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-forest px-4 text-sm font-medium text-white shadow-control transition-[background-color,transform] duration-150 ease-ui hover:bg-forest/90 active:scale-[0.98]">{organizerOnly ? "Open Command Center" : "Open your Sprint"}<ArrowUpRight className="size-4" aria-hidden /></Link>
      </div>
      <div className="hidden min-w-0 items-center justify-center @min-[760px]:flex" aria-hidden><SanFranciscoIllustration className="h-auto max-h-52 w-full max-w-sm rounded-xl" /></div>
    </section>
    <div className="grid items-stretch gap-5 @min-[760px]:grid-cols-2">
      <Panel className="flex flex-col p-5 @min-[640px]:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2.5"><CalendarDays className="size-[18px] text-forest" aria-hidden /><h2 className="text-base font-medium text-foreground">Your two weeks</h2></div>{preview ? <Badge>Sample cohort</Badge> : cohort ? <Badge tone={cohort.status === "active" ? "green" : "neutral"}>{cohort.status === "active" ? "In progress" : cohort.status === "upcoming" ? "Upcoming" : "Completed"}</Badge> : <Badge>Not assigned</Badge>}</div>
        {cohort ? <div className="mt-5">
          <p className="text-xs leading-5 text-muted wrap-anywhere">{cohort.name}</p>
          <p className="mt-2 text-2xl leading-8 font-medium tracking-tight tabular-nums text-foreground">{dateRangeLabel(cohort.startDate, cohort.endDate)}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs leading-5 text-muted"><MapPin className="size-3.5 shrink-0" aria-hidden />San Francisco · Pacific Time</p>
          <Link href={organizerOnly ? "/organizer" : homeHref("/sprint")} className="mt-5 flex min-h-11 items-center gap-1 rounded-lg" aria-label={organizerOnly ? "View cohort details" : "Open your 14-day Sprint"}>{Array.from({ length: 14 }, (_, i) => <span key={i} className="h-1.5 min-w-0 flex-1 rounded-full bg-sage" aria-hidden />)}</Link>
        </div> : <div className="mt-5"><h3 className="text-xl font-medium tracking-tight text-foreground">Your stay is taking shape.</h3><p className="mt-2 text-sm leading-6 text-muted">{viewer?.isOrganizer ? "Create a cohort and choose an arrival date to get started." : "Your organizer will assign your cohort and confirm your stay dates."}</p></div>}
        <div className="mt-auto pt-3"><TextLink href={organizerOnly ? "/organizer" : homeHref("/sprint")}>{organizerOnly ? "View cohort details" : "Plan your two weeks"}</TextLink></div>
      </Panel>
      <MissionSummary cohort={cohort} />
    </div>
    <section aria-labelledby="explore-heading" className="space-y-4">
      <div><h2 id="explore-heading" className="text-lg font-medium tracking-tight text-foreground">Find your next step</h2><p className="mt-1 text-sm leading-6 text-muted">A few ways to make the most of your stay.</p></div>
      <div className="grid gap-4 @min-[760px]:grid-cols-3">{features.map(({ href, title, detail, icon: Icon }) => <Link key={href} href={homeHref(href)} className="group min-w-0 rounded-2xl border border-line bg-white p-5 transition-colors duration-150 hover:border-forest/25 hover:bg-soft/40"><div className="flex items-center gap-3"><span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-soft text-forest"><Icon className="size-[18px]" strokeWidth={1.7} aria-hidden /></span><h3 className="min-w-0 flex-1 text-base font-medium text-foreground">{title}</h3><ArrowUpRight className="size-4 shrink-0 text-muted group-hover:text-forest" aria-hidden /></div><p className="mt-3 text-sm leading-6 text-muted">{detail}</p></Link>)}</div>
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs leading-5 text-muted"><Link href={homeHref("/community")} className="inline-flex min-h-10 items-center gap-2 rounded-lg text-forest underline-offset-4 hover:underline"><UsersRound className="size-3.5" aria-hidden />Meet your community<ArrowUpRight className="size-3.5" aria-hidden /></Link><a href="https://philoxenia.hustlehours.com/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg underline-offset-4 hover:text-foreground hover:underline">The Philoxenia story<ArrowUpRight className="size-3.5" aria-hidden /></a></div>
  </div></div>;
}
