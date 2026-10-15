import { WorkspaceGateway } from "@/components/workspace-gateway";
import { HomeDashboard } from "@/components/home-dashboard";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Sign in",
  description: "Sign in to Philoxenia OS to plan your San Francisco chapter, discover opportunities, and connect with your community. By Hustle Hours.",
  path: "/sign-in",
});

export const instant = false;

export default function SignInPage() { return <WorkspaceGateway allowPreview={false}><HomeDashboard /></WorkspaceGateway>; }
