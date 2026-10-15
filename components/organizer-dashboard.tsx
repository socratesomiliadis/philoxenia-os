"use client";

import { useId, useState, type ComponentProps, type FormEvent } from "react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Edit3, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useWorkspace, type Cohort } from "./workspace-context";
import { CheckboxField, TextareaField, ActionButton, Badge, ChoiceField, Field, PageHeading, Panel, errorMessage } from "./ui";
import { CohortRoster } from "./organizer-workspace";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { navigateOrganizer, useOrganizerSection, type OrganizerSection } from "./organizer-navigation";
import { OrganizerMission } from "./organizer-mission";
import { OpportunityManager } from "./opportunity-manager";
import { OpportunityImports } from "./opportunity-imports";
import { OrganizerSprint } from "./organizer-sprint";
import { SprintDashboard } from "./sprint-dashboard";
import { SprintModal } from "./sprint-editors";
import { dateRangeLabel, sprintDates } from "@/lib/cohort-dates";
import { DialogFormActions, WorkspaceDialog } from "./workspace-dialog";
import { OpenDoors } from "./open-doors";
import { CohortReport, PilotOperations } from "./cohort-report";
import { DeliveryManager } from "./workspace-inbox";
import { OrganizerPanel } from "./organizer-panel";
import { McpConnections } from "./mcp-connections";

type Roster = FunctionReturnType<typeof api.cohorts.roster>;
type CohortInput = { name: string; description: string; startDate: string; status: Cohort["status"] };

export function OrganizerDashboard() {
  const { preview, viewer } = useWorkspace();
  if (!preview && !viewer?.isOrganizer) return <Panel className="mx-auto max-w-lg p-10"><ShieldCheck className="mb-5 size-7 text-gold" aria-hidden /><h1 className="text-3xl font-medium tracking-tight text-foreground">Organizer access required</h1><p className="mt-4 text-sm leading-7 text-muted-foreground">The Command Center is reserved for Philoxenia organizers.</p></Panel>;
  return preview ? <PreviewOrganizer /> : <ConnectedOrganizer />;
}

function PreviewOrganizer() {
  const { cohorts } = useWorkspace();
  return <OrganizerView preview cohorts={cohorts} selected={cohorts[0]} roster={{ participants: [], invitations: [] }} />;
}

function ConnectedOrganizer() {
  const { cohorts } = useWorkspace();
  const [selectedId, setSelectedId] = useState<Id<"cohorts"> | null>(null);
  const selected = cohorts.find((cohort) => cohort._id === selectedId) ?? cohorts.find((cohort) => cohort.status === "active") ?? cohorts.find((cohort) => cohort.status === "upcoming") ?? cohorts[0];
  const roster = useQuery(api.cohorts.roster, selected ? { cohortId: selected._id } : "skip");
  const create = useMutation(api.cohorts.create);
  const update = useMutation(api.cohorts.update);
  const invite = useMutation(api.invitations.invite);
  const revoke = useMutation(api.invitations.revoke);
  const updateMembership = useMutation(api.cohorts.updateMembership);
  const deleteUser = useMutation(api.users.deleteUser);
  const graduate = useMutation(api.openDoors.graduate);

  return <OrganizerView cohorts={cohorts} selected={selected} roster={roster ?? { participants: [], invitations: [] }} rosterLoading={Boolean(selected && !roster)}
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
  rosterLoading?: boolean;
  onSelect?: (id: Id<"cohorts">) => void;
  onCreate?: (input: CohortInput) => Promise<void>;
  onUpdate?: (input: CohortInput) => Promise<void>;
  onInvite?: (email: string, name: string) => Promise<void>;
  onRevokeInvite?: (id: Id<"invitations">) => Promise<void>;
  onDeleteUser?: (profileId: Id<"profiles">, confirmationEmail: string) => Promise<void>;
  onGraduate?: (profileId: Id<"profiles">) => Promise<void>;
  onMembership?: (id: Id<"memberships">, status: "active" | "revoked", startDateOverride: string | undefined, suspended: boolean) => Promise<void>;
};

