import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
    "expire pending department-user catalog requests",
    { hours: 1 },
    internal.functions.catalogRequests.expirePendingCatalogRequests,
    {},
);

export default crons;
