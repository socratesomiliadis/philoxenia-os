"use client";

import Image from "next/image";
import { useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Globe, Link2, MapPin } from "lucide-react";
import { profileSchema, socialLinksSchema, socialPlatforms, type CommunityInput } from "@/lib/open-doors";
import type { CommunityPerson } from "./community";
import { ActionButton, Badge, Field, Panel, TextareaField, errorMessage } from "./ui";
import { DialogFormActions, WorkspaceDialog } from "./workspace-dialog";

function CommunityAvatar({ person }: { person: CommunityPerson }) {
  const [failed, setFailed] = useState(false);
  return <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sage text-lg font-medium text-forest" aria-hidden>
    {person.image && !failed ? <Image src={person.image} alt="" width={48} height={48} unoptimized onError={() => setFailed(true)} className="size-full object-cover" /> : person.name.charAt(0).toUpperCase()}
  </span>;
}

function RoleBadge({ person }: { person: CommunityPerson }) {
  return <Badge tone={person.isOrganizer ? "gold" : "green"}>{person.isOrganizer ? "Organizer" : person.isAlumni ? "Alumnus" : "Hustler"}</Badge>;
}

function SocialLinks({ person }: { person: CommunityPerson }) {
  const links = socialPlatforms.flatMap((platform) => {
    const parsed = socialLinksSchema.shape[platform.key].safeParse(person.community?.socialLinks?.[platform.key]);
    return parsed.success && parsed.data ? [{ ...platform, url: parsed.data }] : [];
  });
  if (!links.length) return null;
  return <nav aria-label={`Connect with ${person.name}`} className="flex flex-wrap gap-2">{links.map(({ key, label, url }) => {
    const Icon = key === "website" ? Globe : Link2;
    return <a key={key} href={url} target="_blank" rel="noopener noreferrer" aria-label={`${person.name} on ${label} (opens in a new tab)`} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg surface-inset px-3 text-xs font-medium text-forest transition-colors hover:bg-sage focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"><Icon className="size-3.5" aria-hidden />{label}<ArrowUpRight className="size-3" aria-hidden /></a>;
  })}</nav>;
}

function Location({ value }: { value?: string }) {
  return value ? <p className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground"><MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /><span className="wrap-anywhere">{value}</span></p> : null;
}

function ProfileFacts({ profile }: { profile?: CommunityInput }) {
  const facts = [{ label: "Building", value: profile?.building }, { label: "Interests", value: profile?.interests }, { label: "Can offer", value: profile?.offering }].filter((item) => item.value);
  return facts.length ? <dl className="space-y-3 text-sm leading-6">{facts.map((item) => <div key={item.label}><dt className="text-xs font-medium text-foreground">{item.label}</dt><dd className="whitespace-pre-wrap wrap-anywhere text-muted-foreground">{item.value}</dd></div>)}</dl> : null;
}

function CohortHistory({ person }: { person: CommunityPerson }) {
  return person.cohorts.length ? <div className="space-y-1 pt-3">{person.cohorts.map((cohort, index) => <p key={`${cohort.name}:${index}`} className="text-xs leading-5 wrap-anywhere text-muted-foreground">{cohort.name} · {cohort.status}</p>)}</div> : null;
}

export function CommunityCard({ person, own, onOpen }: { person: CommunityPerson; own: boolean; onOpen: () => void }) {
  const profile = person.community;
  return <Panel className="flex flex-col gap-4 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><CommunityAvatar person={person} /><div className="flex flex-wrap items-center gap-2">{own ? <span className="text-xs text-muted-foreground">You</span> : null}<RoleBadge person={person} /></div></div>
    <div className="min-w-0 space-y-2"><h2 className="text-lg font-medium wrap-anywhere">{person.name}</h2>{profile?.headline ? <p className="text-sm leading-6 wrap-anywhere">{profile.headline}</p> : null}<Location value={profile?.location} /></div>
    {profile?.bio ? <p className="line-clamp-3 text-sm leading-6 whitespace-pre-wrap wrap-anywhere text-muted-foreground">{profile.bio}</p> : <p className="text-sm leading-6 text-muted-foreground">Part of the Philoxenia community.</p>}
    <ProfileFacts profile={profile} />
    <div className="mt-auto space-y-4"><SocialLinks person={person} /><CohortHistory person={person} /><ActionButton appearance="secondary" onClick={onOpen} aria-label={`View profile of ${person.name}`} className="w-full">View profile<ArrowUpRight className="size-4" aria-hidden /></ActionButton></div>
  </Panel>;
}

