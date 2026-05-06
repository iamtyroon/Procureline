"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAuthenticated = exports.store = exports.signOut = exports.signIn = exports.auth = void 0;
const server_1 = require("@convex-dev/auth/server");
const ConvexCredentials_1 = require("@convex-dev/auth/providers/ConvexCredentials");
const Password_1 = require("@convex-dev/auth/providers/Password");
const api_1 = require("./_generated/api");
const session_1 = require("../lib/shared/auth/session");
const department_user_access_1 = require("../lib/shared/auth/department-user-access");
const invitations_1 = require("../lib/procurement-officer/invitations");
const audit_1 = require("../lib/shared/security/audit");
const input_1 = require("../lib/shared/security/input");
const ResendOTP_1 = require("./ResendOTP");
const ResendPasswordReset_1 = require("./ResendPasswordReset");
const departmentUserAuth_1 = require("./functions/departmentUserAuth");
const procurementOfficerOnboarding_1 = require("./functions/procurementOfficerOnboarding");
_a = (0, server_1.convexAuth)({
    session: {
        totalDurationMs: session_1.REMEMBER_ME_SESSION_WINDOW_MS,
        inactiveDurationMs: session_1.REMEMBER_ME_SESSION_WINDOW_MS,
    },
    providers: [
        (0, ConvexCredentials_1.ConvexCredentials)({
            id: department_user_access_1.DEPARTMENT_USER_AUTH_PROVIDER,
            extraProviders: [ResendOTP_1.ResendOTP],
            authorize: async (params, ctx) => {
                const flow = typeof params.flow === "string" ? params.flow : "";
                const challengeId = typeof params.challengeId === "string" ? params.challengeId : "";
                const signedRequestContext = typeof params.signedRequestContext === "string"
                    ? params.signedRequestContext
                    : "";
                const challengeDocId = challengeId;
                if (!challengeId) {
                    throw new Error("Department User sign-in challenge expired. Start again.");
                }
                if (flow === department_user_access_1.DEPARTMENT_USER_AUTH_START_FLOW) {
                    await (0, departmentUserAuth_1.startDepartmentUserOtpChallenge)(ctx, challengeDocId);
                    return null;
                }
                if (flow === department_user_access_1.DEPARTMENT_USER_AUTH_VERIFY_FLOW) {
                    const codeResult = (0, input_1.validateOneTimeCodeInput)(String(params.code ?? ""), {
                        field: "code",
                        label: "Verification code",
                    });
                    if (!codeResult.ok) {
                        throw new Error(codeResult.issue.message);
                    }
                    return await (0, departmentUserAuth_1.verifyDepartmentUserOtpChallenge)(ctx, {
                        challengeId: challengeDocId,
                        code: codeResult.value,
                        signedRequestContext,
                    });
                }
                throw new Error("Unsupported Department User sign-in flow.");
            },
        }),
        (0, ConvexCredentials_1.ConvexCredentials)({
            id: invitations_1.PROCUREMENT_OFFICER_AUTH_PROVIDER,
            extraProviders: [ResendOTP_1.ResendOTP],
            authorize: async (params, ctx) => {
                const flow = typeof params.flow === "string" ? params.flow : "";
                const challengeId = typeof params.challengeId === "string" ? params.challengeId : "";
                const challengeDocId = challengeId;
                if (!challengeId) {
                    throw new Error("Procurement Officer sign-in challenge expired. Start again.");
                }
                if (flow === invitations_1.PROCUREMENT_OFFICER_AUTH_START_FLOW) {
                    await (0, procurementOfficerOnboarding_1.startProcurementOfficerOtpChallenge)(ctx, challengeDocId);
                    return null;
                }
                if (flow === invitations_1.PROCUREMENT_OFFICER_AUTH_VERIFY_FLOW) {
                    const codeResult = (0, input_1.validateOneTimeCodeInput)(String(params.code ?? ""), {
                        field: "code",
                        label: "Verification code",
                    });
                    if (!codeResult.ok) {
                        throw new Error(codeResult.issue.message);
                    }
                    return await (0, procurementOfficerOnboarding_1.verifyProcurementOfficerOtpChallenge)(ctx, {
                        challengeId: challengeDocId,
                        code: codeResult.value,
                    });
                }
                throw new Error("Unsupported Procurement Officer sign-in flow.");
            },
        }),
        (0, Password_1.Password)({
            verify: ResendOTP_1.ResendOTP,
            reset: ResendPasswordReset_1.ResendPasswordReset,
            profile(params, ctx) {
                const flow = typeof params.flow === "string" ? params.flow : "unknown";
                const queueRejectedAuthInputAudit = (args) => {
                    const entry = (0, audit_1.buildSecurityInputRejectedEvent)({
                        field: args.field,
                        flow,
                        outcome: args.outcome,
                        path: "convex.auth",
                        reason: args.reason,
                    });
                    void ctx
                        .runMutation(api_1.internal.functions.auditLogs.appendAuditLogFromAction, {
                        action: entry.action,
                        actorRole: entry.actor.role,
                        actorState: entry.actor.state,
                        entityType: entry.entityType,
                        event: entry.event,
                        metadata: entry.metadata,
                        outcome: entry.outcome,
                        timestamp: entry.timestamp,
                    })
                        .catch(() => undefined);
                };
                const emailResult = (0, input_1.validateEmailInput)(String(params.email ?? ""));
                if (!emailResult.ok) {
                    queueRejectedAuthInputAudit({
                        field: emailResult.issue.field,
                        outcome: emailResult.issue.outcome,
                        reason: emailResult.issue.reason,
                    });
                    throw new Error(emailResult.issue.message);
                }
                if ((flow === "email-verification" || flow === "reset-verification") &&
                    params.code !== undefined) {
                    const codeLabel = flow === "email-verification" ? "Verification code" : "Reset code";
                    const codeResult = (0, input_1.validateOneTimeCodeInput)(String(params.code), {
                        field: "code",
                        label: codeLabel,
                    });
                    if (!codeResult.ok) {
                        queueRejectedAuthInputAudit({
                            field: codeResult.issue.field,
                            outcome: codeResult.issue.outcome,
                            reason: codeResult.issue.reason,
                        });
                        throw new Error(codeResult.issue.message);
                    }
                }
                const passwordCandidate = flow === "reset-verification"
                    ? params.newPassword
                    : params.password;
                if (typeof passwordCandidate === "string") {
                    const passwordField = flow === "reset-verification" ? "newPassword" : "password";
                    const passwordLengthResult = (0, input_1.validatePasswordLength)(passwordCandidate, passwordField);
                    if (!passwordLengthResult.ok) {
                        queueRejectedAuthInputAudit({
                            field: passwordLengthResult.issue.field,
                            outcome: passwordLengthResult.issue.outcome,
                            reason: passwordLengthResult.issue.reason,
                        });
                        throw new Error(passwordLengthResult.issue.message);
                    }
                }
                return {
                    email: emailResult.value,
                };
            },
            validatePasswordRequirements(password) {
                if (password.length < input_1.PASSWORD_MIN_LENGTH) {
                    throw new Error(`Password must be at least ${input_1.PASSWORD_MIN_LENGTH} characters`);
                }
                if (password.length > 256) {
                    throw new Error("Password must not exceed 256 characters");
                }
                if (!input_1.PASSWORD_PATTERNS.uppercase.test(password)) {
                    throw new Error("Password must contain at least one uppercase letter");
                }
                if (!input_1.PASSWORD_PATTERNS.lowercase.test(password)) {
                    throw new Error("Password must contain at least one lowercase letter");
                }
                if (!input_1.PASSWORD_PATTERNS.digit.test(password)) {
                    throw new Error("Password must contain at least one number");
                }
                if (!input_1.PASSWORD_PATTERNS.special.test(password)) {
                    throw new Error("Password must contain at least one special character");
                }
            },
        }),
    ],
}), exports.auth = _a.auth, exports.signIn = _a.signIn, exports.signOut = _a.signOut, exports.store = _a.store, exports.isAuthenticated = _a.isAuthenticated;
