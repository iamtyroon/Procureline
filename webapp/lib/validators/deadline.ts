import { z } from "zod";
import { DEADLINE_REMINDER_OFFSETS } from "../procurement-officer/deadlines";

export const submissionDeadlineFormSchema = z.object({
    confirmTightening: z.boolean().default(false),
    extensionReason: z.string().trim().max(240).optional(),
    reminderOffsets: z
        .array(z.number().int())
        .default([])
        .transform((offsets) =>
            Array.from(
                new Set(
                    offsets.filter((offset) =>
                        DEADLINE_REMINDER_OFFSETS.includes(offset as any),
                    ),
                ),
            ).sort((left, right) => right - left),
        ),
    selectedFiscalYear: z.string().min(1, "Choose a fiscal year."),
    submissionEndsAt: z.string().min(1, "Choose the submission deadline."),
    submissionStartsAt: z.string().min(1, "Choose the submission start."),
});

export type SubmissionDeadlineFormData = z.infer<
    typeof submissionDeadlineFormSchema
>;
