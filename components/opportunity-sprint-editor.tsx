"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Opportunity } from "@/lib/opportunities";
import type { SprintActions, SprintData } from "@/lib/sprint";
import { getSampleSprint, getServerSampleSprint, sampleSprintActions, subscribeSampleSprint } from "@/lib/sample-sprint";
import { useWorkspace } from "./workspace-context";
import { ActivityEditor, SprintModal } from "./sprint-editors";
import { useSprintActions } from "./sprint-dashboard";

type Props = { opportunity: Opportunity; cohortId: Id<"cohorts">; onClose: () => void; onAdded: () => void };
export function OpportunitySprintEditor(props: Props) {
  const { preview } = useWorkspace();
  return preview ? <PreviewEditor {...props} /> : <ConnectedEditor {...props} />;
}
function PreviewEditor(props: Props) {
  const data = useSyncExternalStore(subscribeSampleSprint, getSampleSprint, getServerSampleSprint);
  return <Editor {...props} data={data} actions={sampleSprintActions} preview />;
}
function ConnectedEditor(props: Props) {
  const data = useQuery(api.sprint.get, { cohortId: props.cohortId });
  const actions = useSprintActions(props.cohortId);
  if (!data) return null;
  return <Editor {...props} data={data} actions={actions} />;
}
function Editor({ data, actions, opportunity, onClose, onAdded, preview = false }: Props & { data: SprintData; actions: SprintActions; preview?: boolean }) {
  const [alreadyAdded] = useState(() => data.entries.some((entry) => entry.opportunityId === opportunity._id));
  if (alreadyAdded || !data.canPlan) return <SprintModal title={alreadyAdded ? "Already in your Sprint" : "Cohort membership required"} onClose={onClose}><div className="space-y-4"><p className="text-sm leading-6 text-muted">{alreadyAdded ? "Open your Sprint to edit or reschedule the existing activity." : "An active cohort membership is required to keep a personal Sprint."}</p><Link href={preview ? "/preview/sprint" : "/sprint"} className="inline-flex min-h-11 items-center rounded-xl bg-forest px-4 text-sm font-medium text-white">Open Sprint</Link></div></SprintModal>;
  return <ActivityEditor data={data} opportunity={opportunity} onClose={onClose} onSave={async (input, goalLink, allowOverlap) => { await actions.saveActivity({ input, goalLink, allowOverlap, opportunity }); onAdded(); }} />;
}
