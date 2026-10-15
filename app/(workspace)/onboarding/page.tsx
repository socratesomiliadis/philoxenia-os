import { Onboarding } from "@/components/onboarding";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Your personal mission",
  description: "Set your goals and shape a personal mission for two weeks of building, connecting, and opening doors in San Francisco.",
  path: "/onboarding",
});

export const instant = false;

export default function OnboardingPage() {
  return <Onboarding />;
}
