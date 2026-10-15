"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button, Checkbox, Description, Modal, TextArea, TextField, Label, toast } from "@heroui/react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CalendarDays, Check, Edit3, Mail, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useWorkspace, type Cohort } from "./workspace-context";
import { ActionButton, Badge, ChoiceField, Field, InlineError, LoadingState, PageHeading, Panel, errorMessage } from "./ui";
import { CohortNavigation, CohortRoster, OrganizerOverview } from "./organizer-workspace";
import { OrganizerMission } from "./organizer-mission";
import { OpportunityManager } from "./opportunity-manager";
import { OpportunityImports } from "./opportunity-imports";
import { OrganizerSprint } from "./organizer-sprint";
import { SprintDashboard } from "./sprint-dashboard";
import { SprintModal } from "./sprint-editors";
import { dateRangeLabel, sprintDates } from "@/lib/cohort-dates";
import { useModalNotifications } from "./notification-context";
import { OpenDoors } from "./open-doors";
import { CohortReport, PilotOperations } from "./cohort-report";

type Roster = FunctionReturnType<typeof api.cohorts.roster>;
type CohortInput = { name: string; description: string; startDate: string; status: Cohort["status"] };

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
  const graduate = useMutation(api.openDoors.graduate);

  if (!overview || (selected && !roster)) return <LoadingState label="Opening the Command Center…" />;
  return <OrganizerView cohorts={cohorts} selected={selected} roster={roster ?? { participants: [], invitations: [] }} overview={overview}
    onSelect={setSelectedId}
    onCreate={async ({ name, description, startDate }) => { const id = await create({ name, description, startDate }); setSelectedId(id); }}
    onUpdate={async (input) => { if (selected) await update({ cohortId: selected._id, ...input }); }}
    onInvite={async (email, name) => { if (selected) await invite({ cohortId: selected._id, email, name }); }}
    onRevokeInvite={async (invitationId) => { await revoke({ invitationId }); }}
    onDeleteUser={async (profileId, confirmationEmail) => { await deleteUser({ profileId, confirmationEmail }); }}
    onGraduate={async (profileId) => { if (selected) await graduate({ profileId, cohortId: selected._id }); }}
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
  onGraduate?: (profileId: Id<"profiles">) => Promise<void>;
  onMembership?: (id: Id<"memberships">, status: "active" | "revoked", startDateOverride: string | undefined, suspended: boolean) => Promise<void>;
};

