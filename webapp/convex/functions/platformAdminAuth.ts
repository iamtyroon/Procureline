import { getAuthUserId } from "@convex-dev/auth/server";
import { generateRandomString } from "@oslojs/crypto/random";
import { Resend as ResendAPI } from "resend";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
    action,
    internalMutation,
    mutation,
    query,
    type MutationCtx,
    type QueryCtx,
} from "../_generated/server";
import {
    AUDIT_EVENT_NAMES,
    AUDIT_OUTCOMES,
    createAuthenticatedAuditActor,
    type AuditEventEntry,
    type AuditEventName,
    type AuditOutcome,
} from "../../lib/security/audit";
import {
    consumePlatformAdminBackupCode,
    getPlatformAdminRedirectPath,
    maskPlatformAdminEmail,
    normalizePlatformAdminBackupCode,
    PLATFORM_ADMIN_BACKUP_CODE_COUNT,
    PLATFORM_ADMIN_CHALLENGE_LOCKOUT_THRESHOLD,
    PLATFORM_ADMIN_CHALLENGE_LOCKOUT_WINDOW_MS,
    PLATFORM_ADMIN_CHALLENGE_WINDOW_MS,
    PLATFORM_ADMIN_DELETE_BLOCKED_MESSAGE,
    resolvePlatformAdminAuthStage,
    type PlatformAdminAuthStage,
    type PlatformAdminChallengePurpose,
    type PlatformAdminRiskReason,
    type PlatformAdminVerificationMethod,
} from "../../lib/platform-admin/auth";
import {
    evaluatePlatformAdminRisk,
    fingerprintPlatformAdminRequestContext,
    sha256Hex,
} from "../../lib/platform-admin/risk";
import { resolveSessionState } from "../../lib/auth/session";
import {
    validateEmailInput,
    validateOneTimeCodeInput,
} from "../../lib/security/input";
import { appendAuditLogBestEffort } from "./_audit";
import { loadCurrentSessionDocuments } from "./sessions";
import {
    getAuthorizationContext,
    requirePlatformAdminSession,
    requireVerifiedPlatformAdmin,
} from "./_roleGuard";

const requestContextValidator = v.object({
    city: v.union(v.string(), v.null()),
    country: v.union(v.string(), v.null()),
    ipAddress: v.union(v.string(), v.null()),
    region: v.union(v.string(), v.null()),
    userAgent: v.union(v.string(), v.null()),
});

const riskReasonValidator = v.union(
    v.literal("country_changed"),
    v.literal("ip_changed"),
    v.literal("user_agent_changed"),
);

type ReadCtx = QueryCtx | MutationCtx;
type ActivePlatformAdminStage = Exclude<PlatformAdminAuthStage, "not_applicable">;

function randomReader() {
    return {
        read(bytes: Uint8Array): void {
            crypto.getRandomValues(bytes);
        },
    };
}

function createNumericCode(): string {
    return generateRandomString(randomReader(), "0123456789", 8);
}

function createBackupCode(): string {
    return generateRandomString(
        randomReader(),
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
        10,
    );
}

function formatBackupCode(rawCode: string): string {
    return `${rawCode.slice(0, 5)}-${rawCode.slice(5)}`;
}

async function sendVerificationEmail(args: {
    code: string;
    email: string;
    purpose: PlatformAdminChallengePurpose;
    riskReasons: PlatformAdminRiskReason[];
}): Promise<void> {
    const apiKey = process.env.AUTH_RESEND_KEY;
    if (!apiKey) {
        throw new Error("AUTH_RESEND_KEY environment variable is not set");
    }

    const resend = new ResendAPI(apiKey);
    const headline =
        args.purpose === "setup"
            ? "Finish your Platform Admin 2FA setup"
            : "Complete your Platform Admin verification";
    const contextLine =
        args.riskReasons.length > 0
            ? "We noticed a new or unusual sign-in context, so extra verification is required before this admin session is trusted."
            : "Enter this code to continue into the Platform Admin workspace.";

    const { error } = await resend.emails.send({
        from: "Procureline <onboarding@resend.dev>",
        to: [args.email],
        subject: headline,
        text: `${contextLine}\n\nYour code is ${args.code}. It expires in 15 minutes.`,
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
    });

    if (error) {
        throw new Error(`Could not send verification email: ${JSON.stringify(error)}`);
    }
}

