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

crons.daily(
    "run subscription billing maintenance",
    { hourUTC: 0, minuteUTC: 15 },
    internal.functions.platformAdminSubscriptions.runScheduledBillingMaintenance,
    {},
);

crons.daily(
    "run tenant subscription reminders and scheduled changes",
    { hourUTC: 0, minuteUTC: 30 },
    internal.functions.tenantAdminOperations.runTenantSubscriptionMaintenance,
    {},
);

crons.interval(
    "process due billing reconciliations",
    { minutes: 30 },
    internal.functions.platformAdminSubscriptions.processDueBillingReconciliations,
    {},
);

crons.interval(
    "run platform-admin operations maintenance",
    { minutes: 15 },
    internal.functions.platformAdminOperations.runPlatformAdminMaintenance,
    {},
);

export default crons;
