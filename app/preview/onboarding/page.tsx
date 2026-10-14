import { notFound } from "next/navigation";
import { PreviewWorkspace } from "@/components/workspace-gateway";
import { OnboardingPreview } from "@/components/onboarding";
import { previewCohort } from "@/components/workspace-context";

export default function OnboardingPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PreviewWorkspace><OnboardingPreview cohort={previewCohort} /></PreviewWorkspace>;
}
