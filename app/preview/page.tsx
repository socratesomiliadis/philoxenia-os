import { notFound } from "next/navigation";
import { PreviewWorkspace } from "@/components/workspace-gateway";
import { HomeDashboard } from "@/components/home-dashboard";

export default function PreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PreviewWorkspace><HomeDashboard /></PreviewWorkspace>;
}
