"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attemptDeleteCurrentPlatformAdminAccount = exports.clearPlatformAdminPasswordResetRequirementForEmail = exports.revokePlatformAdminChallengeInternal = exports.preparePlatformAdminPasswordResetCompletionToken = exports.clearCurrentPlatformAdminPasswordResetRequirement = exports.revokeAllPlatformAdminSessions = exports.getPlatformAdminSecurityOverview = exports.verifyCurrentBackupCode = exports.verifyCurrentTwoFactorCode = exports.getCurrentTwoFactorState = exports.issueCurrentTwoFactorChallenge = exports.beginPlatformAdminSignIn = exports.prepareCurrentTwoFactorChallengeInternal = exports.initializeCurrentPlatformAdminSession = void 0;
const server_1 = require("@convex-dev/auth/server");
const random_1 = require("@oslojs/crypto/random");
const values_1 = require("convex/values");
const server_2 = require("../_generated/server");
const audit_1 = require("../../lib/shared/security/audit");
const auth_1 = require("../../lib/shared/platform-admin/auth");
const risk_1 = require("../../lib/backend/platform-admin/risk");
const request_context_token_1 = require("../../lib/backend/platform-admin/request-context-token");
const session_1 = require("../../lib/shared/auth/session");
const input_1 = require("../../lib/shared/security/input");
const _audit_1 = require("./_audit");
const sessions_1 = require("./sessions");
const emailTransport_1 = require("../emailTransport");
const _roleGuard_1 = require("./_roleGuard");
const requestContextValidator = values_1.v.object({
    city: values_1.v.union(values_1.v.string(), values_1.v.null()),
    consentFlag: values_1.v.optional(values_1.v.boolean()),
    country: values_1.v.union(values_1.v.string(), values_1.v.null()),
    ipAddress: values_1.v.union(values_1.v.string(), values_1.v.null()),
    isPIIAllowed: values_1.v.optional(values_1.v.boolean()),
    region: values_1.v.union(values_1.v.string(), values_1.v.null()),
    userAgent: values_1.v.union(values_1.v.string(), values_1.v.null()),
});
const riskReasonValidator = values_1.v.union(values_1.v.literal("country_changed"), values_1.v.literal("ip_changed"), values_1.v.literal("user_agent_changed"));
function randomReader() {
    return {
        read(bytes) {
            crypto.getRandomValues(bytes);
        },
    };
}
function createNumericCode() {
    return (0, random_1.generateRandomString)(randomReader(), "0123456789", 8);
}
function createBackupCode() {
    return (0, random_1.generateRandomString)(randomReader(), "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);
}
function formatBackupCode(rawCode) {
    return `${rawCode.slice(0, 5)}-${rawCode.slice(5)}`;
}
function constantTimeEqual(left, right) {
    if (left.length !== right.length) {
        return false;
    }
    let mismatch = 0;
    for (let index = 0; index < left.length; index += 1) {
        mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return mismatch === 0;
}
function resolvePlatformAdminVerificationEmailSender() {
    const sender = process.env.AUTH_PLATFORM_ADMIN_RESEND_FROM ??
        process.env.AUTH_RESET_RESEND_FROM;
    const nodeEnv = typeof process.env.NODE_ENV === "string"
        ? process.env.NODE_ENV
        : "development";
    if (typeof sender === "string" && sender.trim().length > 0) {
        return sender.trim();
    }
    if (nodeEnv === "development") {
        return "Procureline <onboarding@resend.dev>";
    }
    throw new Error("AUTH_PLATFORM_ADMIN_RESEND_FROM must be configured for Platform Admin verification emails outside development.");
}
async function sendVerificationEmail(args) {
    const fromAddress = resolvePlatformAdminVerificationEmailSender();
    const headline = args.purpose === "setup"
        ? "Finish your Platform Admin 2FA setup"
        : "Complete your Platform Admin verification";
    const contextLine = args.riskReasons.length > 0
        ? "We noticed a new or unusual sign-in context, so extra verification is required before this admin session is trusted."
        : "Enter this code to continue into the Platform Admin workspace.";
    const result = await (0, emailTransport_1.sendAppEmail)({
        debugCode: args.code,
        from: fromAddress,
        html: `
            <div style="font-family: 'Inter', system-ui, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
                <p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #0f172a;">
                    Procureline Platform Admin
                </p>
                <h2 style="margin: 0 0 12px; color: #0f172a;">${headline}</h2>
                <p style="margin: 0 0 24px; color: #475569; font-size: 15px; line-height: 1.6;">
                    ${contextLine}
                </p>
                <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; text-align: center;">
                    <div style="font-size: 32px; letter-spacing: 8px; font-weight: 700; color: #0f172a;">${args.code}</div>
                </div>
                <p style="margin: 24px 0 0; color: #64748b; font-size: 13px;">
                    This code expires in 15 minutes. If you did not start this request, contact platform security immediately.
                </p>
            </div>
        `,
        messageType: "platform_admin_verification",
        metadata: {
            purpose: args.purpose,
            riskReasons: args.riskReasons,
        },
        subject: headline,
        text: `${contextLine}\n\nYour code is ${args.code}. It expires in 15 minutes.`,
        to: [args.email],
    });
    if (!result.sent) {
        throw new Error(`Could not send verification email: ${result.errorMessage ?? "unknown email transport error"}`);
    }
}
function createAuditEntry(args) {
    return {
        action: "authenticate",
        actor: (0, audit_1.createAuthenticatedAuditActor)({
            role: "platform_admin",
            userId: String(args.userId),
        }),
        entityType: "platform_admin_auth",
        event: args.event,
        metadata: args.metadata,
        outcome: args.outcome,
        timestamp: Date.now(),
    };
}
function getRequestContextAuditMetadata(args) {
    return {
        challengeId: args.challengeId ? String(args.challengeId) : undefined,
        ipAddress: args.session.metadata?.platformAdminIpAddress,
        ipCity: args.session.metadata?.platformAdminIpCity,
        ipCountry: args.session.metadata?.platformAdminIpCountry,
        ipRegion: args.session.metadata?.platformAdminIpRegion,
        riskReasons: args.riskReasons,
        sessionId: String(args.session.sessionId),
        userAgent: args.session.metadata?.platformAdminUserAgent,
    };
}
async function appendPlatformAdminAuditEntry(ctx, args) {
    await (0, _audit_1.appendAuditLogBestEffort)(ctx, createAuditEntry(args));
}
async function ensureSecurityState(ctx, userId, userEmail) {
    const existingState = await ctx.db
        .query("platformAdminSecurityStates")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
    if (existingState) {
        return existingState;
    }
    const now = Date.now();
    const stateId = await ctx.db.insert("platformAdminSecurityStates", {
        userId,
        enrollmentEmail: userEmail,
        isTwoFactorEnrolled: false,
        backupCodes: [],
        createdAt: now,
        updatedAt: now,
    });
    const createdState = await ctx.db.get(stateId);
    if (!createdState) {
        throw new values_1.ConvexError({
            code: "INVALID_STATE",
            message: "Platform Admin security state could not be initialized.",
        });
    }
    return createdState;
}
async function getSecurityState(ctx, userId) {
    return await ctx.db
        .query("platformAdminSecurityStates")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
}
async function revokePlatformAdminChallenge(ctx, challengeId) {
    const challenge = await ctx.db.get(challengeId);
    if (!challenge || challenge.revokedAt !== undefined) {
        return;
    }
    await ctx.db.patch(challengeId, {
        revokedAt: Date.now(),
        updatedAt: Date.now(),
    });
}
async function requirePlatformSession(ctx) {
    const authContext = await (0, _roleGuard_1.requirePlatformAdminSession)(ctx);
    const session = await (0, sessions_1.loadCurrentSessionDocuments)(ctx);
    if (!session) {
        throw new values_1.ConvexError({
            code: "UNAUTHORIZED",
            message: "You must be signed in to continue.",
        });
    }
    return { authContext, session };
}
async function getActiveChallenge(ctx, args) {
    const challenges = args.purpose
        ? await (() => {
            const purpose = args.purpose;
            return ctx.db
                .query("platformAdminChallenges")
                .withIndex("by_userId_sessionId_purpose", (q) => q
                .eq("userId", args.userId)
                .eq("sessionId", args.sessionId)
                .eq("purpose", purpose))
                .collect();
        })()
        : await ctx.db
            .query("platformAdminChallenges")
            .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
            .collect();
    const now = Date.now();
    return (challenges
        .filter((challenge) => challenge.userId === args.userId &&
        challenge.consumedAt === undefined &&
        challenge.revokedAt === undefined &&
        challenge.expiresAt > now)
        .sort((left, right) => right.createdAt - left.createdAt)[0] ?? null);
}
async function revokeSessionChallenges(ctx, sessionId, now) {
    const challenges = await ctx.db
        .query("platformAdminChallenges")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect();
    for (const challenge of challenges) {
        if (challenge.consumedAt !== undefined ||
            challenge.revokedAt !== undefined ||
            challenge.expiresAt <= now) {
            continue;
        }
        await ctx.db.patch(challenge._id, {
            revokedAt: now,
            updatedAt: now,
        });
    }
}
exports.initializeCurrentPlatformAdminSession = (0, server_2.internalMutation)({
    args: {
        requestContext: requestContextValidator,
    },
    returns: values_1.v.object({
        redirectPath: values_1.v.string(),
        riskLevel: values_1.v.union(values_1.v.literal("normal"), values_1.v.literal("suspicious")),
        riskReasons: values_1.v.array(riskReasonValidator),
        stage: values_1.v.union(values_1.v.literal("setup_required"), values_1.v.literal("verification_required"), values_1.v.literal("verified"), values_1.v.literal("reset_required")),
    }),
    handler: async (ctx, args) => {
        const userId = await (0, server_1.getAuthUserId)(ctx);
        const authContext = await (0, _roleGuard_1.getAuthorizationContext)(ctx);
        const session = await (0, sessions_1.loadCurrentSessionDocuments)(ctx);
        if (!userId || !authContext || !session) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "You must be signed in to continue.",
            });
        }
        if (authContext.role !== "platform_admin" || authContext.scope !== "platform") {
            await appendPlatformAdminAuditEntry(ctx, {
                event: audit_1.AUDIT_EVENT_NAMES.platformAdminNonAdminDenied,
                metadata: {
                    attemptedRole: authContext.role,
                    sessionId: String(session.sessionId),
                },
                outcome: audit_1.AUDIT_OUTCOMES.blockedPlatformAdminAccessDenied,
                userId,
            });
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "Platform Admin access is restricted to platform administrators.",
            });
        }
        const user = await ctx.db.get(userId);
        const emailResult = (0, input_1.validateEmailInput)(user?.email ?? "");
        if (!user || !emailResult.ok) {
            throw new values_1.ConvexError({
                code: "INVALID_STATE",
                message: "Platform Admin email identity could not be resolved.",
            });
        }
        const securityState = await ensureSecurityState(ctx, userId, emailResult.value);
        const fingerprint = await (0, risk_1.fingerprintPlatformAdminRequestContext)(args.requestContext);
        const risk = await (0, risk_1.evaluatePlatformAdminRisk)({
            baseline: {
                country: securityState.lastTrustedCountry,
                ipHash: securityState.lastTrustedIpHash,
                userAgentHash: securityState.lastTrustedUserAgentHash,
            },
            current: fingerprint,
        });
        const stage = (0, auth_1.resolvePlatformAdminAuthStage)({
            currentSessionStage: session.metadata?.platformAdminAuthStage ?? null,
            hasTwoFactorEnrollment: securityState.isTwoFactorEnrolled,
            passwordResetRequiredAt: securityState.passwordResetRequiredAt,
            storedBackupCodeCount: securityState.backupCodes.length,
        });
        const now = Date.now();
        const metadataPatch = {
            rememberMe: false,
            lastActivityAt: now,
            isPlatformAdminSession: true,
            platformAdminAuthStage: stage,
            platformAdminRiskLevel: risk.level,
            platformAdminRiskReasons: risk.reasons,
            platformAdminIpAddress: args.requestContext.ipAddress ?? undefined,
            platformAdminIpCity: args.requestContext.city ?? undefined,
            platformAdminIpCountry: args.requestContext.country ?? undefined,
            platformAdminIpRegion: args.requestContext.region ?? undefined,
            platformAdminUserAgent: args.requestContext.userAgent ?? undefined,
        };
        if (session.metadata) {
            await ctx.db.patch(session.metadata._id, metadataPatch);
        }
        else {
            await ctx.db.insert("sessionMetadata", {
                sessionId: session.sessionId,
                userId,
                createdAt: now,
                rememberMe: false,
                lastActivityAt: now,
                isPlatformAdminSession: true,
                platformAdminAuthStage: stage,
                platformAdminRiskLevel: risk.level,
                platformAdminRiskReasons: risk.reasons,
                platformAdminIpAddress: args.requestContext.ipAddress ?? undefined,
                platformAdminIpCity: args.requestContext.city ?? undefined,
                platformAdminIpCountry: args.requestContext.country ?? undefined,
                platformAdminIpRegion: args.requestContext.region ?? undefined,
                platformAdminUserAgent: args.requestContext.userAgent ?? undefined,
            });
        }
        const auditMetadata = {
            ipAddress: args.requestContext.ipAddress ?? undefined,
            ipCity: args.requestContext.city ?? undefined,
            ipCountry: args.requestContext.country ?? undefined,
            ipRegion: args.requestContext.region ?? undefined,
            riskLevel: risk.level,
            riskReasons: risk.reasons,
            sessionId: String(session.sessionId),
            stage,
            userAgent: args.requestContext.userAgent ?? undefined,
        };
        await appendPlatformAdminAuditEntry(ctx, {
            event: stage === "reset_required"
                ? audit_1.AUDIT_EVENT_NAMES.platformAdminPasswordResetRequired
                : audit_1.AUDIT_EVENT_NAMES.platformAdminSessionInitialized,
            metadata: auditMetadata,
            outcome: stage === "reset_required"
                ? audit_1.AUDIT_OUTCOMES.blockedPlatformAdminPasswordResetRequired
                : risk.level === "suspicious"
                    ? audit_1.AUDIT_OUTCOMES.allowedWithStepUp
                    : audit_1.AUDIT_OUTCOMES.allowed,
            userId,
        });
        if (risk.level === "suspicious") {
            await appendPlatformAdminAuditEntry(ctx, {
                event: audit_1.AUDIT_EVENT_NAMES.platformAdminSuspiciousLoginDetected,
                metadata: auditMetadata,
                outcome: audit_1.AUDIT_OUTCOMES.allowedWithStepUp,
                userId,
            });
        }
        return {
            redirectPath: (0, auth_1.getPlatformAdminRedirectPath)(stage),
            riskLevel: risk.level,
            riskReasons: risk.reasons,
            stage,
        };
    },
});
exports.prepareCurrentTwoFactorChallengeInternal = (0, server_2.internalMutation)({
    args: {
        riskReasons: values_1.v.optional(values_1.v.array(riskReasonValidator)),
    },
    returns: values_1.v.object({
        id: values_1.v.id("platformAdminChallenges"),
        code: values_1.v.string(),
        deliveryEmail: values_1.v.string(),
        expiresAt: values_1.v.number(),
        maskedEmail: values_1.v.string(),
        purpose: values_1.v.union(values_1.v.literal("setup"), values_1.v.literal("verify")),
        riskReasons: values_1.v.array(riskReasonValidator),
    }),
    handler: async (ctx, args) => {
        const { authContext, session } = await requirePlatformSession(ctx);
        const user = await ctx.db.get(session.userId);
        const emailResult = (0, input_1.validateEmailInput)(user?.email ?? "");
        if (!user || !emailResult.ok) {
            throw new values_1.ConvexError({
                code: "INVALID_STATE",
                message: "Platform Admin email identity could not be resolved.",
            });
        }
        if (authContext.platformAdminAuthStage === "verified") {
            throw new values_1.ConvexError({
                code: "INVALID_STATE",
                message: "Platform Admin verification is already complete for this session.",
            });
        }
        if (authContext.platformAdminAuthStage === "reset_required") {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "Reset your password before regaining Platform Admin access.",
            });
        }
        const now = Date.now();
        await revokeSessionChallenges(ctx, session.sessionId, now);
        const code = createNumericCode();
        const purpose = authContext.platformAdminAuthStage === "setup_required"
            ? "setup"
            : "verify";
        const riskReasons = args.riskReasons ?? session.metadata?.platformAdminRiskReasons ?? [];
        const challengeId = await ctx.db.insert("platformAdminChallenges", {
            userId: session.userId,
            sessionId: session.sessionId,
            purpose,
            codeHash: await (0, risk_1.sha256Hex)(code),
            deliveryEmail: emailResult.value,
            riskLevel: session.metadata?.platformAdminRiskLevel === "suspicious"
                ? "suspicious"
                : "normal",
            riskReasons,
            failedAttempts: 0,
            sentAt: now,
            expiresAt: now + auth_1.PLATFORM_ADMIN_CHALLENGE_WINDOW_MS,
            ipAddress: session.metadata?.platformAdminIpAddress,
            ipCountry: session.metadata?.platformAdminIpCountry,
            ipRegion: session.metadata?.platformAdminIpRegion,
            ipCity: session.metadata?.platformAdminIpCity,
            userAgent: session.metadata?.platformAdminUserAgent,
            createdAt: now,
            updatedAt: now,
        });
        if (session.metadata) {
            await ctx.db.patch(session.metadata._id, {
                lastActivityAt: now,
                isPlatformAdminSession: true,
                platformAdminChallengeId: challengeId,
            });
        }
        await appendPlatformAdminAuditEntry(ctx, {
            event: audit_1.AUDIT_EVENT_NAMES.platformAdminChallengeIssued,
            metadata: {
                ...getRequestContextAuditMetadata({
                    challengeId,
                    riskReasons,
                    session,
                }),
                purpose,
            },
            outcome: session.metadata?.platformAdminRiskLevel === "suspicious"
                ? audit_1.AUDIT_OUTCOMES.allowedWithStepUp
                : audit_1.AUDIT_OUTCOMES.allowed,
            userId: session.userId,
        });
        return {
            id: challengeId,
            code,
            deliveryEmail: emailResult.value,
            expiresAt: now + auth_1.PLATFORM_ADMIN_CHALLENGE_WINDOW_MS,
            maskedEmail: (0, auth_1.maskPlatformAdminEmail)(emailResult.value),
            purpose,
            riskReasons,
        };
    },
});
exports.beginPlatformAdminSignIn = (0, server_2.action)({
    args: {
        signedRequestContext: values_1.v.string(),
    },
    returns: values_1.v.object({
        challengeExpiresAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        redirectPath: values_1.v.string(),
        stage: values_1.v.union(values_1.v.literal("setup_required"), values_1.v.literal("verification_required"), values_1.v.literal("verified"), values_1.v.literal("reset_required")),
    }),
    handler: async (ctx, args) => {
        let requestContext;
        try {
            requestContext = await (0, request_context_token_1.verifySignedPlatformAdminRequestContext)(args.signedRequestContext);
        }
        catch (error) {
            if (error instanceof request_context_token_1.PlatformAdminRequestContextSignatureError) {
                throw new values_1.ConvexError({
                    code: "UNAUTHORIZED",
                    message: error.message,
                });
            }
            throw error;
        }
        const initialized = await ctx.runMutation("functions/platformAdminAuth:initializeCurrentPlatformAdminSession", {
            requestContext,
        });
        if (initialized.stage === "verified" ||
            initialized.stage === "reset_required") {
            return {
                challengeExpiresAt: null,
                redirectPath: initialized.redirectPath,
                stage: initialized.stage,
            };
        }
        const challenge = await ctx.runMutation("functions/platformAdminAuth:prepareCurrentTwoFactorChallengeInternal", {
            riskReasons: initialized.riskReasons,
        });
        try {
            await sendVerificationEmail({
                code: challenge.code,
                email: challenge.deliveryEmail,
                purpose: challenge.purpose,
                riskReasons: challenge.riskReasons,
            });
        }
        catch (error) {
            console.error("Platform Admin verification email failed", error);
            await ctx.runMutation("functions/platformAdminAuth:revokePlatformAdminChallengeInternal", {
                challengeId: challenge.id,
            });
            throw error;
        }
        return {
            challengeExpiresAt: challenge.expiresAt,
            redirectPath: initialized.redirectPath,
            stage: initialized.stage,
        };
    },
});
exports.issueCurrentTwoFactorChallenge = (0, server_2.action)({
    args: {},
    returns: values_1.v.object({
        challengeExpiresAt: values_1.v.number(),
        maskedEmail: values_1.v.string(),
        purpose: values_1.v.union(values_1.v.literal("setup"), values_1.v.literal("verify")),
    }),
    handler: async (ctx) => {
        const challenge = await ctx.runMutation("functions/platformAdminAuth:prepareCurrentTwoFactorChallengeInternal", {});
        try {
            await sendVerificationEmail({
                code: challenge.code,
                email: challenge.deliveryEmail,
                purpose: challenge.purpose,
                riskReasons: challenge.riskReasons,
            });
        }
        catch (error) {
            console.error("Platform Admin verification email failed", error);
            await ctx.runMutation("functions/platformAdminAuth:revokePlatformAdminChallengeInternal", {
                challengeId: challenge.id,
            });
            throw error;
        }
        return {
            challengeExpiresAt: challenge.expiresAt,
            maskedEmail: challenge.maskedEmail,
            purpose: challenge.purpose,
        };
    },
});
exports.getCurrentTwoFactorState = (0, server_2.query)({
    args: {},
    returns: values_1.v.object({
        backupCodesRemaining: values_1.v.number(),
        challengeExpiresAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        challengePurpose: values_1.v.union(values_1.v.literal("setup"), values_1.v.literal("verify"), values_1.v.null()),
        challengeSentAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        maskedEmail: values_1.v.string(),
        riskLevel: values_1.v.union(values_1.v.literal("normal"), values_1.v.literal("suspicious")),
        stage: values_1.v.union(values_1.v.literal("setup_required"), values_1.v.literal("verification_required"), values_1.v.literal("verified"), values_1.v.literal("reset_required")),
    }),
    handler: async (ctx) => {
        const { authContext, session } = await requirePlatformSession(ctx);
        const user = await ctx.db.get(session.userId);
        const securityState = await getSecurityState(ctx, session.userId);
        const activeChallenge = await getActiveChallenge(ctx, {
            sessionId: session.sessionId,
            userId: session.userId,
        });
        return {
            backupCodesRemaining: securityState?.backupCodes.filter((backupCode) => backupCode.consumedAt === undefined).length ?? 0,
            challengeExpiresAt: activeChallenge?.expiresAt ?? null,
            challengePurpose: activeChallenge?.purpose ?? null,
            challengeSentAt: activeChallenge?.sentAt ?? null,
            maskedEmail: (0, auth_1.maskPlatformAdminEmail)(user?.email ?? ""),
            riskLevel: session.metadata?.platformAdminRiskLevel === "suspicious"
                ? "suspicious"
                : "normal",
            stage: authContext.platformAdminAuthStage,
        };
    },
});
async function recordChallengeFailure(ctx, challengeId, now) {
    const challenge = await ctx.db.get(challengeId);
    if (!challenge) {
        throw new values_1.ConvexError({
            code: "INVALID_STATE",
            message: "Platform Admin verification challenge expired. Request a new code.",
        });
    }
    const failedAttempts = challenge.failedAttempts + 1;
    const lockedUntil = failedAttempts >= auth_1.PLATFORM_ADMIN_CHALLENGE_LOCKOUT_THRESHOLD
        ? now + auth_1.PLATFORM_ADMIN_CHALLENGE_LOCKOUT_WINDOW_MS
        : undefined;
    await ctx.db.patch(challengeId, {
        failedAttempts,
        lockedUntil,
        updatedAt: now,
    });
    return {
        failedAttempts,
        lockedUntil: lockedUntil ?? null,
    };
}
async function finalizeVerifiedSession(args) {
    const { ctx, session } = args;
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
        throw new values_1.ConvexError({
            code: "INVALID_STATE",
            message: "Platform Admin verification challenge expired. Request a new code.",
        });
    }
    const securityState = await ensureSecurityState(ctx, session.userId, challenge.deliveryEmail);
    const now = Date.now();
    const backupCodes = challenge.purpose === "setup"
        ? await Promise.all(Array.from({ length: auth_1.PLATFORM_ADMIN_BACKUP_CODE_COUNT }).map(async () => {
            const rawCode = createBackupCode();
            return {
                codeHash: await (0, risk_1.sha256Hex)(rawCode),
                displayValue: formatBackupCode(rawCode),
                createdAt: now,
                suffix: rawCode.slice(-4),
            };
        }))
        : [];
    const trustFingerprint = await (0, risk_1.fingerprintPlatformAdminRequestContext)({
        country: session.metadata?.platformAdminIpCountry ?? null,
        ipAddress: session.metadata?.platformAdminIpAddress ?? null,
        isPIIAllowed: true,
        userAgent: session.metadata?.platformAdminUserAgent ?? null,
    });
    await ctx.db.patch(securityState._id, {
        backupCodes: challenge.purpose === "setup"
            ? backupCodes.map((code) => ({
                codeHash: code.codeHash,
                createdAt: code.createdAt,
                suffix: code.suffix,
            }))
            : securityState.backupCodes,
        enrollmentEmail: challenge.deliveryEmail,
        isTwoFactorEnrolled: true,
        lastTrustedAt: now,
        lastTrustedCountry: trustFingerprint.country ?? undefined,
        lastTrustedIpHash: trustFingerprint.ipHash ?? undefined,
        lastTrustedUserAgentHash: trustFingerprint.userAgentHash ?? undefined,
        passwordResetCompletionTokenHash: undefined,
        passwordResetCompletionTokenIssuedAt: undefined,
        passwordResetRequiredAt: undefined,
        revokedAt: undefined,
        updatedAt: now,
    });
    await ctx.db.patch(args.challengeId, {
        consumedAt: now,
        updatedAt: now,
    });
    if (session.metadata) {
        await ctx.db.patch(session.metadata._id, {
            lastActivityAt: now,
            isPlatformAdminSession: true,
            platformAdminAuthStage: "verified",
            platformAdminChallengeId: undefined,
            platformAdminTrustedAt: now,
            platformAdminVerificationMethod: args.verificationMethod,
            platformAdminVerifiedAt: now,
        });
    }
    return backupCodes.map((code) => code.displayValue);
}
exports.verifyCurrentTwoFactorCode = (0, server_2.mutation)({
    args: {
        code: values_1.v.string(),
    },
    returns: values_1.v.object({
        backupCodes: values_1.v.array(values_1.v.string()),
        redirectPath: values_1.v.string(),
    }),
    handler: async (ctx, args) => {
        const { authContext, session } = await requirePlatformSession(ctx);
        const codeResult = (0, input_1.validateOneTimeCodeInput)(args.code, {
            field: "code",
            label: "Verification code",
        });
        if (!codeResult.ok) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                message: codeResult.issue.message,
            });
        }
        const challenge = await getActiveChallenge(ctx, {
            purpose: authContext.platformAdminAuthStage === "setup_required"
                ? "setup"
                : "verify",
            sessionId: session.sessionId,
            userId: session.userId,
        });
        if (!challenge) {
            await appendPlatformAdminAuditEntry(ctx, {
                event: audit_1.AUDIT_EVENT_NAMES.platformAdminChallengeExpired,
                metadata: {
                    ...getRequestContextAuditMetadata({ session }),
                    reason: "challenge_expired",
                },
                outcome: audit_1.AUDIT_OUTCOMES.blockedPlatformAdminChallengeExpired,
                userId: session.userId,
            });
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "Platform Admin verification challenge expired. Request a new code.",
            });
        }
        const now = Date.now();
        if (challenge.lockedUntil !== undefined && challenge.lockedUntil > now) {
            await appendPlatformAdminAuditEntry(ctx, {
                event: audit_1.AUDIT_EVENT_NAMES.platformAdminChallengeBlocked,
                metadata: {
                    ...getRequestContextAuditMetadata({
                        challengeId: challenge._id,
                        riskReasons: challenge.riskReasons,
                        session,
                    }),
                    reason: "challenge_locked",
                },
                outcome: audit_1.AUDIT_OUTCOMES.blockedPlatformAdminChallengeLocked,
                userId: session.userId,
            });
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "Too many failed verification attempts. Request a fresh code and try again.",
            });
        }
        const submittedCodeHash = await (0, risk_1.sha256Hex)(codeResult.value);
        if (submittedCodeHash !== challenge.codeHash) {
            const failureState = await recordChallengeFailure(ctx, challenge._id, now);
            await appendPlatformAdminAuditEntry(ctx, {
                event: audit_1.AUDIT_EVENT_NAMES.platformAdminChallengeRejected,
                metadata: {
                    ...getRequestContextAuditMetadata({
                        challengeId: challenge._id,
                        riskReasons: challenge.riskReasons,
                        session,
                    }),
                    failedAttempts: failureState.failedAttempts,
                    reason: "invalid_code",
                },
                outcome: failureState.lockedUntil !== null
                    ? audit_1.AUDIT_OUTCOMES.blockedPlatformAdminChallengeLocked
                    : audit_1.AUDIT_OUTCOMES.rejectedInvalidCode,
                userId: session.userId,
            });
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: failureState.lockedUntil !== null
                    ? "Too many failed verification attempts. Request a fresh code and try again."
                    : "Verification code is invalid. Please try again.",
            });
        }
        const backupCodes = await finalizeVerifiedSession({
            challengeId: challenge._id,
            ctx,
            session,
            verificationMethod: "email_otp",
        });
        await appendPlatformAdminAuditEntry(ctx, {
            event: audit_1.AUDIT_EVENT_NAMES.platformAdminChallengeVerified,
            metadata: {
                ...getRequestContextAuditMetadata({
                    challengeId: challenge._id,
                    riskReasons: challenge.riskReasons,
                    session,
                }),
                purpose: challenge.purpose,
                verificationMethod: "email_otp",
            },
            outcome: challenge.riskLevel === "suspicious"
                ? audit_1.AUDIT_OUTCOMES.allowedWithStepUp
                : audit_1.AUDIT_OUTCOMES.allowed,
            userId: session.userId,
        });
        return {
            backupCodes,
            redirectPath: (0, auth_1.getPlatformAdminRedirectPath)("verified"),
        };
    },
});
exports.verifyCurrentBackupCode = (0, server_2.mutation)({
    args: {
        backupCode: values_1.v.string(),
    },
    returns: values_1.v.object({
        redirectPath: values_1.v.string(),
    }),
    handler: async (ctx, args) => {
        const { authContext, session } = await requirePlatformSession(ctx);
        const challenge = await getActiveChallenge(ctx, {
            purpose: authContext.platformAdminAuthStage === "setup_required"
                ? "setup"
                : "verify",
            sessionId: session.sessionId,
            userId: session.userId,
        });
        const securityState = await getSecurityState(ctx, session.userId);
        const now = Date.now();
        if (!challenge || !securityState) {
            await appendPlatformAdminAuditEntry(ctx, {
                event: audit_1.AUDIT_EVENT_NAMES.platformAdminBackupCodeRejected,
                metadata: {
                    ...getRequestContextAuditMetadata({ session }),
                    reason: "challenge_expired",
                },
                outcome: audit_1.AUDIT_OUTCOMES.blockedPlatformAdminChallengeExpired,
                userId: session.userId,
            });
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "Platform Admin verification challenge expired. Request a new code.",
            });
        }
        if (challenge.lockedUntil !== undefined && challenge.lockedUntil > now) {
            await appendPlatformAdminAuditEntry(ctx, {
                event: audit_1.AUDIT_EVENT_NAMES.platformAdminBackupCodeRejected,
                metadata: {
                    ...getRequestContextAuditMetadata({
                        challengeId: challenge._id,
                        riskReasons: challenge.riskReasons,
                        session,
                    }),
                    reason: "challenge_locked",
                },
                outcome: audit_1.AUDIT_OUTCOMES.blockedPlatformAdminChallengeLocked,
                userId: session.userId,
            });
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "Too many failed verification attempts. Request a fresh code and try again.",
            });
        }
        const consumedBackupCode = (0, auth_1.consumePlatformAdminBackupCode)({
            backupCodes: securityState.backupCodes,
            normalizedCodeHash: await (0, risk_1.sha256Hex)((0, auth_1.normalizePlatformAdminBackupCode)(args.backupCode)),
            now,
        });
        if (!consumedBackupCode.ok) {
            const failureState = await recordChallengeFailure(ctx, challenge._id, now);
            await appendPlatformAdminAuditEntry(ctx, {
                event: audit_1.AUDIT_EVENT_NAMES.platformAdminBackupCodeRejected,
                metadata: {
                    ...getRequestContextAuditMetadata({
                        challengeId: challenge._id,
                        riskReasons: challenge.riskReasons,
                        session,
                    }),
                    failedAttempts: failureState.failedAttempts,
                    reason: consumedBackupCode.reason,
                },
                outcome: failureState.lockedUntil !== null
                    ? audit_1.AUDIT_OUTCOMES.blockedPlatformAdminChallengeLocked
                    : consumedBackupCode.reason === "already_consumed"
                        ? audit_1.AUDIT_OUTCOMES.blockedPlatformAdminBackupCodeReplay
                        : audit_1.AUDIT_OUTCOMES.rejectedInvalidCode,
                userId: session.userId,
            });
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: failureState.lockedUntil !== null
                    ? "Too many failed verification attempts. Request a fresh code and try again."
                    : consumedBackupCode.reason === "already_consumed"
                        ? "That backup code has already been used."
                        : "Backup code is invalid. Please try again.",
            });
        }
        await ctx.db.patch(securityState._id, {
            backupCodes: consumedBackupCode.updatedBackupCodes,
            updatedAt: now,
        });
        await finalizeVerifiedSession({
            challengeId: challenge._id,
            ctx,
            session,
            verificationMethod: "backup_code",
        });
        await appendPlatformAdminAuditEntry(ctx, {
            event: audit_1.AUDIT_EVENT_NAMES.platformAdminBackupCodeUsed,
            metadata: {
                ...getRequestContextAuditMetadata({
                    challengeId: challenge._id,
                    riskReasons: challenge.riskReasons,
                    session,
                }),
                purpose: challenge.purpose,
                verificationMethod: "backup_code",
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowedBackupCode,
            userId: session.userId,
        });
        return {
            redirectPath: (0, auth_1.getPlatformAdminRedirectPath)("verified"),
        };
    },
});
exports.getPlatformAdminSecurityOverview = (0, server_2.query)({
    args: {},
    returns: values_1.v.object({
        backupCodesRemaining: values_1.v.number(),
        deleteBlockedMessage: values_1.v.string(),
        lastTrustedAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        lastTrustedCountry: values_1.v.union(values_1.v.string(), values_1.v.null()),
        sessions: values_1.v.array(values_1.v.object({
            ipAddress: values_1.v.union(values_1.v.string(), values_1.v.null()),
            ipCity: values_1.v.union(values_1.v.string(), values_1.v.null()),
            ipCountry: values_1.v.union(values_1.v.string(), values_1.v.null()),
            ipRegion: values_1.v.union(values_1.v.string(), values_1.v.null()),
            isCurrent: values_1.v.boolean(),
            lastActivityAt: values_1.v.number(),
            location: values_1.v.union(values_1.v.string(), values_1.v.null()),
            revocationReason: values_1.v.union(values_1.v.string(), values_1.v.null()),
            sessionId: values_1.v.id("authSessions"),
            status: values_1.v.union(values_1.v.literal("active"), values_1.v.literal("expired"), values_1.v.literal("revoked"), values_1.v.literal("logged_out")),
            userAgent: values_1.v.union(values_1.v.string(), values_1.v.null()),
            verificationMethod: values_1.v.union(values_1.v.literal("email_otp"), values_1.v.literal("backup_code"), values_1.v.null()),
            verifiedAt: values_1.v.union(values_1.v.number(), values_1.v.null()),
        })),
    }),
    handler: async (ctx) => {
        const authContext = await (0, _roleGuard_1.requireVerifiedPlatformAdmin)(ctx);
        const currentSession = await (0, sessions_1.loadCurrentSessionDocuments)(ctx);
        const securityState = await getSecurityState(ctx, authContext.userId);
        const sessionMetadata = await ctx.db
            .query("sessionMetadata")
            .withIndex("by_userId", (q) => q.eq("userId", authContext.userId))
            .collect();
        const sessions = await Promise.all(sessionMetadata
            .filter((metadata) => metadata.isPlatformAdminSession === true)
            .map(async (metadata) => {
            const authSession = await ctx.db.get(metadata.sessionId);
            const state = (0, session_1.resolveSessionState)({
                authSession,
                metadata,
            });
            const locationParts = [
                metadata.platformAdminIpCity,
                metadata.platformAdminIpRegion,
                metadata.platformAdminIpCountry,
            ].filter((value) => typeof value === "string");
            return {
                ipAddress: metadata.platformAdminIpAddress ?? null,
                ipCity: metadata.platformAdminIpCity ?? null,
                ipCountry: metadata.platformAdminIpCountry ?? null,
                ipRegion: metadata.platformAdminIpRegion ?? null,
                isCurrent: currentSession?.sessionId === metadata.sessionId,
                lastActivityAt: metadata.lastActivityAt,
                location: locationParts.length > 0 ? locationParts.join(", ") : null,
                revocationReason: metadata.platformAdminRevocationReason ?? null,
                sessionId: metadata.sessionId,
                status: state.status,
                userAgent: metadata.platformAdminUserAgent ?? null,
                verificationMethod: metadata.platformAdminVerificationMethod ?? null,
                verifiedAt: metadata.platformAdminVerifiedAt ?? null,
            };
        }));
        return {
            backupCodesRemaining: securityState?.backupCodes.filter((backupCode) => backupCode.consumedAt === undefined).length ?? 0,
            deleteBlockedMessage: auth_1.PLATFORM_ADMIN_DELETE_BLOCKED_MESSAGE,
            lastTrustedAt: securityState?.lastTrustedAt ?? null,
            lastTrustedCountry: securityState?.lastTrustedCountry ?? null,
            sessions,
        };
    },
});
exports.revokeAllPlatformAdminSessions = (0, server_2.mutation)({
    args: {},
    returns: values_1.v.object({
        challengeCount: values_1.v.number(),
        sessionCount: values_1.v.number(),
    }),
    handler: async (ctx) => {
        const authContext = await (0, _roleGuard_1.requireVerifiedPlatformAdmin)(ctx);
        const currentSession = await (0, sessions_1.loadCurrentSessionDocuments)(ctx);
        const user = await ctx.db.get(authContext.userId);
        const emailResult = (0, input_1.validateEmailInput)(user?.email ?? "");
        const securityState = await ensureSecurityState(ctx, authContext.userId, emailResult.ok ? emailResult.value : "");
        const allSessionMetadata = await ctx.db
            .query("sessionMetadata")
            .withIndex("by_userId", (q) => q.eq("userId", authContext.userId))
            .collect();
        const challenges = await ctx.db
            .query("platformAdminChallenges")
            .withIndex("by_userId", (q) => q.eq("userId", authContext.userId))
            .collect();
        const now = Date.now();
        const platformAdminSessions = allSessionMetadata.filter((metadata) => metadata.isPlatformAdminSession === true);
        const activeChallenges = challenges.filter((challenge) => challenge.consumedAt === undefined && challenge.revokedAt === undefined);
        for (const metadata of platformAdminSessions) {
            await ctx.db.patch(metadata._id, {
                lastActivityAt: now,
                platformAdminAuthStage: "reset_required",
                platformAdminChallengeId: undefined,
                platformAdminRevocationReason: "revoke_all",
                revokedAt: now,
            });
        }
        for (const challenge of activeChallenges) {
            await ctx.db.patch(challenge._id, {
                revokedAt: now,
                updatedAt: now,
            });
        }
        await ctx.db.patch(securityState._id, {
            passwordResetRequiredAt: now,
            revokedAt: now,
            updatedAt: now,
        });
        const requestContextAuditMetadata = currentSession
            ? getRequestContextAuditMetadata({ session: currentSession })
            : {};
        await appendPlatformAdminAuditEntry(ctx, {
            event: audit_1.AUDIT_EVENT_NAMES.platformAdminSessionRevoked,
            metadata: {
                ...requestContextAuditMetadata,
                challengeCount: activeChallenges.length,
                sessionCount: platformAdminSessions.length,
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            userId: authContext.userId,
        });
        return {
            challengeCount: activeChallenges.length,
            sessionCount: platformAdminSessions.length,
        };
    },
});
exports.clearCurrentPlatformAdminPasswordResetRequirement = (0, server_2.mutation)({
    args: {
        resetCompletionToken: values_1.v.optional(values_1.v.string()),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const userId = await (0, server_1.getAuthUserId)(ctx);
        if (!userId) {
            throw new values_1.ConvexError({
                code: "UNAUTHORIZED",
                message: "You must be signed in to continue.",
            });
        }
        const securityState = await getSecurityState(ctx, userId);
        if (!securityState) {
            return null;
        }
        if (securityState.passwordResetRequiredAt === undefined) {
            return null;
        }
        const token = args.resetCompletionToken?.trim();
        if (!token) {
            throw new values_1.ConvexError({
                code: "FORBIDDEN",
                message: "A completed password reset is required before Platform Admin access can be restored.",
            });
        }
        if (!securityState.passwordResetCompletionTokenHash ||
            securityState.passwordResetCompletionTokenIssuedAt === undefined) {
            throw new values_1.ConvexError({
                code: "FORBIDDEN",
                message: "The Platform Admin password reset completion token is missing or expired. Request a fresh reset link.",
            });
        }
        const submittedTokenHash = await (0, risk_1.sha256Hex)(token);
        if (!constantTimeEqual(submittedTokenHash, securityState.passwordResetCompletionTokenHash)) {
            throw new values_1.ConvexError({
                code: "FORBIDDEN",
                message: "The Platform Admin password reset completion token could not be verified.",
            });
        }
        await ctx.db.patch(securityState._id, {
            passwordResetCompletionTokenHash: undefined,
            passwordResetCompletionTokenIssuedAt: undefined,
            passwordResetRequiredAt: undefined,
            revokedAt: undefined,
            updatedAt: Date.now(),
        });
        return null;
    },
});
exports.preparePlatformAdminPasswordResetCompletionToken = (0, server_2.internalMutation)({
    args: {
        email: values_1.v.string(),
        resetCompletionToken: values_1.v.string(),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const emailResult = (0, input_1.validateEmailInput)(args.email);
        if (!emailResult.ok) {
            return null;
        }
        const user = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", emailResult.value))
            .first();
        if (!user) {
            return null;
        }
        const platformUser = await ctx.db
            .query("platformUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .first();
        if (!platformUser) {
            return null;
        }
        const securityState = await ensureSecurityState(ctx, user._id, emailResult.value);
        const now = Date.now();
        await ctx.db.patch(securityState._id, {
            passwordResetCompletionTokenHash: await (0, risk_1.sha256Hex)(args.resetCompletionToken.trim()),
            passwordResetCompletionTokenIssuedAt: now,
            updatedAt: now,
        });
        return null;
    },
});
exports.revokePlatformAdminChallengeInternal = (0, server_2.internalMutation)({
    args: {
        challengeId: values_1.v.id("platformAdminChallenges"),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        await revokePlatformAdminChallenge(ctx, args.challengeId);
        return null;
    },
});
exports.clearPlatformAdminPasswordResetRequirementForEmail = (0, server_2.internalMutation)({
    args: {
        email: values_1.v.string(),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const emailResult = (0, input_1.validateEmailInput)(args.email);
        if (!emailResult.ok) {
            return null;
        }
        const user = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", emailResult.value))
            .first();
        if (!user) {
            return null;
        }
        const securityState = await getSecurityState(ctx, user._id);
        if (!securityState) {
            return null;
        }
        await ctx.db.patch(securityState._id, {
            passwordResetCompletionTokenHash: undefined,
            passwordResetCompletionTokenIssuedAt: undefined,
            passwordResetRequiredAt: undefined,
            revokedAt: undefined,
            updatedAt: Date.now(),
        });
        return null;
    },
});
exports.attemptDeleteCurrentPlatformAdminAccount = (0, server_2.mutation)({
    args: {},
    returns: values_1.v.null(),
    handler: async (ctx) => {
        const authContext = await (0, _roleGuard_1.requirePlatformAdminSession)(ctx);
        const currentSession = await (0, sessions_1.loadCurrentSessionDocuments)(ctx);
        await appendPlatformAdminAuditEntry(ctx, {
            event: audit_1.AUDIT_EVENT_NAMES.platformAdminDeletionBlocked,
            metadata: {
                ...(currentSession
                    ? getRequestContextAuditMetadata({ session: currentSession })
                    : {}),
                message: auth_1.PLATFORM_ADMIN_DELETE_BLOCKED_MESSAGE,
            },
            outcome: audit_1.AUDIT_OUTCOMES.blockedPlatformAdminDeletion,
            userId: authContext.userId,
        });
        throw new values_1.ConvexError({
            code: "FORBIDDEN",
            message: auth_1.PLATFORM_ADMIN_DELETE_BLOCKED_MESSAGE,
        });
    },
});
