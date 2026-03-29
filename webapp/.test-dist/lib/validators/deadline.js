"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submissionDeadlineFormSchema = void 0;
const zod_1 = require("zod");
const deadlines_1 = require("../procurement-officer/deadlines");
exports.submissionDeadlineFormSchema = zod_1.z.object({
    confirmTightening: zod_1.z.boolean().default(false),
    extensionReason: zod_1.z.string().trim().max(240).optional(),
    reminderOffsets: zod_1.z
        .array(zod_1.z.number().int())
        .default([])
        .transform((offsets) => Array.from(new Set(offsets.filter((offset) => deadlines_1.DEADLINE_REMINDER_OFFSETS.includes(offset)))).sort((left, right) => right - left)),
    selectedFiscalYear: zod_1.z.string().min(1, "Choose a fiscal year."),
    submissionEndsAt: zod_1.z.string().min(1, "Choose the submission deadline."),
    submissionStartsAt: zod_1.z.string().min(1, "Choose the submission start."),
});
