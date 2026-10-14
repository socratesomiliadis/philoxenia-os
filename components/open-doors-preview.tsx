"use client";

import { useState, useSyncExternalStore } from "react";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { offerSchema, requestSchema, reservesCapacity } from "@/lib/open-doors";
import type { ActivityInput } from "@/lib/sprint";
import { getSampleSprint, getServerSampleSprint, sampleSprintActions, subscribeSampleSprint } from "@/lib/sample-sprint";
import { DoorsView } from "./open-doors";
import { SelectField } from "./opportunity-parts";
import { ActivityEditor } from "./sprint-editors";
import { previewCohort } from "./workspace-context";
import type { DoorActions, DoorOffer, DoorRequest } from "./open-doors-types";

const participantId = "sample-hustler" as Id<"profiles">, alumnusId = "sample-alumnus" as Id<"profiles">;
const storageKey = "philoxenia.open-doors.sample.v1", eventName = "philoxenia-open-doors-sample";
type Sample = { offers: Doc<"alumniOffers">[]; requests: DoorRequest[]; updates: string[] };
type PreviewActions = DoorActions & { schedule: (request: DoorRequest, input: ActivityInput, allowOverlap?: boolean) => Promise<void> };
const initial: Sample = { requests: [], updates: [], offers: [
  { _id: "sample-offer-portfolio" as Id<"alumniOffers">, _creationTime: 1, ownerId: alumnusId, title: "A fresh pair of eyes on your portfolio", kind: "portfolio", description: "Bring one project and a specific question. I can review how you explain the problem, show your work, and ask for feedback.", availability: "One 30-minute review during your stay. Agree the time in advance.", capacity: 2, connection: "", published: true, revision: 1, updatedAt: 1 },
  { _id: "sample-offer-intro" as Id<"alumniOffers">, _creationTime: 1, ownerId: alumnusId, title: "Meet a fellow developer tools builder", kind: "introduction", description: "I can ask a former teammate whether they’d like to hear about your developer tools project. Their agreement is needed before I connect you.", availability: "One introduction at a time. Share a short project summary.", capacity: 1, connection: "A former teammate is building developer tools. I can personally ask for permission to introduce you; a meeting is subject to their reply.", published: true, revision: 1, updatedAt: 1 },
] };
let snapshot = initial, restored = false;
function getSample() {
  if (!restored) {
    restored = true;
    try { const raw = JSON.parse(sessionStorage.getItem(storageKey) ?? "null"); if (raw && Array.isArray(raw.offers) && raw.offers.every((offer: unknown) => offerSchema.safeParse(offer).success) && Array.isArray(raw.requests) && Array.isArray(raw.updates)) snapshot = raw; } catch { /* Storage is optional in preview. */ }
  }
  return snapshot;
}
function subscribe(callback: () => void) { window.addEventListener(eventName, callback); return () => window.removeEventListener(eventName, callback); }
function write(next: Sample) { snapshot = next; try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the in-memory sample usable. */ } window.dispatchEvent(new Event(eventName)); }
function patchRequest(request: DoorRequest, patch: Partial<DoorRequest>, message: string) {
  const current = getSample().requests.find((item) => item._id === request._id);
  if (!current || current.revision !== request.revision) throw new Error("This sample request changed. Reopen it.");
  write({ ...getSample(), requests: getSample().requests.map((item) => item._id === request._id ? { ...item, ...patch, revision: item.revision + 1, updatedAt: Date.now() } : item), updates: [message, ...getSample().updates].slice(0, 10) });
}
export function PreviewDoors({ organizer }: { organizer: boolean }) {
  const sample = useSyncExternalStore(subscribe, getSample, () => initial);
  const sprint = useSyncExternalStore(subscribeSampleSprint, getSampleSprint, getServerSampleSprint);
  const [role, setRole] = useState("participant");
  const coordinator = organizer || role === "organizer", alumni = !coordinator && role === "alumnus";
  const requests = sample.requests.map((request) => {
    const activity = sprint.entries.find((entry) => entry._id === request.activityId);
    return { ...request, isRequester: !alumni && !coordinator, isRecipient: alumni, coordination: coordinator ? request.coordination : null,
      meeting: activity ? { title: activity.title, startAt: activity.startAt, endAt: activity.endAt } : null,
      outcomeCount: sprint.outcomes.filter((outcome) => outcome.activityId === request.activityId).reduce((sum, outcome) => sum + outcome.quantity, 0) };
  });
  const offers: DoorOffer[] = sample.offers.filter((offer) => offer.published).map((offer) => ({ ...offer, ownerName: "Alex · Sample alumnus", own: alumni, remaining: Math.max(0, offer.capacity - sample.requests.filter((request) => request.offerId === offer._id && reservesCapacity(request.status)).length) }));
  function capacity(request: DoorRequest) { const offer = offers.find((offer) => offer._id === request.offerId); if (!offer || (!reservesCapacity(request.status) && offer.remaining === 0)) throw new Error("This sample offer is at capacity."); }
  const actions: PreviewActions = {
    async saveOffer(input, offer) {
      const parsed = offerSchema.parse(input), current = offer ? sample.offers.find((item) => item._id === offer._id) : undefined;
      if (current && current.revision !== offer?.revision) throw new Error("This sample offer changed. Reopen it.");
      if (offer && sample.requests.filter((request) => request.offerId === offer._id && reservesCapacity(request.status)).length > parsed.capacity) throw new Error("Capacity cannot be lower than reserved places.");
      const row = { ...parsed, _id: offer?._id ?? `sample-offer-${crypto.randomUUID()}` as Id<"alumniOffers">, _creationTime: offer?._creationTime ?? Date.now(), ownerId: alumnusId, revision: (current?.revision ?? 0) + 1, updatedAt: Date.now() };
      write({ ...getSample(), offers: current ? getSample().offers.map((item) => item._id === row._id ? row : item) : [...getSample().offers, row] });
    },
    async request(offer, cohortId, goal, fit) {
      requestSchema.parse({ goal, fit });
      if (sample.requests.some((request) => request.offerId === offer._id && ["pending", "alternative", "agreed"].includes(request.status))) throw new Error("You already have an open request for this sample offer.");
      const { kind, title, description, availability, capacity, connection, published } = offer;
      const request: DoorRequest = { _id: `sample-request-${crypto.randomUUID()}` as Id<"supportRequests">, _creationTime: Date.now(), offerId: offer._id, requesterId: participantId, alumnusId, cohortId, goal, fit, offerSnapshot: { kind, title, description, availability, capacity, connection, published }, status: "pending", revision: 1, updatedAt: Date.now(), requesterName: "Sam · Sample Hustler", alumnusName: "Alex · Sample alumnus", isRequester: true, isRecipient: false, coordination: null, meeting: null, outcomeCount: 0 };
      write({ ...getSample(), requests: [request, ...getSample().requests], updates: ["Sample alumnus: A Hustler requested your support.", ...getSample().updates] });
    },
    async respond(request, decision, response) {
      if (decision !== "approve" && response.trim().length < 10) throw new Error("Explain a decline or alternative in at least 10 characters.");
      if (decision !== "decline") capacity(request);
      patchRequest(request, { status: decision === "approve" ? "agreed" : decision === "decline" ? "declined" : "alternative", response, alternative: decision === "alternative" ? response : undefined }, `Sample Hustler: Your request received ${decision === "alternative" ? "an alternative" : "a decision"}.`);
    },
    async decide(request, accept) { if (accept) capacity(request); patchRequest(request, { status: accept ? "agreed" : "withdrawn" }, `Sample alumnus: The Hustler ${accept ? "accepted your alternative" : "withdrew the request"}.`); },
    async complete(request, response) { if (response.trim().length < 10) throw new Error("Describe what happened in at least 10 characters."); patchRequest(request, { status: "completed", response, completedBy: alumni ? alumnusId : participantId }, "Sample support was reported as completed."); },
    async coordinate(request, note) { patchRequest(request, { coordination: { _id: "sample-coordination" as Id<"supportCoordination">, _creationTime: Date.now(), requestId: request._id, organizerId: "sample-organizer" as Id<"profiles">, note, updatedAt: Date.now() } }, "A private sample coordination note was saved."); },
    async schedule(request, input, allowOverlap) {
      await sampleSprintActions.saveActivity({ input, allowOverlap });
      const entry = getSampleSprint().entries.at(-1)!;
      patchRequest(request, { activityId: entry._id as Id<"sprintActivities">, meeting: { title: input.title, startAt: input.startAt, endAt: input.endAt } }, "Sample alumnus: The Hustler scheduled the agreed support.");
    },
  };
  return <div className="space-y-6">{!organizer ? <div className="space-y-3 rounded-xl bg-soft p-4"><p className="text-sm leading-6 text-muted">Illustrative people and offers. Switch roles to try both sides; changes stay in this tab. No real requests or emails are sent.</p><div className="max-w-xs"><SelectField label="Sample role" value={role} onChange={(event) => setRole(event.target.value)}><option value="participant">Hustler</option><option value="alumnus">Alumnus</option><option value="organizer">Organizer</option></SelectField></div></div> : null}<DoorsView key={coordinator ? "organizer" : alumni ? "alumnus" : "participant"} offers={offers} ownOffers={alumni ? sample.offers : []} requests={requests} cohorts={[previewCohort]} isAlumni={alumni} organizer={coordinator} actions={actions} preview sampleMeeting={(request, onClose) => <SampleMeeting request={request} onClose={onClose} actions={actions} />} />{sample.updates.length ? <details className="rounded-xl border border-line p-4"><summary className="cursor-pointer text-sm font-medium">Sample notification updates</summary><ul className="mt-3 space-y-2 text-xs leading-5 text-muted">{sample.updates.map((update, index) => <li key={index}>{update}</li>)}</ul></details> : null}<button className="min-h-11 text-sm text-muted hover:underline" onClick={() => write(initial)}>Reset sample Open Doors</button></div>;
}
function SampleMeeting({ request, actions, onClose }: { request: DoorRequest; actions: PreviewActions; onClose: () => void }) {
  const data = useSyncExternalStore(subscribeSampleSprint, getSampleSprint, getServerSampleSprint);
  return <ActivityEditor data={data} supportMeeting={{ title: request.offerSnapshot.title, notes: request.alternative ?? request.goal }} onClose={onClose} onSave={async (input, _goal, allowOverlap) => { await actions.schedule(request, input, allowOverlap); onClose(); }} />;
}