function createAuditEntry(args: {
    event: AuditEventName;
    metadata?: Record<string, unknown>;
    outcome: AuditOutcome;
    userId: Id<"users">;
}): AuditEventEntry {
    return {
        action: "authenticate",
        actor: createAuthenticatedAuditActor({
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

async function ensureSecurityState(
    ctx: MutationCtx,
    userId: Id<"users">,
    userEmail: string,
) {
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
        throw new ConvexError({
            code: "INVALID_STATE",
            message: "Platform Admin security state could not be initialized.",
        });
    }

    return createdState;
}

async function getSecurityState(
    ctx: ReadCtx,
    userId: Id<"users">,
): Promise<Doc<"platformAdminSecurityStates"> | null> {
    return await ctx.db
        .query("platformAdminSecurityStates")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
}

async function requirePlatformSession(
    ctx: QueryCtx | MutationCtx,
): Promise<{
    authContext: Awaited<ReturnType<typeof requirePlatformAdminSession>>;
    session: NonNullable<Awaited<ReturnType<typeof loadCurrentSessionDocuments>>>;
}> {
    const authContext = await requirePlatformAdminSession(ctx);
    const session = await loadCurrentSessionDocuments(ctx);

    if (!session) {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "You must be signed in to continue.",
        });
    }

    return { authContext, session };
}

async function getActiveChallenge(
    ctx: ReadCtx,
    args: {
        purpose?: PlatformAdminChallengePurpose;
        sessionId: Id<"authSessions">;
        userId: Id<"users">;
    },
): Promise<Doc<"platformAdminChallenges"> | null> {
    const challenges = await ctx.db
        .query("platformAdminChallenges")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId))
        .collect();
    const now = Date.now();

    return (
        challenges
            .filter(
                (challenge) =>
                    challenge.sessionId === args.sessionId &&
                    (args.purpose ? challenge.purpose === args.purpose : true) &&
                    challenge.consumedAt === undefined &&
                    challenge.revokedAt === undefined &&
                    challenge.expiresAt > now,
            )
            .sort((left, right) => right.createdAt - left.createdAt)[0] ?? null
    );
}

async function revokeSessionChallenges(
    ctx: MutationCtx,
    sessionId: Id<"authSessions">,
    userId: Id<"users">,
    now: number,
): Promise<void> {
    const challenges = await ctx.db
        .query("platformAdminChallenges")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();

    for (const challenge of challenges) {
        if (
            challenge.sessionId !== sessionId ||
            challenge.consumedAt !== undefined ||
            challenge.revokedAt !== undefined ||
            challenge.expiresAt <= now
        ) {
            continue;
        }

        await ctx.db.patch(challenge._id, {
            revokedAt: now,
            updatedAt: now,
        });
    }
}

