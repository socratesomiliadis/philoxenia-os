"use client";

import { useQuery } from "convex/react";
import { UsersRound } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "./workspace-context";
import { Badge, LoadingState, PageHeading, Panel } from "./ui";

export function CommunityPage() {
  const { preview } = useWorkspace();
  return <><PageHeading eyebrow="You don’t have to build alone" title="Your kind of people." description="Hustlers, alumni, and organizers. Different chapters, shared ambition." />{preview ? <EmptyCommunity /> : <LiveCommunity />}</>;
}

function LiveCommunity() {
  const people = useQuery(api.users.community);
  if (!people) return <LoadingState label="Meeting your community…" />;
  if (people.length === 0) return <EmptyCommunity />;
  return <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{people.map((person) => <Panel key={person._id} className="p-7"><div className="mb-5 flex items-center justify-between"><span className="flex size-12 items-center justify-center rounded-2xl bg-forest/7 font-display text-2xl text-forest">{person.name.charAt(0).toUpperCase()}</span><Badge tone={person.isOrganizer ? "gold" : "green"}>{person.isOrganizer ? "Organizer" : person.isAlumni ? "Alumnus" : "Hustler"}</Badge></div><h2 className="text-sm font-semibold text-forest">{person.name}</h2><p className="mt-2 text-xs text-muted">Part of the Philoxenia community</p></Panel>)}</div>;
}

function EmptyCommunity() {
  return <Panel className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center"><UsersRound className="mb-6 size-8 text-gold" strokeWidth={1.5} aria-hidden /><h2 className="font-display text-3xl text-forest">A community starts with a hello.</h2><p className="mt-4 max-w-md text-sm leading-7 text-muted">Invited Hustlers will appear here after they join. Profiles are shared within Philoxenia; email addresses stay private.</p></Panel>;
}
