"use node";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestPasswordReset = void 0;
const random_1 = require("@oslojs/crypto/random");
const values_1 = require("convex/values");
const api_1 = require("../_generated/api");
const server_1 = require("../_generated/server");
const password_reset_1 = require("../../lib/auth/password-reset");
function randomReader() {
    return {
        read(bytes) {
            crypto.getRandomValues(bytes);
        },
    };
}
function createPlatformAdminPasswordResetCompletionToken() {
    return (0, random_1.generateRandomString)(randomReader(), "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789", 32);
}
exports.requestPasswordReset = (0, server_1.action)({
    args: {
        continueTo: values_1.v.optional(values_1.v.string()),
        email: values_1.v.string(),
    },
    returns: values_1.v.object({
        requested: values_1.v.boolean(),
    }),
    handler: async (ctx, args) => {
        const normalizedEmail = (0, password_reset_1.normalizeAuthEmail)(args.email);
        if (!normalizedEmail) {
            return { requested: true };
        }
        const platformResetToken = createPlatformAdminPasswordResetCompletionToken();
        try {
            await ctx.runMutation("functions/platformAdminAuth:preparePlatformAdminPasswordResetCompletionToken", {
                email: normalizedEmail,
                resetCompletionToken: platformResetToken,
            });
            await ctx.runAction(api_1.api.auth.signIn, {
                provider: "password",
                params: {
                    email: normalizedEmail,
                    flow: "reset",
                    redirectTo: (0, password_reset_1.buildPasswordResetRedirectTo)(normalizedEmail, {
                        continueTo: args.continueTo,
                        platformResetToken,
                    }),
                },
                calledBy: "password-reset-request",
            });
        }
        catch (error) {
            if (!(0, password_reset_1.isMaskedPasswordResetRequestError)(error)) {
                throw error;
            }
        }
        return { requested: true };
    },
});
