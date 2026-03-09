"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { callNestService, getServiceActorContext } from "./_helpers";

export const createExcelExport = action({
  args: {
    idempotencyKey: v.optional(v.string()),
    reportName: v.string(),
    rows: v.array(v.any()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const actor = await getServiceActorContext(ctx);
    return callNestService(ctx, {
      actor,
      body: args,
      path: "/api/services/files/exports/excel",
    });
  },
});

export const queueExcelExport = action({
  args: {
    idempotencyKey: v.optional(v.string()),
    reportName: v.string(),
    rows: v.array(v.any()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const actor = await getServiceActorContext(ctx);
    return callNestService(ctx, {
      actor,
      body: args,
      path: "/api/services/files/exports/excel/queue",
    });
  },
});

export const importWorkbook = action({
  args: {
    workbookBase64: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const actor = await getServiceActorContext(ctx);
    return callNestService(ctx, {
      actor,
      body: args,
      path: "/api/services/files/imports/excel",
    });
  },
});

export const createPdf = action({
  args: {
    body: v.string(),
    title: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const actor = await getServiceActorContext(ctx);
    return callNestService(ctx, {
      actor,
      body: args,
      path: "/api/services/files/exports/pdf",
    });
  },
});
