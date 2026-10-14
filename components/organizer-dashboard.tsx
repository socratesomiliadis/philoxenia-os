"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button, Modal, TextArea, TextField, Label } from "@heroui/react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CalendarDays, Check, Copy, Edit3, Mail, Plus, Search, Settings2, ShieldCheck, Trash2, UsersRound, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useWorkspace, type Cohort } from "./workspace-context";
import { ActionButton, Badge, Field, InlineError, LoadingState, PageHeading, Panel, errorMessage } from "./ui";
import { OrganizerMission } from "./organizer-mission";
import { dateRangeLabel, sprintDates } from "@/lib/cohort-dates";

type Roster = FunctionReturnType<typeof api.cohorts.roster>;
type CohortInput = { name: string; description: string; startDate: string; status: Cohort["status"] };
type Notice = { message: string; error?: boolean } | null;

export function OrganizerDashboard() {
  const { preview, viewer } = useWorkspace();
  if (!preview && !viewer?.isOrganizer) return <Panel className="mx-auto max-w-lg p-10"><ShieldCheck className="mb-5 size-7 text-gold" aria-hidden /><h1 className="text-3xl font-medium tracking-tight text-foreground">Organizer access required</h1><p className="mt-4 text-sm leading-7 text-muted">The Command Center is reserved for Philoxenia organizers.</p></Panel>;
  return preview ? <PreviewOrganizer /> : <ConnectedOrganizer />;
}

function PreviewOrganizer() {
  const { cohorts } = useWorkspace();
  return <OrganizerView preview cohorts={cohorts} selected={cohorts[0]} roster={{ participants: [], invitations: [] }} overview={{ cohorts: 1, participants: 0, pendingInvitations: 0 }} />;
}

function ConnectedOrganizer() {
  const { cohorts } = useWorkspace();
  const [selectedId, setSelectedId] = useState<Id<"cohorts"> | null>(null);
  const selected = cohorts.find((cohort) => cohort._id === selectedId) ?? cohorts[0];
  const roster = useQuery(api.cohorts.roster, selected ? { cohortId: selected._id } : "skip");
  const overview = useQuery(api.cohorts.overview);
  const create = useMutation(api.cohorts.create);
  const update = useMutation(api.cohorts.update);
  const invite = useMutation(api.invitations.invite);
  const revoke = useMutation(api.invitations.revoke);
  const updateMembership = useMutation(api.cohorts.updateMembership);
  const deleteUser = useMutation(api.users.deleteUser);

  if (!overview || (selected && !roster)) return <LoadingState label="Opening the Command Center…" />;
  return <OrganizerView cohorts={cohorts} selected={selected} roster={roster ?? { participants: [], invitations: [] }} overview={overview}
    onSelect={setSelectedId}
    onCreate={async ({ name, description, startDate }) => { const id = await create({ name, description, startDate }); setSelectedId(id); }}
    onUpdate={async (input) => { if (selected) await update({ cohortId: selected._id, ...input }); }}
    onInvite={async (email, name) => { if (selected) await invite({ cohortId: selected._id, email, name }); }}
    onRevokeInvite={async (invitationId) => { await revoke({ invitationId }); }}
    onDeleteUser={async (profileId, confirmationEmail) => { await deleteUser({ profileId, confirmationEmail }); }}
    onMembership={async (membershipId, status, startDateOverride, suspended) => { await updateMembership({ membershipId, status, startDateOverride, suspended }); }} />;
}

type OrganizerViewProps = {
  preview?: boolean;
  cohorts: Cohort[];
  selected?: Cohort;
  roster: Roster;
  overview: { cohorts: number; participants: number; pendingInvitations: number };
  onSelect?: (id: Id<"cohorts">) => void;
  onCreate?: (input: CohortInput) => Promise<void>;
  onUpdate?: (input: CohortInput) => Promise<void>;
  onInvite?: (email: string, name: string) => Promise<void>;
  onRevokeInvite?: (id: Id<"invitations">) => Promise<void>;
  onDeleteUser?: (profileId: Id<"profiles">, confirmationEmail: string) => Promise<void>;
  onMembership?: (id: Id<"memberships">, status: "active" | "revoked", startDateOverride: string | undefined, suspended: boolean) => Promise<void>;
};

