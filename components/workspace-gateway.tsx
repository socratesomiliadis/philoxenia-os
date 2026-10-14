"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ShieldX } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { backendConfigured } from "./providers";
import { SignInScreen } from "./sign-in";
import { ActionButton, InlineError, LoadingState, errorMessage } from "./ui";
import { WorkspaceContext, previewCohort, type Viewer } from "./workspace-context";
import { WorkspaceShell } from "./workspace-shell";
import { EntryLayout } from "./entry-layout";

export function PreviewWorkspace({ children }: { children: ReactNode }) {
  return <WorkspaceContext.Provider value={{ preview: true, viewer: null, cohorts: [previewCohort] }}><WorkspaceShell>{children}</WorkspaceShell></WorkspaceContext.Provider>;
}

export function WorkspaceGateway({ children, allowPreview = true }: { children: ReactNode; allowPreview?: boolean }) {
  if (!backendConfigured) return allowPreview && process.env.NODE_ENV === "development" ? <PreviewWorkspace>{children}</PreviewWorkspace> : <SignInScreen />;
  return <ConnectedGateway allowPreview={allowPreview}>{children}</ConnectedGateway>;
}

function ConnectedGateway({ children, allowPreview }: { children: ReactNode; allowPreview: boolean }) {
  const readiness = useQuery(api.auth.readiness);
  if (readiness === undefined) return <LoadingState />;
  if (!readiness.google) return allowPreview && process.env.NODE_ENV === "development" ? <PreviewWorkspace>{children}</PreviewWorkspace> : <SignInScreen />;
  return <AuthenticatedGateway>{children}</AuthenticatedGateway>;
}

function AuthenticatedGateway({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  const ensureProfile = useMutation(api.users.ensureProfile);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const needsProvisioning = Boolean(viewer?.allowed && viewer.needsProvisioning);

  useEffect(() => {
    if (!needsProvisioning) return;
    let cancelled = false;
    ensureProfile({}).catch((error) => { if (!cancelled) setProvisionError(errorMessage(error)); });
    return () => { cancelled = true; };
  }, [needsProvisioning, ensureProfile, retry]);

  if (isLoading || (isAuthenticated && viewer === undefined)) return <LoadingState />;
  if (!isAuthenticated || !viewer) return <SignInScreen />;
  if (!viewer.allowed) return <AccessDenied email={viewer.email} />;
  if (needsProvisioning) return provisionError ? <div className="mx-auto max-w-md space-y-4 p-10"><InlineError message={provisionError} /><ActionButton onPress={() => { setProvisionError(null); setRetry((count) => count + 1); }}>Try again</ActionButton></div> : <LoadingState label="Joining your cohort…" />;
  return <MemberWorkspace viewer={viewer}>{children}</MemberWorkspace>;
}

function MemberWorkspace({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const cohorts = useQuery(api.cohorts.list);
  const requiredOnboardingCohortId = useQuery(api.onboarding.required);
  const pathname = usePathname();
  const router = useRouter();
  const destination = requiredOnboardingCohortId && pathname !== "/onboarding" ? "/onboarding" : requiredOnboardingCohortId === null && pathname === "/sign-in" ? "/" : null;

  useEffect(() => { if (destination) router.replace(destination); }, [destination, router]);

  if (!cohorts || requiredOnboardingCohortId === undefined || destination) return <EntryLayout onboarding><LoadingState label="Getting your next step ready…" /></EntryLayout>;
  return <WorkspaceContext.Provider value={{ preview: false, viewer, cohorts, requiredOnboardingCohortId }}>{pathname === "/onboarding" ? children : <WorkspaceShell>{children}</WorkspaceShell>}</WorkspaceContext.Provider>;
}

function AccessDenied({ email }: { email: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function switchAccount() {
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      router.replace("/sign-in");
      router.refresh();
    } catch { setError("Could not switch accounts. Please try again."); }
  }
  return <main className="flex min-h-dvh items-center justify-center bg-canvas p-6"><section className="w-full max-w-lg rounded-[20px] border border-line bg-white p-7 shadow-panel sm:p-9"><ShieldX className="mb-6 size-8 text-forest" aria-hidden /><h1 className="text-3xl font-medium tracking-tight text-foreground">An invitation is needed.</h1><p className="mt-4 text-sm leading-7 wrap-anywhere text-muted">{email} doesn’t have an active invitation. Sign in with your invited Google account or ask your organizer to check your access.</p><div className="mt-6"><ActionButton onPress={switchAccount}>Use another account</ActionButton></div><div className="mt-4"><InlineError message={error} /></div></section></main>;
}
