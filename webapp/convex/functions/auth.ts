"use node";

import { generateRandomString } from "@oslojs/crypto/random";
import { v } from "convex/values";
import { api } from "../_generated/api";
import { action } from "../_generated/server";
import {
    buildPasswordResetRedirectTo,
    isMaskedPasswordResetRequestError,
    normalizeAuthEmail,
} from "../../lib/auth/password-reset";

function randomReader() {
    return {
        read(bytes: Uint8Array): void {
            crypto.getRandomValues(bytes);
        },
    };
}

function createPlatformAdminPasswordResetCompletionToken(): string {
    return generateRandomString(
        randomReader(),
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789",
        32,
    );
}

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

        const platformResetToken =
            createPlatformAdminPasswordResetCompletionToken();

        try {
            await ctx.runMutation(
                "functions/platformAdminAuth:preparePlatformAdminPasswordResetCompletionToken" as any,
                {
                    email: normalizedEmail,
                    resetCompletionToken: platformResetToken,
                },
            );
            await ctx.runAction(api.auth.signIn, {
                provider: "password",
                params: {
                    email: normalizedEmail,
                    flow: "reset",
                    redirectTo: buildPasswordResetRedirectTo(normalizedEmail, {
                        platformResetToken,
                    }),
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
