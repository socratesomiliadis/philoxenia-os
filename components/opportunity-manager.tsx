"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { FilePlus2, Pencil, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { kindLabels, type Opportunity, type OpportunityInput } from "@/lib/opportunities";
import { sampleOpportunities } from "@/lib/sample-opportunities";
import { useWorkspace } from "./workspace-context";
import { ActionButton, Badge, InlineError, Panel, errorMessage } from "./ui";
import { SelectField } from "./opportunity-parts";
import { OpportunityEditor } from "./opportunity-editor";

export function OpportunityManager() {
  const { preview, viewer } = useWorkspace();
  if (preview) return <ManagerView entries={sampleOpportunities} preview />;
  if (!viewer?.isOrganizer) return null;
  return <ConnectedManager />;
}

function ConnectedManager() {
  const data = useQuery(api.opportunities.list, { management: true });
  const save = useMutation(api.opportunities.save);
  const addStarters = useMutation(api.opportunities.addCuratedStarters);
  if (!data) return <Panel className="p-6"><p role="status" className="text-sm text-muted">Loading opportunities…</p></Panel>;
  return <ManagerView entries={data.entries} onSave={async (input, entry, confirmSupport) => { await save({ opportunity: input, opportunityId: entry?._id as Id<"opportunities"> | undefined, expectedUpdatedAt: entry?.updatedAt, confirmSupport }); }} onAddStarters={async () => (await addStarters({})).added} />;
}

function ManagerView({ entries, preview = false, onSave, onAddStarters }: { entries: Opportunity[]; preview?: boolean; onSave?: (input: OpportunityInput, entry: Opportunity | undefined, confirmSupport: boolean) => Promise<void>; onAddStarters?: () => Promise<number> }) {
  const [editor, setEditor] = useState<{ entry?: Opportunity } | null>(null);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const visible = entries.filter((entry) => (status === "all" || status === entry.status) && `${entry.title} ${entry.sourceName}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title));
  async function addStarters() {
    setBusy(true); setError(null); setNotice("");
    try { const count = await onAddStarters?.(); setNotice(count ? `Added ${count} directory drafts. Review the original sources, then publish each listing.` : "The curated starters are already in your catalog. Existing listings were preserved."); setStatus("draft"); setSearch(""); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <section id="opportunities" aria-labelledby="manage-opportunities-heading" className="scroll-mt-24 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 id="manage-opportunities-heading" className="text-2xl font-medium tracking-tight text-foreground">Manage opportunities</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted">Curate events, startups, founders, and confirmed alumni offers for all members.</p></div><ActionButton onPress={() => setEditor({})} isDisabled={preview}><Plus className="size-4" aria-hidden />Add opportunity</ActionButton></div>
    <Panel className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="text-sm font-medium text-foreground">Start with a few real directory entries</h3><p className="mt-2 max-w-2xl text-xs leading-6 text-muted">Add LangChain, Harrison Chase, Supabase, and Replit as unpublished drafts. Sources reviewed October 14, 2026. Review current details before publishing. No events or support availability are implied.</p></div><ActionButton appearance="secondary" busy={busy} isDisabled={preview} onPress={addStarters}><FilePlus2 className="size-4" aria-hidden />Add curated starters</ActionButton></div></Panel>
    <InlineError message={error} />{notice ? <p role="status" className="text-sm leading-6 text-forest">{notice}</p> : null}
    <Panel className="overflow-hidden"><div className="grid items-end gap-4 border-b border-line p-5 sm:grid-cols-[minmax(0,1fr)_200px]"><label className="space-y-2 text-xs font-medium text-muted"><span className="block">Search listings</span><input type="search" aria-label="Search listings" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title or source" className="min-h-11 w-full rounded-xl border border-line px-3 text-sm text-foreground" /></label><SelectField label="Listing status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses ({entries.length})</option><option value="draft">Drafts ({entries.filter((entry) => entry.status === "draft").length})</option><option value="published">Published ({entries.filter((entry) => entry.status === "published").length})</option><option value="archived">Archived ({entries.filter((entry) => entry.status === "archived").length})</option></SelectField></div>
      {visible.length ? <ul className="divide-y divide-line">{visible.map((entry) => <li key={entry._id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div className="min-w-0 flex-1 basis-48"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium wrap-anywhere text-foreground">{entry.title}</p><Badge tone={entry.status === "published" ? "green" : "neutral"}>{entry.status}</Badge></div><p className="mt-2 text-xs leading-5 wrap-anywhere text-muted">{kindLabels[entry.kind]} · {entry.location} · {entry.sourceName}</p></div><ActionButton appearance="secondary" isDisabled={preview} aria-label={`Edit ${entry.title}`} onPress={() => setEditor({ entry })}><Pencil className="size-3.5" aria-hidden />Edit</ActionButton></li>)}</ul> : <div className="space-y-3 p-7"><h3 className="text-base font-medium text-foreground">{entries.length ? "No listings match these filters" : "Publish the first opportunity"}</h3><p className="text-sm leading-6 text-muted">{entries.length ? "Try another title or listing status." : "Add a real event or a directory entry. Drafts stay private until you publish."}</p>{entries.length ? <ActionButton appearance="secondary" onPress={() => { setSearch(""); setStatus("all"); }}>Reset listing filters</ActionButton> : null}</div>}
    </Panel>
    {editor ? <OpportunityEditor entry={editor.entry} onClose={() => setEditor(null)} onSave={async (input, confirmSupport) => { await onSave?.(input, editor.entry, confirmSupport); setStatus(input.status); setSearch(""); setNotice(`${input.title}: ${input.status === "published" ? "published for all members" : input.status === "archived" ? "archived; member bookmarks are retained" : "draft saved"}.`); setEditor(null); }} /> : null}
  </section>;
}
