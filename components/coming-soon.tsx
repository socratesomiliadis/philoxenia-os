"use client";

import { CalendarDays, Compass, DoorOpen, ArrowLeft, Check, Target } from "lucide-react";
import Link from "next/link";
import { Badge, IconTile, PageHeading, Panel } from "./ui";

const features = {
  opportunities: { title: "Opportunities", description: "Find events, founders, and startups that match your ambition.", icon: Compass, items: ["A feed shaped by your interests", "Events in SF and the wider Bay Area", "Save opportunities for your Sprint"] },
  sprint: { title: "Your 14-day Sprint", description: "A personal plan for your two weeks in San Francisco.", icon: CalendarDays, items: ["A day-by-day plan for your stay", "Mission goals and meaningful challenges", "Calendar exports and outcome tracking"] },
  doors: { title: "Open Doors", description: "Connect with alumni for advice, support, and introductions.", icon: DoorOpen, items: ["Mentorship and portfolio reviews", "Introductions alumni can facilitate", "Clear requests and thoughtful responses"] },
  mission: { title: "Your personal mission", description: "Three concrete goals built around what you want from San Francisco.", icon: Target, items: ["An introduction to what you’re building", "Goals tailored to your two-week stay", "A mission you can edit and make your own"] },
};

export function ComingSoon({ feature }: { feature: keyof typeof features }) {
  const { title, description, icon, items } = features[feature];
  return <><PageHeading title={title} description={description} /><Panel className="mx-auto mt-10 flex max-w-2xl flex-col items-center px-6 py-12 text-center sm:px-10"><IconTile icon={icon} tone="green" className="mb-6 size-14 rounded-2xl" /><h2 className="text-2xl font-medium tracking-tight text-foreground">{title} is on its way.</h2><div className="mt-3"><Badge>Coming soon</Badge></div><p className="mt-5 max-w-md text-sm leading-7 text-muted-foreground">Here’s what you’ll be able to do when it’s ready.</p><ul className="mt-6 space-y-3 text-start text-sm text-muted-foreground">{items.map((item) => <li key={item} className="flex items-start gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden />{item}</li>)}</ul><Link href="/" className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-xl bg-soft/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-soft"><ArrowLeft className="size-4" aria-hidden />Back to your workspace</Link></Panel></>;
}
