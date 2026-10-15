"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { DoorOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { supportKinds, supportLabels } from "@/lib/open-doors";
import { useWorkspace, type Cohort } from "./workspace-context";
import { ActionButton, Badge, LoadingState, PageHeading, Panel, SearchField } from "./ui";
import { SelectField } from "./opportunity-parts";
import { ActivityEditor } from "./sprint-editors";
import { OfferEditor, SupportRequestEditor } from "./open-doors-editors";
import { RequestCard, RequestDetails } from "./open-doors-requests";
import type { DoorActions, DoorOffer, DoorRequest } from "./open-doors-types";
import { PreviewDoors } from "./open-doors-preview";

export function OpenDoors({ organizer = false }: { organizer?: boolean }) {
  const { preview } = useWorkspace();
  return preview ? <PreviewDoors organizer={organizer} /> : <ConnectedDoors organizer={organizer} />;
}
function ConnectedDoors({ organizer }: { organizer: boolean }) {
  const { viewer, cohorts } = useWorkspace();
  const offers = useQuery(api.openDoors.catalog), ownOffers = useQuery(api.openDoors.ownOffers), requests = useQuery(api.openDoors.requests, { organizer });
  const save = useMutation(api.openDoors.saveOffer), submit = useMutation(api.openDoors.submitRequest), respond = useMutation(api.openDoors.respond), decide = useMutation(api.openDoors.participantDecision), complete = useMutation(api.openDoors.complete), coordinate = useMutation(api.openDoors.coordinate);
  const actions: DoorActions = {
    async saveOffer(input, offer) { await save({ input, offerId: offer?._id, expectedRevision: offer?.revision ?? 0 }); },
    async request(offer, cohortId, goal, fit) { await submit({ offerId: offer._id, cohortId, goal, fit }); },
    async respond(request, decision, response) { await respond({ requestId: request._id, expectedRevision: request.revision, decision, response }); },
    async decide(request, accept) { await decide({ requestId: request._id, expectedRevision: request.revision, accept }); },
    async complete(request, response) { await complete({ requestId: request._id, expectedRevision: request.revision, response }); },
    async coordinate(request, note) { await coordinate({ requestId: request._id, note, expectedUpdatedAt: request.coordination?.updatedAt }); },
  };
  const participantCohorts = cohorts.filter((cohort) => viewer?.participantCohortIds.includes(cohort._id));
  if (!offers || !ownOffers || !requests) return <LoadingState label="Opening the alumni network…" />;
  return <DoorsView offers={offers} ownOffers={ownOffers} requests={requests} cohorts={participantCohorts} isAlumni={viewer?.profile?.isAlumni ?? false} organizer={organizer} actions={actions} />;
}