function OrganizerView({ preview = false, cohorts, selected, roster, rosterLoading = false, onSelect, onCreate, onUpdate, onInvite, onRevokeInvite, onMembership, onDeleteUser, onGraduate }: OrganizerViewProps) {
  const location = useOrganizerSection();
  const section = location === "participants" ? "cohorts" : location === "imports" ? "opportunities" : location;
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
    catch (error) { toast.error(errorMessage(error)); }
    finally { setBusyId(null); }
  }

  async function copySignIn() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/sign-in`); toast.success("Sign-in link copied", { description: "Share it with your invited Hustlers." }); }
    catch { toast.error("Could not copy the link. Share your app’s /sign-in address instead."); }
  }

  async function graduateParticipant(participant: Roster["participants"][number]) {
    if (!participant.profile || !onGraduate) return;
    setBusyId(participant._id);
    try { await onGraduate(participant.profile._id); toast.success("Participant graduated to alumni", { description: "Their cohort history is preserved. They can now offer support in Open Doors." }); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setBusyId(null); }
  }

  return <div className="@container"><div className="space-y-6 @min-[640px]:space-y-8">
    <PageHeading title="Command Center" action={section === "cohorts" ? <ActionButton appearance="secondary" onClick={() => setEditor("create")} disabled={preview} aria-label="New cohort" className="size-11 px-0 @min-[640px]:w-auto @min-[640px]:px-4"><Plus className="size-4" aria-hidden /><span className="hidden @min-[640px]:inline">New cohort</span></ActionButton> : undefined} />
    <Tabs value={section} onValueChange={(value) => navigateOrganizer(value as OrganizerSection)} className="min-w-0 gap-6">
      <TabsList aria-label="Command Center sections" activateOnFocus={false} className="grid h-auto! w-full grid-cols-2 gap-1 rounded-xl bg-soft p-1 @min-[640px]:inline-flex @min-[640px]:w-fit">
        {[{ value: "cohorts", label: "Cohorts" }, { value: "opportunities", label: "Opportunities" }, { value: "open-doors", label: "Open Doors" }, { value: "settings", label: "Settings" }].map(({ value, label }) => <TabsTrigger key={value} value={value} className="min-h-10 rounded-lg px-4 py-2 text-muted-foreground transition-colors focus-visible:outline-none! data-active:bg-white data-active:text-forest group-data-[variant=default]/tabs-list:data-active:shadow-control dark:data-active:bg-white dark:data-active:text-forest">{label}</TabsTrigger>)}
      </TabsList>
      <OrganizerPanel active={section === "cohorts"} value="cohorts" className="min-w-0 space-y-6">
        {selected ? <>
          <section aria-label="Selected cohort" className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1 basis-64 space-y-2">
              <div className="flex flex-wrap items-center gap-3">{cohorts.length > 1 ? <div className="min-w-0 max-w-xs flex-1"><ChoiceField compact label="Choose your cohort" value={selected._id} options={cohorts.map((cohort) => ({ value: cohort._id, label: cohort.name }))} onChange={(id) => { setSearch(""); onSelect?.(id as Id<"cohorts">); }} /></div> : <h2 className="text-xl font-medium tracking-tight wrap-anywhere">{selected.name}</h2>}<Badge tone={selected.status === "active" ? "green" : "neutral"}>{selected.status === "active" ? "In progress" : selected.status === "upcoming" ? "Upcoming" : "Completed"}</Badge></div>
              <p className="text-xs leading-5 tabular-nums text-muted-foreground">{dateRangeLabel(selected.startDate, selected.endDate)} · San Francisco time</p>
            </div>
            <div className="flex flex-wrap gap-2"><ActionButton appearance="secondary" onClick={() => setEditor("edit")} disabled={preview}><Edit3 className="size-3.5" aria-hidden />Edit cohort</ActionButton><OrganizerSprint cohort={selected} compact /></div>
          </section>
          <Tabs value={location === "participants" ? "participants" : "cohorts"} onValueChange={(value) => navigateOrganizer(value as OrganizerSection)} className="min-w-0 gap-5">
            <TabsList variant="line" aria-label="Cohort views" activateOnFocus={false} className="h-auto! w-full justify-start gap-5 p-0">
              <TabsTrigger value="cohorts" className="min-h-11 flex-none px-1 py-3 transition-colors focus-visible:outline-none! data-active:text-forest dark:data-active:text-forest after:bg-forest after:bottom-0!">Overview</TabsTrigger>
              <TabsTrigger value="participants" className="min-h-11 flex-none gap-2 px-1 py-3 transition-colors focus-visible:outline-none! data-active:text-forest dark:data-active:text-forest after:bg-forest after:bottom-0!">Participants{!rosterLoading ? <span className="text-xs tabular-nums text-muted-foreground">{roster.participants.length + roster.invitations.filter((invite) => invite.status === "pending").length}</span> : null}</TabsTrigger>
            </TabsList>
            <OrganizerPanel active={location === "cohorts"} value="cohorts"><CohortReport key={`report-${selected._id}`} cohort={selected} onShowParticipants={() => navigateOrganizer("participants")} /></OrganizerPanel>
            <OrganizerPanel active={location === "participants"} value="participants">{rosterLoading ? <p role="status" className="py-8 text-sm text-muted-foreground">Loading participants…</p> : <CohortRoster key={selected._id} roster={roster} preview={preview} completed={selected.status === "completed"} busyId={busyId} search={search} onSearch={setSearch} onInvite={() => setInviteOpen(true)} onCopy={() => void copySignIn()} onManage={setManaging} onMission={setMissionParticipant} onSprint={setSprintParticipant} onRevoke={(id) => void revokeInvitation(id)} onGraduate={(participant) => void graduateParticipant(participant)} />}</OrganizerPanel>
          </Tabs>
        </> : <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl surface-card p-6 text-center"><h2 className="text-xl font-medium tracking-tight">No cohorts yet</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Create a cohort, then invite your Hustlers.</p><ActionButton className="mt-5" disabled={preview} onClick={() => setEditor("create")}>Create cohort</ActionButton></section>}
      </OrganizerPanel>
      <OrganizerPanel active={section === "opportunities"} value="opportunities" className="min-w-0">
        <Tabs value={location === "imports" ? "imports" : "opportunities"} onValueChange={(value) => navigateOrganizer(value as OrganizerSection)} className="min-w-0 gap-5">
          <TabsList variant="line" aria-label="Opportunity management" activateOnFocus={false} className="h-auto! w-full justify-start gap-5 p-0">{[{ value: "opportunities", label: "Listings" }, { value: "imports", label: "Imports" }].map(({ value, label }) => <TabsTrigger key={value} value={value} className="min-h-11 flex-none px-1 py-3 transition-colors focus-visible:outline-none! data-active:text-forest dark:data-active:text-forest after:bg-forest after:bottom-0!">{label}</TabsTrigger>)}</TabsList>
          <OrganizerPanel active={location === "opportunities"} value="opportunities"><OpportunityManager /></OrganizerPanel>
          <OrganizerPanel active={location === "imports"} value="imports"><OpportunityImports expanded /></OrganizerPanel>
        </Tabs>
      </OrganizerPanel>
      <OrganizerPanel active={section === "open-doors"} value="open-doors"><OpenDoors organizer /></OrganizerPanel>
      <OrganizerPanel active={section === "settings"} value="settings" className="space-y-6">{preview ? <Panel className="p-6"><h2 className="text-xl font-medium">System status</h2><p className="mt-2 text-sm text-muted-foreground">Sign in as an organizer to review configuration and email delivery.</p></Panel> : <><McpConnections /><PilotOperations /><DeliveryManager /></>}</OrganizerPanel>
    </Tabs>
    {deleting?.profile && onDeleteUser ? <DeleteUserDialog name={deleting.profile.name} email={deleting.profile.email} onClose={() => setDeleting(null)} onDelete={async (confirmationEmail) => {
      await onDeleteUser(deleting.profile!._id, confirmationEmail);
      toast.success("User deleted", { description: `${deleting.profile!.email} was removed from all cohorts. You can invite this email again to start fresh.`, duration: 7000 });
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

function EditorModal(props: Omit<ComponentProps<typeof WorkspaceDialog>, "closeLabel" | "bodyClassName">) {
  return <WorkspaceDialog closeLabel="Close organizer dialog" bodyClassName="@container/editor" {...props} />;
}

function CohortEditor({ cohort, onClose, onSave }: { cohort?: Cohort; onClose: () => void; onSave: (input: CohortInput) => Promise<void> }) {
  const formId = useId();
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
  return <EditorModal title={cohort ? "Edit cohort" : "Create cohort"} busy={busy} onClose={onClose} footer={<DialogFormActions formId={formId} onClose={onClose} busy={busy} error={error} label={cohort ? "Save changes" : "Create cohort"} />}><form id={formId} onSubmit={submit} className="space-y-5"><Field label="Cohort name" placeholder="Winter 2026 · Cohort 01" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} /><Field label="Arrival date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /><p className="-mt-2 text-xs text-muted-foreground">{range}</p><TextareaField label="A few words about this cohort" labelClassName="text-forest" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Two weeks for founders building their next idea." />{cohort ? <ChoiceField label="Status" value={status} options={[{ value: "upcoming", label: "Upcoming" }, { value: "active", label: "Active" }, { value: "completed", label: "Completed" }]} onChange={(value) => setStatus(value as Cohort["status"])} /> : null}</form></EditorModal>;
}

function InviteEditor({ cohortName, onClose, onSave }: { cohortName: string; onClose: () => void; onSave: (email: string, name: string) => Promise<void> }) {
  const formId = useId();
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await onSave(email, name); } catch (error) { setError(errorMessage(error)); setBusy(false); }
  }
  return <EditorModal title="Invite a Hustler" size="compact" busy={busy} onClose={onClose} footer={<DialogFormActions formId={formId} onClose={onClose} busy={busy} error={error} label="Save invitation" />}><form id={formId} onSubmit={submit} className="space-y-5"><p className="text-sm leading-6 text-muted-foreground">Invite them to {cohortName}. They can use Google or email and password with the email address you enter here.</p><Field label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" /><Field label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></form></EditorModal>;
}

function MembershipEditor({ participant, cohort, canSuspend, onClose, onSave, onDelete }: { participant: Roster["participants"][number]; cohort: Cohort; canSuspend: boolean; onDelete?: () => void; onClose: () => void; onSave: (status: "active" | "revoked", override: string | undefined, suspended: boolean) => Promise<void> }) {
  const formId = useId();
  const [status, setStatus] = useState(participant.status);
  const [override, setOverride] = useState(participant.startDateOverride ?? "");
  const [suspended, setSuspended] = useState(participant.profile?.suspended ?? false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await onSave(status, override || undefined, suspended); }
    catch (error) { setError(errorMessage(error)); setBusy(false); }
  }
  return <EditorModal title="Participant access & dates" busy={busy} onClose={onClose} footer={<DialogFormActions formId={formId} onClose={onClose} busy={busy} error={error} label="Save changes" />}><form id={formId} onSubmit={submit} className="space-y-5"><p className="text-xs text-muted-foreground">{participant.profile?.name} · {participant.profile?.email}</p><ChoiceField label="Cohort access" value={status} options={[{ value: "active", label: "Active" }, { value: "revoked", label: "Revoked" }]} onChange={(value) => setStatus(value as "active" | "revoked")} /><Field label="Individual arrival date (optional)" type="date" value={override} onChange={(e) => setOverride(e.target.value)} /><p className="text-sm leading-6 text-muted-foreground">Leave blank to follow the cohort: {dateRangeLabel(cohort.startDate, cohort.endDate)}. An override always creates a 14-day stay.</p>{canSuspend ? <CheckboxField checked={suspended} onCheckedChange={setSuspended} className="rounded-xl bg-soft p-4" description="Blocks this account across every cohort until you restore access." contentClassName="items-start gap-3">Suspend all workspace access</CheckboxField> : null}</form>{onDelete ? <div className="mt-6 pt-5"><h3 className="text-sm font-medium">Delete user</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">Permanently remove this account, all cohort memberships, and mission data. You can invite the email again afterward.</p><Button variant="ghost" disabled={busy} onClick={onDelete} className="mt-3 min-h-11 px-2 text-sm text-red-700"><Trash2 className="size-4" aria-hidden />Delete user</Button></div> : null}</EditorModal>;
}

function DeleteUserDialog({ name, email, onClose, onDelete }: { name: string; email: string; onClose: () => void; onDelete: (confirmationEmail: string) => Promise<void> }) {
  const formId = useId();
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await onDelete(confirmationEmail); }
    catch (failure) { setError(errorMessage(failure)); setBusy(false); }
  }
  return <EditorModal title={`Delete ${name || email}?`} size="compact" busy={busy} onClose={onClose} footer={<DialogFormActions formId={formId} onClose={onClose} busy={busy} error={error} label="Delete user permanently" danger disabled={confirmationEmail.trim().toLowerCase() !== email.toLowerCase()} />}><form id={formId} onSubmit={submit} className="space-y-5"><p className="text-sm leading-7 wrap-anywhere text-muted-foreground">Permanently delete <strong className="font-medium text-foreground">{email}</strong> from Philoxenia OS. This removes their sign-in account, active sessions, invitations, memberships across all cohorts, onboarding answers, and missions. This cannot be undone.</p><p className="text-sm leading-6 text-muted-foreground">You can invite this email again. Their next sign-in will start fresh with onboarding.</p><Field label="Type the email to confirm" type="email" autoComplete="off" autoFocus value={confirmationEmail} onChange={(event) => setConfirmationEmail(event.target.value)} required /></form></EditorModal>;
}
