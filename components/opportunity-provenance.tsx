"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { costLabels, eventTimeLabel, opportunityTimeLabel, type Opportunity } from "@/lib/opportunities";
import { providerLabels } from "@/lib/ingestion";
import { ActionButton, Badge, InlineError, errorMessage } from "./ui";
import { OpportunityModal } from "./opportunity-parts";

const fieldLabels: Record<string, string> = { kind: "type", title: "title", summary: "summary", description: "details", interests: "interests", categories: "mission categories", area: "area", location: "venue", sourceName: "source name", sourceUrl: "source link", organizerPick: "organizer pick", status: "publication status", startAt: "start time", endAt: "end time", eventDate: "first day", eventEndDate: "end date", cost: "cost", costNote: "pricing notes", support: "support path" };

export function OpportunityProvenance({ entry, onClose }: { entry: Opportunity; onClose: () => void }) {
  const sources = useQuery(api.ingestion.provenance, { opportunityId: entry._id as Id<"opportunities"> });
  const restore = useMutation(api.ingestion.restoreFields);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function restoreFields() {
    setBusy(true); setError(null);
    try { await restore({ opportunityId: entry._id as Id<"opportunities">, expectedUpdatedAt: entry.updatedAt }); onClose(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <OpportunityModal title="Imported source details" onClose={() => { if (!busy) onClose(); }}><div className="space-y-5">
    <p className="text-sm leading-6 text-muted">{entry.title}. The first imported source supplies automatic updates. Other sources are retained as provenance. Provider snapshots stay separate from your edits.</p>
    {entry.importOverrides?.length ? <div className="space-y-3"><p className="text-sm leading-6 text-muted">Protected organizer fields: {entry.importOverrides.map((field) => fieldLabels[field] ?? field).join(", ")}.</p><p className="text-xs leading-6 text-muted">Restoring uses the latest primary source fields. Publication status and organizer pick stay as you set them.</p><ActionButton appearance="secondary" busy={busy} onPress={restoreFields}>Restore imported fields</ActionButton></div> : <p className="text-sm text-muted">No protected field edits.</p>}
    <InlineError message={error} />
    {!sources ? <p role="status" className="text-sm text-muted">Loading source records…</p> : <ul className="space-y-4">{sources.map((s) => <li key={s._id} className="space-y-3 rounded-2xl border border-line p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{providerLabels[s.provider]}</h3>{s._id === entry.primarySourceId ? <Badge tone="green">Primary source</Badge> : <Badge>Additional source</Badge>}</div><p className="text-xs leading-6 text-muted">Last imported: {eventTimeLabel(s.lastImportedAt)}</p><p className="text-xs leading-6 wrap-anywhere text-muted">Source ID: {s.sourceId}</p><p className="text-sm font-medium">{s.snapshot.title}</p>{s.snapshot.startAt !== undefined || s.snapshot.eventDate ? <p className="text-xs text-muted">{opportunityTimeLabel(s.snapshot)}</p> : null}<p className="text-sm leading-6 text-muted">{s.snapshot.location}</p><p className="text-sm leading-6 text-muted">{s.snapshot.summary}</p><p className="text-sm leading-6 text-muted">{s.snapshot.description}</p><p className="text-xs leading-6 text-muted">Interests: {s.snapshot.interests.join(", ")}</p>{s.snapshot.cost ? <p className="text-xs leading-6 text-muted">{costLabels[s.snapshot.cost]}{s.snapshot.costNote ? ` · ${s.snapshot.costNote}` : ""}</p> : null}{s.approvalRequired !== undefined ? <p className="text-xs leading-6 text-muted">{s.approvalRequired ? "Host approval required" : "Host approval not required by source"}</p> : null}{s.cancelled ? <p className="text-sm text-red-700">Reported cancelled</p> : null}<a href={s.canonicalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 text-sm text-forest underline underline-offset-4">Open original source</a></li>)}</ul>}
  </div></OpportunityModal>;
}
