"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ShieldCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { WRITE_SCOPE } from "@/lib/mcp-policy";
import { useWorkspace } from "./workspace-context";
import { ActionButton, InlineError, Panel, errorMessage } from "./ui";

export function McpConsent({ input }: { input: Record<string, string | string[] | undefined> }) {
  const { viewer } = useWorkspace();
  if (!viewer?.isOrganizer) return <Panel className="mx-auto max-w-lg space-y-3 p-6"><h1 className="text-2xl font-medium">Organiser access required</h1><p className="text-sm text-muted-foreground">Sign in with an approved organiser account to connect your agent.</p></Panel>;
  return <ConsentForm input={input} />;
}
function ConsentForm({ input }: { input: Record<string, string | string[] | undefined> }) {
  const details = useQuery(api.mcp.consentDetails, { input });
  const authorize = useMutation(api.mcp.authorize);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  async function decide(accept: boolean) {
    setBusy(true); setError(null);
    try { window.location.assign(await authorize({ input, accept })); }
    catch (failure) { setError(errorMessage(failure)); setBusy(false); }
  }
  if (details?.valid === false) return <Panel className="mx-auto max-w-xl space-y-3 p-6"><h1 className="text-2xl font-medium">Invalid connection request</h1><p className="text-sm leading-6 text-muted-foreground">Return to your agent and start connecting again. This request has an unrecognised client, redirect address, resource, or permission.</p></Panel>;
  return <Panel className="mx-auto max-w-xl space-y-5 p-6 sm:p-8"><ShieldCheck className="size-7 text-forest" aria-hidden /><h1 className="text-2xl font-medium tracking-tight">Connect {details?.name ?? "your agent"} to Philoxenia?</h1><p className="text-sm leading-7 text-muted-foreground">This agent will act with your organiser access. Only connect an agent you recognise. The name below is supplied by the client.</p><div className="rounded-xl bg-soft p-4"><p className="text-sm font-medium wrap-anywhere">{details?.name ?? "Loading agent…"}</p><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground"><li>Read cohorts, participant emails, missions, private organiser notes, opportunities, and requests.</li>{details?.scopes.includes(WRITE_SCOPE) ? <li>Invite users, change participant access, publish opportunities, coordinate and complete requests, and manage shared activities.</li> : null}</ul></div><p className="text-sm leading-6 text-muted-foreground">You can revoke this connection in Command Center → Settings → Connect your agent. Access expires after 30 days.</p><InlineError message={error} /><div className="flex flex-wrap gap-3"><ActionButton busy={busy} disabled={!details} onClick={() => void decide(true)}>Allow access</ActionButton><ActionButton appearance="secondary" disabled={busy || !details} onClick={() => void decide(false)}>Cancel</ActionButton></div></Panel>;
}
