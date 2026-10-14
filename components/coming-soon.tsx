"use client";

import { CalendarDays, Compass, DoorOpen, ArrowLeft, Target } from "lucide-react";
import Link from "next/link";
import { Badge, PageHeading, Panel } from "./ui";

const features = {
  opportunities: { eyebrow: "The right room changes everything", title: "Opportunity Dashboard", description: "Find the events, founders, and startups that match your ambition.", icon: Compass, items: ["A feed shaped by your interests", "Events in SF and the wider Bay Area", "Save opportunities for your Sprint"] },
  sprint: { eyebrow: "Fourteen days. Make them count.", title: "Your 14-day Sprint", description: "A personal plan for building, meeting, learning, and moving forward.", icon: CalendarDays, items: ["A day-by-day plan for your stay", "Mission goals and meaningful challenges", "Calendar exports and outcome tracking"] },
  doors: { eyebrow: "Someone has been where you are", title: "Open Doors", description: "Connect with alumni who can offer their time, experience, and real introductions.", icon: DoorOpen, items: ["Mentorship and portfolio reviews", "Introductions alumni can actually facilitate", "Clear requests and thoughtful responses"] },
  mission: { eyebrow: "Ambition, with a little direction", title: "Your personal mission", description: "Three concrete goals built around what you want from San Francisco.", icon: Target, items: ["A quick introduction to what you’re building", "Goals tailored to your two-week stay", "A mission you can edit and make your own"] },
};

export function ComingSoon({ feature }: { feature: keyof typeof features }) {
  const { eyebrow, title, description, icon: Icon, items } = features[feature];
  return <><PageHeading eyebrow={eyebrow} title={title} description={description} /><Panel className="mx-auto mt-12 flex max-w-2xl flex-col items-center px-7 py-14 text-center"><span className="mb-7 flex size-16 items-center justify-center rounded-2xl bg-gold/10"><Icon className="size-7 text-[#8a733c]" strokeWidth={1.5} aria-hidden /></span><Badge tone="gold">Coming soon</Badge><h2 className="mt-5 font-display text-4xl text-forest">Good things are taking shape.</h2><p className="mt-4 max-w-md text-sm leading-7 text-muted">This part of your workspace is on its way. Here’s what you’ll be able to do.</p><ul className="mt-7 space-y-3 text-sm text-forest">{items.map((item) => <li key={item}>{item}</li>)}</ul><Link href="/" className="mt-10 flex items-center gap-2 text-xs font-medium text-forest"><ArrowLeft className="size-4" aria-hidden />Back to your workspace</Link></Panel></>;
}
