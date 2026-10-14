import type { ReactNode } from "react";
import { WorkspaceGateway } from "@/components/workspace-gateway";

// The client authentication gate renders this segment after session resolution.
export const instant = false;

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <WorkspaceGateway>{children}</WorkspaceGateway>;
}
