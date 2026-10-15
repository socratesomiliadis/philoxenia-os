"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { Cable, Copy, KeyRound } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { READ_SCOPE, WRITE_SCOPE } from "@/lib/mcp-policy";
import { ActionButton, Badge, CheckboxField, ChoiceField, Field, InlineError, Panel, errorMessage } from "./ui";
import { toast } from "sonner";

export function McpConnections() {
  const data = useQuery(api.mcp.connections);
  const create = useMutation(api.mcp.createPersonalToken), revoke = useMutation(api.mcp.revokeConnection);
  const [name, setName] = useState("");
  const [write, setWrite] = useState(false);
  const [days, setDays] = useState("30");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); toast.success("Copied to clipboard."); }
    catch { setError("Could not copy. Select and copy the text manually."); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setToken(null);
    try { const result = await create({ name, days: Number(days), scopes: write ? [READ_SCOPE, WRITE_SCOPE] : [READ_SCOPE] }); setToken(result.token); setName(""); }
    catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  return <Panel className="space-y-6 p-5 sm:p-6">
    <div className="flex items-start gap-3"><Cable className="mt-1 size-5 shrink-0 text-forest" aria-hidden /><div><h2 className="text-xl font-medium tracking-tight">Connect your agent</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Manage Philoxenia through Claude, ChatGPT, Codex, or another MCP client. Add this server URL in your agent’s connectors and sign in with your organiser account.</p></div></div>
    {data ? <div className="flex flex-wrap items-center gap-3 rounded-xl surface-inset p-3"><code className="min-w-0 flex-1 text-xs wrap-anywhere">{data.resource}</code><ActionButton appearance="secondary" onClick={() => void copy(data.resource)}><Copy className="size-4" aria-hidden />Copy URL</ActionButton></div> : <p role="status" className="text-sm text-muted-foreground">Loading connections…</p>}
    <p className="text-sm leading-6 text-muted-foreground">You review access before connecting. Read access includes participant emails, missions, and private organiser notes. Write access allows invitations, access changes, publishing, request coordination, and shared activities. Permanent account deletion stays in Philoxenia.</p>
    <div className="pt-6"><h3 className="flex items-center gap-2 text-base font-medium"><KeyRound className="size-4 text-forest" aria-hidden />Personal access token</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">For clients that accept a bearer token. Create one per agent so you can revoke access separately.</p>
      <form onSubmit={submit} className="mt-4 space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Agent name" placeholder="My Codex workspace" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /><ChoiceField label="Expires after" value={days} onChange={setDays} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} /></div><CheckboxField checked={write} onCheckedChange={(checked) => setWrite(checked === true)} description="Allow this agent to make organiser changes in Philoxenia.">Allow write access</CheckboxField><ActionButton type="submit" busy={busy} disabled={!data}>Create token</ActionButton></form>
      {token ? <div role="status" className="mt-4 space-y-3 rounded-xl surface-inset p-4"><p className="text-sm font-medium">Copy your token now. It is shown only once.</p><code className="block select-all text-xs wrap-anywhere">{token}</code><div className="flex flex-wrap gap-2"><ActionButton appearance="secondary" onClick={() => void copy(token)}>Copy token</ActionButton><ActionButton appearance="secondary" onClick={() => setToken(null)}>Done</ActionButton></div></div> : null}
    </div>
    <InlineError message={error} />
    <div className="pt-6"><h3 className="text-base font-medium">Your connections</h3>{data?.connections.length ? <ul className="mt-3 space-y-2">{data.connections.map((connection) => <li key={connection._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl surface-inset p-4"><div className="min-w-0"><p className="text-sm font-medium wrap-anywhere">{connection.name}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{connection.kind === "oauth" ? "OAuth" : "Personal token"} · {connection.scopes.includes(WRITE_SCOPE) ? "Read and write" : "Read only"} · Expires {new Date(connection.refreshExpiresAt ?? connection.expiresAt).toLocaleDateString()}</p></div>{connection.revokedAt !== undefined ? <Badge>Revoked</Badge> : <ActionButton appearance="secondary" disabled={busy} onClick={async () => { setBusy(true); setError(null); try { await revoke({ credentialId: connection._id }); toast.success("Agent access revoked."); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); } }}>Revoke access</ActionButton>}</li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No agents connected yet.</p>}</div>
    {data?.audit.length ? <div className="pt-6"><h3 className="text-base font-medium">Recent agent activity</h3><ul className="mt-3 space-y-2">{data.audit.map((entry) => <li key={entry._id} className="flex flex-wrap justify-between gap-2 text-xs leading-5 text-muted-foreground"><code>{entry.tool}</code><time dateTime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleString()}</time></li>)}</ul></div> : null}
  </Panel>;
}
