"use client";

import Link from "next/link";
import { Popover } from "@heroui/react";
import { useRef, type ReactNode } from "react";
import { ArrowDownUp, ArrowUpRight, Bookmark, CalendarDays, Compass, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { dateLabel, dateRangeLabel } from "@/lib/cohort-dates";
import { sfCalendarDate, type Opportunity, type OpportunityFilters, type RecommendationContext } from "@/lib/opportunities";
import type { Cohort } from "./workspace-context";
import { ActionButton, ChoiceField, Field } from "./ui";
import { SelectField } from "./opportunity-parts";
import { useModalNotifications } from "./notification-context";

export function OpportunitiesHeader({ context, cohorts, cohort, preview, organizer, onSelectCohort }: {
  context: RecommendationContext; cohorts: Cohort[]; cohort?: Cohort; preview: boolean; organizer: boolean; onSelectCohort?: (id: string) => void;
}) {
  return <header className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="min-w-0"><h1 className="text-3xl leading-tight font-medium tracking-[-0.045em] text-foreground @min-[640px]:text-[38px]">Opportunities</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted">Find your next conversation, fresh perspective, or place to build.</p></div>
      {organizer ? <Link href={preview ? "/preview/organizer#opportunities" : "/organizer#opportunities"} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-medium text-forest transition-colors duration-150 hover:bg-soft">Manage opportunities<ArrowUpRight className="size-4" aria-hidden /></Link> : null}
    </div>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs leading-5 text-muted">
      <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" aria-hidden />San Francisco & beyond</span>
      {context.startDate && context.endDate ? <span className="inline-flex items-center gap-2 tabular-nums"><CalendarDays className="size-3.5 shrink-0" aria-hidden />Your stay · {dateRangeLabel(context.startDate, context.endDate)}</span> : null}
      <span className="inline-flex items-center gap-1.5 text-forest"><Compass className="size-3.5 shrink-0" aria-hidden />{context.interests.length ? "Matched to your interests and mission" : "Curated by your organizers"}</span>
    </div>
    {cohorts.length > 1 ? <div className="max-w-sm"><SelectField label="Recommendations for cohort" value={cohort?._id ?? ""} onChange={(event) => onSelectCohort?.(event.target.value)}>{cohorts.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</SelectField></div> : null}
    {preview ? <p className="text-xs leading-5 text-muted">Sample listings · People, events, and offers are illustrative.</p> : null}
  </header>;
}

const opportunityTabs = [{ value: "all", label: "All opportunities" }, { value: "event", label: "Events" }, { value: "startup", label: "Startups" }, { value: "founder", label: "Founders" }, { value: "alumni", label: "Alumni offers" }] as const;
const areaLabels = { sf: "San Francisco", "bay-area": "Wider Bay Area", online: "Online", all: "All locations" };
const priceLabels = { free: "Free events", paid: "Paid events", unknown: "Price not confirmed" };

export function OpportunitySearch({ entries, filters, moreFilters, onFiltersOpenChange, filtersContent, onUpdate }: {
  entries: Opportunity[]; filters: OpportunityFilters; moreFilters: boolean; onFiltersOpenChange: (open: boolean) => void; filtersContent: ReactNode; onUpdate: (patch: Partial<OpportunityFilters>) => void;
}) {
  const searchInput = useRef<HTMLInputElement>(null);
  useModalNotifications(moreFilters);
  const eventFilters = filters.kind === "all" || filters.kind === "event";
  const filterCount = Number(filters.area !== "sf") + Number(!!filters.interest) + (eventFilters ? Number(filters.cost !== "any") + Number(!!filters.from || !!filters.to) : 0);
  return <div className="space-y-4 rounded-2xl bg-soft p-3 @min-[640px]:p-4">
    <div className="flex flex-col gap-3 @min-[640px]:flex-row">
      <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 shadow-control transition-[border-color,box-shadow] duration-150 focus-within:border-forest/40 focus-within:ring-2 focus-within:ring-forest/10">
        <Search className="size-[18px] shrink-0 text-muted" aria-hidden />
        <input ref={searchInput} type="search" aria-label="Search opportunities" value={filters.search} onChange={(event) => onUpdate({ search: event.target.value })} placeholder="AI, product feedback, founders…" className="min-h-11 w-full min-w-0 bg-transparent text-sm text-foreground outline-none! placeholder:text-muted/70 [&::-webkit-search-cancel-button]:appearance-none" />
        {filters.search ? <button type="button" aria-label="Clear search" onClick={() => { onUpdate({ search: "" }); searchInput.current?.focus(); }} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-soft"><X className="size-3.5" aria-hidden /></button> : null}
      </div>
      <div className="flex flex-wrap gap-2.5">
        <ActionButton appearance="secondary" aria-pressed={filters.savedOnly} onPress={() => onUpdate({ savedOnly: !filters.savedOnly })} className={filters.savedOnly ? "border-forest/25 bg-sage text-forest" : ""}><Bookmark className={`size-4 ${filters.savedOnly ? "fill-forest" : "text-muted"}`} aria-hidden />Saved<span className="rounded-md bg-soft px-1.5 py-0.5 text-xs tabular-nums text-muted">{entries.filter((entry) => entry.saved).length}</span></ActionButton>
        <Popover isOpen={moreFilters} onOpenChange={onFiltersOpenChange}><ActionButton appearance="secondary" aria-label="Filters" className={moreFilters || filterCount ? "border-forest/25 text-forest" : ""}><SlidersHorizontal className="size-4" aria-hidden />Filters{filterCount ? <span className="flex size-5 items-center justify-center rounded-full bg-sage text-[11px] tabular-nums text-forest">{filterCount}</span> : null}</ActionButton><Popover.Content placement="bottom end" className="w-[min(460px,calc(100vw-32px))] rounded-2xl border border-line bg-white p-5 shadow-lg"><Popover.Dialog aria-label="Opportunity filters" className="space-y-4">{filtersContent}<ActionButton appearance="secondary" className="w-full" onPress={() => onFiltersOpenChange(false)}>Done</ActionButton></Popover.Dialog></Popover.Content></Popover>
      </div>
    </div>
    <div role="group" aria-label="Opportunity types" className="flex flex-wrap gap-1.5">
      {opportunityTabs.map((tab) => <button key={tab.value} aria-pressed={filters.kind === tab.value} onClick={() => onUpdate({ kind: tab.value })} className={`min-h-10 rounded-lg px-3.5 py-2 text-sm transition-colors duration-150 ${filters.kind === tab.value ? "bg-white font-medium text-forest shadow-control" : "text-muted hover:bg-warm hover:text-foreground"}`}>{tab.label}</button>)}
    </div>
  </div>;
}

export function OpportunityFiltersPanel({ entries, context, filters, datePreset, onUpdate, onDatePreset, onReset }: {
  entries: Opportunity[]; context: RecommendationContext; filters: OpportunityFilters; datePreset: string;
  onUpdate: (patch: Partial<OpportunityFilters>) => void; onDatePreset: (preset: string) => void; onReset: () => void;
}) {
  const interests = [...new Set(entries.flatMap((entry) => entry.interests))].sort();
  const eventFilters = filters.kind === "all" || filters.kind === "event";
  return <div className="@container/filters w-full min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-medium text-foreground">Refine your search</h2><button onClick={onReset} className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-medium text-forest underline-offset-4 hover:bg-soft hover:underline">Reset filters</button></div>
    <div className="grid min-w-0 gap-4 @min-[360px]/filters:grid-cols-2">
      <ChoiceField label="Location" value={filters.area} options={[{ value: "sf", label: "San Francisco" }, { value: "bay-area", label: "Wider Bay Area (including SF)" }, { value: "online", label: "Online" }, { value: "all", label: "All locations" }]} onChange={(value) => onUpdate({ area: value as OpportunityFilters["area"] })} />
      <ChoiceField label="Interest" value={filters.interest} options={[{ value: "", label: "All interests" }, ...interests.map((interest) => ({ value: interest, label: interest }))]} onChange={(value) => onUpdate({ interest: value })} />
      {eventFilters ? <>
        <ChoiceField label="Event dates" value={datePreset} options={[{ value: "any", label: "Any dates" }, { value: "upcoming", label: "Today onward" }, { value: "stay", label: "During my stay", disabled: !context.startDate }, { value: "custom", label: "Choose dates" }]} onChange={(preset) => { onDatePreset(preset); onUpdate({ from: preset === "stay" ? context.startDate ?? "" : preset === "upcoming" ? sfCalendarDate(Date.now()) : "", to: preset === "stay" ? context.endDate ?? "" : "" }); }} />
        <ChoiceField label="Event cost" value={filters.cost} options={[{ value: "any", label: "Any cost" }, { value: "free", label: "Free" }, { value: "paid", label: "Paid" }, { value: "unknown", label: "Price not confirmed" }]} onChange={(value) => onUpdate({ cost: value as OpportunityFilters["cost"] })} />
      </> : null}
    </div>
    {datePreset === "custom" && eventFilters ? <div className="grid min-w-0 gap-4 @min-[360px]/filters:grid-cols-2">
      <Field label="From (SF date)" type="date" value={filters.from} onChange={(event) => onUpdate({ from: event.target.value })} />
      <Field label="To (SF date)" type="date" min={filters.from || undefined} value={filters.to} onChange={(event) => onUpdate({ to: event.target.value })} />
    </div> : null}
    {eventFilters ? <p className="text-xs leading-5 text-muted">Dates and cost apply to events. Startups, founders, and alumni offers stay visible.</p> : null}
  </div>;
}

export function ActiveOpportunityFilters({ filters, onUpdate, onClearDates, onReset }: {
  filters: OpportunityFilters; onUpdate: (patch: Partial<OpportunityFilters>) => void; onClearDates: () => void; onReset: () => void;
}) {
  const eventFilters = filters.kind === "all" || filters.kind === "event";
  const active: { label: string; name: string; clear: () => void }[] = [];
  if (filters.area !== "sf") active.push({ label: areaLabels[filters.area], name: "location", clear: () => onUpdate({ area: "sf" }) });
  if (filters.interest) active.push({ label: filters.interest, name: "interest", clear: () => onUpdate({ interest: "" }) });
  if (eventFilters && filters.cost !== "any") active.push({ label: priceLabels[filters.cost], name: "event cost", clear: () => onUpdate({ cost: "any" }) });
  if (eventFilters && (filters.from || filters.to)) active.push({ label: filters.from && filters.to ? `${dateLabel(filters.from, "MMM d")} – ${dateLabel(filters.to, "MMM d")}` : filters.from ? `From ${dateLabel(filters.from, "MMM d")}` : `Until ${dateLabel(filters.to, "MMM d")}`, name: "event dates", clear: onClearDates });
  if (!active.length) return null;
  return <div role="group" aria-label="Active filters" className="flex flex-wrap items-center gap-2">
    {active.map((filter) => <button key={filter.name} aria-label={`Remove ${filter.name} filter`} onClick={filter.clear} className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg bg-sage px-3 py-1.5 text-xs text-forest"><span className="min-w-0 text-start wrap-anywhere">{filter.label}</span><X className="size-3.5 shrink-0" aria-hidden /></button>)}
    <button onClick={onReset} className="min-h-9 rounded-lg px-2 text-xs font-medium text-muted underline-offset-4 hover:text-foreground hover:underline">Clear filters</button>
  </div>;
}

export function OpportunityResultsHeading({ count, filters, sort, onSort }: { count: number; filters: OpportunityFilters; sort: string; onSort: (sort: string) => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1"><h2 aria-live="polite" aria-atomic="true" className="text-base font-medium tracking-tight text-foreground">{count} {count === 1 ? "opportunity" : "opportunities"}{filters.savedOnly ? " saved" : " to explore"}</h2><span className="text-xs text-muted">{areaLabels[filters.area]}</span></div>
    <div className="flex min-w-0 items-center gap-2"><ArrowDownUp className="size-3.5 shrink-0 text-muted" aria-hidden /><div className="w-44 min-w-0"><ChoiceField compact label="Sort opportunities" value={sort} options={[{ value: "recommended", label: "Recommended" }, { value: "soonest", label: "Events soonest" }, { value: "newest", label: "Recently updated" }]} onChange={onSort} /></div></div>
  </div>;
}

export function OpportunityEmptyState({ entries, filters, organizer, preview, invalidRange, onReset }: {
  entries: Opportunity[]; filters: OpportunityFilters; organizer: boolean; preview: boolean; invalidRange: boolean; onReset: () => void;
}) {
  return <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-soft/50 px-5 py-10 text-center">
    <span className="mb-4 inline-flex size-12 items-center justify-center rounded-xl border border-line bg-white text-forest">{filters.savedOnly ? <Bookmark className="size-5" strokeWidth={1.6} aria-hidden /> : <Compass className="size-5" strokeWidth={1.6} aria-hidden />}</span>
    <h2 className="text-lg font-medium tracking-tight text-foreground">{entries.length === 0 ? "No published opportunities yet" : invalidRange ? "Check your event dates" : filters.savedOnly ? "No saved opportunities here yet" : "No opportunities match these filters"}</h2>
    <p className="mt-2 max-w-md text-sm leading-6 text-muted wrap-anywhere">{entries.length === 0 ? "Events, founders, startups, and alumni offers will appear here when your organizers publish them." : invalidRange ? "Choose an end date on or after the start date to see matching events." : filters.savedOnly ? "Bookmark an opportunity to come back to it. Try browsing all listings or widening your filters." : filters.search.trim() ? `No results for “${filters.search.trim()}”. Try a different search or browse all opportunities.` : "Try another interest or include more locations to find something that fits."}</p>
    {entries.length && !invalidRange ? <ActionButton appearance="secondary" className="mt-5" onPress={onReset}>Browse all opportunities</ActionButton> : entries.length === 0 && organizer ? <Link href={preview ? "/preview/organizer#opportunities" : "/organizer#opportunities"} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-medium text-forest hover:bg-soft">Publish your first opportunity<ArrowUpRight className="size-4" aria-hidden /></Link> : null}
  </div>;
}