export const initializeCurrentPlatformAdminSession = mutation({
    args: {
        requestContext: requestContextValidator,
    },
    returns: v.object({
        redirectPath: v.string(),
        riskLevel: v.union(v.literal("normal"), v.literal("suspicious")),
        riskReasons: v.array(riskReasonValidator),
        stage: v.union(
            v.literal("setup_required"),
            v.literal("verification_required"),
            v.literal("verified"),
            v.literal("reset_required"),
        ),
    }),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        const authContext = await getAuthorizationContext(ctx);
        const session = await loadCurrentSessionDocuments(ctx);

        if (!userId || !authContext || !session) {
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "You must be signed in to continue.",
            });
        }

        if (authContext.role !== "platform_admin" || authContext.scope !== "platform") {
            await appendAuditLogBestEffort(
                ctx,
                createAuditEntry({
                    event: AUDIT_EVENT_NAMES.platformAdminNonAdminDenied,
                    metadata: {
                        attemptedRole: authContext.role,
                    },
                    outcome: AUDIT_OUTCOMES.blockedPlatformAdminAccessDenied,
                    userId,
                }),
            );

            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "Platform Admin access is restricted to platform administrators.",
            });
        }

        const user = await ctx.db.get(userId);
        const emailResult = validateEmailInput(user?.email ?? "");
        if (!user || !emailResult.ok) {
            throw new ConvexError({
                code: "INVALID_STATE",
                message: "Platform Admin email identity could not be resolved.",
            });
        }

        const securityState = await ensureSecurityState(ctx, userId, emailResult.value);
        const fingerprint = await fingerprintPlatformAdminRequestContext(
            args.requestContext,
        );
        const risk = await evaluatePlatformAdminRisk({
            baseline: {
                country: securityState.lastTrustedCountry,
                ipHash: securityState.lastTrustedIpHash,
                userAgentHash: securityState.lastTrustedUserAgentHash,
            },
            current: fingerprint,
        });
        const stage = resolvePlatformAdminAuthStage({
            currentSessionStage: session.metadata?.platformAdminAuthStage ?? null,
            hasTwoFactorEnrollment: securityState.isTwoFactorEnrolled,
            passwordResetRequiredAt: securityState.passwordResetRequiredAt,
            storedBackupCodeCount: securityState.backupCodes.length,
        }) as ActivePlatformAdminStage;
        const now = Date.now();
        const metadataPatch = {
            rememberMe: false,
            lastActivityAt: now,
            isPlatformAdminSession: true,
            platformAdminAuthStage: stage,
            platformAdminRiskLevel: risk.level as "normal" | "suspicious",
            platformAdminIpAddress: args.requestContext.ipAddress ?? undefined,
            platformAdminIpCity: args.requestContext.city ?? undefined,
            platformAdminIpCountry: args.requestContext.country ?? undefined,
            platformAdminIpRegion: args.requestContext.region ?? undefined,
            platformAdminUserAgent: args.requestContext.userAgent ?? undefined,
        };

        if (session.metadata) {
            await ctx.db.patch(session.metadata._id, metadataPatch);
        } else {
            await ctx.db.insert("sessionMetadata", {
                sessionId: session.sessionId,
                userId,
                createdAt: now,
                rememberMe: false,
                lastActivityAt: now,
                isPlatformAdminSession: true,
                platformAdminAuthStage: stage,
                platformAdminRiskLevel: risk.level as "normal" | "suspicious",
                platformAdminIpAddress: args.requestContext.ipAddress ?? undefined,
                platformAdminIpCity: args.requestContext.city ?? undefined,
                platformAdminIpCountry: args.requestContext.country ?? undefined,
                platformAdminIpRegion: args.requestContext.region ?? undefined,
                platformAdminUserAgent: args.requestContext.userAgent ?? undefined,
            });
        }

        await appendAuditLogBestEffort(
            ctx,
            createAuditEntry({
                event:
                    stage === "reset_required"
                        ? AUDIT_EVENT_NAMES.platformAdminPasswordResetRequired
                        : AUDIT_EVENT_NAMES.platformAdminSessionInitialized,
                metadata: {
                    riskLevel: risk.level,
                    riskReasons: risk.reasons,
                    sessionId: String(session.sessionId),
                    stage,
                },
                outcome:
                    stage === "reset_required"
                        ? AUDIT_OUTCOMES.blockedPlatformAdminPasswordResetRequired
                        : risk.level === "suspicious"
                            ? AUDIT_OUTCOMES.allowedWithStepUp
                            : AUDIT_OUTCOMES.allowed,
                userId,
            }),
        );

        return {
            redirectPath: getPlatformAdminRedirectPath(stage),
            riskLevel: risk.level,
            riskReasons: risk.reasons,
            stage,
        };
    },
});

