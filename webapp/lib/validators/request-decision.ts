import { z } from "zod";
import { categoryFormSchema } from "./category";
import { itemFormSchema } from "./item";

const REQUEST_DECISION_REASON_MIN = 3;
const REQUEST_DECISION_REASON_MAX = 280;

export const requestDenialSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(
      REQUEST_DECISION_REASON_MIN,
      "Denial reason must be at least 3 characters.",
    )
    .max(
      REQUEST_DECISION_REASON_MAX,
      "Denial reason must be 280 characters or less.",
    ),
});

export const requestApprovalCategorySchema = categoryFormSchema;

export const requestApprovalItemSchema = itemFormSchema;

export const bulkRequestDecisionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(
      REQUEST_DECISION_REASON_MIN,
      "Decision reason must be at least 3 characters.",
    )
    .max(
      REQUEST_DECISION_REASON_MAX,
      "Decision reason must be 280 characters or less.",
    ),
  requestIds: z
    .array(z.string().trim().min(1))
    .min(1, "Select at least one request."),
});

export type RequestDenialValues = z.infer<typeof requestDenialSchema>;
export type RequestApprovalCategoryValues = z.infer<
  typeof requestApprovalCategorySchema
>;
export type RequestApprovalItemValues = z.infer<
  typeof requestApprovalItemSchema
>;
export type BulkRequestDecisionValues = z.infer<
  typeof bulkRequestDecisionSchema
>;