export function DoorsView({ offers, ownOffers, requests, cohorts, isAlumni, organizer, actions, preview = false, sampleMeeting }: { offers: DoorOffer[]; ownOffers: Doc<"alumniOffers">[]; requests: DoorRequest[]; cohorts: Cohort[]; isAlumni: boolean; organizer: boolean; actions: DoorActions; preview?: boolean; sampleMeeting?: (request: DoorRequest, onClose: () => void) => ReactNode }) {
  const [search, setSearch] = useState(""), [kind, setKind] = useState(""), [status, setStatus] = useState("");
  const [editing, setEditing] = useState<{ offer?: Doc<"alumniOffers"> } | null>(null), [requesting, setRequesting] = useState<DoorOffer | null>(null), [detail, setDetail] = useState<DoorRequest | null>(null), [meeting, setMeeting] = useState<DoorRequest | null>(null);
  const [tab, setTab] = useState(organizer ? "requests" : "offers");
  const term = search.trim().toLowerCase();
  const filtered = offers.filter((offer) => (!kind || offer.kind === kind) && `${offer.title} ${offer.description} ${offer.ownerName} ${offer.connection}`.toLowerCase().includes(term));
  const filteredRequests = requests.filter((request) => (!status || request.status === status) && `${request.offerSnapshot.title} ${request.requesterName} ${request.alumnusName} ${request.goal}`.toLowerCase().includes(term));
  const currentDetail = detail ? requests.find((request) => request._id === detail._id) : undefined;
  return <div className="space-y-6">
    {organizer ? <div><h2 className="text-xl font-medium tracking-tight">Support coordination</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Requests across all cohorts</p></div> : <PageHeading title="Open Doors" description="Ask for focused support from alumni who’ve been where you are." action={isAlumni ? <ActionButton onClick={() => setEditing({})}><Plus className="size-4" aria-hidden />Offer your support</ActionButton> : undefined} />}
    {!organizer ? <div className="flex flex-wrap gap-2" role="group" aria-label="Open Doors view">{[{ value: "offers", label: "Explore support" }, { value: "requests", label: `Requests (${requests.length})` }, ...(isAlumni ? [{ value: "own", label: "Your offers" }] : [])].map((item) => <ActionButton key={item.value} appearance="secondary" aria-pressed={tab === item.value} className={tab === item.value ? "bg-sage text-forest" : ""} onClick={() => setTab(item.value)}>{item.label}</ActionButton>)}</div> : null}
    {tab !== "own" ? <div className="flex flex-wrap items-end gap-3"><SearchField aria-label={tab === "offers" ? "Search support offers" : "Search support requests"} placeholder={tab === "offers" ? "Support, alumnus, or connection" : "Request, person, or goal"} value={search} onChange={(event) => setSearch(event.target.value)} containerClassName="flex-1 basis-60" /><div className="w-full min-w-0 sm:w-56">{tab === "offers" ? <SelectField label="Support type" value={kind} onChange={(event) => setKind(event.target.value)}><option value="">All support</option>{supportKinds.map((kind) => <option key={kind} value={kind}>{supportLabels[kind]}</option>)}</SelectField> : <SelectField label="Request status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All requests</option><option value="pending">Awaiting reply</option><option value="alternative">Alternative proposed</option><option value="agreed">Support agreed</option><option value="completed">Completed</option><option value="declined">Declined</option><option value="withdrawn">Withdrawn</option></SelectField>}</div></div> : null}
    {tab === "offers" ? filtered.length ? <div className="grid items-start gap-5 md:grid-cols-2">{filtered.map((offer) => <Panel key={offer._id} className="space-y-4 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><Badge tone="green">{supportLabels[offer.kind]}</Badge><span className="text-xs tabular-nums text-muted-foreground">{offer.remaining} of {offer.capacity} places available</span></div><div><h2 className="text-xl font-medium tracking-tight wrap-anywhere">{offer.title}</h2><p className="mt-1 text-xs text-forest">With {offer.ownerName}</p></div><p className="text-sm leading-6 whitespace-pre-wrap wrap-anywhere text-muted-foreground">{offer.description}</p>{offer.connection ? <div className="rounded-xl bg-sage/50 p-3"><h3 className="text-xs font-medium">Introduction path</h3><p className="mt-1 text-sm leading-6 wrap-anywhere text-muted-foreground">{offer.connection}</p></div> : null}<div><h3 className="text-xs font-medium">Availability</h3><p className="mt-1 text-sm leading-6 wrap-anywhere text-muted-foreground">{offer.availability}</p></div><ActionButton appearance="secondary" disabled={offer.own || offer.remaining === 0 || cohorts.length === 0 || requests.some((request) => request.isRequester && request.offerId === offer._id && ["pending", "alternative", "agreed"].includes(request.status))} onClick={() => setRequesting(offer)}>{offer.own ? "Your offer" : !cohorts.length ? "Cohort membership required" : offer.remaining === 0 ? "Currently at capacity" : requests.some((request) => request.isRequester && request.offerId === offer._id && ["pending", "alternative", "agreed"].includes(request.status)) ? "Request already open" : "Request support"}</ActionButton></Panel>)}</div> : <DoorsEmpty title={search || kind ? "No matching support" : "The next door opens with an offer"} description={search || kind ? "Try another support type or search." : "Alumni offers will appear here when they’re published. Each offer describes personal support and current availability."} /> : null}
    {tab === "requests" ? filteredRequests.length ? <div className="grid items-start gap-5 md:grid-cols-2">{filteredRequests.map((request) => <RequestCard key={request._id} request={request} onOpen={() => setDetail(request)} />)}</div> : <DoorsEmpty title="No requests here yet" description={organizer ? "Requests from all cohorts will appear here for coordination." : "Explore support and send a focused request. Replies and alternatives will appear here."} /> : null}
    {tab === "own" ? ownOffers.length ? <div className="grid items-start gap-5 md:grid-cols-2">{ownOffers.map((offer) => <Panel key={offer._id} className="space-y-4 p-5"><Badge tone={offer.published ? "green" : "neutral"}>{offer.published ? "Published" : "Private draft"}</Badge><h2 className="text-xl font-medium wrap-anywhere">{offer.title}</h2><p className="text-sm leading-6 text-muted-foreground">{offer.availability}</p><ActionButton appearance="secondary" onClick={() => setEditing({ offer })}>Edit offer</ActionButton></Panel>)}</div> : <DoorsEmpty title="Share what you learned" description="Offer mentorship, a portfolio review, an introduction you can facilitate, or another useful next step." /> : null}
    {editing ? <OfferEditor offer={editing.offer} onClose={() => setEditing(null)} onSave={async (input) => { await actions.saveOffer(input, editing.offer); setEditing(null); toast.success("Support offer saved."); }} /> : null}
    {requesting ? <SupportRequestEditor offer={requesting} cohorts={cohorts} onClose={() => setRequesting(null)} onSave={async (cohortId, goal, fit) => { await actions.request(requesting, cohortId, goal, fit); setRequesting(null); setTab("requests"); toast.success("Support request sent."); }} /> : null}
    {detail && currentDetail ? <RequestDetails request={detail} organizer={organizer} preview={preview} actions={actions} onClose={() => setDetail(null)} onSchedule={() => { setMeeting(currentDetail); setDetail(null); }} /> : null}
    {meeting ? preview && sampleMeeting ? sampleMeeting(meeting, () => setMeeting(null)) : <SupportMeeting request={meeting} onClose={() => setMeeting(null)} /> : null}
  </div>;
}
function DoorsEmpty({ title, description }: { title: string; description: string }) { return <Panel className="flex min-h-64 flex-col items-center justify-center p-6 text-center"><DoorOpen className="mb-4 size-7 text-forest" strokeWidth={1.7} aria-hidden /><h2 className="text-xl font-medium tracking-tight">{title}</h2><p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">{description}</p></Panel>; }

function SupportMeeting({ request, onClose }: { request: DoorRequest; onClose: () => void }) {
  const data = useQuery(api.sprint.get, { cohortId: request.cohortId }), schedule = useMutation(api.openDoors.schedule);
  if (!data) return <LoadingState label="Opening your stay dates…" />;
  return <ActivityEditor data={data} supportMeeting={{ title: request.offerSnapshot.title, notes: request.alternative ?? request.goal }} onClose={onClose} onSave={async (input, _goal, allowOverlap) => { await schedule({ requestId: request._id, expectedRevision: request.revision, input, allowOverlap }); onClose(); toast.success("Agreed support added to your Sprint."); }} />;
}