export const prepareCurrentTwoFactorChallengeInternal = internalMutation({
    args: {},
    returns: v.object({
        code: v.string(),
        deliveryEmail: v.string(),
        expiresAt: v.number(),
        maskedEmail: v.string(),
        purpose: v.union(v.literal("setup"), v.literal("verify")),
        riskReasons: v.array(riskReasonValidator),
    }),
    handler: async (ctx) => {
        const { authContext, session } = await requirePlatformSession(ctx);
        const user = await ctx.db.get(session.userId);
        const emailResult = validateEmailInput(user?.email ?? "");

        if (!user || !emailResult.ok) {
            throw new ConvexError({
                code: "INVALID_STATE",
                message: "Platform Admin email identity could not be resolved.",
            });
        }

        if (authContext.platformAdminAuthStage === "verified") {
            throw new ConvexError({
                code: "INVALID_STATE",
                message: "Platform Admin verification is already complete for this session.",
            });
        }

        if (authContext.platformAdminAuthStage === "reset_required") {
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "Reset your password before regaining Platform Admin access.",
            });
        }

        const now = Date.now();
        await revokeSessionChallenges(ctx, session.sessionId, session.userId, now);

        const code = createNumericCode();
        const purpose: PlatformAdminChallengePurpose =
            authContext.platformAdminAuthStage === "setup_required"
                ? "setup"
                : "verify";
        const challengeId = await ctx.db.insert("platformAdminChallenges", {
            userId: session.userId,
            sessionId: session.sessionId,
            purpose,
            codeHash: await sha256Hex(code),
            deliveryEmail: emailResult.value,
            riskLevel:
                session.metadata?.platformAdminRiskLevel === "suspicious"
                    ? "suspicious"
                    : "normal",
            riskReasons: [],
            failedAttempts: 0,
            sentAt: now,
            expiresAt: now + PLATFORM_ADMIN_CHALLENGE_WINDOW_MS,
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

        await appendAuditLogBestEffort(
            ctx,
            createAuditEntry({
                event: AUDIT_EVENT_NAMES.platformAdminChallengeIssued,
                metadata: {
                    challengeId: String(challengeId),
                    purpose,
                    sessionId: String(session.sessionId),
                },
                outcome:
                    session.metadata?.platformAdminRiskLevel === "suspicious"
                        ? AUDIT_OUTCOMES.allowedWithStepUp
                        : AUDIT_OUTCOMES.allowed,
                userId: session.userId,
            }),
        );

        return {
            code,
            deliveryEmail: emailResult.value,
            expiresAt: now + PLATFORM_ADMIN_CHALLENGE_WINDOW_MS,
            maskedEmail: maskPlatformAdminEmail(emailResult.value),
            purpose,
            riskReasons: [],
        };
    },
});

export const beginPlatformAdminSignIn = action({
    args: {
        requestContext: requestContextValidator,
    },
    returns: v.object({
        challengeExpiresAt: v.union(v.number(), v.null()),
        redirectPath: v.string(),
        stage: v.union(
            v.literal("setup_required"),
            v.literal("verification_required"),
            v.literal("verified"),
            v.literal("reset_required"),
        ),
    }),
    handler: async (ctx, args) => {
        const initialized = await ctx.runMutation(
            "functions/platformAdminAuth:initializeCurrentPlatformAdminSession" as any,
            {
                requestContext: args.requestContext,
            },
        );

        if (
            initialized.stage === "verified" ||
            initialized.stage === "reset_required"
        ) {
            return {
                challengeExpiresAt: null,
                redirectPath: initialized.redirectPath,
                stage: initialized.stage,
            };
        }

        const challenge = await ctx.runMutation(
            "functions/platformAdminAuth:prepareCurrentTwoFactorChallengeInternal" as any,
            {},
        );

        await sendVerificationEmail({
            code: challenge.code,
            email: challenge.deliveryEmail,
            purpose: challenge.purpose,
            riskReasons: challenge.riskReasons,
        });

        return {
            challengeExpiresAt: challenge.expiresAt,
            redirectPath: initialized.redirectPath,
            stage: initialized.stage,
        };
    },
});

export const issueCurrentTwoFactorChallenge = action({
    args: {},
    returns: v.object({
        challengeExpiresAt: v.number(),
        maskedEmail: v.string(),
        purpose: v.union(v.literal("setup"), v.literal("verify")),
    }),
    handler: async (ctx) => {
        const challenge = await ctx.runMutation(
            "functions/platformAdminAuth:prepareCurrentTwoFactorChallengeInternal" as any,
            {},
        );

        await sendVerificationEmail({
            code: challenge.code,
            email: challenge.deliveryEmail,
            purpose: challenge.purpose,
            riskReasons: challenge.riskReasons,
        });

        return {
            challengeExpiresAt: challenge.expiresAt,
            maskedEmail: challenge.maskedEmail,
            purpose: challenge.purpose,
        };
    },
});

