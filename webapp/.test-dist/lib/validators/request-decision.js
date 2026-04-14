"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkRequestDecisionSchema = exports.requestApprovalItemSchema = exports.requestApprovalCategorySchema = exports.requestDenialSchema = void 0;
const zod_1 = require("zod");
const category_1 = require("./category");
const item_1 = require("./item");
const REQUEST_DECISION_REASON_MIN = 3;
const REQUEST_DECISION_REASON_MAX = 280;
exports.requestDenialSchema = zod_1.z.object({
    reason: zod_1.z
        .string()
        .trim()
        .min(REQUEST_DECISION_REASON_MIN, "Denial reason must be at least 3 characters.")
        .max(REQUEST_DECISION_REASON_MAX, "Denial reason must be 280 characters or less."),
});
exports.requestApprovalCategorySchema = category_1.categoryFormSchema;
exports.requestApprovalItemSchema = item_1.itemFormSchema;
exports.bulkRequestDecisionSchema = zod_1.z.object({
    reason: zod_1.z
        .string()
        .trim()
        .min(REQUEST_DECISION_REASON_MIN, "Decision reason must be at least 3 characters.")
        .max(REQUEST_DECISION_REASON_MAX, "Decision reason must be 280 characters or less."),
    requestIds: zod_1.z
        .array(zod_1.z.string().trim().min(1))
        .min(1, "Select at least one request."),
});