function OrganizerView({ preview = false, cohorts, selected, roster, overview, onSelect, onCreate, onUpdate, onInvite, onRevokeInvite, onMembership, onDeleteUser, onGraduate }: OrganizerViewProps) {
  const [editor, setEditor] = useState<"create" | "edit" | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [managing, setManaging] = useState<Roster["participants"][number] | null>(null);
  const [deleting, setDeleting] = useState<Roster["participants"][number] | null>(null);
  const [search, setSearch] = useState("");
  const [missionParticipant, setMissionParticipant] = useState<Roster["participants"][number] | null>(null);
  const [sprintParticipant, setSprintParticipant] = useState<Roster["participants"][number] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { viewer } = useWorkspace();

  async function revokeInvitation(id: Id<"invitations">) {
    setBusyId(id);
    try { await onRevokeInvite?.(id); toast.success("Invitation revoked", { description: "This email can no longer join through this invitation." }); }
    catch (error) { toast.danger(errorMessage(error)); }
    finally { setBusyId(null); }
  }

  async function copySignIn() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/sign-in`); toast.success("Sign-in link copied", { description: "Share it with your invited Hustlers." }); }
    catch { toast.danger("Could not copy the link. Share your app’s /sign-in address instead."); }
  }

  async function graduateParticipant(participant: Roster["participants"][number]) {
    if (!participant.profile || !onGraduate) return;
    setBusyId(participant._id);
    try { await onGraduate(participant.profile._id); toast.success("Participant graduated to alumni", { description: "Their cohort history is preserved. They can now offer support in Open Doors." }); }
    catch (error) { toast.danger(errorMessage(error)); }
    finally { setBusyId(null); }
  }

  return <div className="@container"><div className="space-y-6 @min-[640px]:space-y-8">
    <PageHeading title="Command Center" description="Bring your cohort together. Manage people, plans, and opportunities." action={<ActionButton appearance={cohorts.length ? "secondary" : "primary"} onPress={() => setEditor("create")} isDisabled={preview}><Plus className="size-4" aria-hidden />New cohort</ActionButton>} />
    <OrganizerOverview overview={overview} />
    <div className={`grid items-start gap-5 ${cohorts.length ? "@min-[900px]:grid-cols-[220px_minmax(0,1fr)] @min-[900px]:gap-7" : ""}`}>
      <CohortNavigation cohorts={cohorts} selected={selected} onSelect={onSelect} />
      <div className="min-w-0 space-y-5">{selected ? <>
        <section aria-label="Selected cohort" className="space-y-5 rounded-2xl border border-line bg-white p-5 @min-[640px]:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1 basis-48"><div className="mb-3 flex flex-wrap items-center gap-2"><Badge tone={selected.status === "active" ? "green" : "neutral"}>{selected.status === "active" ? "In progress" : selected.status === "upcoming" ? "Upcoming" : "Completed"}</Badge>{preview ? <Badge>Sample cohort</Badge> : null}</div><h2 className="text-2xl leading-8 font-medium tracking-tight text-foreground wrap-anywhere">{selected.name}</h2>{selected.description ? <p className="mt-2 max-w-xl text-sm leading-6 text-muted wrap-anywhere">{selected.description}</p> : null}</div><ActionButton appearance="secondary" onPress={() => setEditor("edit")} isDisabled={preview}><Edit3 className="size-3.5" aria-hidden />Edit cohort</ActionButton></div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3"><div className="space-y-1 text-xs leading-5 text-muted"><p className="flex items-start gap-1.5 tabular-nums"><CalendarDays className="mt-0.5 size-3.5 shrink-0" aria-hidden />{dateRangeLabel(selected.startDate, selected.endDate)}</p><p>14 days · San Francisco time</p></div><OrganizerSprint cohort={selected} compact /></div>
        </section>
        <CohortReport key={`report-${selected._id}`} cohort={selected} />
        <CohortRoster key={selected._id} roster={roster} preview={preview} completed={selected.status === "completed"} busyId={busyId} search={search} onSearch={setSearch} onInvite={() => setInviteOpen(true)} onCopy={() => void copySignIn()} onManage={setManaging} onMission={setMissionParticipant} onSprint={setSprintParticipant} onRevoke={(id) => void revokeInvitation(id)} onGraduate={(participant) => void graduateParticipant(participant)} />
      </> : <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-soft/50 p-6 text-center"><CalendarDays className="mb-4 size-7 text-forest" strokeWidth={1.6} aria-hidden /><h2 className="text-2xl font-medium tracking-tight text-foreground">Create your first cohort</h2><p className="mt-3 max-w-sm text-sm leading-6 text-muted">Choose a name and arrival date. We’ll set the departure date for a 14-day stay.</p><ActionButton className="mt-5" isDisabled={preview} onPress={() => setEditor("create")}><Plus className="size-4" aria-hidden />Create your first cohort</ActionButton></section>}</div>
    </div>
    <OpportunityManager />
    <OpportunityImports />
    <OpenDoors organizer />
    <PilotOperations />
    {deleting?.profile && onDeleteUser ? <DeleteUserDialog name={deleting.profile.name} email={deleting.profile.email} onClose={() => setDeleting(null)} onDelete={async (confirmationEmail) => {
      await onDeleteUser(deleting.profile!._id, confirmationEmail);
      toast.success("User deleted", { description: `${deleting.profile!.email} was removed from all cohorts. You can invite this email again to start fresh.`, timeout: 7000 });
      if (missionParticipant?.profileId === deleting.profileId) setMissionParticipant(null);
      if (sprintParticipant?.profileId === deleting.profileId) setSprintParticipant(null);
      setDeleting(null);
    }} /> : null}
    {missionParticipant?.profile && selected ? <EditorModal title={`${missionParticipant.profile.name} mission`} onClose={() => setMissionParticipant(null)}><OrganizerMission cohortId={selected._id} profileId={missionParticipant.profile._id} /></EditorModal> : null}
    {sprintParticipant?.profile && selected ? <SprintModal title={`${sprintParticipant.profile.name} Sprint`} wide onClose={() => setSprintParticipant(null)}><SprintDashboard cohortId={selected._id} profileId={sprintParticipant.profile._id} /></SprintModal> : null}
    {editor ? <CohortEditor key={editor === "create" ? "new" : selected?._id} cohort={editor === "edit" ? selected : undefined} onClose={() => setEditor(null)} onSave={async (input) => { if (editor === "create") await onCreate?.(input); else await onUpdate?.(input); toast.success(editor === "create" ? "Cohort created" : "Cohort updated", { description: editor === "create" ? "Invite your first Hustler to get started." : "Participants without individual stay dates follow the cohort dates." }); setEditor(null); }} /> : null}
    {inviteOpen && selected ? <InviteEditor cohortName={selected.name} onClose={() => setInviteOpen(false)} onSave={async (email, name) => { await onInvite?.(email, name); toast.success("Invitation saved", { description: "Share the sign-in link so this Hustler can join." }); setInviteOpen(false); }} /> : null}
    {managing && selected ? <MembershipEditor participant={managing} cohort={selected} canSuspend={!managing.isOrganizer && managing.profile?.email !== viewer?.email} onDelete={!preview && !managing.isOrganizer && managing.profile && managing.profile.email !== viewer?.email ? () => { setManaging(null); setDeleting(managing); } : undefined} onClose={() => setManaging(null)} onSave={async (status, startDateOverride, suspended) => { await onMembership?.(managing._id, status, startDateOverride, suspended); toast.success("Participant updated", { description: "Access and stay dates saved." }); setManaging(null); }} /> : null}
  </div></div>;
}

function EditorModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useModalNotifications();
  const headingId = useId();
  return <Modal isOpen onOpenChange={(open) => { if (!open) onClose(); }}><Modal.Backdrop><Modal.Container size="lg"><Modal.Dialog aria-label={title} className="rounded-2xl bg-white p-5 sm:p-7"><Modal.CloseTrigger aria-label="Close organizer dialog" /><Modal.Header className="mb-5 pe-8"><Modal.Heading id={headingId} className="text-2xl font-medium tracking-tight text-foreground wrap-anywhere">{title}</Modal.Heading></Modal.Header><Modal.Body className="@container/editor scrollbar-thin min-h-0 wrap-anywhere [--scrollbar-thumb:var(--foreground)] [--scrollbar-track:transparent]">{children}</Modal.Body></Modal.Dialog></Modal.Container></Modal.Backdrop></Modal>;
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
  return <EditorModal title={cohort ? "Edit cohort" : "Create cohort"} onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit} className="space-y-5"><Field label="Cohort name" placeholder="Winter 2026 · Cohort 01" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} /><Field label="Arrival date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /><p className="-mt-2 text-xs text-muted">{range}</p><TextField className="gap-2"><Label className="text-sm font-medium text-forest">A few words about this cohort</Label><TextArea className="w-full rounded-xl border border-line bg-white p-3 text-sm" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Two weeks for founders building their next idea." /></TextField>{cohort ? <ChoiceField label="Status" value={status} options={[{ value: "upcoming", label: "Upcoming" }, { value: "active", label: "Active" }, { value: "completed", label: "Completed" }]} onChange={(value) => setStatus(value as Cohort["status"])} /> : null}<InlineError message={error} /><div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onPress={onClose} isDisabled={busy} className="rounded-xl">Cancel</Button><ActionButton type="submit" busy={busy}>{cohort ? "Save changes" : "Create cohort"}</ActionButton></div></form></EditorModal>;
}

function InviteEditor({ cohortName, onClose, onSave }: { cohortName: string; onClose: () => void; onSave: (email: string, name: string) => Promise<void> }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await onSave(email, name); } catch (error) { setError(errorMessage(error)); setBusy(false); }
  }
  return <EditorModal title="Invite a Hustler" onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit} className="space-y-5"><p className="text-sm leading-6 text-muted">Invite them to {cohortName}. They must sign in with the Google email you enter here.</p><Field label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" /><Field label="Google account email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /><InlineError message={error} /><div className="flex justify-end gap-2"><Button variant="secondary" onPress={onClose} isDisabled={busy} className="rounded-xl">Cancel</Button><ActionButton type="submit" busy={busy}><Mail className="size-4" aria-hidden />Save invitation</ActionButton></div></form></EditorModal>;
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
  return <EditorModal title="Participant access & dates" onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit} className="space-y-5"><p className="text-xs text-muted">{participant.profile?.name} · {participant.profile?.email}</p><ChoiceField label="Cohort access" value={status} options={[{ value: "active", label: "Active" }, { value: "revoked", label: "Revoked" }]} onChange={(value) => setStatus(value as "active" | "revoked")} /><Field label="Individual arrival date (optional)" type="date" value={override} onChange={(e) => setOverride(e.target.value)} /><p className="text-sm leading-6 text-muted">Leave blank to follow the cohort: {dateRangeLabel(cohort.startDate, cohort.endDate)}. An override always creates a 14-day stay.</p>{canSuspend ? <Checkbox isSelected={suspended} onChange={setSuspended} className="rounded-xl border border-line bg-soft p-4"><Checkbox.Content className="items-start gap-3"><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control><Label className="text-sm font-medium text-foreground">Suspend all workspace access</Label></Checkbox.Content><Description className="mt-2 text-xs leading-5 text-muted">Blocks this account across every cohort until you restore access.</Description></Checkbox> : null}<InlineError message={error} /><div className="flex justify-end gap-2"><Button variant="secondary" onPress={onClose} isDisabled={busy} className="rounded-xl">Cancel</Button><ActionButton type="submit" busy={busy}><Check className="size-4" aria-hidden />Save changes</ActionButton></div></form>{onDelete ? <div className="mt-6 border-t border-line pt-5"><h3 className="text-sm font-medium">Delete user</h3><p className="mt-2 text-xs leading-6 text-muted">Permanently remove this account, all cohort memberships, and mission data. You can invite the email again afterward.</p><Button variant="ghost" isDisabled={busy} onPress={onDelete} className="mt-3 min-h-11 px-2 text-sm text-red-700"><Trash2 className="size-4" aria-hidden />Delete user</Button></div> : null}</EditorModal>;
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