export const getCurrentTwoFactorState = query({
    args: {},
    returns: v.object({
        backupCodesRemaining: v.number(),
        challengeExpiresAt: v.union(v.number(), v.null()),
        challengePurpose: v.union(v.literal("setup"), v.literal("verify"), v.null()),
        challengeSentAt: v.union(v.number(), v.null()),
        maskedEmail: v.string(),
        riskLevel: v.union(v.literal("normal"), v.literal("suspicious")),
        stage: v.union(
            v.literal("setup_required"),
            v.literal("verification_required"),
            v.literal("verified"),
            v.literal("reset_required"),
        ),
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
            backupCodesRemaining:
                securityState?.backupCodes.filter(
                    (backupCode) => backupCode.consumedAt === undefined,
                ).length ?? 0,
            challengeExpiresAt: activeChallenge?.expiresAt ?? null,
            challengePurpose: activeChallenge?.purpose ?? null,
            challengeSentAt: activeChallenge?.sentAt ?? null,
            maskedEmail: maskPlatformAdminEmail(user?.email ?? ""),
            riskLevel:
                session.metadata?.platformAdminRiskLevel === "suspicious"
                    ? "suspicious"
                    : "normal" as "normal" | "suspicious",
            stage: authContext.platformAdminAuthStage as ActivePlatformAdminStage,
        };
    },
});

async function recordChallengeFailure(
    ctx: MutationCtx,
    challengeId: Id<"platformAdminChallenges">,
    now: number,
) {
    const challenge = await ctx.db.get(challengeId);
    if (!challenge) {
        throw new ConvexError({
            code: "INVALID_STATE",
            message: "Platform Admin verification challenge expired. Request a new code.",
        });
    }

    const failedAttempts = challenge.failedAttempts + 1;
    const lockedUntil =
        failedAttempts >= PLATFORM_ADMIN_CHALLENGE_LOCKOUT_THRESHOLD
            ? now + PLATFORM_ADMIN_CHALLENGE_LOCKOUT_WINDOW_MS
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

async function finalizeVerifiedSession(args: {
    challengeId: Id<"platformAdminChallenges">;
    ctx: MutationCtx;
    session: NonNullable<Awaited<ReturnType<typeof loadCurrentSessionDocuments>>>;
    verificationMethod: PlatformAdminVerificationMethod;
}) {
    const { ctx, session } = args;
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) {
        throw new ConvexError({
            code: "INVALID_STATE",
            message: "Platform Admin verification challenge expired. Request a new code.",
        });
    }

    const securityState = await ensureSecurityState(ctx, session.userId, challenge.deliveryEmail);
    const now = Date.now();
    const backupCodes =
        challenge.purpose === "setup"
            ? await Promise.all(
                  Array.from({ length: PLATFORM_ADMIN_BACKUP_CODE_COUNT }).map(
                      async () => {
                          const rawCode = createBackupCode();
                          return {
                              codeHash: await sha256Hex(rawCode),
                              displayValue: formatBackupCode(rawCode),
                              createdAt: now,
                              suffix: rawCode.slice(-4),
                          };
                      },
                  ),
              )
            : [];
    const trustFingerprint = await fingerprintPlatformAdminRequestContext({
        country: session.metadata?.platformAdminIpCountry ?? null,
        ipAddress: session.metadata?.platformAdminIpAddress ?? null,
        userAgent: session.metadata?.platformAdminUserAgent ?? null,
    });

    await ctx.db.patch(securityState._id, {
        backupCodes:
            challenge.purpose === "setup"
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

export const verifyCurrentTwoFactorCode = mutation({
    args: {
        code: v.string(),
    },
    returns: v.object({
        backupCodes: v.array(v.string()),
        redirectPath: v.string(),
    }),
    handler: async (ctx, args) => {
        const { authContext, session } = await requirePlatformSession(ctx);
        const codeResult = validateOneTimeCodeInput(args.code, {
            field: "code",
            label: "Verification code",
        });
        if (!codeResult.ok) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: codeResult.issue.message,
            });
        }

        const challenge = await getActiveChallenge(ctx, {
            purpose:
                authContext.platformAdminAuthStage === "setup_required"
                    ? "setup"
                    : "verify",
            sessionId: session.sessionId,
            userId: session.userId,
        });
        if (!challenge) {
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "Platform Admin verification challenge expired. Request a new code.",
            });
        }

        const now = Date.now();
        if (challenge.lockedUntil !== undefined && challenge.lockedUntil > now) {
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "Too many failed verification attempts. Request a fresh code and try again.",
            });
        }

        const submittedCodeHash = await sha256Hex(codeResult.value);
        if (submittedCodeHash !== challenge.codeHash) {
            const failureState = await recordChallengeFailure(ctx, challenge._id, now);
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message:
                    failureState.lockedUntil !== null
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

        await appendAuditLogBestEffort(
            ctx,
            createAuditEntry({
                event: AUDIT_EVENT_NAMES.platformAdminChallengeVerified,
                metadata: {
                    challengeId: String(challenge._id),
                    purpose: challenge.purpose,
                    sessionId: String(session.sessionId),
                    verificationMethod: "email_otp",
                },
                outcome:
                    challenge.riskLevel === "suspicious"
                        ? AUDIT_OUTCOMES.allowedWithStepUp
                        : AUDIT_OUTCOMES.allowed,
                userId: session.userId,
            }),
        );

        return {
            backupCodes,
            redirectPath: getPlatformAdminRedirectPath("verified"),
        };
    },
});

