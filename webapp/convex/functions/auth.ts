"use node";

import { v } from "convex/values";
import { api } from "../_generated/api";
import { action } from "../_generated/server";
import {
    buildPasswordResetRedirectTo,
    isMaskedPasswordResetRequestError,
    normalizeAuthEmail,
} from "../../lib/auth/password-reset";

export const requestPasswordReset = action({
    args: {
        email: v.string(),
    },
    returns: v.object({
        requested: v.boolean(),
    }),
    handler: async (ctx, args) => {
        const normalizedEmail = normalizeAuthEmail(args.email);

        if (!normalizedEmail) {
            return { requested: true };
        }

        try {
            await ctx.runAction(api.auth.signIn, {
                provider: "password",
                params: {
                    email: normalizedEmail,
                    flow: "reset",
                    redirectTo: buildPasswordResetRedirectTo(normalizedEmail),
                },
                calledBy: "password-reset-request",
            });
        } catch (error: unknown) {
            if (!isMaskedPasswordResetRequestError(error)) {
                throw error;
            }
        }

        return { requested: true };
    },
});
