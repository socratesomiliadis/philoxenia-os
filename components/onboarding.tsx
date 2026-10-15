"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, LogOut, Target } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { answersSchema, emptyAnswers, goalSchema, industries, templateGoals, validateGoals, type MissionGoal, type OnboardingAnswers } from "@/lib/mission";
import { dateRangeLabel } from "@/lib/cohort-dates";
import { useWorkspace, type Cohort } from "./workspace-context";
import { CheckboxField, TextareaField, ActionButton, Badge, ChoiceField, IconTile, InlineError, LoadingState, TextLink, errorMessage } from "./ui";
import { MissionGoals } from "./mission-goals";
import { MissionReview } from "./mission-review";
import { EntryCard, EntryLayout } from "./entry-layout";
import { authClient } from "@/lib/auth-client";
import { HelpCheckin } from "./help-checkin";

type Suggestion = { goals: MissionGoal[]; revision: number; source: "ai" | "template"; fallbackReason?: "unconfigured" | "unavailable" | "requested" };
type EditorProps = {
  cohort: Cohort; initial: Doc<"onboarding"> | null; preview?: boolean; firstVisit?: boolean; accountName?: string; cohortPicker?: ReactNode;
  onSave: (answers: OnboardingAnswers, step: number) => Promise<number>;
  onSuggest: () => Promise<Suggestion>;
  onSaveGoals: (goals: MissionGoal[], revision: number, confirm: boolean) => Promise<number>;
};
const steps = [
  { label: "Your project", title: "What are you building?", description: "A startup, a side project, or an idea you’re still exploring. Start where you are.", field: "building" as const, placeholder: "A feedback tool for small game studios." },
  { label: "Your ambitions", title: "What would make SF worthwhile?", description: "Think about the feedback, connections, or learning you want to bring home.", field: "outcomes" as const, placeholder: "Meet three potential users and get feedback on my prototype." },
  { label: "Your interests", title: "What would you like to explore?", description: "Choose one to eight industries to help shape your recommendations.", field: "industries" as const },
  { label: "Your contribution", title: "What can you offer others?", description: "A skill, a fresh perspective, or time to help. Everyone has something to share.", field: "offering" as const, placeholder: "Product reviews, React prototypes, and landing page feedback." },
];

export function Onboarding() {
  const { preview, cohorts: allCohorts, viewer, requiredOnboardingCohortId } = useWorkspace();
  const cohorts = preview ? allCohorts : allCohorts.filter((cohort) => viewer?.participantCohortIds.includes(cohort._id));
  const [selected, setSelected] = useState<string>();
  const cohort = cohorts.find((c) => c._id === requiredOnboardingCohortId) ?? cohorts.find((c) => c._id === selected) ?? cohorts.find((c) => c.status === "active") ?? cohorts.find((c) => c.status === "upcoming") ?? cohorts[0];
  if (preview) return <OnboardingPreview cohort={cohort} />;
  if (!cohort) return <EntryLayout onboarding><EntryCard><h2 className="text-[28px] font-medium tracking-tight">{viewer?.isOrganizer ? "Personal missions" : "Your cohort comes first."}</h2><p className="mt-4 mb-6 text-sm leading-7 text-muted-foreground">{viewer?.isOrganizer ? "Open a Hustler’s mission from the cohort roster in the Command Center." : "Ask your organizer to assign a cohort and confirm your stay dates before setting your mission."}</p><TextLink href={viewer?.isOrganizer ? "/organizer" : "/"}>{viewer?.isOrganizer ? "Open the Command Center" : "Return home"}</TextLink></EntryCard></EntryLayout>;
  const cohortPicker = !requiredOnboardingCohortId && cohorts.length > 1 ? <div className="mb-5"><ChoiceField label="Choose your cohort" value={cohort._id} options={cohorts.map((item) => ({ value: item._id, label: item.name }))} onChange={setSelected} /></div> : null;
  return <ConnectedOnboarding key={cohort._id} cohort={cohort} firstVisit={Boolean(requiredOnboardingCohortId)} cohortPicker={cohortPicker} />;
}

function ConnectedOnboarding({ cohort, firstVisit, cohortPicker }: { cohort: Cohort; firstVisit: boolean; cohortPicker: ReactNode }) {
  const { viewer } = useWorkspace();
  const data = useQuery(api.onboarding.get, { cohortId: cohort._id });
  const save = useMutation(api.onboarding.saveDraft);
  const suggest = useAction(api.missions.generate);
  const saveGoals = useMutation(api.onboarding.saveProposal);
  const onSave = useCallback((answers: OnboardingAnswers, step: number) => save({ cohortId: cohort._id, answers, step }), [save, cohort._id]);
  const onSuggest = useCallback(() => suggest({ cohortId: cohort._id }), [suggest, cohort._id]);
  const onSaveGoals = useCallback((goals: MissionGoal[], expectedRevision: number, confirm: boolean) => saveGoals({ cohortId: cohort._id, goals, expectedRevision, confirm }), [saveGoals, cohort._id]);

  if (data === undefined) return <EntryLayout onboarding><LoadingState label="Loading your mission…" /></EntryLayout>;
  return <MissionEditor cohort={cohort} initial={data} firstVisit={firstVisit} cohortPicker={cohortPicker} accountName={viewer?.name} onSave={onSave} onSuggest={onSuggest} onSaveGoals={onSaveGoals} />;
}

