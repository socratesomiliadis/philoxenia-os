import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PreviewWorkspace } from "@/components/workspace-gateway";
import { OrganizerDashboard } from "@/components/organizer-dashboard";
import { CommunityPage } from "@/components/community";
import { OpenDoors } from "@/components/open-doors";
import { LoadingState } from "@/components/ui";
import { OpportunitiesDashboard } from "@/components/opportunities-dashboard";
import { SprintDashboard } from "@/components/sprint-dashboard";

export default function PreviewSectionPage({ params }: { params: Promise<{ section: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Suspense fallback={<LoadingState />}><PreviewSection params={params} /></Suspense>;
}

async function PreviewSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const content = {
    organizer: <OrganizerDashboard />, community: <CommunityPage />,
    opportunities: <OpportunitiesDashboard />, sprint: <SprintDashboard />,
    "open-doors": <OpenDoors />,
  }[section];
  if (!content) notFound();
  return <PreviewWorkspace>{content}</PreviewWorkspace>;
}