export const verifyCurrentBackupCode = mutation({
    args: {
        backupCode: v.string(),
    },
    returns: v.object({
        redirectPath: v.string(),
    }),
    handler: async (ctx, args) => {
        const { authContext, session } = await requirePlatformSession(ctx);
        const challenge = await getActiveChallenge(ctx, {
            purpose:
                authContext.platformAdminAuthStage === "setup_required"
                    ? "setup"
                    : "verify",
            sessionId: session.sessionId,
            userId: session.userId,
        });
        const securityState = await getSecurityState(ctx, session.userId);

        if (!challenge || !securityState) {
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "Platform Admin verification challenge expired. Request a new code.",
            });
        }

        const consumedBackupCode = consumePlatformAdminBackupCode({
            backupCodes: securityState.backupCodes,
            normalizedCodeHash: await sha256Hex(
                normalizePlatformAdminBackupCode(args.backupCode),
            ),
            now: Date.now(),
        });

        if (!consumedBackupCode.ok) {
            await appendAuditLogBestEffort(
                ctx,
                createAuditEntry({
                    event: AUDIT_EVENT_NAMES.platformAdminBackupCodeRejected,
                    metadata: {
                        challengeId: String(challenge._id),
                        reason: consumedBackupCode.reason,
                    },
                    outcome:
                        consumedBackupCode.reason === "already_consumed"
                            ? AUDIT_OUTCOMES.blockedPlatformAdminBackupCodeReplay
                            : AUDIT_OUTCOMES.blockedInvalidAccessCode,
                    userId: session.userId,
                }),
            );

            throw new ConvexError({
                code: "UNAUTHORIZED",
                message:
                    consumedBackupCode.reason === "already_consumed"
                        ? "That backup code has already been used."
                        : "Backup code is invalid. Please try again.",
            });
        }

        await ctx.db.patch(securityState._id, {
            backupCodes: consumedBackupCode.updatedBackupCodes,
            updatedAt: Date.now(),
        });

        await finalizeVerifiedSession({
            challengeId: challenge._id,
            ctx,
            session,
            verificationMethod: "backup_code",
        });

        await appendAuditLogBestEffort(
            ctx,
            createAuditEntry({
                event: AUDIT_EVENT_NAMES.platformAdminBackupCodeUsed,
                metadata: {
                    challengeId: String(challenge._id),
                    sessionId: String(session.sessionId),
                },
                outcome: AUDIT_OUTCOMES.allowedBackupCode,
                userId: session.userId,
            }),
        );

        return {
            redirectPath: getPlatformAdminRedirectPath("verified"),
        };
    },
});

