"use client";

import { useQuery } from "convex/react";
import { UsersRound } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "./workspace-context";
import { Badge, IconTile, LoadingState, PageHeading, Panel } from "./ui";

export function CommunityPage() {
  const { preview } = useWorkspace();
  return <><PageHeading title="Your kind of people." description="Meet the Hustlers, alumni, and organizers in Philoxenia." />{preview ? <EmptyCommunity /> : <LiveCommunity />}</>;
}

function LiveCommunity() {
  const people = useQuery(api.users.community);
  if (!people) return <LoadingState label="Meeting your community…" />;
  if (people.length === 0) return <EmptyCommunity />;
  return <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{people.map((person) => <Panel key={person._id} className="p-6"><div className="mb-5 flex items-center justify-between gap-3"><span className="flex size-12 items-center justify-center rounded-full bg-sage text-lg font-medium text-forest">{person.name.charAt(0).toUpperCase()}</span><Badge tone={person.isOrganizer ? "gold" : "green"}>{person.isOrganizer ? "Organizer" : person.isAlumni ? "Alumnus" : "Hustler"}</Badge></div><h2 className="text-base font-medium wrap-anywhere text-foreground">{person.name}</h2></Panel>)}</div>;
}

function EmptyCommunity() {
  return <Panel className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center"><IconTile icon={UsersRound} tone="green" className="mb-6 size-14 rounded-2xl" /><h2 className="text-2xl font-medium tracking-tight text-foreground">A community starts with a hello.</h2><p className="mt-3 max-w-md text-sm leading-7 text-muted">Invited Hustlers will appear here after they join. Profiles are shared within Philoxenia; email addresses stay private.</p></Panel>;
}
