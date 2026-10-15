"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { defaultOpportunityFilters, filterOpportunities, isUpcomingOpportunity, matchOpportunity, opportunitySortTime, type Opportunity, type OpportunityFilters, type RecommendationContext } from "@/lib/opportunities";
import { sampleOpportunities, sampleRecommendationContext } from "@/lib/sample-opportunities";
import { useWorkspace, type Cohort } from "./workspace-context";
import { InlineError, LoadingState, errorMessage } from "./ui";
import { OpportunityCard, OpportunityDetails } from "./opportunity-parts";
import { ActiveOpportunityFilters, OpportunitiesHeader, OpportunityEmptyState, OpportunityFiltersPanel, OpportunityResultsHeading, OpportunitySearch } from "./opportunity-discovery";

import { OpportunitySprintEditor } from "./opportunity-sprint-editor";

export function OpportunitiesDashboard() {
  const { preview } = useWorkspace();
  return preview ? <PreviewOpportunities /> : <ConnectedOpportunities />;
}

function PreviewOpportunities() {
  const [entries, setEntries] = useState(sampleOpportunities);
  const { cohorts } = useWorkspace();
  return <OpportunitiesView entries={entries} context={sampleRecommendationContext} cohorts={cohorts} cohort={cohorts[0]} onBookmark={async (entry) => { setEntries((items) => items.map((item) => item._id === entry._id ? { ...item, saved: !entry.saved } : item)); }} />;
}

function ConnectedOpportunities() {
  const { cohorts } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string>("");
  const ordered = [...cohorts].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const cohort = cohorts.find((item) => item._id === selectedId) ?? ordered.find((item) => item.status === "active") ?? ordered.find((item) => item.status === "upcoming") ?? ordered.at(-1);
  const data = useQuery(api.opportunities.list, { cohortId: cohort?._id });
  const setBookmark = useMutation(api.opportunities.setBookmark);
  if (!data) return <LoadingState label="Finding your next opportunity…" />;
  return <OpportunitiesView key={cohort?._id ?? "no-cohort"} entries={data.entries} context={data.context} cohorts={cohorts} cohort={cohort} onSelectCohort={setSelectedId} onBookmark={async (entry) => { await setBookmark({ opportunityId: entry._id as Id<"opportunities">, saved: !entry.saved }); }} />;
}

function OpportunitiesView({ entries: allEntries, context, cohorts, cohort, onSelectCohort, onBookmark }: {
  entries: Opportunity[]; context: RecommendationContext; cohorts: Cohort[]; cohort?: Cohort;
  onSelectCohort?: (id: string) => void; onBookmark: (entry: Opportunity) => Promise<void>;
}) {
  const { preview, viewer } = useWorkspace();
  const router = useRouter();
  const [now, setNow] = useState(0);
  useEffect(() => {
    let timer: number;
    function update() {
      const current = Date.now();
      setNow(current);
      const nextStart = allEntries.reduce((next, entry) => entry.kind === "event" && entry.startAt !== undefined && entry.startAt > current ? Math.min(next, entry.startAt) : next, current + 60_000);
      timer = window.setTimeout(update, nextStart - current);
    }
    function resume() { window.clearTimeout(timer); update(); }
    update();
    window.addEventListener("focus", resume);
    return () => { window.clearTimeout(timer); window.removeEventListener("focus", resume); };
  }, [allEntries]);
  const entries = allEntries.filter((entry) => isUpcomingOpportunity(entry, now));
  const [filters, setFilters] = useState<OpportunityFilters>(defaultOpportunityFilters);
  const [datePreset, setDatePreset] = useState("any");
  const [sort, setSort] = useState("recommended");
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState<Opportunity | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreFilters, setMoreFilters] = useState(false);
  const invalidRange = !!filters.from && !!filters.to && filters.to < filters.from;
  const visible = filterOpportunities(entries, filters).sort((a, b) => {
    if (sort === "newest") return b.updatedAt - a.updatedAt || a.title.localeCompare(b.title);
    if (sort === "soonest") return opportunitySortTime(a) - opportunitySortTime(b) || a.title.localeCompare(b.title);
    return matchOpportunity(b, context).score - matchOpportunity(a, context).score || opportunitySortTime(a) - opportunitySortTime(b) || a.title.localeCompare(b.title);
  });
  function update(patch: Partial<OpportunityFilters>) { setFilters((previous) => ({ ...previous, ...patch })); }
  function reset() { setFilters(defaultOpportunityFilters); setDatePreset("any"); }
  async function bookmark(entry: Opportunity) {
    if (busy) return;
    setBusy(true); setError(null);
    try { await onBookmark(entry); toast.success(entry.saved ? "Removed from saved" : "Opportunity saved", { description: entry.title }); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  const eventFilters = filters.kind === "all" || filters.kind === "event";
  return <div className="@container"><div className="space-y-6 @min-[640px]:space-y-8">
    <OpportunitiesHeader context={context} cohorts={cohorts} cohort={cohort} preview={preview} organizer={!!viewer?.isOrganizer} onSelectCohort={onSelectCohort} />
    <section aria-label="Find opportunities" className="flex min-w-0 flex-col gap-3">
      <OpportunitySearch entries={entries} filters={filters} moreFilters={moreFilters} onFiltersOpenChange={setMoreFilters} onUpdate={update} filtersContent={<OpportunityFiltersPanel entries={entries} context={context} filters={filters} datePreset={datePreset} onUpdate={update} onDatePreset={setDatePreset} onReset={reset} />} />
      <ActiveOpportunityFilters filters={filters} onUpdate={update} onClearDates={() => { update({ from: "", to: "" }); setDatePreset("any"); }} onReset={reset} />
    </section>
    <InlineError message={selected ? null : error} />
    {invalidRange && eventFilters ? <InlineError message="Choose an end date on or after the start date." /> : null}
    <section aria-label="Opportunity results" className="space-y-4">
      <OpportunityResultsHeading count={invalidRange && eventFilters ? 0 : visible.length} filters={filters} sort={sort} onSort={setSort} />
      {visible.length && !(invalidRange && eventFilters) ? <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-4">{visible.map((entry) => <OpportunityCard key={entry._id} entry={entry} busy={busy || now === 0} onBookmark={bookmark} onOpen={() => { setError(null); setSelected(entry._id); }} />)}</div> : <OpportunityEmptyState entries={entries} filters={filters} organizer={!!viewer?.isOrganizer} preview={preview} invalidRange={invalidRange && eventFilters} onReset={reset} />}
    </section>
    {selected ? <OpportunityDetails entry={entries.find((entry) => entry._id === selected)} context={context} busy={busy} error={error} onBookmark={bookmark} onClose={() => setSelected(null)} onAddToSprint={cohort && (preview || viewer?.participantCohortIds.includes(cohort._id)) ? () => { const entry = entries.find((item) => item._id === selected); if (entry) { setAdding(entry); } } : undefined} /> : null}
    {adding && cohort ? <OpportunitySprintEditor opportunity={adding} cohortId={cohort._id} onClose={() => { setAdding(null); }} onAdded={() => { setAdding(null); toast.success("Added to your Sprint", { description: "Review your schedule and choose your next step.", action: { label: "Open Sprint", onClick: () => router.push(preview ? "/preview/sprint" : "/sprint") } }); }} /> : null}
  </div></div>;
}
