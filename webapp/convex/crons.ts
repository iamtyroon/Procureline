import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
    "expire pending department-user catalog requests",
    { hours: 1 },
    internal.functions.catalogRequests.expirePendingCatalogRequests,
    {},
);

crons.interval(
    "run due tenant-admin report schedules",
    { minutes: 15 },
    internal.actions.files.runDueTenantAdminReportSchedules,
    {},
);

export default crons;
