"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("convex/server");
const api_1 = require("./_generated/api");
const crons = (0, server_1.cronJobs)();
crons.interval("expire pending department-user catalog requests", { hours: 1 }, api_1.internal.functions.catalogRequests.expirePendingCatalogRequests, {});
exports.default = crons;
