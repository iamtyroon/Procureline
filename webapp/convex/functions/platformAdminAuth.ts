import { getAuthUserId } from "@convex-dev/auth/server";
import { generateRandomString } from "@oslojs/crypto/random";
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
} from "../../lib/shared/platform-admin/auth";
import {
    evaluatePlatformAdminRisk,
    fingerprintPlatformAdminRequestContext,
    sha256Hex,
} from "../../lib/backend/platform-admin/risk";
import {
    PlatformAdminRequestContextSignatureError,
    verifySignedPlatformAdminRequestContext,
} from "../../lib/backend/platform-admin/request-context-token";
import { resolveSessionState } from "../../lib/auth/session";
import {
    validateEmailInput,
    validateOneTimeCodeInput,
} from "../../lib/security/input";
import { appendAuditLogBestEffort } from "./_audit";
import { loadCurrentSessionDocuments } from "./sessions";
import { sendAppEmail } from "../emailTransport";
import {
    getAuthorizationContext,
    requirePlatformAdminSession,
    requireVerifiedPlatformAdmin,
} from "./_roleGuard";

const requestContextValidator = v.object({
    city: v.union(v.string(), v.null()),
    consentFlag: v.optional(v.boolean()),
    country: v.union(v.string(), v.null()),
    ipAddress: v.union(v.string(), v.null()),
    isPIIAllowed: v.optional(v.boolean()),
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

function constantTimeEqual(left: string, right: string): boolean {
    if (left.length !== right.length) {
        return false;
    }

    let mismatch = 0;

    for (let index = 0; index < left.length; index += 1) {
        mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }

    return mismatch === 0;
}

function resolvePlatformAdminVerificationEmailSender(): string {
    const sender =
        process.env.AUTH_PLATFORM_ADMIN_RESEND_FROM ??
        process.env.AUTH_RESET_RESEND_FROM;
    const nodeEnv =
        typeof process.env.NODE_ENV === "string"
            ? process.env.NODE_ENV
            : "development";

    if (typeof sender === "string" && sender.trim().length > 0) {
        return sender.trim();
    }

    if (nodeEnv === "development") {
        return "Procureline <onboarding@resend.dev>";
    }

    throw new Error(
        "AUTH_PLATFORM_ADMIN_RESEND_FROM must be configured for Platform Admin verification emails outside development.",
    );
}

async function sendVerificationEmail(args: {
    code: string;
    email: string;
    purpose: PlatformAdminChallengePurpose;
    riskReasons: PlatformAdminRiskReason[];
}): Promise<void> {
    const fromAddress = resolvePlatformAdminVerificationEmailSender();
    const headline =
        args.purpose === "setup"
            ? "Finish your Platform Admin 2FA setup"
            : "Complete your Platform Admin verification";
    const contextLine =
        args.riskReasons.length > 0
            ? "We noticed a new or unusual sign-in context, so extra verification is required before this admin session is trusted."
            : "Enter this code to continue into the Platform Admin workspace.";

    const result = await sendAppEmail({
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
        throw new Error(
            `Could not send verification email: ${result.errorMessage ?? "unknown email transport error"}`,
        );
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

function getRequestContextAuditMetadata(args: {
    challengeId?: Id<"platformAdminChallenges">;
    riskReasons?: PlatformAdminRiskReason[];
    session: NonNullable<Awaited<ReturnType<typeof loadCurrentSessionDocuments>>>;
}): Record<string, unknown> {
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

async function appendPlatformAdminAuditEntry(
    ctx: MutationCtx,
    args: {
        event: AuditEventName;
        metadata?: Record<string, unknown>;
        outcome: AuditOutcome;
        userId: Id<"users">;
    },
): Promise<void> {
    await appendAuditLogBestEffort(ctx, createAuditEntry(args));
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

async function revokePlatformAdminChallenge(
    ctx: MutationCtx,
    challengeId: Id<"platformAdminChallenges">,
): Promise<void> {
    const challenge = await ctx.db.get(challengeId);

    if (!challenge || challenge.revokedAt !== undefined) {
        return;
    }

    await ctx.db.patch(challengeId, {
        revokedAt: Date.now(),
        updatedAt: Date.now(),
    });
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
    const challenges = args.purpose
        ? await (() => {
              const purpose = args.purpose;
              return ctx.db
                  .query("platformAdminChallenges")
                  .withIndex("by_userId_sessionId_purpose", (q) =>
                      q
                          .eq("userId", args.userId)
                          .eq("sessionId", args.sessionId)
                          .eq("purpose", purpose),
                  )
                  .collect();
          })()
        : await ctx.db
              .query("platformAdminChallenges")
              .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
              .collect();
    const now = Date.now();

    return (
        challenges
            .filter(
                (challenge) =>
                    challenge.userId === args.userId &&
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
    now: number,
): Promise<void> {
    const challenges = await ctx.db
        .query("platformAdminChallenges")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
        .collect();

    for (const challenge of challenges) {
        if (
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

export const initializeCurrentPlatformAdminSession = internalMutation({
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
            await appendPlatformAdminAuditEntry(ctx, {
                event: AUDIT_EVENT_NAMES.platformAdminNonAdminDenied,
                metadata: {
                    attemptedRole: authContext.role,
                    sessionId: String(session.sessionId),
                },
                outcome: AUDIT_OUTCOMES.blockedPlatformAdminAccessDenied,
                userId,
            });

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
            platformAdminRiskReasons: risk.reasons,
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
            event:
                stage === "reset_required"
                    ? AUDIT_EVENT_NAMES.platformAdminPasswordResetRequired
                    : AUDIT_EVENT_NAMES.platformAdminSessionInitialized,
            metadata: auditMetadata,
            outcome:
                stage === "reset_required"
                    ? AUDIT_OUTCOMES.blockedPlatformAdminPasswordResetRequired
                    : risk.level === "suspicious"
                        ? AUDIT_OUTCOMES.allowedWithStepUp
                        : AUDIT_OUTCOMES.allowed,
            userId,
        });

        if (risk.level === "suspicious") {
            await appendPlatformAdminAuditEntry(ctx, {
                event: AUDIT_EVENT_NAMES.platformAdminSuspiciousLoginDetected,
                metadata: auditMetadata,
                outcome: AUDIT_OUTCOMES.allowedWithStepUp,
                userId,
            });
        }

        return {
            redirectPath: getPlatformAdminRedirectPath(stage),
            riskLevel: risk.level,
            riskReasons: risk.reasons,
            stage,
        };
    },
});

export const prepareCurrentTwoFactorChallengeInternal = internalMutation({
    args: {
        riskReasons: v.optional(v.array(riskReasonValidator)),
    },
    returns: v.object({
        id: v.id("platformAdminChallenges"),
        code: v.string(),
        deliveryEmail: v.string(),
        expiresAt: v.number(),
        maskedEmail: v.string(),
        purpose: v.union(v.literal("setup"), v.literal("verify")),
        riskReasons: v.array(riskReasonValidator),
    }),
    handler: async (ctx, args) => {
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
        await revokeSessionChallenges(ctx, session.sessionId, now);

        const code = createNumericCode();
        const purpose: PlatformAdminChallengePurpose =
            authContext.platformAdminAuthStage === "setup_required"
                ? "setup"
                : "verify";
        const riskReasons =
            args.riskReasons ?? session.metadata?.platformAdminRiskReasons ?? [];
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
            riskReasons,
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

        await appendPlatformAdminAuditEntry(ctx, {
            event: AUDIT_EVENT_NAMES.platformAdminChallengeIssued,
            metadata: {
                ...getRequestContextAuditMetadata({
                    challengeId,
                    riskReasons,
                    session,
                }),
                purpose,
            },
            outcome:
                session.metadata?.platformAdminRiskLevel === "suspicious"
                    ? AUDIT_OUTCOMES.allowedWithStepUp
                    : AUDIT_OUTCOMES.allowed,
            userId: session.userId,
        });

        return {
            id: challengeId,
            code,
            deliveryEmail: emailResult.value,
            expiresAt: now + PLATFORM_ADMIN_CHALLENGE_WINDOW_MS,
            maskedEmail: maskPlatformAdminEmail(emailResult.value),
            purpose,
            riskReasons,
        };
    },
});

export const beginPlatformAdminSignIn = action({
    args: {
        signedRequestContext: v.string(),
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
        let requestContext;
        try {
            requestContext = await verifySignedPlatformAdminRequestContext(
                args.signedRequestContext,
            );
        } catch (error) {
            if (error instanceof PlatformAdminRequestContextSignatureError) {
                throw new ConvexError({
                    code: "UNAUTHORIZED",
                    message: error.message,
                });
            }

            throw error;
        }

        const initialized = await ctx.runMutation(
            "functions/platformAdminAuth:initializeCurrentPlatformAdminSession" as any,
            {
                requestContext,
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
            {
                riskReasons: initialized.riskReasons,
            },
        );

        try {
            await sendVerificationEmail({
                code: challenge.code,
                email: challenge.deliveryEmail,
                purpose: challenge.purpose,
                riskReasons: challenge.riskReasons,
            });
        } catch (error) {
            console.error("Platform Admin verification email failed", error);
            await ctx.runMutation(
                "functions/platformAdminAuth:revokePlatformAdminChallengeInternal" as any,
                {
                    challengeId: challenge.id,
                },
            );
            throw error;
        }

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

        try {
            await sendVerificationEmail({
                code: challenge.code,
                email: challenge.deliveryEmail,
                purpose: challenge.purpose,
                riskReasons: challenge.riskReasons,
            });
        } catch (error) {
            console.error("Platform Admin verification email failed", error);
            await ctx.runMutation(
                "functions/platformAdminAuth:revokePlatformAdminChallengeInternal" as any,
                {
                    challengeId: challenge.id,
                },
            );
            throw error;
        }

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
        isPIIAllowed: true,
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
            await appendPlatformAdminAuditEntry(ctx, {
                event: AUDIT_EVENT_NAMES.platformAdminChallengeExpired,
                metadata: {
                    ...getRequestContextAuditMetadata({ session }),
                    reason: "challenge_expired",
                },
                outcome: AUDIT_OUTCOMES.blockedPlatformAdminChallengeExpired,
                userId: session.userId,
            });
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "Platform Admin verification challenge expired. Request a new code.",
            });
        }

        const now = Date.now();
        if (challenge.lockedUntil !== undefined && challenge.lockedUntil > now) {
            await appendPlatformAdminAuditEntry(ctx, {
                event: AUDIT_EVENT_NAMES.platformAdminChallengeBlocked,
                metadata: {
                    ...getRequestContextAuditMetadata({
                        challengeId: challenge._id,
                        riskReasons: challenge.riskReasons,
                        session,
                    }),
                    reason: "challenge_locked",
                },
                outcome: AUDIT_OUTCOMES.blockedPlatformAdminChallengeLocked,
                userId: session.userId,
            });
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "Too many failed verification attempts. Request a fresh code and try again.",
            });
        }

        const submittedCodeHash = await sha256Hex(codeResult.value);
        if (submittedCodeHash !== challenge.codeHash) {
            const failureState = await recordChallengeFailure(ctx, challenge._id, now);
            await appendPlatformAdminAuditEntry(ctx, {
                event: AUDIT_EVENT_NAMES.platformAdminChallengeRejected,
                metadata: {
                    ...getRequestContextAuditMetadata({
                        challengeId: challenge._id,
                        riskReasons: challenge.riskReasons,
                        session,
                    }),
                    failedAttempts: failureState.failedAttempts,
                    reason: "invalid_code",
                },
                outcome:
                    failureState.lockedUntil !== null
                        ? AUDIT_OUTCOMES.blockedPlatformAdminChallengeLocked
                        : AUDIT_OUTCOMES.rejectedInvalidCode,
                userId: session.userId,
            });
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

        await appendPlatformAdminAuditEntry(ctx, {
            event: AUDIT_EVENT_NAMES.platformAdminChallengeVerified,
            metadata: {
                ...getRequestContextAuditMetadata({
                    challengeId: challenge._id,
                    riskReasons: challenge.riskReasons,
                    session,
                }),
                purpose: challenge.purpose,
                verificationMethod: "email_otp",
            },
            outcome:
                challenge.riskLevel === "suspicious"
                    ? AUDIT_OUTCOMES.allowedWithStepUp
                    : AUDIT_OUTCOMES.allowed,
            userId: session.userId,
        });

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
        const now = Date.now();

        if (!challenge || !securityState) {
            await appendPlatformAdminAuditEntry(ctx, {
                event: AUDIT_EVENT_NAMES.platformAdminBackupCodeRejected,
                metadata: {
                    ...getRequestContextAuditMetadata({ session }),
                    reason: "challenge_expired",
                },
                outcome: AUDIT_OUTCOMES.blockedPlatformAdminChallengeExpired,
                userId: session.userId,
            });
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "Platform Admin verification challenge expired. Request a new code.",
            });
        }

        if (challenge.lockedUntil !== undefined && challenge.lockedUntil > now) {
            await appendPlatformAdminAuditEntry(ctx, {
                event: AUDIT_EVENT_NAMES.platformAdminBackupCodeRejected,
                metadata: {
                    ...getRequestContextAuditMetadata({
                        challengeId: challenge._id,
                        riskReasons: challenge.riskReasons,
                        session,
                    }),
                    reason: "challenge_locked",
                },
                outcome: AUDIT_OUTCOMES.blockedPlatformAdminChallengeLocked,
                userId: session.userId,
            });
            throw new ConvexError({
                code: "UNAUTHORIZED",
                message: "Too many failed verification attempts. Request a fresh code and try again.",
            });
        }

        const consumedBackupCode = consumePlatformAdminBackupCode({
            backupCodes: securityState.backupCodes,
            normalizedCodeHash: await sha256Hex(
                normalizePlatformAdminBackupCode(args.backupCode),
            ),
            now,
        });

        if (!consumedBackupCode.ok) {
            const failureState = await recordChallengeFailure(ctx, challenge._id, now);
            await appendPlatformAdminAuditEntry(ctx, {
                event: AUDIT_EVENT_NAMES.platformAdminBackupCodeRejected,
                metadata: {
                    ...getRequestContextAuditMetadata({
                        challengeId: challenge._id,
                        riskReasons: challenge.riskReasons,
                        session,
                    }),
                    failedAttempts: failureState.failedAttempts,
                    reason: consumedBackupCode.reason,
                },
                outcome:
                    failureState.lockedUntil !== null
                        ? AUDIT_OUTCOMES.blockedPlatformAdminChallengeLocked
                        : consumedBackupCode.reason === "already_consumed"
                            ? AUDIT_OUTCOMES.blockedPlatformAdminBackupCodeReplay
                            : AUDIT_OUTCOMES.rejectedInvalidCode,
                userId: session.userId,
            });

            throw new ConvexError({
                code: "UNAUTHORIZED",
                message:
                    failureState.lockedUntil !== null
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
            event: AUDIT_EVENT_NAMES.platformAdminBackupCodeUsed,
            metadata: {
                ...getRequestContextAuditMetadata({
                    challengeId: challenge._id,
                    riskReasons: challenge.riskReasons,
                    session,
                }),
                purpose: challenge.purpose,
                verificationMethod: "backup_code",
            },
            outcome: AUDIT_OUTCOMES.allowedBackupCode,
            userId: session.userId,
        });

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
            ipAddress: v.union(v.string(), v.null()),
            ipCity: v.union(v.string(), v.null()),
            ipCountry: v.union(v.string(), v.null()),
            ipRegion: v.union(v.string(), v.null()),
            isCurrent: v.boolean(),
            lastActivityAt: v.number(),
            location: v.union(v.string(), v.null()),
            revocationReason: v.union(v.string(), v.null()),
            sessionId: v.id("authSessions"),
            status: v.union(
                v.literal("active"),
                v.literal("expired"),
                v.literal("revoked"),
                v.literal("logged_out"),
            ),
            userAgent: v.union(v.string(), v.null()),
            verificationMethod: v.union(
                v.literal("email_otp"),
                v.literal("backup_code"),
                v.null(),
            ),
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
                    const locationParts = [
                        metadata.platformAdminIpCity,
                        metadata.platformAdminIpRegion,
                        metadata.platformAdminIpCountry,
                    ].filter((value): value is string => typeof value === "string");

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
                        verificationMethod:
                            metadata.platformAdminVerificationMethod ?? null,
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
        const currentSession = await loadCurrentSessionDocuments(ctx);
        const user = await ctx.db.get(authContext.userId);
        const emailResult = validateEmailInput(user?.email ?? "");
        const securityState = await ensureSecurityState(
            ctx,
            authContext.userId,
            emailResult.ok ? emailResult.value : "",
        );
        const allSessionMetadata = await ctx.db
            .query("sessionMetadata")
            .withIndex("by_userId", (q) => q.eq("userId", authContext.userId))
            .collect();
        const challenges = await ctx.db
            .query("platformAdminChallenges")
            .withIndex("by_userId", (q) => q.eq("userId", authContext.userId))
            .collect();
        const now = Date.now();
        const platformAdminSessions = allSessionMetadata.filter(
            (metadata) => metadata.isPlatformAdminSession === true,
        );
        const activeChallenges = challenges.filter(
            (challenge) =>
                challenge.consumedAt === undefined && challenge.revokedAt === undefined,
        );

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
            event: AUDIT_EVENT_NAMES.platformAdminSessionRevoked,
            metadata: {
                ...requestContextAuditMetadata,
                challengeCount: activeChallenges.length,
                sessionCount: platformAdminSessions.length,
            },
            outcome: AUDIT_OUTCOMES.allowed,
            userId: authContext.userId,
        });

        return {
            challengeCount: activeChallenges.length,
            sessionCount: platformAdminSessions.length,
        };
    },
});

export const clearCurrentPlatformAdminPasswordResetRequirement = mutation({
    args: {
        resetCompletionToken: v.optional(v.string()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new ConvexError({
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
            throw new ConvexError({
                code: "FORBIDDEN",
                message: "A completed password reset is required before Platform Admin access can be restored.",
            });
        }

        if (
            !securityState.passwordResetCompletionTokenHash ||
            securityState.passwordResetCompletionTokenIssuedAt === undefined
        ) {
            throw new ConvexError({
                code: "FORBIDDEN",
                message: "The Platform Admin password reset completion token is missing or expired. Request a fresh reset link.",
            });
        }

        const submittedTokenHash = await sha256Hex(token);
        if (
            !constantTimeEqual(
                submittedTokenHash,
                securityState.passwordResetCompletionTokenHash,
            )
        ) {
            throw new ConvexError({
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

export const preparePlatformAdminPasswordResetCompletionToken = internalMutation({
    args: {
        email: v.string(),
        resetCompletionToken: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const emailResult = validateEmailInput(args.email);
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
            passwordResetCompletionTokenHash: await sha256Hex(
                args.resetCompletionToken.trim(),
            ),
            passwordResetCompletionTokenIssuedAt: now,
            updatedAt: now,
        });

        return null;
    },
});

export const revokePlatformAdminChallengeInternal = internalMutation({
    args: {
        challengeId: v.id("platformAdminChallenges"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        await revokePlatformAdminChallenge(ctx, args.challengeId);
        return null;
    },
});

export const clearPlatformAdminPasswordResetRequirementForEmail = internalMutation({
    args: {
        email: v.string(),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const emailResult = validateEmailInput(args.email);
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

export const attemptDeleteCurrentPlatformAdminAccount = mutation({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        const authContext = await requirePlatformAdminSession(ctx);

        const currentSession = await loadCurrentSessionDocuments(ctx);

        await appendPlatformAdminAuditEntry(ctx, {
            event: AUDIT_EVENT_NAMES.platformAdminDeletionBlocked,
            metadata: {
                ...(currentSession
                    ? getRequestContextAuditMetadata({ session: currentSession })
                    : {}),
                message: PLATFORM_ADMIN_DELETE_BLOCKED_MESSAGE,
            },
            outcome: AUDIT_OUTCOMES.blockedPlatformAdminDeletion,
            userId: authContext.userId,
        });

        throw new ConvexError({
            code: "FORBIDDEN",
            message: PLATFORM_ADMIN_DELETE_BLOCKED_MESSAGE,
        });
    },
});