export function CommunityDetails({ person, onClose, onEdit }: { person?: CommunityPerson; onClose: () => void; onEdit?: () => void }) {
  if (!person) return <WorkspaceDialog title="Profile unavailable" onClose={onClose}><p>This member is no longer in the community. Close this profile to meet other members.</p></WorkspaceDialog>;
  return <WorkspaceDialog title={person.name} closeLabel="Close profile" onClose={onClose} footer={onEdit ? <ActionButton appearance="secondary" onClick={onEdit}>Edit your profile</ActionButton> : undefined}>
    <div className="space-y-6">
      <div className="flex items-center gap-3"><CommunityAvatar person={person} /><div className="min-w-0 space-y-2"><RoleBadge person={person} /><Location value={person.community?.location} /></div></div>
      {person.community?.headline ? <p className="text-base font-medium text-foreground">{person.community.headline}</p> : null}
      {person.community?.bio ? <section className="space-y-2"><h2 className="text-sm font-medium text-foreground">About</h2><p className="text-sm leading-7 whitespace-pre-wrap wrap-anywhere">{person.community.bio}</p></section> : <p className="text-sm leading-6">This member hasn’t added a bio yet.</p>}
      <ProfileFacts profile={person.community} /><SocialLinks person={person} /><CohortHistory person={person} />
    </div>
  </WorkspaceDialog>;
}

export function ProfileEditor({ input, onSave, onClose }: { input: CommunityInput; onSave: (input: CommunityInput) => Promise<void>; onClose: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState(input);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  function update<K extends keyof CommunityInput>(key: K, value: CommunityInput[K]) { setDraft((draft) => ({ ...draft, [key]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null); setErrors({});
    const parsed = profileSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join("."), issue.message])));
      const firstField = formRef.current?.elements.namedItem(parsed.error.issues[0].path.join("."));
      if (firstField instanceof HTMLElement) firstField.focus();
      return;
    }
    setBusy(true);
    try { await onSave(parsed.data); } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  return <WorkspaceDialog title="Your community profile" size="large" busy={busy} bodyClassName="@container/profile-editor" closeLabel="Close profile editor" onClose={onClose} footer={<DialogFormActions formId="community-profile-form" onClose={onClose} busy={busy} label="Save profile" error={error ?? Object.entries(errors).find(([path]) => !path.startsWith("socialLinks."))?.[1]} />}>
    <form ref={formRef} id="community-profile-form" onSubmit={submit} className="grid gap-8 @min-[680px]/profile-editor:grid-cols-2">
      <p className="text-sm leading-6 @min-[680px]/profile-editor:col-span-2">Share a little about yourself with approved members. All fields are optional. Your email, mission, and onboarding answers stay private.</p>
      <fieldset disabled={busy} className="min-w-0 space-y-4"><legend className="mb-3 text-sm font-medium text-foreground">Introduce yourself</legend>
        <Field name="headline" label="Headline" value={draft.headline ?? ""} maxLength={100} placeholder="Product designer building tools for small teams" onChange={(event) => update("headline", event.target.value)} />
        <Field name="location" label="Location" value={draft.location ?? ""} maxLength={100} placeholder="Athens, Greece" onChange={(event) => update("location", event.target.value)} />
        <TextareaField name="bio" label="Short bio" value={draft.bio} maxLength={1000} rows={3} description="A few sentences about you, beyond what you’re building." onChange={(event) => update("bio", event.target.value)} />
        <p className="text-end text-xs text-muted-foreground">{draft.bio.length}/1,000</p>
      </fieldset>
      <fieldset disabled={busy} className="min-w-0 space-y-4"><legend className="mb-3 text-sm font-medium text-foreground">Find common ground</legend>
        <Field name="building" label="What you’re building" value={draft.building} maxLength={200} placeholder="A prototype for independent developers" onChange={(event) => update("building", event.target.value)} />
        <Field name="interests" label="Interests" value={draft.interests} maxLength={300} placeholder="Design, climate tech, hiking" onChange={(event) => update("interests", event.target.value)} />
        <TextareaField name="offering" label="Skills and support you can offer" value={draft.offering} maxLength={500} rows={3} onChange={(event) => update("offering", event.target.value)} />
      </fieldset>
      <fieldset disabled={busy} className="min-w-0 space-y-4 @min-[680px]/profile-editor:col-span-2"><legend className="mb-3 text-sm font-medium text-foreground">Keep in touch</legend>
        <p className="text-xs leading-5">Add full URLs starting with https://. Members can use these links to connect with you outside Philoxenia.</p>
        <div className="grid gap-4 @min-[680px]/profile-editor:grid-cols-2 @min-[880px]/profile-editor:grid-cols-3">
        {socialPlatforms.map(({ key, label, placeholder }) => <div key={key} className="space-y-2"><Field id={`community-link-${key}`} name={`socialLinks.${key}`} label={label} type="url" inputMode="url" autoCapitalize="none" spellCheck={false} value={draft.socialLinks?.[key] ?? ""} maxLength={2048} placeholder={placeholder} aria-invalid={Boolean(errors[`socialLinks.${key}`])} aria-describedby={errors[`socialLinks.${key}`] ? `community-link-${key}-error` : undefined} onChange={(event) => update("socialLinks", { ...draft.socialLinks, [key]: event.target.value })} />{errors[`socialLinks.${key}`] ? <p id={`community-link-${key}-error`} role="alert" className="text-xs leading-5 text-red-800">{errors[`socialLinks.${key}`]}</p> : null}</div>)}
        </div>
      </fieldset>
    </form>
  </WorkspaceDialog>;
}