export function OnboardingPreview({ cohort }: { cohort: Cohort }) {
  const answersRef = useRef(emptyAnswers);
  const revision = useRef(0);
  const onSave = useCallback(async (answers: OnboardingAnswers) => { answersRef.current = answers; return ++revision.current; }, []);
  const onSuggest = useCallback(async (): Promise<Suggestion> => ({ goals: templateGoals(answersRef.current, cohort.startDate, cohort.endDate), revision: ++revision.current, source: "template", fallbackReason: "requested" }), [cohort.startDate, cohort.endDate]);
  const onSaveGoals = useCallback(async () => ++revision.current, []);
  return <MissionEditor cohort={cohort} initial={null} preview onSave={onSave} onSuggest={onSuggest} onSaveGoals={onSaveGoals} />;
}

function MissionEditor({ cohort, initial, preview, firstVisit, accountName, cohortPicker, onSave, onSuggest, onSaveGoals }: EditorProps) {
  const router = useRouter();
  const [step, setStep] = useState(initial?.step ?? 0);
  const [goals, setGoals] = useState<MissionGoal[]>(initial?.proposal ?? initial?.confirmedGoals ?? []);
  const [confirmed, setConfirmed] = useState(initial?.confirmedGoals);
  const [reviewing, setReviewing] = useState(!initial?.confirmedGoals);
  const [expandedGoal, setExpandedGoal] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [goalsDirty, setGoalsDirty] = useState(false);
  const attemptedAutoGeneration = useRef(false);
  const [reason, setReason] = useState(initial?.fallbackReason);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);
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
      try {
        revision.current = await onSave(answers, currentStep);
        lastSaved.current = serialized;
        setSaveError(false);
      } catch (failure) { setSaveError(true); throw failure; }
    });
    queue.current = operation.catch(() => {});
    return operation;
  }, [onSave]);

  useEffect(() => {
    if (busy) return;
    const timeout = setTimeout(() => {
      persist(getValues(), step).catch(() => { /* The save error appears beside the form actions. */ });
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
    try {
      await persist(answers, next);
      if (next === 4) attemptedAutoGeneration.current = true;
      setStep(next);
      if (next === 4) await generate();
      requestAnimationFrame(() => heading.current?.focus());
    }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }

  async function generate() {
    setError(null);
    const parsed = answersSchema.safeParse(getValues());
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true); setGenerating(true);
    try {
      await persist(getValues(), 4);
      const result = await onSuggest();
      revision.current = result.revision;
      setGoals(result.goals); setReason(result.fallbackReason); setExpandedGoal(null); setGoalsDirty(false);
      setStep(4); setReviewing(true);
      requestAnimationFrame(() => heading.current?.focus());
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); setGenerating(false); }
  }

  const resumeMission = useEffectEvent(() => {
    if (initial?.proposal?.length === 3) {
      revision.current = initial.revision;
      setGoals(initial.proposal); setReason(initial.fallbackReason); setError(null);
    } else if (!attemptedAutoGeneration.current) {
      attemptedAutoGeneration.current = true;
      void generate();
    }
  });
  useEffect(() => {
    if (step !== 4 || goals.length !== 0) return;
    const timeout = setTimeout(() => resumeMission(), 0);
    return () => clearTimeout(timeout);
  }, [step, goals.length, initial?.proposal]);

  async function saveGoals(confirm: boolean) {
    setError(null); setBusy(true);
    try {
      const valid = validateGoals(goals, cohort.startDate, cohort.endDate);
      await persist(getValues(), 4);
      revision.current = await onSaveGoals(valid, revision.current, confirm);
      setGoalsDirty(false);
      toast.success(confirm ? "Mission confirmed" : preview ? "Sample goal draft updated" : "Goal draft saved", { description: confirm ? "Your three goals are ready to guide your Sprint." : undefined });
      if (confirm) { setConfirmed(valid); setReviewing(false); if (firstVisit) router.replace("/"); }
    } catch (failure) {
      const invalid = goals.findIndex((goal) => !goalSchema.safeParse(goal).success || goal.deadline < cohort.startDate || goal.deadline > cohort.endDate);
      if (invalid >= 0) setExpandedGoal(invalid);
      setError(failure instanceof Error && failure.name === "ZodError" ? "Give each goal a title, a target from 1 to 100, a measure, a valid deadline, and one to three first actions." : errorMessage(failure));
    }
    finally { setBusy(false); }
  }

  function editGoal(index: number, patch: Partial<MissionGoal>) { setGoals((current) => current.map((goal, i) => i === index ? { ...goal, ...patch } : goal)); setGoalsDirty(true); }

  const accountControls = <div className="flex min-w-0 flex-col items-end text-end text-xs leading-5 text-muted-foreground">
    <p className="wrap-anywhere">{preview ? "Onboarding preview" : accountName}</p>
    {preview ? <Link href="/preview" className="mt-1 text-forest underline-offset-4 hover:underline">Return to preview</Link> : firstVisit ? <EntrySignOut /> : <Button variant="ghost" disabled={busy} onClick={() => { void persist(getValues(), step).then(() => router.push("/")).catch((failure) => setError(errorMessage(failure))); }} className="-me-2 min-h-9 px-2 text-xs text-forest">Return home</Button>}
  </div>;
  const saveFeedback = saveError ? <div className="space-y-2"><InlineError message="Could not save your answers. Check your connection and retry." /><ActionButton appearance="secondary" disabled={busy} onClick={async () => {
    setBusy(true); setError(null);
    try { await persist(getValues(), step); if (step === 4 && goals.length === 0) await generate(); } catch { /* Keep the save error and retry control visible. */ }
    finally { setBusy(false); }
  }}>Retry save</ActionButton></div> : null;

  return <EntryLayout onboarding>
    {!preview ? <div className="mb-4 flex justify-end"><HelpCheckin /></div> : null}
    {cohortPicker}
    {confirmed && !reviewing ? <EntryCard>
      <div className="flex items-start justify-between gap-4"><IconTile icon={Target} tone="green" />{accountControls}</div>
      {saveFeedback}
      <h1 ref={heading} tabIndex={-1} className="mt-6 text-[28px] leading-tight font-medium tracking-[-0.045em] outline-none sm:text-[34px]">Your mission is set.</h1>
      <div className="mt-4"><Badge tone="green">{preview ? "Sample confirmation" : "Confirmed"}</Badge></div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Three goals and a few first steps to make the most of your stay.</p><div className="mt-6"><h2 className="sr-only">Your three goals</h2><MissionGoals goals={confirmed} showActions /></div>

      <div className="mt-8 flex flex-wrap items-center gap-3"><ActionButton onClick={() => router.push(preview ? "/preview" : "/")}>Enter your workspace<ArrowRight className="size-4" aria-hidden /></ActionButton><ActionButton appearance="secondary" onClick={() => { setStep(4); setReviewing(true); }}>Edit your mission</ActionButton></div>
    </EntryCard> : <>
      <EntryCard>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><p className="inline-flex items-center gap-2 text-xs font-medium text-forest"><Target className="size-4" aria-hidden />Personal mission</p>{accountControls}</div>
        <div className="mb-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><p>{step < 4 ? `Step ${step + 1} of 4` : "Your personal mission"}</p><span>{step < 4 ? preview ? "Preview only" : "Answers save as you go" : "Three goals for your two weeks"}</span></div>
          <ol aria-label="Onboarding progress" className="grid grid-cols-4 gap-2">{steps.map((item, index) => <li key={item.label} aria-label={item.label} aria-current={step === index ? "step" : undefined}><div className={`h-1 rounded-full ${index <= step ? "bg-forest" : "bg-soft"}`} /><span className={`mt-2 block text-[10px] leading-4 ${index === step ? "font-medium text-forest" : "text-muted-foreground"}`}>{["Project", "Ambitions", "Interests", "Contribution"][index]}</span></li>)}</ol>
        </div>
        {step < 4 ? <form onSubmit={(event) => { event.preventDefault(); void navigate(step + 1); }}>
          <h1 ref={heading} tabIndex={-1} className="text-[28px] leading-tight font-medium tracking-[-0.045em] outline-none sm:text-[34px]">{steps[step].title}</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{steps[step].description}</p>
          <fieldset disabled={busy} className="mt-6 min-w-0 border-0 p-0"><legend className="sr-only">{steps[step].title}</legend>
            {step === 2 ? <div className="space-y-3"><p className="text-xs tabular-nums text-muted-foreground">{values.industries?.length ?? 0} of 8 selected</p><div className="grid min-w-0 gap-2 @min-[400px]/entry:grid-cols-2">{industries.map((industry) => {
              const selected = values.industries?.includes(industry) ?? false;
              return <CheckboxField key={industry} checked={selected} disabled={busy || (!selected && (values.industries?.length ?? 0) >= 8)} onCheckedChange={(selected) => { const current = getValues("industries"); setValue("industries", selected ? [...current, industry] : current.filter((item) => item !== industry), { shouldDirty: true }); setError(null); }} className={`min-w-0 rounded-xl border p-3 ${selected ? "border-forest/30 bg-sage/60" : "border-line bg-white"}`} contentClassName="min-h-6 items-start gap-2.5" controlClassName="mt-0.5 shrink-0">{industry}</CheckboxField>;
            })}</div></div> : <Controller name={steps[step].field as "building" | "outcomes" | "offering"} control={control} render={({ field }) => <TextareaField key={field.name} name={field.name} label={steps[step].label} value={field.value} onChange={(event) => { field.onChange(event.target.value); setError(null); }} onBlur={field.onBlur} ref={field.ref} rows={4} maxLength={1200} placeholder={steps[step].placeholder} className="min-h-36 bg-soft/35 p-4 text-sm leading-7 placeholder:text-muted-foreground/70" description={<span className="flex flex-wrap justify-between gap-2"><span>{step === 3 ? "5" : "10"}–1,200 characters</span><span className="tabular-nums">{field.value.length} / 1,200</span></span>} />} />
            }
          </fieldset>
          <div className="mt-5">{saveFeedback}<InlineError message={saveError ? null : error} /></div>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">{step > 0 ? <ActionButton appearance="secondary" disabled={busy} onClick={() => void navigate(step - 1)}><ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />Back</ActionButton> : <span />}<ActionButton type="submit" busy={busy}>Continue<ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></ActionButton></div>
        </form> : <div>
          <h1 ref={heading} tabIndex={-1} className="text-[28px] leading-tight font-medium tracking-[-0.045em] outline-none sm:text-[34px]">{generating ? "Creating your mission…" : "Your mission, in three goals."}</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{generating ? "Turning your answers into concrete next steps for your stay." : confirmed ? "Review your next steps. Your confirmed mission stays in place until you confirm a replacement." : "Choose what to work toward during your stay. Open a goal to adjust its target, deadline, and first steps."}</p>
          {generating ? <div role="status" className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="size-5 animate-spin text-forest motion-reduce:animate-none" aria-hidden />Finding your next steps…</div> : goals.length === 3 ? <>
            {reason && !preview ? <p className="mt-4 rounded-xl bg-soft p-4 text-xs leading-6 text-muted-foreground">Start with these three goals. Adjust the targets and first steps to fit your stay.</p> : null}
            <div className="mt-5"><h2 className="sr-only">Review your three goals</h2><MissionReview goals={goals} expanded={expandedGoal} onExpand={setExpandedGoal} onChange={editGoal} disabled={busy} startDate={cohort.startDate} endDate={cohort.endDate} /></div>
            {saveFeedback}<InlineError message={saveError ? null : error} />
            <div className="mt-5 space-y-3"><ActionButton busy={busy} className="w-full" onClick={() => void saveGoals(true)}><Check className="size-4" aria-hidden />{confirmed ? "Confirm replacement mission" : firstVisit ? "Confirm & enter workspace" : "Confirm my mission"}</ActionButton>
              <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" disabled={busy} onClick={() => void navigate(0)} className="min-h-11 px-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" aria-hidden />Edit answers</Button>{goalsDirty ? <ActionButton appearance="secondary" disabled={busy} onClick={() => void saveGoals(false)}>Save goal draft</ActionButton> : confirmed ? <Button variant="ghost" disabled={busy} onClick={() => setReviewing(false)} className="min-h-11 px-2 text-sm text-muted-foreground">View confirmed mission</Button> : null}</div>
            </div>
          </> : <div className="mt-5 space-y-4">{saveFeedback}<InlineError message={saveError ? null : error} />{error && !saveError ? <ActionButton appearance="secondary" disabled={busy} onClick={() => void generate()}>Try again</ActionButton> : null}<Button variant="ghost" disabled={busy} onClick={() => void navigate(0)} className="min-h-11 px-2 text-sm text-muted-foreground">Edit answers</Button></div>}
        </div>}
        <div className="mt-7 border-t border-line pt-4 text-xs leading-5 text-muted-foreground"><p className="wrap-anywhere">{cohort.name}</p><p className="tabular-nums">{dateRangeLabel(cohort.startDate, cohort.endDate)} · San Francisco</p></div>
      </EntryCard>
    </>}
  </EntryLayout>;
}

function EntrySignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function signOut() {
    setBusy(true); setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      router.replace("/sign-in"); router.refresh();
    } catch { setError("Could not sign out. Try again."); setBusy(false); }
  }
  return <div><Button variant="ghost" disabled={busy} onClick={signOut} className="-me-2 min-h-9 px-2 text-xs text-muted-foreground hover:text-forest"><LogOut className="size-3.5" aria-hidden />{busy ? "Signing out…" : "Sign out"}</Button>{error ? <p role="alert" className="mt-2 text-red-800">{error}</p> : null}</div>;
}
