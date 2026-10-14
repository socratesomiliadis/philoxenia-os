"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Button, Label, TextArea, TextField } from "@heroui/react";
import { ArrowLeft, ArrowRight, Check, MapPin, RefreshCw, Sparkles, Target } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { answersSchema, emptyAnswers, industries, templateGoals, validateGoals, type MissionGoal, type OnboardingAnswers } from "@/lib/mission";
import { dateRangeLabel } from "@/lib/cohort-dates";
import { useWorkspace, type Cohort } from "./workspace-context";
import { ActionButton, Badge, Field, IconTile, InlineError, LoadingState, PageHeading, Panel, TextLink, errorMessage } from "./ui";
import { MissionGoals } from "./mission-goals";

type Suggestion = { goals: MissionGoal[]; revision: number; source: "ai" | "template"; fallbackReason?: "unconfigured" | "unavailable" | "requested" };
type EditorProps = {
  cohort: Cohort; initial: Doc<"onboarding"> | null; preview?: boolean;
  onSave: (answers: OnboardingAnswers, step: number) => Promise<number>;
  onSuggest: (templates: boolean) => Promise<Suggestion>;
  onSaveGoals: (goals: MissionGoal[], revision: number, confirm: boolean) => Promise<number>;
};
const steps = [
  { label: "Your project", title: "What are you building?", description: "A startup, a side project, or an idea you’re still exploring. Start where you are.", field: "building" as const, placeholder: "I’m building a tool that helps small teams understand customer feedback…" },
  { label: "Your ambitions", title: "What would make SF worthwhile?", description: "Think about the feedback, connections, or learning you want to bring home.", field: "outcomes" as const, placeholder: "I want to test my idea with potential users and learn how founders found their first customers…" },
  { label: "Your interests", title: "Which worlds interest you?", description: "Choose up to eight industries you’d like to explore.", field: "industries" as const },
  { label: "Your contribution", title: "What can you offer others?", description: "A skill, a fresh perspective, or time to help. Everyone has something to share.", field: "offering" as const, placeholder: "I can review a landing page, help with a React prototype, or give product feedback…" },
];