export const getPlatformAdminSecurityOverview = query({
    args: {},
    returns: v.object({
        backupCodesRemaining: v.number(),
        deleteBlockedMessage: v.string(),
        lastTrustedAt: v.union(v.number(), v.null()),
        lastTrustedCountry: v.union(v.string(), v.null()),
        sessions: v.array(v.object({
            isCurrent: v.boolean(),
            lastActivityAt: v.number(),
            location: v.union(v.string(), v.null()),
            sessionId: v.id("authSessions"),
            status: v.union(
                v.literal("active"),
                v.literal("expired"),
                v.literal("revoked"),
                v.literal("logged_out"),
            ),
            userAgent: v.union(v.string(), v.null()),
            verifiedAt: v.union(v.number(), v.null()),
        })),
    }),
    handler: async (ctx) => {
        const authContext = await requireVerifiedPlatformAdmin(ctx);
        const currentSession = await loadCurrentSessionDocuments(ctx);
        const securityState = await getSecurityState(ctx, authContext.userId);
        const sessionMetadata = await ctx.db
            .query("sessionMetadata")
            .withIndex("by_userId", (q) => q.eq("userId", authContext.userId))
            .collect();

        const sessions = await Promise.all(
            sessionMetadata
                .filter((metadata) => metadata.isPlatformAdminSession === true)
                .map(async (metadata) => {
                    const authSession = await ctx.db.get(metadata.sessionId);
                    const state = resolveSessionState({
                        authSession,
                        metadata,
                    });

                    return {
                        isCurrent: currentSession?.sessionId === metadata.sessionId,
                        lastActivityAt: metadata.lastActivityAt,
                        location:
                            metadata.platformAdminIpCountry ??
                            metadata.platformAdminIpCity ??
                            null,
                        sessionId: metadata.sessionId,
                        status: state.status,
                        userAgent: metadata.platformAdminUserAgent ?? null,
                        verifiedAt: metadata.platformAdminVerifiedAt ?? null,
                    };
                }),
        );

        return {
            backupCodesRemaining:
                securityState?.backupCodes.filter(
                    (backupCode) => backupCode.consumedAt === undefined,
                ).length ?? 0,
            deleteBlockedMessage: PLATFORM_ADMIN_DELETE_BLOCKED_MESSAGE,
            lastTrustedAt: securityState?.lastTrustedAt ?? null,
            lastTrustedCountry: securityState?.lastTrustedCountry ?? null,
            sessions,
        };
    },
});

export const revokeAllPlatformAdminSessions = mutation({
    args: {},
    returns: v.object({
        challengeCount: v.number(),
        sessionCount: v.number(),
    }),
    handler: async (ctx) => {
        const authContext = await requireVerifiedPlatformAdmin(ctx);
        const securityState = await ensureSecurityState(ctx, authContext.userId, "");
        const allSessionMetadata = await ctx.db
            .query("sessionMetadata")
            .withIndex("by_userId", (q) => q.eq("userId", authContext.userId))
            .collect();
        const challenges = await ctx.db
            .query("platformAdminChallenges")
            .withIndex("by_userId", (q) => q.eq("userId", authContext.userId))
            .collect();
        const now = Date.now();

        for (const metadata of allSessionMetadata) {
            if (metadata.isPlatformAdminSession !== true) {
                continue;
            }

            await ctx.db.patch(metadata._id, {
                lastActivityAt: now,
                platformAdminAuthStage: "reset_required",
                platformAdminChallengeId: undefined,
                platformAdminRevocationReason: "revoke_all",
                revokedAt: now,
            });
        }

        for (const challenge of challenges) {
            if (challenge.consumedAt !== undefined || challenge.revokedAt !== undefined) {
                continue;
            }

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

        await appendAuditLogBestEffort(
            ctx,
            createAuditEntry({
                event: AUDIT_EVENT_NAMES.platformAdminSessionRevoked,
                metadata: {
                    challengeCount: challenges.length,
                    sessionCount: allSessionMetadata.length,
                },
                outcome: AUDIT_OUTCOMES.allowed,
                userId: authContext.userId,
            }),
        );

        return {
            challengeCount: challenges.length,
            sessionCount: allSessionMetadata.length,
        };
    },
});

export const attemptDeleteCurrentPlatformAdminAccount = mutation({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        const authContext = await requirePlatformAdminSession(ctx);

        await appendAuditLogBestEffort(
            ctx,
            createAuditEntry({
                event: AUDIT_EVENT_NAMES.platformAdminDeletionBlocked,
                metadata: {
                    message: PLATFORM_ADMIN_DELETE_BLOCKED_MESSAGE,
                },
                outcome: AUDIT_OUTCOMES.blockedPlatformAdminDeletion,
                userId: authContext.userId,
            }),
        );

        throw new ConvexError({
            code: "FORBIDDEN",
            message: PLATFORM_ADMIN_DELETE_BLOCKED_MESSAGE,
        });
    },
});
