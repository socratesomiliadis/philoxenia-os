export function emptyCohortReport(cohort: object) {
  return { cohort, asOf: Date.parse("2026-11-05T20:00:00Z"), participants: [], summary: { active: 0, onboardingIncomplete: 0, needingAttention: 0, openCheckins: 0, plannedMeetings: 0, completedActivities: 0, reportedOutcomes: 0, pendingRequests: 0, pendingInvitations: 0 } };
}
