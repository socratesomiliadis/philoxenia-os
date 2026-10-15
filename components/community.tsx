"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { UsersRound } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { CommunityInput } from "@/lib/open-doors";
import { useWorkspace } from "./workspace-context";
import { ActionButton, ChoiceField, LoadingState, PageHeading, Panel, SearchField } from "./ui";
import { CommunityCard, CommunityDetails, ProfileEditor } from "./community-profile";

export type CommunityPerson = FunctionReturnType<typeof api.users.community>[number];
const empty: CommunityInput = { bio: "", building: "", interests: "", offering: "" };
const samples: CommunityPerson[] = [
  { _id: "sample-hustler" as Id<"profiles">, name: "Sam · Sample Hustler", image: undefined, isAlumni: false, isOrganizer: false, community: { headline: "Developer, designer, and first-time founder", location: "Athens, Greece", bio: "Building a first product and learning from other founders. Always up for a coffee and a conversation about an idea.", building: "A prototype for independent developers", interests: "Developer tools, design", offering: "React prototypes and product feedback", socialLinks: { website: "https://example.com", github: "https://github.com" } }, cohorts: [{ name: "Sample winter cohort", status: "upcoming" }] },
  { _id: "sample-alumnus" as Id<"profiles">, name: "Alex · Sample alumnus", image: undefined, isAlumni: true, isOrganizer: false, community: { headline: "Helping builders find their next step", location: "San Francisco, CA", bio: "Philoxenia alumnus sharing what I learned with the next cohort. Ask me about telling your product’s story or finding your first collaborators.", building: "Tools that help builders ship", interests: "Startups, developer tools", offering: "Portfolio reviews and focused introductions", socialLinks: { linkedin: "https://linkedin.com", x: "https://x.com" } }, cohorts: [{ name: "Sample summer cohort", status: "completed" }] },
];

export function CommunityPage() {
  const { preview } = useWorkspace();
  return preview ? <CommunityView people={samples} input={empty} preview /> : <LiveCommunity />;
}

function LiveCommunity() {
  const { viewer } = useWorkspace();
  const people = useQuery(api.users.community);
  const save = useMutation(api.users.saveCommunity);
  if (!people) return <LoadingState label="Meeting your community…" />;
  return <CommunityView people={people} input={viewer?.profile?.community ?? empty} ownId={viewer?.profile?._id} onSave={async (input) => { await save({ input }); }} />;
}

function CommunityView({ people, input, ownId, onSave, preview = false }: {
  people: CommunityPerson[]; input: CommunityInput; ownId?: Id<"profiles">;
  onSave?: (input: CommunityInput) => Promise<void>; preview?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [cohort, setCohort] = useState("");
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<Id<"profiles"> | null>(null);
  const [saved, setSaved] = useState(false);
  const names = [...new Set(people.flatMap((person) => person.cohorts.map((cohort) => cohort.name)))];
  const query = search.toLowerCase().trim();
  const filtered = people.filter((person) => {
    const profile = person.community;
    const matchesRole = !role || (role === "alumni" && person.isAlumni) || (role === "hustler" && !person.isAlumni && !person.isOrganizer) || (role === "organizer" && person.isOrganizer);
    const text = [person.name, profile?.headline, profile?.location, profile?.bio, profile?.building, profile?.interests, profile?.offering].join(" ");
    return matchesRole && (!cohort || person.cohorts.some((item) => item.name === cohort)) && text.toLowerCase().includes(query);
  });
  const selected = people.find((person) => person._id === selectedId);
  function editProfile() { setSaved(false); setEditing(true); }

  return <div className="space-y-6">
    <PageHeading title="Your kind of people." description="Meet the people behind the projects. Find shared interests, exchange ideas, and keep in touch." action={!preview ? <ActionButton appearance="secondary" onClick={editProfile}>Edit your profile</ActionButton> : undefined} />
    {preview ? <p className="text-xs text-muted-foreground">Illustrative community profiles. No real member data is shown.</p> : null}
    {saved ? <p role="status" className="rounded-xl bg-sage px-4 py-3 text-sm text-forest">Profile saved. Your community can see your updates.</p> : null}
    <div className="flex flex-wrap items-end gap-3">
      <SearchField aria-label="Search community" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="People, interests, skills, or location" containerClassName="flex-1 basis-60" />
      <div className="w-full sm:w-44"><ChoiceField label="Community role" value={role} onChange={setRole} options={[{ value: "", label: "Everyone" }, { value: "alumni", label: "Alumni" }, { value: "hustler", label: "Hustlers" }, { value: "organizer", label: "Organizers" }]} /></div>
      <div className="w-full sm:w-60"><ChoiceField label="Community cohort" value={cohort} onChange={setCohort} options={[{ value: "", label: "All cohorts" }, ...names.map((name) => ({ value: name, label: name }))]} /></div>
    </div>
    <p className="text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "member" : "members"}{search || role || cohort ? " found" : " across the community"}</p>
    {filtered.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((person) => <CommunityCard key={person._id} person={person} own={person._id === ownId} onOpen={() => setSelectedId(person._id)} />)}</div> : <Panel className="flex min-h-64 flex-col items-center justify-center p-6 text-center">
      <UsersRound className="mb-4 size-7 text-forest" aria-hidden />
      <h2 className="text-xl font-medium">{people.length ? "No matching people" : "A community starts with a hello."}</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{people.length ? "Try another interest, role, or cohort." : "Invited Hustlers will appear after joining. Email addresses stay private."}</p>
      {search || role || cohort ? <ActionButton appearance="secondary" className="mt-4" onClick={() => { setSearch(""); setRole(""); setCohort(""); }}>Clear filters</ActionButton> : null}
    </Panel>}
    {selectedId ? <CommunityDetails person={selected} onClose={() => setSelectedId(null)} onEdit={selectedId === ownId ? () => { setSelectedId(null); editProfile(); } : undefined} /> : null}
    {editing && onSave ? <ProfileEditor input={input} onSave={async (input) => { await onSave(input); setEditing(false); setSaved(true); }} onClose={() => setEditing(false)} /> : null}
  </div>;
}