function OrganizerView({ preview = false, cohorts, selected, roster, overview, onSelect, onCreate, onUpdate, onInvite, onRevokeInvite, onMembership, onDeleteUser }: OrganizerViewProps) {
  const [editor, setEditor] = useState<"create" | "edit" | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [managing, setManaging] = useState<Roster["participants"][number] | null>(null);
  const [deleting, setDeleting] = useState<Roster["participants"][number] | null>(null);
  const [search, setSearch] = useState("");
  const [missionParticipant, setMissionParticipant] = useState<Roster["participants"][number] | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { viewer } = useWorkspace();
  const searchTerm = search.toLowerCase().trim();
  const participants = roster.participants.filter((p) => `${p.profile?.name} ${p.profile?.email}`.toLowerCase().includes(searchTerm));
  const invitations = roster.invitations.filter((i) => `${i.name} ${i.email}`.toLowerCase().includes(searchTerm));

  async function revokeInvitation(id: Id<"invitations">) {
    setBusyId(id); setNotice(null);
    try { await onRevokeInvite?.(id); setNotice({ message: "Invitation revoked. This email can no longer join through this invitation." }); }
    catch (error) { setNotice({ message: errorMessage(error), error: true }); }
    finally { setBusyId(null); }
  }

  async function copySignIn() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/sign-in`); setNotice({ message: "Sign-in link copied. Share it with invited Hustlers; they must use their approved Google account." }); }
    catch { setNotice({ message: "Could not copy the link. Share your app’s /sign-in address instead.", error: true }); }
  }

  return <div className="space-y-7">
    <PageHeading title="Organizer Command Center" description="Manage cohorts, invitations, and participant access." action={<ActionButton onPress={() => setEditor("create")} isDisabled={preview}><Plus className="size-4" aria-hidden />New cohort</ActionButton>} />
    {notice ? <div role={notice.error ? "alert" : "status"} className={`flex items-start justify-between gap-3 rounded-xl p-4 text-xs leading-6 ${notice.error ? "bg-red-50 text-red-800" : "bg-forest/5 text-forest"}`}><span>{notice.message}</span><button aria-label="Dismiss message" onClick={() => setNotice(null)}><X className="size-4" /></button></div> : null}
    <div className="grid gap-3 sm:grid-cols-3">{[{ icon: CalendarDays, value: overview.cohorts, label: "Cohorts", detail: "Across your workspace" }, { icon: UsersRound, value: overview.participants, label: "Hustlers", detail: "With active cohort access" }, { icon: Mail, value: overview.pendingInvitations, label: "Pending invitations", detail: "Waiting to join" }].map(({ icon: Icon, value, label, detail }) => <Panel key={label} className="p-6"><div className="mb-4 flex items-center justify-between"><p className="text-sm font-medium text-muted">{label}</p><Icon className="size-4 text-muted" aria-hidden /></div><p className="text-3xl font-medium tracking-tight text-foreground">{value}</p><p className="mt-2 text-xs text-muted">{detail}</p></Panel>)}</div>
    <div className="grid items-start gap-3 xl:grid-cols-[260px_minmax(0,1fr)]">
      <Panel className="overflow-hidden"><div className="border-b border-line px-5 py-5"><h2 className="text-sm font-medium text-foreground">Your cohorts</h2></div><div className="p-2">{cohorts.length ? cohorts.map((cohort) => <button key={cohort._id} onClick={() => onSelect?.(cohort._id)} aria-pressed={selected?._id === cohort._id} className={`w-full rounded-xl px-4 py-4 text-start transition-colors ${selected?._id === cohort._id ? "bg-soft" : "hover:bg-canvas"}`}><div className="flex items-center justify-between gap-2"><CalendarDays className="size-4 text-forest" aria-hidden /><Badge tone={cohort.status === "active" ? "green" : "neutral"}>{cohort.status}</Badge></div><p className="mt-3 text-xs font-medium leading-5 text-forest">{cohort.name}</p><p className="mt-1.5 text-xs leading-5 text-muted">{dateRangeLabel(cohort.startDate, cohort.endDate)}</p></button>) : <p className="p-4 text-sm leading-6 text-muted">Create your first cohort to get started.</p>}</div></Panel>
      <div className="min-w-0 space-y-3">{selected ? <><Panel className="p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-3 flex items-center gap-2"><Badge tone={selected.status === "active" ? "green" : "gold"}>{selected.status}</Badge>{preview ? <Badge>Sample cohort</Badge> : null}</div><h2 className="text-2xl font-medium tracking-tight text-foreground">{selected.name}</h2><p className="mt-2 text-sm leading-6 text-muted">{selected.description || "A 14-day stay in San Francisco."}</p></div><Button variant="secondary" onPress={() => setEditor("edit")} isDisabled={preview} className="rounded-xl text-xs"><Edit3 className="size-3.5" aria-hidden />Edit cohort</Button></div><div className="mt-5 flex flex-wrap gap-4 border-t border-line pt-4 text-xs text-muted"><span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" aria-hidden />{dateRangeLabel(selected.startDate, selected.endDate)}</span><span>14 days · America/Los_Angeles</span><span>{roster.participants.filter((p) => p.status === "active").length} Hustlers</span></div></Panel>
        <Panel className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-5"><div><h2 className="text-base font-medium text-foreground">Participants and invitations</h2><p className="mt-1.5 text-xs text-muted">Invitations and participant access</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onPress={copySignIn} isDisabled={preview} className="rounded-xl text-xs"><Copy className="size-3.5" aria-hidden />Copy sign-in link</Button><ActionButton onPress={() => setInviteOpen(true)} isDisabled={preview || selected.status === "completed"} className="min-h-9 px-3 text-xs"><Plus className="size-3.5" aria-hidden />Invite Hustler</ActionButton></div></div>
          <div className="px-6 pt-5"><label className="flex items-center gap-2 rounded-xl bg-soft px-3"><Search className="size-4 text-muted" aria-hidden /><input aria-label="Search participants and invitations" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" className="min-h-11 min-w-0 w-full rounded-sm bg-transparent text-sm text-foreground" /></label></div>
          {participants.length || invitations.length ? <div className="overflow-x-auto p-6"><table className="w-full min-w-[420px] text-start text-sm"><thead><tr className="border-b border-line text-xs text-muted"><th className="pb-3 font-medium">Hustler</th><th className="pb-3 font-medium">Status</th><th className="pb-3 text-end font-medium">Manage</th></tr></thead><tbody>{participants.map((participant) => <tr key={participant._id} className="border-b border-line last:border-0"><td className="py-4"><p className="font-medium text-forest">{participant.profile?.name ?? "Unavailable account"}</p><p className="mt-1 text-xs text-muted">{participant.profile?.email}</p>{participant.startDateOverride ? <p className="mt-1 text-xs text-[#806832]">Individual stay: {dateRangeLabel(participant.startDateOverride, participant.endDateOverride!)}</p> : null}</td><td className="py-4"><Badge tone={participant.profile?.suspended || participant.status === "revoked" ? "neutral" : "green"}>{participant.profile?.suspended ? "Suspended" : participant.status === "active" ? "Joined" : "Access revoked"}</Badge></td><td className="py-4 text-right"><Button variant="ghost" aria-label={`View mission for ${participant.profile?.name ?? "participant"}`} isDisabled={!participant.profile || preview} onPress={() => setMissionParticipant(participant)} className="text-xs text-forest">View mission</Button><Button isIconOnly variant="ghost" aria-label={`Manage ${participant.profile?.name ?? "participant"}`} onPress={() => setManaging(participant)} className="min-w-0"><Settings2 className="size-4 text-muted" /></Button></td></tr>)}{invitations.map((invitation) => <tr key={invitation._id} className="border-b border-line last:border-0"><td className="py-4"><p className="font-medium text-forest">{invitation.name || invitation.email}</p>{invitation.name ? <p className="mt-1 text-xs text-muted">{invitation.email}</p> : null}</td><td className="py-4"><Badge tone={invitation.status === "pending" ? "gold" : "neutral"}>{invitation.status === "pending" ? "Invited" : "Revoked"}</Badge></td><td className="py-4 text-right">{invitation.status === "pending" ? <Button variant="ghost" onPress={() => revokeInvitation(invitation._id)} isDisabled={busyId === invitation._id} className="text-xs text-muted">{busyId === invitation._id ? "Revoking…" : "Revoke invite"}</Button> : <span className="text-xs text-muted">Invite again to restore</span>}</td></tr>)}</tbody></table></div> : <div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center"><UsersRound className="mb-4 size-6 text-muted/50" aria-hidden /><h3 className="text-sm font-medium text-forest">{searchTerm ? "No matching Hustlers" : "No participants yet"}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted">{searchTerm ? "Try a different name or email." : "Invite a Hustler with their Google account email. They’ll join this cohort when they first sign in."}</p></div>}
        </Panel></> : <Panel className="flex min-h-96 flex-col items-center justify-center px-8 py-12 text-center"><CalendarDays className="mb-5 size-8 text-gold" strokeWidth={1.5} aria-hidden /><h2 className="text-3xl font-medium tracking-tight text-foreground">Create your first cohort</h2><p className="mt-4 max-w-sm text-sm leading-7 text-muted">Give your cohort a name and an arrival date. We’ll set up its 14-day stay in San Francisco.</p><ActionButton className="mt-7" onPress={() => setEditor("create")}><Plus className="size-4" aria-hidden />Create your first cohort</ActionButton></Panel>}</div>
    </div>
    <div className="flex items-center gap-3 rounded-2xl bg-sage/50 p-5"><ShieldCheck className="size-5 shrink-0 text-forest" aria-hidden /><p className="text-sm leading-6 text-muted">Only approved members can enter the workspace. Cohort access, invitations, and participant details are managed here.</p></div>
    {deleting?.profile && onDeleteUser ? <DeleteUserDialog name={deleting.profile.name} email={deleting.profile.email} onClose={() => setDeleting(null)} onDelete={async (confirmationEmail) => {
      await onDeleteUser(deleting.profile!._id, confirmationEmail);
      setNotice({ message: `${deleting.profile!.email} deleted from all cohorts. You can invite this email again to start fresh.` });
      if (missionParticipant?.profileId === deleting.profileId) setMissionParticipant(null);
      setDeleting(null);
    }} /> : null}
    {missionParticipant?.profile && selected ? <EditorModal title={`${missionParticipant.profile.name} mission`} onClose={() => setMissionParticipant(null)}><OrganizerMission cohortId={selected._id} profileId={missionParticipant.profile._id} /></EditorModal> : null}
    {editor ? <CohortEditor key={editor === "create" ? "new" : selected?._id} cohort={editor === "edit" ? selected : undefined} onClose={() => setEditor(null)} onSave={async (input) => { if (editor === "create") await onCreate?.(input); else await onUpdate?.(input); setNotice({ message: editor === "create" ? "Your cohort is ready. Invite your first Hustler." : "Cohort updated. Participants without date overrides follow these dates." }); setEditor(null); }} /> : null}
    {inviteOpen && selected ? <InviteEditor cohortName={selected.name} onClose={() => setInviteOpen(false)} onSave={async (email, name) => { await onInvite?.(email, name); setNotice({ message: "Invitation saved. Share the sign-in link with this Hustler; automatic invitation emails will be added with Open Doors." }); setInviteOpen(false); }} /> : null}
    {managing && selected ? <MembershipEditor participant={managing} cohort={selected} canSuspend={!managing.isOrganizer && managing.profile?.email !== viewer?.email} onDelete={!preview && !managing.isOrganizer && managing.profile && managing.profile.email !== viewer?.email ? () => { setManaging(null); setDeleting(managing); } : undefined} onClose={() => setManaging(null)} onSave={async (status, startDateOverride, suspended) => { await onMembership?.(managing._id, status, startDateOverride, suspended); setNotice({ message: "Participant access and stay dates updated." }); setManaging(null); }} /> : null}
  </div>;
}

function EditorModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <Modal isOpen onOpenChange={(open) => { if (!open) onClose(); }}><Modal.Backdrop><Modal.Container size="lg"><Modal.Dialog className="rounded-2xl bg-white p-7"><Modal.CloseTrigger /><Modal.Header className="mb-6"><Modal.Heading className="text-2xl font-medium tracking-tight text-foreground">{title}</Modal.Heading></Modal.Header><Modal.Body className="scrollbar-thin min-h-0 [--scrollbar-thumb:var(--foreground)] [--scrollbar-track:transparent]">{children}</Modal.Body></Modal.Dialog></Modal.Container></Modal.Backdrop></Modal>;
}

function CohortEditor({ cohort, onClose, onSave }: { cohort?: Cohort; onClose: () => void; onSave: (input: CohortInput) => Promise<void> }) {
  const [name, setName] = useState(cohort?.name ?? "");
  const [description, setDescription] = useState(cohort?.description ?? "");
  const [startDate, setStartDate] = useState(cohort?.startDate ?? "");
  const [status, setStatus] = useState<Cohort["status"]>(cohort?.status ?? "upcoming");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  let range = "Choose an arrival date. Departure is day 14.";
  try { if (startDate) { const dates = sprintDates(startDate); range = `${dateRangeLabel(dates.startDate, dates.endDate)} · Pacific Time`; } } catch { /* The server and native date input validate the date. */ }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await onSave({ name, description, startDate, status }); }
    catch (error) { setError(errorMessage(error)); setBusy(false); }
  }
  return <EditorModal title={cohort ? "Edit cohort" : "Create cohort"} onClose={onClose}><form onSubmit={submit} className="space-y-5"><Field label="Cohort name" placeholder="Winter 2026 · Cohort 01" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} /><Field label="Arrival date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /><p className="-mt-2 text-xs text-muted">{range}</p><TextField className="space-y-2"><Label className="text-sm font-medium text-forest">A few words about this cohort</Label><TextArea className="w-full rounded-xl border border-line bg-white p-3 text-sm" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Two weeks for founders building their next idea." /></TextField>{cohort ? <label className="block space-y-2 text-sm font-medium text-forest"><span>Status</span><select value={status} onChange={(e) => setStatus(e.target.value as Cohort["status"])} className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm"><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="completed">Completed</option></select></label> : null}<InlineError message={error} /><div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onPress={onClose} isDisabled={busy} className="rounded-xl">Cancel</Button><ActionButton type="submit" busy={busy}>{cohort ? "Save changes" : "Create cohort"}</ActionButton></div></form></EditorModal>;
}

function InviteEditor({ cohortName, onClose, onSave }: { cohortName: string; onClose: () => void; onSave: (email: string, name: string) => Promise<void> }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await onSave(email, name); } catch (error) { setError(errorMessage(error)); setBusy(false); }
  }
  return <EditorModal title="Invite a Hustler" onClose={onClose}><form onSubmit={submit} className="space-y-5"><p className="text-sm leading-6 text-muted">Invite them to {cohortName}. They must sign in with the Google email you enter here.</p><Field label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" /><Field label="Google account email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /><InlineError message={error} /><div className="flex justify-end gap-2"><Button variant="secondary" onPress={onClose} isDisabled={busy} className="rounded-xl">Cancel</Button><ActionButton type="submit" busy={busy}><Mail className="size-4" aria-hidden />Save invitation</ActionButton></div></form></EditorModal>;
}

function MembershipEditor({ participant, cohort, canSuspend, onClose, onSave, onDelete }: { participant: Roster["participants"][number]; cohort: Cohort; canSuspend: boolean; onDelete?: () => void; onClose: () => void; onSave: (status: "active" | "revoked", override: string | undefined, suspended: boolean) => Promise<void> }) {
  const [status, setStatus] = useState(participant.status);
  const [override, setOverride] = useState(participant.startDateOverride ?? "");
  const [suspended, setSuspended] = useState(participant.profile?.suspended ?? false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await onSave(status, override || undefined, suspended); }
    catch (error) { setError(errorMessage(error)); setBusy(false); }
  }
  return <EditorModal title="Participant access & dates" onClose={onClose}><form onSubmit={submit} className="space-y-5"><p className="text-xs text-muted">{participant.profile?.name} · {participant.profile?.email}</p><label className="block space-y-2 text-sm font-medium text-forest"><span>Cohort access</span><select value={status} onChange={(e) => setStatus(e.target.value as "active" | "revoked")} className="h-11 w-full rounded-xl border border-line bg-white px-3"><option value="active">Active</option><option value="revoked">Revoked</option></select></label><Field label="Individual arrival date (optional)" type="date" value={override} onChange={(e) => setOverride(e.target.value)} /><p className="text-sm leading-6 text-muted">Leave blank to follow the cohort: {dateRangeLabel(cohort.startDate, cohort.endDate)}. An override always creates a 14-day stay.</p>{canSuspend ? <label className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-4"><input type="checkbox" checked={suspended} onChange={(e) => setSuspended(e.target.checked)} className="mt-1 accent-forest" /><span><span className="block text-sm font-medium text-foreground">Suspend all workspace access</span><span className="mt-1 block text-xs leading-5 text-muted">Blocks this account across every cohort until restored.</span></span></label> : null}<InlineError message={error} /><div className="flex justify-end gap-2"><Button variant="secondary" onPress={onClose} isDisabled={busy} className="rounded-xl">Cancel</Button><ActionButton type="submit" busy={busy}><Check className="size-4" aria-hidden />Save changes</ActionButton></div></form>{onDelete ? <div className="mt-6 border-t border-line pt-5"><h3 className="text-sm font-medium">Delete user</h3><p className="mt-2 text-xs leading-6 text-muted">Permanently remove this account, all cohort memberships, and mission data. You can invite the email again afterward.</p><Button variant="ghost" isDisabled={busy} onPress={onDelete} className="mt-3 min-h-11 px-2 text-sm text-red-700"><Trash2 className="size-4" aria-hidden />Delete user</Button></div> : null}</EditorModal>;
}

function DeleteUserDialog({ name, email, onClose, onDelete }: { name: string; email: string; onClose: () => void; onDelete: (confirmationEmail: string) => Promise<void> }) {
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await onDelete(confirmationEmail); }
    catch (failure) { setError(errorMessage(failure)); setBusy(false); }
  }
  return <EditorModal title={`Delete ${name || email}?`} onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit} className="space-y-5"><p className="text-sm leading-7 wrap-anywhere text-muted">Permanently delete <strong className="font-medium text-foreground">{email}</strong> from Philoxenia OS. This removes their sign-in account, active sessions, invitations, memberships across all cohorts, onboarding answers, and missions. This cannot be undone.</p><p className="text-sm leading-6 text-muted">You can invite this email again. Their next sign-in will start fresh with onboarding.</p><Field label="Type the email to confirm" type="email" autoComplete="off" autoFocus value={confirmationEmail} onChange={(event) => setConfirmationEmail(event.target.value)} required /><InlineError message={error} /><div className="flex flex-wrap justify-end gap-3"><ActionButton appearance="secondary" onPress={onClose} isDisabled={busy}>Cancel</ActionButton><ActionButton type="submit" appearance="danger" busy={busy} isDisabled={confirmationEmail.trim().toLowerCase() !== email.toLowerCase()}><Trash2 className="size-4" aria-hidden />Delete user permanently</ActionButton></div></form></EditorModal>;
}
