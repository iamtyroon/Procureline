import { z } from "zod";
import {
    CATEGORY_COLOR_INVALID_MESSAGE,
    CATEGORY_DESCRIPTION_TOO_LONG_MESSAGE,
    CATEGORY_ICON_INVALID_MESSAGE,
    CATEGORY_NAME_REQUIRED_MESSAGE,
    normalizeCategoryColor,
    normalizeCategoryDescription,
    normalizeCategoryIcon,
    normalizeCategoryName,
} from "../procurement-officer/categories";
import { normalizePlainText } from "../security/input";

export const categoryFormSchema = z
    .object({
        color: z.string().optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        name: z.string(),
    })
    .superRefine((value, ctx) => {
        const name = normalizePlainText(value.name);
        const description = normalizeCategoryDescription(value.description);
        const normalizedColor = normalizeCategoryColor(value.color);
        const hasColorInput = normalizePlainText(value.color ?? "").length > 0;
        const normalizedIcon = normalizeCategoryIcon(value.icon);
        const hasIconInput = normalizePlainText(value.icon ?? "").length > 0;

        if (name.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: CATEGORY_NAME_REQUIRED_MESSAGE,
                path: ["name"],
            });
        }

        if (description && description.length > 500) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: CATEGORY_DESCRIPTION_TOO_LONG_MESSAGE,
                path: ["description"],
            });
        }

        if (hasColorInput && !normalizedColor) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: CATEGORY_COLOR_INVALID_MESSAGE,
                path: ["color"],
            });
        }

        if (hasIconInput && !normalizedIcon) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: CATEGORY_ICON_INVALID_MESSAGE,
                path: ["icon"],
            });
        }
    })
    .transform((value) => {
        const name = normalizePlainText(value.name);

        return {
            color: normalizeCategoryColor(value.color),
            description: normalizeCategoryDescription(value.description),
            icon: normalizeCategoryIcon(value.icon),
            name,
            normalizedName: normalizeCategoryName(name),
        };
    });

export type CategoryFormData = z.infer<typeof categoryFormSchema>;
