import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
// The transactional gate selects daily or weekly cadence and reserves shared budgets.
crons.daily("opportunity imports", { hourUTC: 14, minuteUTC: 0 }, internal.ingestion.scheduled, {});
export default crons;
