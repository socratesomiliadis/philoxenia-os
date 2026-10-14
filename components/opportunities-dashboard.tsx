"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Bookmark, Compass, Search, SlidersHorizontal } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { defaultOpportunityFilters, filterOpportunities, matchOpportunity, sfCalendarDate, type Opportunity, type OpportunityFilters, type RecommendationContext } from "@/lib/opportunities";
import { sampleOpportunities, sampleRecommendationContext } from "@/lib/sample-opportunities";
import { useWorkspace, type Cohort } from "./workspace-context";
import { ActionButton, InlineError, LoadingState, PageHeading, Panel, errorMessage } from "./ui";
import { OpportunityCard, OpportunityDetails, SelectField } from "./opportunity-parts";
import { dateRangeLabel } from "@/lib/cohort-dates";

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

function OpportunitiesView({ entries, context, cohorts, cohort, onSelectCohort, onBookmark }: {
  entries: Opportunity[]; context: RecommendationContext; cohorts: Cohort[]; cohort?: Cohort;
  onSelectCohort?: (id: string) => void; onBookmark: (entry: Opportunity) => Promise<void>;
}) {
  const { preview, viewer } = useWorkspace();
  const [filters, setFilters] = useState<OpportunityFilters>(defaultOpportunityFilters);
  const [datePreset, setDatePreset] = useState("any");
  const [sort, setSort] = useState("recommended");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [moreFilters, setMoreFilters] = useState(false);
  const interests = [...new Set(entries.flatMap((entry) => entry.interests))].sort();
  const invalidRange = !!filters.from && !!filters.to && filters.to < filters.from;
  const visible = filterOpportunities(entries, filters).sort((a, b) => {
    if (sort === "newest") return b.updatedAt - a.updatedAt || a.title.localeCompare(b.title);
    if (sort === "soonest") return (a.startAt ?? Infinity) - (b.startAt ?? Infinity) || a.title.localeCompare(b.title);
    return matchOpportunity(b, context).score - matchOpportunity(a, context).score || (a.startAt ?? Infinity) - (b.startAt ?? Infinity) || a.title.localeCompare(b.title);
  });
  function update(patch: Partial<OpportunityFilters>) { setFilters((previous) => ({ ...previous, ...patch })); }
  function reset() { setFilters(defaultOpportunityFilters); setDatePreset("any"); }
  async function bookmark(entry: Opportunity) {
    if (busy) return;
    setBusy(true); setError(null); setNotice("");
    try { await onBookmark(entry); setNotice(`${entry.saved ? "Removed from saved" : "Saved"}: ${entry.title}.${preview ? " Preview changes last until you leave this page." : ""}`); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  const tabs = [{ value: "all", label: "All opportunities" }, { value: "event", label: "Events" }, { value: "startup", label: "Startups" }, { value: "founder", label: "Founders" }, { value: "alumni", label: "Alumni offers" }] as const;
  const eventFilters = filters.kind === "all" || filters.kind === "event";
  return <div className="space-y-6">
    <PageHeading title="Opportunities" description="Find your next conversation, fresh perspective, or place to build." action={viewer?.isOrganizer ? <Link href="/organizer#opportunities" className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-medium text-forest hover:bg-soft">Manage opportunities</Link> : undefined} />
    <div className="flex flex-wrap items-center justify-between gap-4"><p className="max-w-xl text-sm leading-6 text-muted">{context.interests.length ? "Picked around your interests and mission. Open a listing to see why it fits." : "Explore your organizers’ picks. Your onboarding interests and confirmed mission help shape recommendations."}</p>{cohorts.length > 1 ? <div className="w-full sm:w-64"><SelectField label="Recommendations for cohort" value={cohort?._id ?? ""} onChange={(event) => onSelectCohort?.(event.target.value)}>{cohorts.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</SelectField></div> : context.startDate && context.endDate ? <p className="text-xs tabular-nums text-muted">Your stay · {dateRangeLabel(context.startDate, context.endDate)}</p> : null}</div>
    {preview ? <p className="text-xs leading-6 text-muted">Sample opportunities · People, events, and offers below are illustrative. Try the filters and bookmarks.</p> : null}
    <section aria-label="Find opportunities" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row"><label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-line bg-white px-4 shadow-control"><Search className="size-[18px] shrink-0 text-muted" aria-hidden /><input type="search" aria-label="Search opportunities" value={filters.search} onChange={(event) => update({ search: event.target.value })} placeholder="Try AI, product feedback, or a founder…" className="min-h-12 w-full min-w-0 bg-transparent text-sm outline-none" /></label><div className="flex flex-wrap gap-3"><ActionButton appearance="secondary" aria-pressed={filters.savedOnly} onPress={() => update({ savedOnly: !filters.savedOnly })}><Bookmark className={`size-4 ${filters.savedOnly ? "fill-forest text-forest" : ""}`} aria-hidden />Saved <span className="tabular-nums text-muted">{entries.filter((entry) => entry.saved).length}</span></ActionButton><ActionButton appearance="secondary" aria-expanded={moreFilters} aria-controls="opportunity-filters" onPress={() => setMoreFilters(!moreFilters)}><SlidersHorizontal className="size-4" aria-hidden />Filters</ActionButton></div></div>
      <div aria-label="Opportunity types" className="flex flex-wrap gap-2">{tabs.map((tab) => <button key={tab.value} aria-pressed={filters.kind === tab.value} onClick={() => update({ kind: tab.value })} className={`min-h-10 rounded-xl px-3.5 py-2 text-sm transition-colors ${filters.kind === tab.value ? "bg-sage font-medium text-forest" : "bg-soft text-muted hover:bg-warm"}`}>{tab.label}</button>)}</div>
      <div id="opportunity-filters" className={moreFilters ? "space-y-4 rounded-2xl border border-line p-4 sm:p-5" : "hidden"}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SelectField label="Location" value={filters.area} onChange={(event) => update({ area: event.target.value as OpportunityFilters["area"] })}><option value="sf">San Francisco</option><option value="bay-area">Wider Bay Area (including SF)</option><option value="online">Online</option><option value="all">All locations</option></SelectField><SelectField label="Interest" value={filters.interest} onChange={(event) => update({ interest: event.target.value })}><option value="">All interests</option>{interests.map((interest) => <option key={interest}>{interest}</option>)}</SelectField>{eventFilters ? <><SelectField label="Event dates" value={datePreset} onChange={(event) => { const value = event.target.value; setDatePreset(value); update({ from: value === "stay" ? context.startDate ?? "" : value === "upcoming" ? sfCalendarDate(Date.now()) : "", to: value === "stay" ? context.endDate ?? "" : "" }); }}><option value="any">Any dates</option><option value="upcoming">Today onward</option><option value="stay" disabled={!context.startDate}>During my stay</option><option value="custom">Choose dates</option></SelectField><SelectField label="Event cost" value={filters.cost} onChange={(event) => update({ cost: event.target.value as OpportunityFilters["cost"] })}><option value="any">Any cost</option><option value="free">Free</option><option value="paid">Paid</option><option value="unknown">Price not confirmed</option></SelectField></> : null}</div>
        {datePreset === "custom" && eventFilters ? <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-xs font-medium text-muted"><span className="block">From (SF date)</span><input aria-label="From (SF date)" type="date" value={filters.from} onChange={(event) => update({ from: event.target.value })} className="min-h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm text-foreground" /></label><label className="space-y-2 text-xs font-medium text-muted"><span className="block">To (SF date)</span><input aria-label="To (SF date)" type="date" min={filters.from || undefined} value={filters.to} onChange={(event) => update({ to: event.target.value })} className="min-h-11 w-full min-w-0 rounded-xl border border-line px-3 text-sm text-foreground" /></label></div> : null}
        {eventFilters ? <p className="text-xs leading-5 text-muted">Dates and cost filter events. Directory entries and alumni offers remain visible.</p> : null}
        <button onClick={reset} className="min-h-9 rounded-sm text-sm font-medium text-forest underline-offset-4 hover:underline">Reset filters</button>
      </div>
    </section>
    <InlineError message={selected ? null : error} />
    {notice && !selected ? <p role="status" className="text-sm leading-6 text-forest">{notice}</p> : null}
    {invalidRange && eventFilters ? <InlineError message="Choose an end date on or after the start date." /> : null}
    <div className="flex flex-wrap items-center justify-between gap-4"><p role="status" className="text-sm text-muted">{visible.length} {visible.length === 1 ? "opportunity" : "opportunities"}{filters.savedOnly ? " saved" : " to explore"} · {filters.area === "sf" ? "San Francisco" : filters.area === "bay-area" ? "Wider Bay Area" : filters.area === "online" ? "Online" : "All locations"}</p><div className="w-full sm:w-52"><SelectField label="Sort opportunities" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">Recommended</option><option value="soonest">Events soonest</option><option value="newest">Recently updated</option></SelectField></div></div>
    {visible.length && !(invalidRange && eventFilters) ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((entry) => <OpportunityCard key={entry._id} entry={entry} context={context} busy={busy} onBookmark={bookmark} onOpen={() => { setError(null); setNotice(""); setSelected(entry._id); }} />)}</div> : <Panel className="flex flex-col items-start gap-4 p-7 sm:p-10"><Compass className="size-7 text-forest" aria-hidden /><h2 className="text-xl font-medium tracking-tight text-foreground">{entries.length === 0 ? "No published opportunities yet" : filters.savedOnly ? "No saved opportunities here yet" : "No opportunities match these filters"}</h2><p className="max-w-lg text-sm leading-6 text-muted">{entries.length === 0 ? "Your organizers are putting the first listings together. Published events, startups, founders, and alumni offers will appear here." : filters.savedOnly ? "Save a listing with the bookmark button, or reset filters to see opportunities in other locations." : "Try a broader search, another interest, or the wider Bay Area."}</p>{entries.length ? <ActionButton appearance="secondary" onPress={reset}>Reset filters</ActionButton> : viewer?.isOrganizer ? <Link href="/organizer#opportunities" className="text-sm font-medium text-forest underline underline-offset-4">Publish your first opportunity</Link> : null}</Panel>}
    {selected ? <OpportunityDetails entry={entries.find((entry) => entry._id === selected)} context={context} busy={busy} error={error} notice={notice} onBookmark={bookmark} onClose={() => setSelected(null)} /> : null}
  </div>;
}
