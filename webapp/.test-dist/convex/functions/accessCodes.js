"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAccessCodeEmail = exports.failAccessCodeEmailDelivery = exports.completeAccessCodeEmailDelivery = exports.prepareAccessCodeEmailDelivery = exports.bulkGenerateAccessCodes = exports.deactivateAccessCode = exports.rotateAccessCode = exports.generateAccessCode = exports.getDepartmentAccessCodeHistory = exports.getAccessCodesWorkspace = exports.appendDepartmentAccessCodeEventFromAction = exports.appendDepartmentAccessCodeEventBestEffort = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const department_user_access_1 = require("../../lib/shared/auth/department-user-access");
const access_codes_1 = require("../../lib/procurement-officer/access-codes");
const dashboard_1 = require("../../lib/procurement-officer/dashboard");
const departments_1 = require("../../lib/procurement-officer/departments");
const audit_1 = require("../../lib/shared/security/audit");
const transport_1 = require("../../lib/email/transport");
const input_1 = require("../../lib/shared/security/input");
const _audit_1 = require("./_audit");
const _roleGuard_1 = require("./_roleGuard");
const _tenantGuard_1 = require("./_tenantGuard");
const _helpers_1 = require("../actions/_helpers");
const emailTransport_1 = require("../emailTransport");
function isActiveDepartment(department) {
    return department.isActive && department.deletedAt === undefined;
}
function isUsableAccessCode(accessCode, now) {
    return accessCode.isActive && accessCode.expiresAt > now;
}
function formatAccessCodeDateTime(timestamp) {
    if (typeof timestamp !== "number") {
        return null;
    }
    return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(timestamp));
}
function createAccessCodeAuditEntry(args) {
    return {
        action: args.action,
        actor: (0, audit_1.createAuthenticatedAuditActor)({
            role: "procurement_officer",
            userId: String(args.actorUserId),
        }),
        entityType: "access_code",
        event: args.event,
        metadata: args.metadata,
        outcome: args.outcome,
        recordId: args.recordId,
        sourceTenantId: String(args.tenantId),
        tableName: "departmentAccessCodes",
        targetTenantId: String(args.tenantId),
        timestamp: Date.now(),
    };
}
async function appendDepartmentAccessCodeEventBestEffort(ctx, args) {
    try {
        await ctx.db.insert("departmentAccessCodeEvents", {
            accessCodeId: args.accessCodeId,
            actorTenantUserId: args.actorTenantUserId,
            actorUserId: args.actorUserId,
            departmentId: args.departmentId,
            event: args.event,
            ipAddress: args.requestOrigin?.ipAddress ?? undefined,
            message: args.message,
            metadata: args.metadata,
            normalizedEmail: args.normalizedEmail,
            occurredAt: Date.now(),
            outcome: args.outcome,
            requestOriginStatus: args.requestOrigin?.requestOriginStatus ?? "unavailable",
            tenantId: args.tenantId,
            userAgent: args.requestOrigin?.userAgent ?? undefined,
        });
    }
    catch {
        // History is append-only but must remain non-blocking for auth and bridge flows.
    }
}
exports.appendDepartmentAccessCodeEventBestEffort = appendDepartmentAccessCodeEventBestEffort;
exports.appendDepartmentAccessCodeEventFromAction = (0, server_1.internalMutation)({
    args: {
        accessCodeId: values_1.v.id("departmentAccessCodes"),
        actorTenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")),
        actorUserId: values_1.v.optional(values_1.v.id("users")),
        departmentId: values_1.v.id("departments"),
        event: values_1.v.union(values_1.v.literal("deactivated"), values_1.v.literal("email_failed"), values_1.v.literal("email_queued"), values_1.v.literal("issued"), values_1.v.literal("login_denied"), values_1.v.literal("login_success"), values_1.v.literal("rotated")),
        ipAddress: values_1.v.optional(values_1.v.string()),
        message: values_1.v.optional(values_1.v.string()),
        metadata: values_1.v.optional(values_1.v.any()),
        normalizedEmail: values_1.v.optional(values_1.v.string()),
        outcome: values_1.v.union(values_1.v.literal("allowed"), values_1.v.literal("blocked"), values_1.v.literal("failed"), values_1.v.literal("queued")),
        requestOriginStatus: values_1.v.union(values_1.v.literal("captured"), values_1.v.literal("unavailable")),
        tenantId: values_1.v.id("tenants"),
        userAgent: values_1.v.optional(values_1.v.string()),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        await appendDepartmentAccessCodeEventBestEffort(ctx, {
            accessCodeId: args.accessCodeId,
            actorTenantUserId: args.actorTenantUserId,
            actorUserId: args.actorUserId,
            departmentId: args.departmentId,
            event: args.event,
            message: args.message,
            metadata: args.metadata,
            normalizedEmail: args.normalizedEmail,
            outcome: args.outcome,
            requestOrigin: {
                ipAddress: args.ipAddress,
                requestOriginStatus: args.requestOriginStatus,
                userAgent: args.userAgent,
            },
            tenantId: args.tenantId,
        });
        return null;
    },
});
async function loadProcurementOfficerMutationContext(ctx) {
    const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
    const [tenant, tenantUser] = await Promise.all([
        ctx.db.get(authContext.tenantId),
        (0, _tenantGuard_1.getCurrentTenantUserMembership)(ctx),
    ]);
    if (!tenant) {
        throw new values_1.ConvexError({
            code: "NOT_FOUND",
            message: "Tenant record not found",
        });
    }
    if (!tenantUser || tenantUser.role !== "procurement_officer" || !tenantUser.isActive) {
        throw new values_1.ConvexError({
            code: "UNAUTHORIZED",
            message: "Procurement Officer access is required for this resource.",
        });
    }
    return {
        authContext,
        tenant,
        tenantUser,
    };
}
async function loadProcurementOfficerQueryContext(ctx) {
    const authContext = await (0, _roleGuard_1.requireTenantRole)(ctx, ["procurement_officer"]);
    const tenant = await ctx.db.get(authContext.tenantId);
    if (!tenant) {
        throw new values_1.ConvexError({
            code: "NOT_FOUND",
            message: "Tenant record not found",
        });
    }
    return {
        authContext,
        tenant,
    };
}
async function loadProcurementOfficerActionContext(ctx) {
    const actor = await (0, _helpers_1.getServiceActorContext)(ctx);
    if (actor.role !== "procurement_officer" || !actor.tenantId) {
        throw new values_1.ConvexError({
            code: "UNAUTHORIZED",
            message: "Procurement Officer access is required for this resource.",
        });
    }
    const tenantUser = await ctx.runQuery("functions/users:getCurrentUserTenant", {});
    if (tenantUser.role !== "procurement_officer" || !tenantUser.isActive) {
        throw new values_1.ConvexError({
            code: "UNAUTHORIZED",
            message: "Procurement Officer access is required for this resource.",
        });
    }
    return {
        actor,
        tenantUser,
    };
}
async function getTenantDepartmentOrThrow(ctx, args) {
    const department = await ctx.db.get(args.departmentId);
    if (!department || department.tenantId !== args.tenantId || !isActiveDepartment(department)) {
        throw new values_1.ConvexError({
            code: "NOT_FOUND",
            message: "Department not found",
        });
    }
    return department;
}
async function loadDepartmentAccessCodes(ctx, departmentId) {
    return await ctx.db
        .query("departmentAccessCodes")
        .withIndex("by_departmentId", (q) => q.eq("departmentId", departmentId))
        .collect();
}
async function buildUniqueCanonicalAccessCode(args) {
    const [departmentAccessCodes, departments] = await Promise.all([
        args.ctx.db
            .query("departmentAccessCodes")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
            .collect(),
        args.ctx.db
            .query("departments")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
            .collect(),
    ]);
    const existingCodeHashes = new Set(departmentAccessCodes.map((accessCode) => accessCode.codeHash));
    const existingDepartmentCodes = new Set(departments
        .filter(isActiveDepartment)
        .map((department) => (0, departments_1.normalizeDepartmentCode)(department.code)));
    for (let attempt = 0; attempt < 25; attempt += 1) {
        const code = (0, access_codes_1.buildCanonicalDepartmentAccessCode)({
            departmentName: args.department.name,
        });
        const normalizedCode = (0, department_user_access_1.normalizeDepartmentUserAccessCode)(code);
        const codeHash = await (0, department_user_access_1.hashDepartmentUserAccessCode)(normalizedCode);
        if (!existingCodeHashes.has(codeHash) &&
            !existingDepartmentCodes.has((0, departments_1.normalizeDepartmentCode)(code))) {
            return {
                code,
                codeHash,
                codeSuffix: (0, department_user_access_1.getDepartmentUserAccessCodeSuffix)(normalizedCode),
            };
        }
    }
    throw new values_1.ConvexError({
        code: "INVALID_STATE",
        message: "We could not issue a unique access code right now.",
    });
}
async function doesDepartmentCodeMatchAccessCode(args) {
    const normalizedCode = (0, department_user_access_1.normalizeDepartmentUserAccessCode)(args.department.code);
    const codeHash = await (0, department_user_access_1.hashDepartmentUserAccessCode)(normalizedCode);
    return codeHash === args.accessCode.codeHash;
}
async function revokeDepartmentAccessCodes(args) {
    const now = Date.now();
    for (const accessCode of args.accessCodes) {
        await args.ctx.db.patch(accessCode._id, {
            isActive: false,
            replacedByAccessCodeId: args.replacementAccessCodeId,
            revokedAt: now,
            revokedByTenantUserId: args.revokedByTenantUserId,
            revocationReason: args.revocationReason,
            updatedAt: now,
        });
    }
}
async function issueDepartmentAccessCode(args) {
    const expirationValidation = (0, access_codes_1.validateAccessCodeExpiration)({
        expirationAt: args.expirationAt,
    });
    if (!expirationValidation.ok) {
        throw new values_1.ConvexError({
            code: "VALIDATION_FAILED",
            field: "expirationAt",
            message: expirationValidation.message,
        });
    }
    const now = Date.now();
    const existingCodes = await loadDepartmentAccessCodes(args.ctx, args.department._id);
    const activeCodes = existingCodes.filter((accessCode) => isUsableAccessCode(accessCode, now));
    const issuedCode = await buildUniqueCanonicalAccessCode({
        ctx: args.ctx,
        department: args.department,
        tenantId: args.tenantUser.tenantId,
    });
    const accessCodeId = await args.ctx.db.insert("departmentAccessCodes", {
        codeHash: issuedCode.codeHash,
        codeSuffix: issuedCode.codeSuffix,
        createdAt: now,
        deliveryAttemptCount: 0,
        departmentId: args.department._id,
        expiresAt: args.expirationAt,
        isActive: true,
        issuedByTenantUserId: args.tenantUser._id,
        tenantId: args.tenantUser.tenantId,
        updatedAt: now,
    });
    if (activeCodes.length > 0) {
        await revokeDepartmentAccessCodes({
            accessCodes: activeCodes,
            ctx: args.ctx,
            replacementAccessCodeId: accessCodeId,
            revocationReason: "rotated",
            revokedByTenantUserId: args.tenantUser._id,
        });
    }
    await args.ctx.db.patch(args.department._id, {
        code: issuedCode.code,
        normalizedCode: (0, access_codes_1.normalizeCanonicalDepartmentAccessCode)(issuedCode.code),
        updatedAt: now,
    });
    await appendDepartmentAccessCodeEventBestEffort(args.ctx, {
        accessCodeId,
        actorTenantUserId: args.tenantUser._id,
        actorUserId: args.tenantUser.userId,
        departmentId: args.department._id,
        event: activeCodes.length > 0 ? "rotated" : "issued",
        message: activeCodes.length > 0
            ? "Active department access code rotated."
            : "Department access code issued.",
        outcome: "allowed",
        tenantId: args.tenantUser.tenantId,
    });
    await (0, _audit_1.appendAuditLogRequired)(args.ctx, createAccessCodeAuditEntry({
        action: args.actionLabel,
        actorUserId: args.tenantUser.userId,
        event: activeCodes.length > 0
            ? audit_1.AUDIT_EVENT_NAMES.accessCodeRotated
            : audit_1.AUDIT_EVENT_NAMES.accessCodeGenerated,
        metadata: {
            accessCodeId: String(accessCodeId),
            departmentId: String(args.department._id),
            departmentName: args.department.name,
            expiresAt: args.expirationAt,
            previousActiveCodeCount: activeCodes.length,
            summary: activeCodes.length > 0
                ? `Rotated the active access code for ${args.department.name}.`
                : `Issued a new access code for ${args.department.name}.`,
        },
        outcome: audit_1.AUDIT_OUTCOMES.allowed,
        recordId: String(accessCodeId),
        tenantId: args.tenantUser.tenantId,
    }));
    return {
        accessCodeId,
        code: issuedCode.code,
        departmentId: args.department._id,
        expiresAt: args.expirationAt,
        hadActiveCode: activeCodes.length > 0,
        maskedCode: (0, access_codes_1.maskCanonicalDepartmentAccessCode)(issuedCode.code),
    };
}
async function evaluateRecipientEligibility(args) {
    const [users, existingDepartmentProfiles] = await Promise.all([
        args.ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", args.normalizedEmail))
            .collect(),
        args.ctx.db
            .query("departmentUserProfiles")
            .withIndex("by_tenantId_email", (q) => q.eq("tenantId", args.tenantId).eq("normalizedEmail", args.normalizedEmail))
            .collect(),
    ]);
    if (users.length > 1) {
        throw new values_1.ConvexError({
            code: "FORBIDDEN",
            message: access_codes_1.ACCESS_CODE_INCOMPATIBLE_RECIPIENT_MESSAGE,
        });
    }
    if (users.length === 0) {
        if (existingDepartmentProfiles.length > 0) {
            throw new values_1.ConvexError({
                code: "FORBIDDEN",
                message: access_codes_1.ACCESS_CODE_INCOMPATIBLE_RECIPIENT_MESSAGE,
            });
        }
        return;
    }
    const user = users.at(0);
    if (!user) {
        return;
    }
    const [platformMemberships, tenantMemberships] = await Promise.all([
        args.ctx.db
            .query("platformUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect(),
        args.ctx.db
            .query("tenantUsers")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .collect(),
    ]);
    const activePlatformMemberships = platformMemberships.filter((membership) => membership.isActive);
    const activeTenantMemberships = tenantMemberships.filter((membership) => membership.isActive);
    if (activePlatformMemberships.length > 0 ||
        activeTenantMemberships.length > 1) {
        throw new values_1.ConvexError({
            code: "FORBIDDEN",
            message: access_codes_1.ACCESS_CODE_INCOMPATIBLE_RECIPIENT_MESSAGE,
        });
    }
    if (activeTenantMemberships.length === 1) {
        const tenantMembership = activeTenantMemberships.at(0);
        if (!tenantMembership) {
            return;
        }
        if (tenantMembership.role !== "department_user" ||
            tenantMembership.tenantId !== args.tenantId) {
            throw new values_1.ConvexError({
                code: "FORBIDDEN",
                message: access_codes_1.ACCESS_CODE_INCOMPATIBLE_RECIPIENT_MESSAGE,
            });
        }
        const profile = await args.ctx.db
            .query("departmentUserProfiles")
            .withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", tenantMembership._id))
            .first();
        if (!profile ||
            !profile.isActive ||
            profile.departmentId !== args.departmentId ||
            profile.normalizedEmail !== args.normalizedEmail) {
            throw new values_1.ConvexError({
                code: "FORBIDDEN",
                message: access_codes_1.ACCESS_CODE_INCOMPATIBLE_RECIPIENT_MESSAGE,
            });
        }
    }
}
function shouldCaptureAccessCodeEmailsDirectly() {
    return (0, transport_1.resolveEmailTransportMode)(process.env.AUTH_EMAIL_TRANSPORT) === "dev_inbox";
}
async function sendAccessCodeEmailDirect(args) {
    const result = await (0, emailTransport_1.sendAppEmail)({
        from: process.env.AUTH_RESET_RESEND_FROM ??
            "Procureline <onboarding@resend.dev>",
        html: `
            <div style="color: #0f172a; font-family: Georgia, serif; line-height: 1.6;">
                <h1>${args.tenantName} department access code</h1>
                <p>A Procurement Officer queued a department access code for ${args.departmentName}.</p>
                <p>Access code: ${args.accessCode}</p>
                <p>Expires: ${args.expirationLabel}</p>
                <p>
                    <a href="${args.loginUrl}" style="color: #0f172a; font-weight: bold;">
                        Open Department User sign-in
                    </a>
                </p>
            </div>
        `,
        idempotencyKey: args.idempotencyKey,
        messageType: "transactional_access-code-delivery",
        metadata: {
            template: "access-code-delivery",
            templateProps: {
                accessCode: args.accessCode,
                departmentName: args.departmentName,
                expirationLabel: args.expirationLabel,
                loginUrl: args.loginUrl,
                tenantName: args.tenantName,
            },
        },
        subject: args.subject,
        text: [
            `${args.tenantName} department access code`,
            "",
            `A Procurement Officer queued a department access code for ${args.departmentName}.`,
            `Access code: ${args.accessCode}`,
            `Expires: ${args.expirationLabel}`,
            `Department User sign-in: ${args.loginUrl}`,
        ].join("\n"),
        to: [args.email],
    });
    if (!result.sent) {
        throw new Error(result.errorMessage ?? "Development inbox capture failed.");
    }
}
function formatAccessCodeActivitySummary(latestEvent) {
    if (!latestEvent) {
        return "No activity recorded yet.";
    }
    switch (latestEvent.event) {
        case "login_success":
            return "Most recent DU login succeeded.";
        case "login_denied":
            return latestEvent.message ?? "Most recent DU login was denied.";
        case "email_queued":
            return "Latest access-code email is queued.";
        case "email_failed":
            return latestEvent.message ?? "Latest access-code email needs a retry.";
        case "deactivated":
            return "Access code was manually deactivated.";
        case "rotated":
            return "Access code was rotated.";
        default:
            return "Access code was issued.";
    }
}
exports.getAccessCodesWorkspace = (0, server_1.query)({
    args: {},
    returns: values_1.v.any(),
    handler: async (ctx) => {
        const { authContext, tenant } = await loadProcurementOfficerQueryContext(ctx);
        const now = Date.now();
        const [departments, accessCodes, events, profiles, tenantUsers, submissionDeadlines] = await Promise.all([
            ctx.db
                .query("departments")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("departmentAccessCodes")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("departmentAccessCodeEvents")
                .withIndex("by_tenantId_occurredAt", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("departmentUserProfiles")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("tenantUsers")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
            ctx.db
                .query("submissionDeadlines")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
                .collect(),
        ]);
        const activeDepartments = departments.filter(isActiveDepartment);
        const tenantUsersById = new Map(tenantUsers.map((tenantUser) => [String(tenantUser._id), tenantUser]));
        const relevantUserIds = Array.from(new Set(profiles
            .map((profile) => tenantUsersById.get(String(profile.tenantUserId))?.userId)
            .filter((userId) => userId !== undefined)));
        const userDocs = await Promise.all(relevantUserIds.map(async (userId) => [String(userId), await ctx.db.get(userId)]));
        const usersById = new Map(userDocs);
        const expirationDefault = (0, access_codes_1.deriveAccessCodeExpirationDefault)({
            deadlineRecord: submissionDeadlines.find((deadline) => deadline.fiscalYearKey ===
                (0, dashboard_1.getProcurementFiscalYearForDate)(Date.now(), {
                    fiscalYearStartMonth: tenant.fiscalYearStartMonth,
                    timeZone: tenant.timeZone,
                }).key) ?? null,
            departments: activeDepartments.map((department) => ({
                id: String(department._id),
                isActive: department.isActive,
                submissionEndsAt: department.submissionEndsAt,
                submissionStartsAt: department.submissionStartsAt,
            })),
            fiscalYearStartMonth: tenant.fiscalYearStartMonth,
            tenantTimeZone: tenant.timeZone,
        });
        const rows = await Promise.all(activeDepartments.map(async (department) => {
            const departmentCodes = accessCodes
                .filter((accessCode) => accessCode.departmentId === department._id)
                .sort((left, right) => right.createdAt - left.createdAt);
            const currentAccessCode = departmentCodes.find((accessCode) => isUsableAccessCode(accessCode, now));
            const latestAccessCode = departmentCodes.at(0);
            const departmentEvents = events
                .filter((event) => event.departmentId === department._id)
                .sort((left, right) => right.occurredAt - left.occurredAt);
            const activeProfileEmails = Array.from(new Set(profiles
                .filter((profile) => profile.departmentId === department._id && profile.isActive)
                .map((profile) => {
                const tenantUser = tenantUsersById.get(String(profile.tenantUserId));
                const user = tenantUser
                    ? usersById.get(String(tenantUser.userId))
                    : null;
                return typeof user?.email === "string"
                    ? user.email.trim()
                    : null;
            })
                .filter((email) => Boolean(email)))).sort((left, right) => left.localeCompare(right));
            const deliveryStatus = (currentAccessCode
                ? currentAccessCode.lastDeliveryStatus
                : latestAccessCode
                    ? latestAccessCode.lastDeliveryStatus
                    : undefined);
            const isCurrentCodeSynced = currentAccessCode === undefined
                ? true
                : await doesDepartmentCodeMatchAccessCode({
                    accessCode: currentAccessCode,
                    department,
                });
            return {
                accessCodeId: currentAccessCode ? String(currentAccessCode._id) : null,
                canEmailActiveCode: Boolean(currentAccessCode) && isCurrentCodeSynced,
                codeMasked: (0, access_codes_1.maskCanonicalDepartmentAccessCode)(department.code),
                deliveryStatus: deliveryStatus ?? "none",
                deliveryStatusLabel: (0, access_codes_1.mapAccessCodeDeliveryStatusLabel)(deliveryStatus ?? "none"),
                expiresAt: currentAccessCode
                    ? currentAccessCode.expiresAt
                    : latestAccessCode
                        ? latestAccessCode.expiresAt
                        : null,
                hasActiveCode: Boolean(currentAccessCode),
                id: String(department._id),
                issuedAt: currentAccessCode
                    ? currentAccessCode.createdAt
                    : latestAccessCode
                        ? latestAccessCode.createdAt
                        : null,
                knownRecipientEmails: activeProfileEmails,
                lastActivityAt: departmentEvents[0]?.occurredAt ?? null,
                lastActivitySummary: formatAccessCodeActivitySummary(departmentEvents[0]),
                lastDeliveryEmail: currentAccessCode
                    ? currentAccessCode.lastDeliveryEmail ?? null
                    : latestAccessCode
                        ? latestAccessCode.lastDeliveryEmail ?? null
                        : null,
                latestHistoryCount: departmentEvents.length,
                name: department.name,
                statusLabel: currentAccessCode
                    ? isCurrentCodeSynced
                        ? "Active"
                        : "Sync required"
                    : latestAccessCode && latestAccessCode.revocationReason === "deactivated"
                        ? "Deactivated"
                        : latestAccessCode && latestAccessCode.expiresAt <= now
                            ? "Expired"
                            : "Missing",
            };
        }));
        return {
            meta: {
                defaultExpirationAt: expirationDefault.deadlineAt,
                defaultExpirationLabel: expirationDefault.label,
                defaultExpirationState: expirationDefault.state,
                loginUrl: access_codes_1.ACCESS_CODE_LOGIN_URL_PATH,
                now,
            },
            rows: rows.sort((left, right) => left.name.localeCompare(right.name)),
        };
    },
});
exports.getDepartmentAccessCodeHistory = (0, server_1.query)({
    args: {
        departmentId: values_1.v.id("departments"),
        limit: values_1.v.optional(values_1.v.number()),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const { authContext } = await loadProcurementOfficerQueryContext(ctx);
        await getTenantDepartmentOrThrow(ctx, {
            departmentId: args.departmentId,
            tenantId: authContext.tenantId,
        });
        const boundedLimit = Math.max(Math.min(args.limit ?? 20, 50), 1);
        const events = await ctx.db
            .query("departmentAccessCodeEvents")
            .withIndex("by_departmentId_occurredAt", (q) => q.eq("departmentId", args.departmentId))
            .order("desc")
            .take(boundedLimit);
        return {
            items: events.map((event) => ({
                email: event.normalizedEmail ?? null,
                event: event.event,
                message: event.message ?? formatAccessCodeActivitySummary(event),
                occurredAt: event.occurredAt,
                origin: event.requestOriginStatus === "captured"
                    ? event.ipAddress ?? "Origin captured without IP"
                    : "Origin unavailable",
                outcome: event.outcome,
                userAgent: event.userAgent ?? null,
            })),
            limit: boundedLimit,
        };
    },
});
exports.generateAccessCode = (0, server_1.mutation)({
    args: {
        departmentId: values_1.v.id("departments"),
        expiresAt: values_1.v.number(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const { authContext, tenantUser } = await loadProcurementOfficerMutationContext(ctx);
        const department = await getTenantDepartmentOrThrow(ctx, {
            departmentId: args.departmentId,
            tenantId: authContext.tenantId,
        });
        const activeCodes = (await loadDepartmentAccessCodes(ctx, department._id)).filter((accessCode) => isUsableAccessCode(accessCode, Date.now()));
        if (activeCodes.length > 0) {
            throw new values_1.ConvexError({
                code: "FORBIDDEN",
                message: "Department already has an active access code. Rotate it instead.",
            });
        }
        return await issueDepartmentAccessCode({
            actionLabel: "generate",
            ctx,
            department,
            expirationAt: args.expiresAt,
            tenantUser,
        });
    },
});
exports.rotateAccessCode = (0, server_1.mutation)({
    args: {
        departmentId: values_1.v.id("departments"),
        expiresAt: values_1.v.number(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const { authContext, tenantUser } = await loadProcurementOfficerMutationContext(ctx);
        const department = await getTenantDepartmentOrThrow(ctx, {
            departmentId: args.departmentId,
            tenantId: authContext.tenantId,
        });
        return await issueDepartmentAccessCode({
            actionLabel: "rotate",
            ctx,
            department,
            expirationAt: args.expiresAt,
            tenantUser,
        });
    },
});
exports.deactivateAccessCode = (0, server_1.mutation)({
    args: {
        departmentId: values_1.v.id("departments"),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const { authContext, tenantUser } = await loadProcurementOfficerMutationContext(ctx);
        const department = await getTenantDepartmentOrThrow(ctx, {
            departmentId: args.departmentId,
            tenantId: authContext.tenantId,
        });
        const activeCodes = (await loadDepartmentAccessCodes(ctx, department._id)).filter((accessCode) => isUsableAccessCode(accessCode, Date.now()));
        if (activeCodes.length === 0) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: access_codes_1.ACCESS_CODE_NOT_FOUND_MESSAGE,
            });
        }
        await revokeDepartmentAccessCodes({
            accessCodes: activeCodes,
            ctx,
            revocationReason: "deactivated",
            revokedByTenantUserId: tenantUser._id,
        });
        for (const accessCode of activeCodes) {
            await appendDepartmentAccessCodeEventBestEffort(ctx, {
                accessCodeId: accessCode._id,
                actorTenantUserId: tenantUser._id,
                actorUserId: tenantUser.userId,
                departmentId: department._id,
                event: "deactivated",
                message: access_codes_1.ACCESS_CODE_DEACTIVATED_MESSAGE,
                outcome: "allowed",
                tenantId: authContext.tenantId,
            });
        }
        await (0, _audit_1.appendAuditLogRequired)(ctx, createAccessCodeAuditEntry({
            action: "deactivate",
            actorUserId: tenantUser.userId,
            event: audit_1.AUDIT_EVENT_NAMES.accessCodeDeactivated,
            metadata: {
                activeCodeCount: activeCodes.length,
                departmentId: String(department._id),
                departmentName: department.name,
                summary: `Deactivated the active access code for ${department.name}.`,
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            recordId: String(activeCodes[0]?._id ?? department._id),
            tenantId: authContext.tenantId,
        }));
        return {
            departmentId: args.departmentId,
        };
    },
});
exports.bulkGenerateAccessCodes = (0, server_1.mutation)({
    args: {
        expiresAt: values_1.v.number(),
        includeDepartmentsWithActiveCodes: values_1.v.optional(values_1.v.boolean()),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const { authContext, tenantUser } = await loadProcurementOfficerMutationContext(ctx);
        const expirationValidation = (0, access_codes_1.validateAccessCodeExpiration)({
            expirationAt: args.expiresAt,
        });
        if (!expirationValidation.ok) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: "expiresAt",
                message: expirationValidation.message || access_codes_1.ACCESS_CODE_EXPIRATION_PAST_MESSAGE,
            });
        }
        const now = Date.now();
        const departments = (await ctx.db
            .query("departments")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
            .collect())
            .filter(isActiveDepartment);
        const accessCodes = await ctx.db
            .query("departmentAccessCodes")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", authContext.tenantId))
            .collect();
        const eligibleDepartmentIds = new Set((0, access_codes_1.selectDepartmentsForBulkAccessCodeGeneration)({
            candidates: departments.map((department) => ({
                departmentId: String(department._id),
                hasActiveCode: accessCodes.some((accessCode) => accessCode.departmentId === department._id &&
                    isUsableAccessCode(accessCode, now)),
                isActive: true,
            })),
            includeDepartmentsWithActiveCodes: args.includeDepartmentsWithActiveCodes,
        }));
        if (eligibleDepartmentIds.size === 0) {
            return {
                noEligibleDepartments: true,
                results: [],
                summary: access_codes_1.ACCESS_CODE_NO_ELIGIBLE_BULK_MESSAGE,
            };
        }
        const results = [];
        for (const department of departments) {
            if (!eligibleDepartmentIds.has(String(department._id))) {
                results.push({
                    departmentId: String(department._id),
                    departmentName: department.name,
                    outcome: "skipped",
                    reason: "Department already has an active access code.",
                });
                continue;
            }
            try {
                await issueDepartmentAccessCode({
                    actionLabel: "bulk_generate",
                    ctx,
                    department,
                    expirationAt: args.expiresAt,
                    tenantUser,
                });
                results.push({
                    departmentId: String(department._id),
                    departmentName: department.name,
                    outcome: "generated",
                });
            }
            catch (error) {
                results.push({
                    departmentId: String(department._id),
                    departmentName: department.name,
                    outcome: "failed",
                    reason: error instanceof Error ? error.message : "Generation failed",
                });
            }
        }
        await (0, _audit_1.appendAuditLogRequired)(ctx, createAccessCodeAuditEntry({
            action: "bulk_generate",
            actorUserId: tenantUser.userId,
            event: audit_1.AUDIT_EVENT_NAMES.accessCodeBulkGenerated,
            metadata: {
                generatedCount: results.filter((result) => result.outcome === "generated").length,
                failedCount: results.filter((result) => result.outcome === "failed").length,
                skippedCount: results.filter((result) => result.outcome === "skipped").length,
                includeDepartmentsWithActiveCodes: args.includeDepartmentsWithActiveCodes ?? false,
                summary: "Bulk access-code generation completed.",
            },
            outcome: audit_1.AUDIT_OUTCOMES.allowed,
            tenantId: authContext.tenantId,
        }));
        return {
            noEligibleDepartments: false,
            results,
            summary: results.filter((result) => result.outcome === "generated").length > 0
                ? "Bulk access-code generation completed."
                : access_codes_1.ACCESS_CODE_NO_ELIGIBLE_BULK_MESSAGE,
        };
    },
});
exports.prepareAccessCodeEmailDelivery = (0, server_1.internalMutation)({
    args: {
        accessCodeId: values_1.v.id("departmentAccessCodes"),
        appUrl: values_1.v.optional(values_1.v.string()),
        departmentId: values_1.v.id("departments"),
        email: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        const { authContext, tenantUser, tenant } = await loadProcurementOfficerMutationContext(ctx);
        const department = await getTenantDepartmentOrThrow(ctx, {
            departmentId: args.departmentId,
            tenantId: authContext.tenantId,
        });
        const accessCode = await ctx.db.get(args.accessCodeId);
        if (!accessCode ||
            accessCode.departmentId !== args.departmentId ||
            accessCode.tenantId !== authContext.tenantId ||
            !isUsableAccessCode(accessCode, Date.now())) {
            throw new values_1.ConvexError({
                code: "NOT_FOUND",
                message: access_codes_1.ACCESS_CODE_NOT_FOUND_MESSAGE,
            });
        }
        const currentUsableCode = (await loadDepartmentAccessCodes(ctx, department._id))
            .filter((departmentAccessCode) => isUsableAccessCode(departmentAccessCode, Date.now()))
            .sort((left, right) => right.createdAt - left.createdAt)
            .at(0);
        if (!currentUsableCode || currentUsableCode._id !== accessCode._id) {
            throw new values_1.ConvexError({
                code: "FORBIDDEN",
                message: access_codes_1.ACCESS_CODE_NOT_FOUND_MESSAGE,
            });
        }
        const departmentCodeMatchesAccessCode = await doesDepartmentCodeMatchAccessCode({
            accessCode,
            department,
        });
        if (!departmentCodeMatchesAccessCode) {
            throw new values_1.ConvexError({
                code: "INVALID_STATE",
                message: access_codes_1.ACCESS_CODE_SYNC_REPAIR_REQUIRED_MESSAGE,
            });
        }
        const emailResult = (0, input_1.validateEmailInput)(args.email);
        if (!emailResult.ok) {
            throw new values_1.ConvexError({
                code: "VALIDATION_FAILED",
                field: "email",
                message: emailResult.issue.message,
            });
        }
        const normalizedEmail = (0, input_1.normalizeAuthEmail)(emailResult.value);
        await evaluateRecipientEligibility({
            ctx,
            departmentId: department._id,
            normalizedEmail,
            tenantId: authContext.tenantId,
        });
        const now = Date.now();
        const duplicateQueuedRequest = accessCode.lastDeliveryStatus === "queued" &&
            accessCode.lastDeliveryEmail === normalizedEmail &&
            typeof accessCode.lastDeliveryRequestedAt === "number" &&
            now - accessCode.lastDeliveryRequestedAt < 60_000 &&
            typeof accessCode.lastDeliveryIdempotencyKey === "string";
        const deliveryAttemptCount = duplicateQueuedRequest
            ? accessCode.deliveryAttemptCount ?? 1
            : (accessCode.deliveryAttemptCount ?? 0) + 1;
        const idempotencyKey = duplicateQueuedRequest
            ? accessCode.lastDeliveryIdempotencyKey
            : `access-code:${accessCode._id}:${normalizedEmail}:${deliveryAttemptCount}`;
        await ctx.db.patch(accessCode._id, {
            deliveryAttemptCount,
            lastDeliveryEmail: normalizedEmail,
            lastDeliveryIdempotencyKey: idempotencyKey,
            lastDeliveryRequestedAt: now,
            updatedAt: now,
        });
        return {
            accessCodeId: accessCode._id,
            accessCodeValue: department.code,
            departmentId: department._id,
            departmentName: department.name,
            duplicateQueuedRequest,
            email: normalizedEmail,
            expirationLabel: formatAccessCodeDateTime(accessCode.expiresAt) ?? "Not configured",
            idempotencyKey,
            loginUrl: (0, access_codes_1.buildAbsoluteAccessCodeLoginUrl)({
                appUrl: args.appUrl,
                loginPath: access_codes_1.ACCESS_CODE_LOGIN_URL_PATH,
            }),
            tenantId: authContext.tenantId,
            tenantName: tenant.name,
            tenantUserId: tenantUser._id,
            userId: tenantUser.userId,
        };
    },
});
exports.completeAccessCodeEmailDelivery = (0, server_1.internalMutation)({
    args: {
        accessCodeId: values_1.v.id("departmentAccessCodes"),
        email: values_1.v.string(),
        eventKey: values_1.v.optional(values_1.v.string()),
        idempotencyKey: values_1.v.string(),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const accessCode = await ctx.db.get(args.accessCodeId);
        if (!accessCode) {
            return null;
        }
        await ctx.db.patch(args.accessCodeId, {
            lastDeliveryEmail: args.email,
            lastDeliveryIdempotencyKey: args.idempotencyKey,
            lastDeliveryQueuedAt: Date.now(),
            lastDeliveryStatus: "queued",
            updatedAt: Date.now(),
        });
        await appendDepartmentAccessCodeEventBestEffort(ctx, {
            accessCodeId: accessCode._id,
            departmentId: accessCode.departmentId,
            event: "email_queued",
            message: "Access-code email queued for delivery.",
            normalizedEmail: args.email,
            outcome: "queued",
            tenantId: accessCode.tenantId,
        });
        return null;
    },
});
exports.failAccessCodeEmailDelivery = (0, server_1.internalMutation)({
    args: {
        accessCodeId: values_1.v.id("departmentAccessCodes"),
        email: values_1.v.string(),
        errorCode: values_1.v.optional(values_1.v.string()),
    },
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        const accessCode = await ctx.db.get(args.accessCodeId);
        if (!accessCode) {
            return null;
        }
        await ctx.db.patch(args.accessCodeId, {
            lastDeliveryEmail: args.email,
            lastDeliveryErrorCode: args.errorCode ?? "QUEUE_FAILED",
            lastDeliveryStatus: "failed",
            updatedAt: Date.now(),
        });
        await appendDepartmentAccessCodeEventBestEffort(ctx, {
            accessCodeId: accessCode._id,
            departmentId: accessCode.departmentId,
            event: "email_failed",
            message: "Access-code email failed before queue confirmation.",
            normalizedEmail: args.email,
            outcome: "failed",
            tenantId: accessCode.tenantId,
        });
        return null;
    },
});
exports.sendAccessCodeEmail = (0, server_1.action)({
    args: {
        accessCodeId: values_1.v.id("departmentAccessCodes"),
        appUrl: values_1.v.optional(values_1.v.string()),
        departmentId: values_1.v.id("departments"),
        email: values_1.v.string(),
    },
    returns: values_1.v.any(),
    handler: async (ctx, args) => {
        await loadProcurementOfficerActionContext(ctx);
        const prepared = await ctx.runMutation("functions/accessCodes:prepareAccessCodeEmailDelivery", args);
        const subject = `${prepared.tenantName} access code for ${prepared.departmentName}`;
        try {
            const queueResult = shouldCaptureAccessCodeEmailsDirectly()
                ? prepared.duplicateQueuedRequest
                    ? { duplicate: true }
                    : await (async () => {
                        await sendAccessCodeEmailDirect({
                            accessCode: prepared.accessCodeValue,
                            departmentName: prepared.departmentName,
                            email: prepared.email,
                            expirationLabel: prepared.expirationLabel,
                            idempotencyKey: prepared.idempotencyKey,
                            loginUrl: prepared.loginUrl,
                            subject,
                            tenantName: prepared.tenantName,
                        });
                        return {
                            duplicate: false,
                            eventKey: `dev-email:${prepared.idempotencyKey}`,
                            queued: true,
                        };
                    })()
                : await ctx.runAction("actions/email:queueTransactionalEmail", {
                    idempotencyKey: prepared.idempotencyKey,
                    subject,
                    template: "access-code-delivery",
                    templateProps: {
                        accessCode: prepared.accessCodeValue,
                        departmentName: prepared.departmentName,
                        expirationLabel: prepared.expirationLabel,
                        loginUrl: prepared.loginUrl,
                        tenantName: prepared.tenantName,
                    },
                    to: prepared.email,
                });
            await ctx.runMutation("functions/accessCodes:completeAccessCodeEmailDelivery", {
                accessCodeId: prepared.accessCodeId,
                email: prepared.email,
                eventKey: queueResult?.eventKey,
                idempotencyKey: prepared.idempotencyKey,
            });
            await ctx.runMutation("functions/auditLogs:appendAuditLogFromAction", {
                action: "email_queue",
                actorRole: "procurement_officer",
                actorState: (0, audit_1.createAuthenticatedAuditActor)({
                    role: "procurement_officer",
                    userId: String(prepared.userId),
                }).state,
                actorUserId: String(prepared.userId),
                entityType: "access_code",
                event: audit_1.AUDIT_EVENT_NAMES.accessCodeEmailQueued,
                metadata: {
                    accessCodeId: String(prepared.accessCodeId),
                    departmentId: String(prepared.departmentId),
                    email: prepared.email,
                    idempotencyKey: prepared.idempotencyKey,
                },
                outcome: audit_1.AUDIT_OUTCOMES.queued,
                recordId: String(prepared.accessCodeId),
                sourceTenantId: String(prepared.tenantId),
                tableName: "departmentAccessCodes",
                targetTenantId: String(prepared.tenantId),
                timestamp: Date.now(),
            }).catch(() => undefined);
            return {
                deliveryStatus: "queued",
                duplicate: prepared.duplicateQueuedRequest ||
                    Boolean(queueResult?.duplicate),
            };
        }
        catch (error) {
            await ctx.runMutation("functions/accessCodes:failAccessCodeEmailDelivery", {
                accessCodeId: prepared.accessCodeId,
                email: prepared.email,
                errorCode: error instanceof Error && error.message.trim().length > 0
                    ? error.message.trim()
                    : "QUEUE_FAILED",
            });
            await ctx.runMutation("functions/auditLogs:appendAuditLogFromAction", {
                action: "email_queue",
                actorRole: "procurement_officer",
                actorState: (0, audit_1.createAuthenticatedAuditActor)({
                    role: "procurement_officer",
                    userId: String(prepared.userId),
                }).state,
                actorUserId: String(prepared.userId),
                entityType: "access_code",
                event: audit_1.AUDIT_EVENT_NAMES.accessCodeEmailFailed,
                metadata: {
                    accessCodeId: String(prepared.accessCodeId),
                    departmentId: String(prepared.departmentId),
                    email: prepared.email,
                },
                outcome: audit_1.AUDIT_OUTCOMES.failed,
                recordId: String(prepared.accessCodeId),
                sourceTenantId: String(prepared.tenantId),
                tableName: "departmentAccessCodes",
                targetTenantId: String(prepared.tenantId),
                timestamp: Date.now(),
            }).catch(() => undefined);
            throw new values_1.ConvexError({
                code: "SERVICE_UNAVAILABLE",
                message: access_codes_1.ACCESS_CODE_DELIVERY_GENERIC_ERROR_MESSAGE,
            });
        }
    },
});
