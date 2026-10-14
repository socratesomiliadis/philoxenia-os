import { WorkspaceGateway } from "@/components/workspace-gateway";
import { HomeDashboard } from "@/components/home-dashboard";

export const instant = false;

export default function SignInPage() { return <WorkspaceGateway allowPreview={false}><HomeDashboard /></WorkspaceGateway>; }
