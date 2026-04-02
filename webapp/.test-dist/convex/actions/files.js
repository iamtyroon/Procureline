"use node";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPdf = exports.importWorkbook = exports.queueExcelExport = exports.createExcelExport = void 0;
const server_1 = require("../_generated/server");
const values_1 = require("convex/values");
const _helpers_1 = require("./_helpers");
exports.createExcelExport = (0, server_1.action)({
    args: {
        idempotencyKey: values_1.v.optional(values_1.v.string()),
        reportName: values_1.v.string(),
        rows: values_1.v.array(values_1.v.any()),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        return (0, _helpers_1.callNestService)(ctx, {
            actor,
            body: args,
            path: "/api/services/files/exports/excel",
        });
    },
});
exports.queueExcelExport = (0, server_1.action)({
    args: {
        idempotencyKey: values_1.v.optional(values_1.v.string()),
        reportName: values_1.v.string(),
        rows: values_1.v.array(values_1.v.any()),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        return (0, _helpers_1.callNestService)(ctx, {
            actor,
            body: args,
            path: "/api/services/files/exports/excel/queue",
        });
    },
});
exports.importWorkbook = (0, server_1.action)({
    args: {
        workbookBase64: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        return (0, _helpers_1.callNestService)(ctx, {
            actor,
            body: args,
            path: "/api/services/files/imports/excel",
        });
    },
});
exports.createPdf = (0, server_1.action)({
    args: {
        body: values_1.v.string(),
        title: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
        return (0, _helpers_1.callNestService)(ctx, {
            actor,
            body: args,
            path: "/api/services/files/exports/pdf",
        });
    },
});