export function Onboarding() {
  const { preview, cohorts: allCohorts, viewer } = useWorkspace();
  const cohorts = preview ? allCohorts : allCohorts.filter((cohort) => viewer?.participantCohortIds.includes(cohort._id));
  const [selected, setSelected] = useState<string>();
  const cohort = cohorts.find((c) => c._id === selected) ?? cohorts.find((c) => c.status === "active") ?? cohorts.find((c) => c.status === "upcoming") ?? cohorts[0];
  if (preview) return <OnboardingPreview cohort={cohort} />;
  if (!cohort && viewer?.isOrganizer) return <><PageHeading title="Personal missions" description="Each Hustler sets three goals for their stay." /><Panel className="space-y-4 p-7"><p className="text-sm leading-7 text-muted">Open a Hustler’s mission from the cohort roster in the Command Center.</p><TextLink href="/organizer">Open the Command Center</TextLink></Panel></>;
  if (!cohort) return <><PageHeading title="Your personal mission" description="Three goals for your two weeks in San Francisco." /><Panel className="space-y-4 p-7"><h2 className="text-xl font-medium">Your cohort comes first.</h2><p className="text-sm text-muted">Ask your organizer to assign a cohort and confirm your stay dates before setting your mission.</p><TextLink href="/">Return home</TextLink></Panel></>;
  return <>{cohorts.length > 1 ? <div className="mb-6 max-w-md"><label htmlFor="mission-cohort" className="mb-2 block text-sm font-medium">Choose your cohort</label><select id="mission-cohort" value={cohort._id} onChange={(event) => setSelected(event.target.value)} className="min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm">{cohorts.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></div> : null}<ConnectedOnboarding key={cohort._id} cohort={cohort} /></>;
}

function ConnectedOnboarding({ cohort }: { cohort: Cohort }) {
  const data = useQuery(api.onboarding.get, { cohortId: cohort._id });
  const save = useMutation(api.onboarding.saveDraft);
  const suggest = useAction(api.missions.generate);
  const templates = useMutation(api.onboarding.useTemplates);
  const saveGoals = useMutation(api.onboarding.saveProposal);
  const onSave = useCallback((answers: OnboardingAnswers, step: number) => save({ cohortId: cohort._id, answers, step }), [save, cohort._id]);
  const onSuggest = useCallback((useTemplates: boolean) => useTemplates ? templates({ cohortId: cohort._id }) : suggest({ cohortId: cohort._id }), [templates, suggest, cohort._id]);
  const onSaveGoals = useCallback((goals: MissionGoal[], expectedRevision: number, confirm: boolean) => saveGoals({ cohortId: cohort._id, goals, expectedRevision, confirm }), [saveGoals, cohort._id]);

  if (data === undefined) return <LoadingState label="Loading your mission…" />;
  return <MissionEditor cohort={cohort} initial={data} onSave={onSave} onSuggest={onSuggest} onSaveGoals={onSaveGoals} />;
}

export function OnboardingPreview({ cohort }: { cohort: Cohort }) {
  const answersRef = useRef(emptyAnswers);
  const revision = useRef(0);
  const onSave = useCallback(async (answers: OnboardingAnswers) => { answersRef.current = answers; return ++revision.current; }, []);
  const onSuggest = useCallback(async (): Promise<Suggestion> => ({ goals: templateGoals(answersRef.current, cohort.startDate, cohort.endDate), revision: ++revision.current, source: "template", fallbackReason: "requested" }), [cohort.startDate, cohort.endDate]);
  const onSaveGoals = useCallback(async () => ++revision.current, []);
  return <MissionEditor cohort={cohort} initial={null} preview onSave={onSave} onSuggest={onSuggest} onSaveGoals={onSaveGoals} />;
}

function MissionEditor({ cohort, initial, preview, onSave, onSuggest, onSaveGoals }: EditorProps) {
  const router = useRouter();
  const [step, setStep] = useState(initial?.step ?? 0);
  const [goals, setGoals] = useState<MissionGoal[]>(initial?.proposal ?? initial?.confirmedGoals ?? []);
  const [confirmed, setConfirmed] = useState(initial?.confirmedGoals);
  const [reviewing, setReviewing] = useState(!initial?.confirmedGoals);
  const [source, setSource] = useState(initial?.source);
  const [reason, setReason] = useState(initial?.fallbackReason);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(preview ? "Sample answers stay in this tab." : "Changes save as you go.");
  const [error, setError] = useState<string | null>(null);
  const revision = useRef(initial?.revision ?? 0);
  const queue = useRef(Promise.resolve());
  const heading = useRef<HTMLHeadingElement>(null);
  const { control, getValues, setValue } = useForm<OnboardingAnswers>({ defaultValues: initial?.answers ?? emptyAnswers });
  const values = useWatch({ control });
  const snapshot = JSON.stringify(values);
  const lastSaved = useRef(JSON.stringify({ answers: initial?.answers ?? emptyAnswers, step: initial?.step ?? 0 }));

  const persist = useCallback((answers: OnboardingAnswers, currentStep: number) => {
    const serialized = JSON.stringify({ answers, step: currentStep });
    const operation = queue.current.then(async () => {
      if (serialized === lastSaved.current) return;
      setStatus("Saving…");
      revision.current = await onSave(answers, currentStep);
      lastSaved.current = serialized;
      setStatus(preview ? "Sample answers stay in this tab." : "Draft saved.");
    });
    queue.current = operation.catch(() => {});
    return operation;
  }, [onSave, preview]);

  useEffect(() => {
    if (busy) return;
    const timeout = setTimeout(() => {
      persist(getValues(), step).catch(() => { setStatus("Draft not saved."); setError("Could not save your answers. Check your connection and use Save draft to retry."); });
    }, 800);
    return () => clearTimeout(timeout);
  }, [snapshot, step, busy, getValues, persist]);

  async function navigate(next: number) {
    setError(null);
    const answers = getValues();
    if (next > step && step < 4) {
      const field = steps[step].field;
      const result = answersSchema.shape[field].safeParse(answers[field]);
      if (!result.success) { setError(result.error.issues[0].message); return; }
    }
    setBusy(true);
    try { await persist(answers, next); setStep(next); requestAnimationFrame(() => heading.current?.focus()); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }

  async function generate(templates: boolean) {
    setError(null);
    const parsed = answersSchema.safeParse(getValues());
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true);
    setStatus(templates ? "Preparing template goals…" : "Creating your three goals…");
    try {
      await persist(getValues(), 4);
      const result = await onSuggest(templates);
      revision.current = result.revision;
      setGoals(result.goals); setSource(result.source); setReason(result.fallbackReason);
      setStep(4); setReviewing(true); setStatus(preview ? "Sample goals · Changes stay in this tab." : "Suggestions saved. Make them yours.");
      requestAnimationFrame(() => heading.current?.focus());
    } catch (failure) { setError(errorMessage(failure)); setStatus("Your saved goals are unchanged."); }
    finally { setBusy(false); }
  }

  async function saveGoals(confirm: boolean) {
    setError(null); setBusy(true);
    try {
      const valid = validateGoals(goals, cohort.startDate, cohort.endDate);
      await persist(getValues(), 4);
      revision.current = await onSaveGoals(valid, revision.current, confirm);
      setStatus(preview ? "Sample mission · Nothing saved to your account." : confirm ? "Mission confirmed." : "Goal draft saved.");
      if (confirm) { setConfirmed(valid); setReviewing(false); }
    } catch (failure) { setError(failure instanceof Error && failure.name === "ZodError" ? "Give each goal a title, a target from 1 to 100, a measure, a valid deadline, and one to three first actions." : errorMessage(failure)); }
    finally { setBusy(false); }
  }

  function editGoal(index: number, patch: Partial<MissionGoal>) { setGoals((current) => current.map((goal, i) => i === index ? { ...goal, ...patch } : goal)); setStatus("Goal edits not saved yet."); }

  return <div className="space-y-6">
    <PageHeading title="Your personal mission" description="A little reflection. Three clear goals. Two weeks to make them happen." action={<ActionButton appearance="secondary" isDisabled={busy} onPress={() => { void persist(getValues(), step).then(() => router.push(preview ? "/preview" : "/")).catch((failure) => setError(errorMessage(failure))); }}>Return home</ActionButton>} />
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-5">
        {confirmed && !reviewing ? <Panel className="space-y-6 p-6 sm:p-8"><div className="flex flex-wrap items-center gap-3"><IconTile icon={Target} tone="green" /><h2 ref={heading} tabIndex={-1} className="text-2xl font-medium tracking-tight outline-none">Your mission is set.</h2><Badge tone="green">{preview ? "Sample confirmation" : "Confirmed"}</Badge></div><MissionGoals goals={confirmed} />{confirmed.map((goal, i) => <div key={i}><h3 className="text-sm font-medium">First steps · {goal.title}</h3><ul className="mt-2 list-disc space-y-1 ps-5 text-sm leading-6 wrap-anywhere text-muted">{goal.firstActions.map((action, j) => <li key={j}>{action}</li>)}</ul></div>)}<div className="flex flex-wrap gap-3"><ActionButton appearance="secondary" onPress={() => { setStep(4); setReviewing(true); }}>Edit your mission</ActionButton><TextLink href={preview ? "/preview" : "/"}>Return home</TextLink></div></Panel> : <>
          <ol aria-label="Onboarding progress" className="grid grid-cols-4 gap-2">{steps.map((item, index) => <li key={item.label} aria-current={step === index ? "step" : undefined}><div className={`h-1 rounded-full ${index <= step ? "bg-forest" : "bg-soft"}`} /><p className={`mt-2 text-xs leading-5 ${index === step ? "font-medium text-forest" : "text-muted"}`}><span className="tabular-nums">{index + 1}</span><span className="hidden sm:inline"> · {item.label}</span></p></li>)}</ol>
          {step < 4 ? <Panel className="p-6 sm:p-8"><form onSubmit={(event) => { event.preventDefault(); void navigate(step + 1); }}>
            <h2 ref={heading} tabIndex={-1} className="text-2xl font-medium tracking-tight outline-none">{steps[step].title}</h2><p className="mt-3 max-w-xl text-sm leading-7 text-muted">{steps[step].description}</p>
            <fieldset disabled={busy} className="mt-7 min-w-0 border-0 p-0"><legend className="sr-only">{steps[step].title}</legend>
              {step === 2 ? <div className="flex flex-wrap gap-2">{industries.map((industry) => { const selected = values.industries?.includes(industry); return <Button key={industry} aria-pressed={selected} isDisabled={!selected && (values.industries?.length ?? 0) >= 8} onPress={() => { const current = getValues("industries"); setValue("industries", selected ? current.filter((item) => item !== industry) : [...current, industry], { shouldDirty: true }); }} className={`min-h-11 h-auto max-w-full justify-start gap-2 rounded-xl border px-3 py-2 text-start text-sm whitespace-normal ${selected ? "border-forest bg-sage text-forest" : "border-line bg-white text-muted"}`}>{selected ? <Check className="size-4 shrink-0" aria-hidden /> : null}{industry}</Button>; })}</div> : <Controller name={steps[step].field as "building" | "outcomes" | "offering"} control={control} render={({ field }) => <TextField key={field.name} name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} className="space-y-2"><Label className="text-sm font-medium">{steps[step].label}</Label><TextArea ref={field.ref} rows={6} maxLength={1200} placeholder={steps[step].placeholder} className="min-h-40 w-full resize-y rounded-xl border border-line bg-white p-4 text-sm leading-7 placeholder:text-muted/60 focus:border-forest focus:ring-2 focus:ring-forest/10" /><p className="text-xs text-muted">{step === 3 ? "At least 5 characters" : "At least 10 characters"} · Up to 1,200 characters</p></TextField>} />}
            </fieldset>
            <div className="mt-6"><InlineError message={error} /></div>
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">{step > 0 ? <ActionButton appearance="secondary" isDisabled={busy} onPress={() => void navigate(step - 1)}><ArrowLeft className="size-4" aria-hidden />Back</ActionButton> : <span />}<ActionButton type="submit" busy={busy}>Continue<ArrowRight className="size-4" aria-hidden /></ActionButton></div>
          </form></Panel> : <div className="space-y-4">
            <Panel className="space-y-4 p-6 sm:p-8"><h2 ref={heading} tabIndex={-1} className="text-2xl font-medium tracking-tight outline-none">{goals.length ? "Make these goals yours." : "Turn your answers into action."}</h2><p className="text-sm leading-7 text-muted">{confirmed ? "Your confirmed mission stays in place until you confirm a replacement." : "Review the targets, deadlines, and first steps before confirming your three goals."}</p>
              {reason ? <p className="rounded-xl bg-soft p-4 text-sm leading-6 text-muted">{reason === "unconfigured" ? "AI isn’t connected yet. These template goals are ready to edit." : reason === "unavailable" ? "AI couldn’t create your mission this time. Start with these editable template goals." : "These are template goals. Adapt them to your project and ambitions."}</p> : source === "ai" ? <Badge>AI suggestions · Review before confirming</Badge> : null}
              <p className="text-xs leading-6 text-muted">Creating AI suggestions sends your project, ambitions, interests, offered skills, and stay dates to the configured AI provider. Keep private details out of your answers. You can use template goals instead.</p>
              <div className="flex flex-wrap gap-3"><ActionButton appearance={goals.length ? "secondary" : "primary"} busy={busy} onPress={() => void generate(false)}>{goals.length ? <RefreshCw className="size-4" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}{goals.length ? "Suggest new goals" : "Create my mission"}</ActionButton><ActionButton appearance="secondary" isDisabled={busy} onPress={() => void generate(true)}>Use template goals</ActionButton><ActionButton appearance="secondary" isDisabled={busy} onPress={() => void navigate(0)}>Edit answers</ActionButton></div>
            </Panel>
            {goals.map((goal, index) => <Panel key={index} className="p-6 sm:p-8"><fieldset disabled={busy} className="min-w-0 space-y-5"><legend className="mb-5 text-base font-medium text-forest">Goal {index + 1}</legend>
              <Field label={`Goal ${index + 1} title`} value={goal.title} maxLength={100} onChange={(event) => editGoal(index, { title: event.target.value })} />
              <div className="grid gap-4 sm:grid-cols-[100px_minmax(0,1fr)]"><Field label={`Goal ${index + 1} target`} type="number" min={1} max={100} value={String(goal.target)} onChange={(event) => editGoal(index, { target: Number(event.target.value) })} /><Field label={`Goal ${index + 1} measure`} value={goal.metric} maxLength={160} onChange={(event) => editGoal(index, { metric: event.target.value })} /></div>
              <Field label={`Goal ${index + 1} deadline`} type="date" min={cohort.startDate} max={cohort.endDate} value={goal.deadline} onChange={(event) => editGoal(index, { deadline: event.target.value })} />
              <TextField className="space-y-2"><Label className="text-sm font-medium">Goal {index + 1} first actions</Label><TextArea rows={3} maxLength={722} value={goal.firstActions.join("\n")} onChange={(event) => editGoal(index, { firstActions: event.target.value.split("\n") })} className="w-full resize-y rounded-xl border border-line bg-white p-3 text-sm leading-7 focus:border-forest focus:ring-2 focus:ring-forest/10" /><p className="text-xs text-muted">One to three actions, each on its own line. Up to 240 characters per action.</p></TextField>
            </fieldset></Panel>)}
            <InlineError message={error} />
            {goals.length === 3 ? <div className="flex flex-wrap gap-3"><ActionButton busy={busy} onPress={() => void saveGoals(true)}><Check className="size-4" aria-hidden />{confirmed ? "Confirm replacement mission" : "Confirm my mission"}</ActionButton><ActionButton appearance="secondary" isDisabled={busy} onPress={() => void saveGoals(false)}>Save goal draft</ActionButton>{confirmed ? <ActionButton appearance="secondary" isDisabled={busy} onPress={() => setReviewing(false)}>View confirmed mission</ActionButton> : null}</div> : null}
          </div>}
        </>}
        <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-xs leading-6 text-muted">{status}</p>{step < 4 && reviewing ? <ActionButton appearance="secondary" isDisabled={busy} onPress={() => { setError(null); void persist(getValues(), step).catch((failure) => setError(errorMessage(failure))); }}>Save draft</ActionButton> : null}</div>
      </div>
      <aside className="space-y-4 xl:sticky xl:top-24"><Panel className="space-y-5 p-6"><IconTile icon={MapPin} tone="green" /><h2 className="text-base font-medium">Your two weeks</h2><p className="text-sm leading-6 wrap-anywhere text-muted">{cohort.name}</p><p className="text-sm font-medium tabular-nums">{dateRangeLabel(cohort.startDate, cohort.endDate)}</p><p className="text-xs text-muted">San Francisco · Pacific Time</p></Panel><p className="px-1 text-xs leading-6 text-muted">Your answers and mission are private to you and the organizers. {preview ? "This sample never calls the AI provider or saves account data." : "You can return here to adjust your mission."}</p></aside>
    </div>
  </div>;
}
