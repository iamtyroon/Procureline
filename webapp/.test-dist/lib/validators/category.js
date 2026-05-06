"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryFormSchema = void 0;
const zod_1 = require("zod");
const categories_1 = require("../procurement-officer/categories");
const input_1 = require("../shared/security/input");
exports.categoryFormSchema = zod_1.z
    .object({
    color: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    icon: zod_1.z.string().optional(),
    name: zod_1.z.string(),
})
    .superRefine((value, ctx) => {
    const name = (0, input_1.normalizePlainText)(value.name);
    const description = (0, categories_1.normalizeCategoryDescription)(value.description);
    const normalizedColor = (0, categories_1.normalizeCategoryColor)(value.color);
    const hasColorInput = (0, input_1.normalizePlainText)(value.color ?? "").length > 0;
    const normalizedIcon = (0, categories_1.normalizeCategoryIcon)(value.icon);
    const hasIconInput = (0, input_1.normalizePlainText)(value.icon ?? "").length > 0;
    if (name.length === 0) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: categories_1.CATEGORY_NAME_REQUIRED_MESSAGE,
            path: ["name"],
        });
    }
    if (description && description.length > 500) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: categories_1.CATEGORY_DESCRIPTION_TOO_LONG_MESSAGE,
            path: ["description"],
        });
    }
    if (hasColorInput && !normalizedColor) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: categories_1.CATEGORY_COLOR_INVALID_MESSAGE,
            path: ["color"],
        });
    }
    if (hasIconInput && !normalizedIcon) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: categories_1.CATEGORY_ICON_INVALID_MESSAGE,
            path: ["icon"],
        });
    }
})
    .transform((value) => {
    const name = (0, input_1.normalizePlainText)(value.name);
    return {
        color: (0, categories_1.normalizeCategoryColor)(value.color),
        description: (0, categories_1.normalizeCategoryDescription)(value.description),
        icon: (0, categories_1.normalizeCategoryIcon)(value.icon),
        name,
        normalizedName: (0, categories_1.normalizeCategoryName)(name),
    };
});
