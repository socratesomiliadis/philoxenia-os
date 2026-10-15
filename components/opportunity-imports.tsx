"use client";

import { useId, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { FileUp, RefreshCw, Settings2 } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { DEFAULT_LUMA_FEED_URL, providerLabels, type ImportProvider } from "@/lib/ingestion";
import { eventTimeLabel } from "@/lib/opportunities";
import { useWorkspace } from "./workspace-context";
import { ActionButton, Badge, ChoiceField, Field, TextareaField, InlineError, Panel, errorMessage } from "./ui";
import { OpportunityModal } from "./opportunity-parts";
import { DialogFormActions } from "./workspace-dialog";

type Status = FunctionReturnType<typeof api.ingestion.status>;
type Source = Status["sources"][number];
const previewData: Status = { sources: ["luma", "serpapi"].map((provider) => ({ provider: provider as ImportProvider, enabled: false, autoPublish: false, monthlyLimit: provider === "serpapi" ? 200 : undefined, feedUrl: provider === "luma" ? DEFAULT_LUMA_FEED_URL : undefined, configured: provider === "luma", reserved: 0, runs: 0, stale: false, lastAttemptAt: undefined, lastSuccessAt: undefined, activeRunId: undefined, nextDueAt: undefined })), runs: [], intervalDays: 1, month: "Sample" };

export function OpportunityImports({ expanded = false }: { expanded?: boolean }) {
  const { preview, viewer } = useWorkspace();
  const [open, setOpen] = useState(false);
  if (!preview && !viewer?.isOrganizer) return null;
  return <section className="space-y-4" aria-labelledby="imports-heading">
    <div className="flex flex-wrap items-start justify-between gap-4"><h2 id="imports-heading" className="text-xl font-medium tracking-tight">Import sources</h2>{!expanded ? <ActionButton appearance="secondary" onClick={() => setOpen(!open)} aria-expanded={open}><RefreshCw className="size-4" aria-hidden />{open ? "Hide import controls" : "Manage imports"}</ActionButton> : null}</div>
    {open || expanded ? preview ? <ImportsView data={previewData} preview /> : <ConnectedImports /> : null}
  </section>;
}
function ConnectedImports() {
  const data = useQuery(api.ingestion.status, {});
  const configure = useMutation(api.ingestion.configure);
  const refresh = useMutation(api.ingestion.refresh);
  const importYc = useMutation(api.ingestion.importYc);
  if (!data) return <Panel className="p-5"><p role="status" className="text-sm text-muted-foreground">Loading import status…</p></Panel>;
  return <ImportsView data={data} onConfigure={async (s) => { await configure(s); }} onRefresh={async (provider) => { await refresh({ provider }); }} onCsv={async (csv) => { return importYc({ csv }); }} />;
}
function ImportsView({ data, preview = false, onConfigure, onRefresh, onCsv }: { data: Status; preview?: boolean;
  onConfigure?: (s: { provider: ImportProvider; enabled: boolean; monthlyLimit?: number; feedUrl?: string; autoPublish: boolean }) => Promise<void>;
  onRefresh?: (provider: ImportProvider) => Promise<void>; onCsv?: (csv: string) => Promise<{ added: number; updated: number; skipped: number }> }) {
  const [settings, setSettings] = useState<Source | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function refresh(provider: ImportProvider) {
    setBusy(provider); setError(null);
    try { await onRefresh?.(provider); toast.success("Import queued", { description: "Results and status will update here." }); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  }
  return <div className="space-y-4">
    <p className="text-xs leading-6 text-muted-foreground">{preview ? "Sample controls. Configure providers in your connected workspace." : `Scheduled ${data.intervalDays === 1 ? "daily while cohorts are upcoming or active" : "weekly between cohorts"}, checked at 14:00 UTC. Discovery covers the next 30 days.`} Imports save drafts unless you enable automatic publication. Organizer edits and publication choices are preserved.</p>
    <InlineError message={error} />
    <div className="grid gap-4 @min-[760px]:grid-cols-2">{data.sources.map((s) => <Panel key={s.provider} className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{providerLabels[s.provider]}</h3><Badge tone={s.enabled && s.configured ? "green" : "neutral"}>{!s.configured ? "Key needed" : s.enabled ? "Enabled" : "Paused"}</Badge></div>
      <dl className="space-y-2 text-xs leading-5 text-muted-foreground"><div className="flex flex-wrap justify-between gap-2"><dt>{s.provider === "luma" ? "Refreshes this month" : `Reserved searches (${data.month})`}</dt><dd className="tabular-nums">{s.provider === "luma" ? s.runs : `${s.reserved} / ${s.monthlyLimit} searches`}</dd></div><div><dt>Last successful import</dt><dd>{s.lastSuccessAt ? eventTimeLabel(s.lastSuccessAt) : "No successful imports yet"}</dd></div></dl>
      {s.stale ? <p className="text-xs text-[#806832]">Source data is stale. Review recent runs and refresh when available.</p> : null}
      <p className="text-xs leading-5 text-muted-foreground">{s.provider === "luma" ? "Up to 50 events from a public city or community iCal feed, with cover images from public event pages when available. No API key needed; pricing and approval are not confirmed by this feed." : "Two startup-event searches per run. Result pagination is disabled."}</p>
      <div className="flex flex-wrap gap-2"><ActionButton appearance="secondary" disabled={preview} onClick={() => setSettings(s)}><Settings2 className="size-4" aria-hidden />Configure source</ActionButton><ActionButton appearance="secondary" busy={busy === s.provider} disabled={preview || !s.enabled || !s.configured || !!s.activeRunId} onClick={() => refresh(s.provider)}><RefreshCw className="size-4" aria-hidden />{s.activeRunId ? "Import running" : "Refresh source"}</ActionButton></div>
    </Panel>)}</div>
    <Panel className="flex flex-wrap items-start justify-between gap-4 p-5"><div className="min-w-0 flex-1 basis-64"><h3 className="font-medium">YC directory CSV</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">Import up to 50 company records with original YC links. New entries stay as drafts for review.</p><p className="mt-2 text-xs leading-6 text-muted-foreground">Product Hunt links can be added through Add opportunity. API ingestion is deferred.</p></div><ActionButton appearance="secondary" onClick={() => setCsvOpen(true)} disabled={preview}><FileUp className="size-4" aria-hidden />Import YC CSV</ActionButton></Panel>
    <Panel className="overflow-hidden"><div className="p-5"><h3 className="font-medium">Recent import runs</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">Luma refreshes use a public calendar feed. SerpApi search reservations include failed attempts and are retained for the month; they are separate from your provider account balance.</p></div>{data.runs.length ? <ul className="[&>li:nth-child(odd)]:bg-soft/70">{data.runs.map((r) => <li key={r._id} className="space-y-2 p-5"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-medium">{providerLabels[r.provider]}</p><Badge tone={r.status === "succeeded" ? "green" : r.status === "failed" ? "gold" : "neutral"}>{r.status}</Badge></div><p className="text-xs leading-6 text-muted-foreground">{eventTimeLabel(r.startedAt)} · {r.trigger} · {r.added} added · {r.updated} updated · {r.skipped} skipped</p>{r.error ? <p className="text-xs leading-6 text-red-700 wrap-anywhere">{r.error}</p> : null}</li>)}</ul> : <p className="p-5 text-sm leading-6 text-muted-foreground">No imports yet. Configure a source, then refresh it or upload a YC CSV.</p>}</Panel>
    {settings ? <SourceSettings source={settings} onClose={() => setSettings(null)} onSave={async (s) => { await onConfigure?.(s); setSettings(null); }} /> : null}
    {csvOpen ? <CsvImport onClose={() => setCsvOpen(false)} onImport={async (csv) => { const result = await onCsv?.(csv); toast.success(`${result?.added ?? 0} YC drafts added; ${result?.updated ?? 0} source records updated; ${result?.skipped ?? 0} unchanged.`); setCsvOpen(false); }} /> : null}
  </div>;
}
function SourceSettings({ source, onClose, onSave }: { source: Source; onClose: () => void; onSave: NonNullable<Parameters<typeof ImportsView>[0]["onConfigure"]> }) {
  const formId = useId();
  const [enabled, setEnabled] = useState(source.enabled); const [publish, setPublish] = useState(source.autoPublish);
  const [limit, setLimit] = useState(source.monthlyLimit ?? 200);
  const [feedUrl, setFeedUrl] = useState(source.feedUrl ?? DEFAULT_LUMA_FEED_URL);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(null); try { await onSave({ provider: source.provider, enabled, autoPublish: publish, ...(source.provider === "luma" ? { feedUrl } : { monthlyLimit: limit }) }); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } }
  return <OpportunityModal title={`Configure ${providerLabels[source.provider]}`} busy={busy} onClose={onClose} footer={<DialogFormActions formId={formId} onClose={onClose} busy={busy} error={error} label="Save source settings" />}><form id={formId} onSubmit={submit} className="space-y-5">
    <p className="text-sm leading-6 text-muted-foreground">{source.provider === "luma" ? "Use San Francisco’s city feed or paste a public Luma calendar subscription link. Both https:// and webcal:// subscription links are accepted." : source.configured ? "Provider key is configured on the backend." : "Set SERPAPI_API_KEY in the Convex environment. Keys are never entered in this form."}</p>
    <ChoiceField label="Import source" value={enabled ? "enabled" : "paused"} options={[{ value: "paused", label: "Paused" }, { value: "enabled", label: "Enabled", disabled: !source.configured }]} onChange={(v) => setEnabled(v === "enabled")} />
    {source.provider === "luma" ? <div className="space-y-3"><Field label="Luma iCal subscription URL" required value={feedUrl} onChange={(e) => setFeedUrl(e.target.value)} maxLength={2000} /><ActionButton appearance="secondary" onClick={() => setFeedUrl(DEFAULT_LUMA_FEED_URL)}>Use San Francisco city feed</ActionButton><p className="text-xs leading-6 text-muted-foreground">On a public Luma city or calendar page, choose Add iCal Subscription → Copy URL to Clipboard. City feeds include events across categories. All-day events keep their calendar dates; no meeting time is inferred.</p></div> : <Field label="Monthly allowance (searches, maximum 200)" type="number" required min={2} max={200} step={1} value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))} />}
    <ChoiceField label="New event publication" value={publish ? "publish" : "draft"} options={[{ value: "draft", label: "Save drafts for review" }, { value: "publish", label: "Publish automatically" }]} onChange={(v) => setPublish(v === "publish")} />
    <p className="text-xs leading-6 text-muted-foreground">Luma can be refreshed again as soon as its current import finishes, with no hourly limit or provider allowance. Google Events manual refreshes are limited to once per hour. SerpApi manual and scheduled imports share the search limit; usage outside Philoxenia is separate.</p>
  </form></OpportunityModal>;
}
function CsvImport({ onClose, onImport }: { onClose: () => void; onImport: (csv: string) => Promise<void> }) {
  const formId = useId();
  const [csv, setCsv] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(null); try { await onImport(csv); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } }
  return <OpportunityModal title="Import YC directory CSV" size="large" busy={busy} onClose={onClose} footer={<DialogFormActions formId={formId} onClose={onClose} busy={busy} error={error} disabled={!csv.trim()} label="Import directory drafts" />}><form id={formId} onSubmit={submit} className="space-y-5"><p className="text-sm leading-6 text-muted-foreground">Use the template, or paste CSV with these headers. Separate interests with |. Area must be sf, bay-area, or online.</p><a className="inline-flex min-h-11 items-center text-sm text-forest underline underline-offset-4" href="/templates/yc-opportunities.csv" download>Download CSV template</a><Field label="Choose a CSV file" type="file" accept=".csv,text/csv" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 200_000) { setError("Use a CSV smaller than 200 KB."); return; } try { setCsv(await file.text()); setError(null); } catch { setError("Unable to read the CSV. Paste its contents below."); } }} /><TextareaField label="CSV contents" required rows={8} maxLength={200_000} value={csv} onChange={(e) => setCsv(e.target.value)} className="font-mono text-xs leading-6" placeholder="title,summary,description,sourceUrl,interests,area,location" /><p className="text-xs leading-6 text-muted-foreground">All rows are validated before saving. Existing company links update their source record while preserving your edits.</p></form></OpportunityModal>;
}
