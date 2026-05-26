"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTenantNotificationDigests = exports.runTenantSubscriptionMaintenance = exports.restoreDeletedTenantAdminAccount = exports.requestAccountDeletion = exports.acceptAdminTransfer = exports.initiateAdminTransfer = exports.getAccountLifecycle = exports.revokeOtherSession = exports.verifyCurrentRecoveryCode = exports.verifyCurrentTwoFactorCode = exports.acknowledgeTwoFactorRecoveryCodes = exports.confirmTwoFactorEnrollment = exports.beginTwoFactorEnrollment = exports.getSecurityWorkspace = exports.sendPoBroadcast = exports.saveNotificationPreset = exports.markNotificationRead = exports.getNotificationCenter = exports.requestSubscriptionChange = exports.getBillingWorkspace = exports.unlockProcurementOfficer = exports.listProcurementOfficerActivity = exports.setProcurementOfficerActive = exports.getPoLifecycleContext = exports.confirmVerifiedEmailChange = exports.requestVerifiedEmailChange = exports.updateCurrentProfile = exports.saveInstitutionLogo = exports.generateInstitutionLogoUploadUrl = exports.updateInstitutionSettings = exports.getInstitutionSettings = void 0;
const random_1 = require("@oslojs/crypto/random");
const server_1 = require("@convex-dev/auth/server");
const values_1 = require("convex/values");
const api_1 = require("../_generated/api");
const server_2 = require("../_generated/server");
const operations_1 = require("../../lib/shared/tenant-admin/operations");
const _roleGuard_1 = require("./_roleGuard");
const sessions_1 = require("./sessions");
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const DEVELOPMENT_TOTP_ENCRYPTION_KEY = "procureline-dev-tenant-admin-totp-encryption-key";
const tierValidator = values_1.v.union(values_1.v.literal("free"), values_1.v.literal("starter"), values_1.v.literal("professional"), values_1.v.literal("enterprise"));
function validationError(field, message) {
    throw new values_1.ConvexError({ code: "VALIDATION_FAILED", field, message });
}
function randomReader() {
    return { read(bytes) { crypto.getRandomValues(bytes); } };
}
async function hashSecret(secret) {
    const data = new TextEncoder().encode(secret);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function bytesToBase64(bytes) {
    return btoa(String.fromCharCode(...bytes));
}
function base64ToBytes(value) {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
async function getTotpEncryptionKey() {
    const configuredKey = process.env.TENANT_ADMIN_TOTP_ENCRYPTION_KEY?.trim();
    const keyMaterial = configuredKey ||
        (process.env.NODE_ENV === "production" ? "" : DEVELOPMENT_TOTP_ENCRYPTION_KEY);
    if (!keyMaterial) {
        throw new values_1.ConvexError({
            code: "SERVER_CONFIGURATION_REQUIRED",
            message: "Tenant Admin authenticator enrollment is unavailable until encryption is configured.",
        });
    }
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(keyMaterial));
    return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encryptTotpSecret(secret) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ iv, name: "AES-GCM" }, await getTotpEncryptionKey(), new TextEncoder().encode(secret));
    return { ciphertext: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}
async function decryptTotpSecret(ciphertext, iv) {
    const decrypted = await crypto.subtle.decrypt({ iv: base64ToBytes(iv), name: "AES-GCM" }, await getTotpEncryptionKey(), base64ToBytes(ciphertext));
    return new TextDecoder().decode(decrypted);
}
function decodeBase32(secret) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    for (const character of secret.replace(/=+$/, "").toUpperCase()) {
        const index = alphabet.indexOf(character);
        if (index < 0)
            validationError("secret", "Invalid authenticator secret.");
        bits += index.toString(2).padStart(5, "0");
    }
    const bytes = [];
    for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
        bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
    }
    return new Uint8Array(bytes);
}
async function computeTotp(secret, timestamp = Date.now()) {
    const counter = Math.floor(timestamp / 30_000);
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setBigUint64(0, BigInt(counter));
    const key = await crypto.subtle.importKey("raw", decodeBase32(secret), { hash: "SHA-1", name: "HMAC" }, false, ["sign"]);
    const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, buffer));
    const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
    const value = (((digest[offset] ?? 0) & 0x7f) << 24) |
        ((digest[offset + 1] ?? 0) << 16) |
        ((digest[offset + 2] ?? 0) << 8) |
        (digest[offset + 3] ?? 0);
    return String(value % 1_000_000).padStart(6, "0");
}
async function getCurrentTenantAdmin(ctx, auth) {
    const member = await ctx.db
        .query("tenantUsers")
        .withIndex("by_userId_tenantId", (q) => q.eq("userId", auth.userId).eq("tenantId", auth.tenantId))
        .filter((q) => q.eq(q.field("role"), "tenant_admin"))
        .first();
    if (!member || !member.isActive) {
        throw new values_1.ConvexError({ code: "UNAUTHORIZED", message: "An active Tenant Admin membership is required." });
    }
    return member;
}
async function getCurrentTenantMember(ctx, auth) {
    const member = await ctx.db
        .query("tenantUsers")
        .withIndex("by_userId_tenantId", (q) => q.eq("userId", auth.userId).eq("tenantId", auth.tenantId))
        .filter((q) => q.eq(q.field("role"), auth.role))
        .first();
    if (!member || !member.isActive) {
        throw new values_1.ConvexError({ code: "UNAUTHORIZED", message: "An active tenant membership is required." });
    }
    return member;
}
async function audit(ctx, auth, args) {
    await ctx.db.insert("auditLogs", {
        action: args.action,
        actorRole: auth.role,
        actorState: "authenticated",
        actorUserId: auth.userId,
        entityType: args.entityType,
        event: args.event,
        metadata: args.metadata ?? {},
        outcome: "allowed",
        recordId: args.recordId,
        sourceTenantId: auth.tenantId,
        targetTenantId: auth.tenantId,
        timestamp: Date.now(),
    });
}
async function requireWritableTenant(ctx, auth) {
    const tenant = await ctx.db.get(auth.tenantId);
    if (tenant?.status === "suspended") {
        throw new values_1.ConvexError({
            code: "SUBSCRIPTION_READ_ONLY",
            message: "This tenant is in suspended read-only mode. Restore billing access before changing operational data.",
        });
    }
}
async function notifyTenantAdminsExceptActor(ctx, auth, args) {
    const existing = await ctx.db.query("tenantNotifications").withIndex("by_eventKey", (q) => q.eq("eventKey", args.eventKey)).first();
    if (existing)
        return;
    const recipients = await ctx.db.query("tenantUsers")
        .withIndex("by_tenantId", (q) => q.eq("tenantId", auth.tenantId))
        .filter((q) => q.eq(q.field("role"), "tenant_admin"))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();
    for (const recipient of recipients.filter((item) => item.userId !== auth.userId)) {
        const preference = await ctx.db.query("tenantNotificationPreferences")
            .withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", recipient._id))
            .first();
        const categoryPreference = preference?.categories.find((item) => item.category === args.category);
        const inApp = args.priority === "critical" || categoryPreference?.inApp !== false;
        const email = args.priority === "critical" || categoryPreference?.email !== false;
        if (!inApp && !email)
            continue;
        const recent = await ctx.db.query("tenantNotifications")
            .withIndex("by_recipientTenantUserId", (q) => q.eq("recipientTenantUserId", recipient._id))
            .filter((q) => q.gte(q.field("createdAt"), Date.now() - DAY_MS))
            .collect();
        const emailMode = email ? (0, operations_1.resolveNotificationEmailMode)({
            isCritical: args.priority === "critical",
            recentImmediateCount: recent.filter((item) => item.emailStatus === "queued").length,
        }) : null;
        await ctx.db.insert("tenantNotifications", {
            category: args.category,
            createdAt: Date.now(),
            emailStatus: emailMode === "digest" ? "digest_queued" : emailMode ? "queued" : "not_requested",
            eventKey: `${args.eventKey}:${recipient._id}`,
            message: args.message,
            priority: args.priority ?? "normal",
            recipientTenantUserId: recipient._id,
            recipientUserId: recipient.userId,
            tenantId: auth.tenantId,
            title: args.title,
        });
        if (emailMode === "immediate") {
            await scheduleGenericEmail(ctx, {
                heading: args.title,
                idempotencyKey: `tenant-notification:${args.eventKey}:${recipient._id}`,
                message: args.message,
                recipientUserId: recipient.userId,
                subject: args.title,
                tenantId: auth.tenantId,
            });
        }
    }
}
async function scheduleGenericEmail(ctx, args) {
    const user = await ctx.db.get(args.recipientUserId);
    const email = args.to?.trim().toLowerCase() ?? (typeof user?.email === "string" ? user.email.trim().toLowerCase() : "");
    if (!email)
        return false;
    await ctx.scheduler.runAfter(0, api_1.internal.actions.email.queueTenantBackgroundEmail, {
        idempotencyKey: args.idempotencyKey,
        subject: args.subject,
        template: "generic-notification",
        templateProps: { heading: args.heading, message: args.message },
        tenantId: String(args.tenantId),
        to: email,
        userId: String(args.recipientUserId),
    });
    return true;
}
async function requireTenantAdminVerificationSession(ctx) {
    const auth = await (0, _roleGuard_1.getAuthorizationContext)(ctx);
    if (!auth || auth.scope !== "tenant" || auth.role !== "tenant_admin" || !auth.tenantId) {
        throw new values_1.ConvexError({ code: "UNAUTHORIZED", message: "Tenant administrator access is required." });
    }
    return auth;
}
exports.getInstitutionSettings = (0, server_2.query)({
    args: {},
    handler: async (ctx) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        const actor = await getCurrentTenantAdmin(ctx, auth);
        const [tenant, versions] = await Promise.all([
            ctx.db.get(auth.tenantId),
            ctx.db.query("tenantSettingsVersions").withIndex("by_tenantId", (q) => q.eq("tenantId", auth.tenantId)).order("desc").take(2),
        ]);
        if (!tenant)
            throw new values_1.ConvexError({ code: "NOT_FOUND", message: "Tenant not found." });
        const effective = versions.find((item) => !item.effectiveFromNextCycle) ?? null;
        const pending = versions.find((item) => item.effectiveFromNextCycle) ?? null;
        return { currentTenantAdminId: actor._id, tenant, effective, pending };
    },
});
exports.updateInstitutionSettings = (0, server_2.mutation)({
    args: {
        allowedEmailDomains: values_1.v.array(values_1.v.string()),
        complianceTargets: values_1.v.object({ agpo: values_1.v.number(), localContent: values_1.v.number(), pwd: values_1.v.number() }),
        fiscalYearCustomFormat: values_1.v.optional(values_1.v.string()),
        fiscalYearDisplayFormat: values_1.v.union(values_1.v.literal("FY2025-26"), values_1.v.literal("2025/2026"), values_1.v.literal("custom")),
        fiscalYearStartMonth: values_1.v.number(),
        institutionName: values_1.v.string(),
        primaryContactEmail: values_1.v.string(),
        primaryContactName: values_1.v.string(),
        primaryContactPhone: values_1.v.string(),
        timeZone: values_1.v.string(),
        confirmActiveCycleChange: values_1.v.boolean(),
    },
    handler: async (ctx, args) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        await requireWritableTenant(ctx, auth);
        const actor = await getCurrentTenantAdmin(ctx, auth);
        const tenant = await ctx.db.get(auth.tenantId);
        if (!tenant)
            throw new values_1.ConvexError({ code: "NOT_FOUND", message: "Tenant not found." });
        if (args.fiscalYearStartMonth < 1 || args.fiscalYearStartMonth > 12)
            validationError("fiscalYearStartMonth", "Start month must be 1 through 12.");
        const complianceErrors = (0, operations_1.validateComplianceTargets)(args.complianceTargets);
        if (complianceErrors.length > 0)
            validationError("complianceTargets", complianceErrors.join(" "));
        if (args.fiscalYearDisplayFormat === "custom" && !/^\{start\}.*\{end(?:Short)?\}$/.test(args.fiscalYearCustomFormat ?? "")) {
            validationError("fiscalYearCustomFormat", "Custom format must include {start} and {end} or {endShort}.");
        }
        const domains = Array.from(new Set(args.allowedEmailDomains.map(operations_1.normalizeAllowedEmailDomain)));
        if (domains.some((domain) => domain === null))
            validationError("allowedEmailDomains", "Enter valid email domains only.");
        const activeDeadlines = await ctx.db.query("submissionDeadlines").withIndex("by_tenantId", (q) => q.eq("tenantId", auth.tenantId)).collect();
        const activeCycle = activeDeadlines.some((deadline) => deadline.submissionStartsAt <= Date.now() && deadline.submissionEndsAt >= Date.now());
        if (activeCycle && !args.confirmActiveCycleChange) {
            validationError("confirmActiveCycleChange", "An active submission cycle exists. Confirm changes for the next cycle.");
        }
        const previous = await ctx.db.query("tenantSettingsVersions").withIndex("by_tenantId", (q) => q.eq("tenantId", auth.tenantId)).order("desc").first();
        const removedDomains = (previous?.allowedEmailDomains ?? []).filter((domain) => !domains.includes(domain));
        if (removedDomains.length > 0) {
            const activeMembers = await ctx.db.query("tenantUsers")
                .withIndex("by_tenantId", (q) => q.eq("tenantId", auth.tenantId))
                .filter((q) => q.eq(q.field("isActive"), true))
                .collect();
            const affectedUsers = (await Promise.all(activeMembers.map((member) => ctx.db.get(member.userId))))
                .filter((user) => user?.email && removedDomains.includes(user.email.split("@")[1]?.toLowerCase() ?? ""));
            if (affectedUsers.length > 0) {
                validationError("allowedEmailDomains", "A removed domain is still assigned to active users. Update those accounts first.");
            }
        }
        const version = (previous?.version ?? 0) + 1;
        const recordId = await ctx.db.insert("tenantSettingsVersions", {
            allowedEmailDomains: domains,
            complianceTargets: args.complianceTargets,
            createdAt: Date.now(),
            createdByTenantUserId: actor._id,
            effectiveFromNextCycle: activeCycle,
            fiscalYearCustomFormat: args.fiscalYearCustomFormat,
            fiscalYearDisplayFormat: args.fiscalYearDisplayFormat,
            fiscalYearStartMonth: args.fiscalYearStartMonth,
            tenantId: auth.tenantId,
            version,
        });
        await ctx.db.patch(auth.tenantId, {
            fiscalYearStartMonth: activeCycle ? tenant.fiscalYearStartMonth : args.fiscalYearStartMonth,
            name: args.institutionName.trim(),
            primaryContactEmail: args.primaryContactEmail.trim().toLowerCase(),
            primaryContactName: args.primaryContactName.trim(),
            primaryContactPhone: args.primaryContactPhone.trim(),
            timeZone: args.timeZone.trim(),
        });
        await audit(ctx, auth, {
            action: "update",
            entityType: "tenant_settings",
            event: "tenant_admin.settings.updated",
            metadata: { activeCycle, version, beforeVersion: previous?.version ?? null },
            recordId: String(recordId),
        });
        return { activeCycle, recordId, version };
    },
});
exports.generateInstitutionLogoUploadUrl = (0, server_2.mutation)({
    args: {},
    handler: async (ctx) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        await requireWritableTenant(ctx, auth);
        return await ctx.storage.generateUploadUrl();
    },
});
exports.saveInstitutionLogo = (0, server_2.mutation)({
    args: { storageId: values_1.v.id("_storage") },
    handler: async (ctx, args) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        await requireWritableTenant(ctx, auth);
        const metadata = await ctx.db.system.get(args.storageId);
        if (!metadata || metadata.size > 2 * 1024 * 1024 ||
            !["image/png", "image/jpeg", "image/svg+xml"].includes(metadata.contentType ?? "")) {
            validationError("logo", "Upload a PNG, JPG, or SVG logo no larger than 2 MB.");
        }
        const logoUrl = await ctx.storage.getUrl(args.storageId);
        if (!logoUrl)
            validationError("logo", "Uploaded logo is unavailable.");
        await ctx.db.patch(auth.tenantId, { logoUrl });
        await audit(ctx, auth, { action: "update", entityType: "tenant_settings", event: "tenant_admin.settings.logo_updated" });
        return { logoUrl };
    },
});
exports.updateCurrentProfile = (0, server_2.mutation)({
    args: { name: values_1.v.string(), phone: values_1.v.string(), image: values_1.v.optional(values_1.v.string()) },
    handler: async (ctx, args) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        await requireWritableTenant(ctx, auth);
        const actor = await getCurrentTenantAdmin(ctx, auth);
        if (args.name.trim().length < 2)
            validationError("name", "Name is required.");
        await ctx.db.patch(auth.userId, {
            image: args.image?.trim() || undefined,
            name: args.name.trim(),
            phone: args.phone.trim(),
        });
        await audit(ctx, auth, {
            action: "update",
            entityType: "tenant_admin_profile",
            event: "tenant_admin.account.profile_updated",
            recordId: String(actor._id),
        });
        return null;
    },
});
exports.requestVerifiedEmailChange = (0, server_2.mutation)({
    args: {
        purpose: values_1.v.union(values_1.v.literal("po_email"), values_1.v.literal("tenant_admin_email")),
        requestedEmail: values_1.v.string(),
        targetTenantUserId: values_1.v.id("tenantUsers"),
    },
    handler: async (ctx, args) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        await requireWritableTenant(ctx, auth);
        const actor = await getCurrentTenantAdmin(ctx, auth);
        const target = await ctx.db.get(args.targetTenantUserId);
        if (!target || target.tenantId !== auth.tenantId || (args.purpose === "po_email" && target.role !== "procurement_officer") || (args.purpose === "tenant_admin_email" && target.userId !== auth.userId)) {
            throw new values_1.ConvexError({ code: "NOT_FOUND", message: "Email change target not found." });
        }
        const requestedEmail = args.requestedEmail.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(requestedEmail))
            validationError("requestedEmail", "Enter a valid email.");
        const token = (0, random_1.generateRandomString)(randomReader(), "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789", 48);
        const id = await ctx.db.insert("tenantPendingEmailChanges", {
            createdAt: Date.now(),
            expiresAt: Date.now() + DAY_MS,
            purpose: args.purpose,
            requestedByTenantUserId: actor._id,
            requestedEmail,
            status: "pending",
            targetTenantUserId: target._id,
            targetUserId: target.userId,
            tenantId: auth.tenantId,
            tokenHash: await hashSecret(token),
        });
        const queued = await scheduleGenericEmail(ctx, {
            heading: "Verify your new Procureline email address",
            idempotencyKey: `tenant-email-change:${id}`,
            message: `Use this one-time verification code to complete your email change request: ${token}`,
            recipientUserId: target.userId,
            subject: "Verify your new Procureline email address",
            tenantId: auth.tenantId,
            to: requestedEmail,
        });
        if (!queued) {
            throw new values_1.ConvexError({ code: "EMAIL_UNAVAILABLE", message: "The verification email could not be queued." });
        }
        await audit(ctx, auth, { action: "request", entityType: "email_change", event: "tenant_admin.account.email_change_requested", metadata: { purpose: args.purpose }, recordId: String(id) });
        return { queued: true };
    },
});
exports.confirmVerifiedEmailChange = (0, server_2.mutation)({
    args: { verificationToken: values_1.v.string() },
    handler: async (ctx, args) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        await requireWritableTenant(ctx, auth);
        const tokenHash = await hashSecret(args.verificationToken);
        const change = await ctx.db.query("tenantPendingEmailChanges").withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash)).first();
        if (!change || change.tenantId !== auth.tenantId || change.status !== "pending" || change.expiresAt <= Date.now())
            validationError("verificationToken", "Email verification request is expired or unavailable.");
        await ctx.db.patch(change.targetUserId, { email: change.requestedEmail });
        await ctx.db.patch(change._id, { completedAt: Date.now(), status: "verified" });
        await audit(ctx, auth, { action: "verify", entityType: "email_change", event: "tenant_admin.account.email_change_verified", recordId: String(change._id) });
        return null;
    },
});
exports.getPoLifecycleContext = (0, server_2.query)({
    args: { tenantUserId: values_1.v.optional(values_1.v.id("tenantUsers")) },
    handler: async (ctx, args) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        if (!args.tenantUserId)
            return null;
        const member = await ctx.db.get(args.tenantUserId);
        if (!member || member.tenantId !== auth.tenantId || member.role !== "procurement_officer")
            return null;
        const departments = await ctx.db.query("departments").withIndex("by_procurementOfficerTenantUserId", (q) => q.eq("procurementOfficerTenantUserId", member._id)).collect();
        const now = Date.now();
        return {
            activeCycleDepartments: departments.filter((item) => item.isActive && (item.submissionStartsAt ?? Infinity) <= now && (item.submissionEndsAt ?? -Infinity) >= now).length,
            assignedDepartments: departments.filter((item) => item.isActive).length,
            isActive: member.isActive,
        };
    },
});
exports.setProcurementOfficerActive = (0, server_2.mutation)({
    args: { active: values_1.v.boolean(), confirmImpact: values_1.v.boolean(), tenantUserId: values_1.v.id("tenantUsers") },
    handler: async (ctx, args) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        await requireWritableTenant(ctx, auth);
        const actor = await getCurrentTenantAdmin(ctx, auth);
        const member = await ctx.db.get(args.tenantUserId);
        if (!member || member.tenantId !== auth.tenantId || member.role !== "procurement_officer") {
            throw new values_1.ConvexError({ code: "NOT_FOUND", message: "Procurement Officer membership not found." });
        }
        if (!args.active) {
            const activePos = await ctx.db.query("tenantUsers").withIndex("by_tenantId", (q) => q.eq("tenantId", auth.tenantId)).filter((q) => q.eq(q.field("role"), "procurement_officer")).filter((q) => q.eq(q.field("isActive"), true)).collect();
            if (member.isActive && activePos.length <= 1)
                validationError("tenantUserId", "Cannot deactivate. At least one active PO required.");
            const departments = await ctx.db.query("departments").withIndex("by_procurementOfficerTenantUserId", (q) => q.eq("procurementOfficerTenantUserId", member._id)).collect();
            const activeCycle = departments.some((item) => item.isActive && (item.submissionStartsAt ?? Infinity) <= Date.now() && (item.submissionEndsAt ?? -Infinity) >= Date.now());
            if (activeCycle && !args.confirmImpact)
                validationError("confirmImpact", "This PO manages departments in an active submission cycle. Confirm deactivation to continue.");
        }
        await ctx.db.patch(member._id, args.active
            ? { isActive: true, reactivatedAt: Date.now() }
            : { deactivatedAt: Date.now(), deactivatedByTenantUserId: actor._id, isActive: false });
        await audit(ctx, auth, {
            action: args.active ? "reactivate" : "deactivate",
            entityType: "procurement_officer_membership",
            event: args.active ? "procurement_officer.reactivated" : "procurement_officer.deactivated",
            metadata: { after: args.active ? "active" : "inactive", before: member.isActive ? "active" : "inactive" },
            recordId: String(member._id),
        });
        await notifyTenantAdminsExceptActor(ctx, auth, {
            category: "po_lifecycle",
            eventKey: `po-lifecycle:${member._id}:${args.active ? "reactivated" : "deactivated"}:${Date.now()}`,
            message: `Procurement Officer access was ${args.active ? "reactivated" : "deactivated"}. Historical assignments and records are retained.`,
            title: `Procurement Officer ${args.active ? "reactivated" : "deactivated"}`,
        });
        return { active: args.active };
    },
});
exports.listProcurementOfficerActivity = (0, server_2.query)({
    args: { tenantUserId: values_1.v.id("tenantUsers"), dateFrom: values_1.v.optional(values_1.v.number()), dateTo: values_1.v.optional(values_1.v.number()), action: values_1.v.optional(values_1.v.string()), entityType: values_1.v.optional(values_1.v.string()), page: values_1.v.optional(values_1.v.number()) },
    handler: async (ctx, args) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        const member = await ctx.db.get(args.tenantUserId);
        if (!member || member.tenantId !== auth.tenantId || member.role !== "procurement_officer")
            return { items: [], page: 1, totalPages: 1 };
        const logs = await ctx.db.query("auditLogs").withIndex("by_actorUserId", (q) => q.eq("actorUserId", member.userId)).order("desc").take(250);
        const filtered = logs.filter((item) => (item.sourceTenantId === auth.tenantId || item.targetTenantId === auth.tenantId) &&
            (!args.dateFrom || item.timestamp >= args.dateFrom) && (!args.dateTo || item.timestamp <= args.dateTo) &&
            (!args.action || item.action === args.action) && (!args.entityType || item.entityType === args.entityType));
        const page = Math.max(1, args.page ?? 1);
        return { items: filtered.slice((page - 1) * 20, page * 20), page, totalPages: Math.max(1, Math.ceil(filtered.length / 20)) };
    },
});
exports.unlockProcurementOfficer = (0, server_2.mutation)({
    args: { tenantUserId: values_1.v.id("tenantUsers") },
    handler: async (ctx, args) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        await requireWritableTenant(ctx, auth);
        const member = await ctx.db.get(args.tenantUserId);
        if (!member || member.tenantId !== auth.tenantId || member.role !== "procurement_officer")
            throw new values_1.ConvexError({ code: "NOT_FOUND", message: "Procurement Officer not found." });
        const state = await ctx.db.query("tenantAdminSecurityStates").withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", member._id)).first();
        if (!state || (!state.lockedUntil && state.failedLoginAttempts === 0))
            validationError("tenantUserId", "No stored lockout condition exists for this account.");
        await ctx.db.patch(state._id, { failedLoginAttempts: 0, lockedUntil: undefined, updatedAt: Date.now() });
        await audit(ctx, auth, { action: "unlock", entityType: "procurement_officer_membership", event: "procurement_officer.unlocked", recordId: String(member._id) });
        await notifyTenantAdminsExceptActor(ctx, auth, { category: "security", eventKey: `po-unlock:${member._id}:${Date.now()}`, message: "The stored account lockout condition was manually reset.", priority: "high", title: "Procurement Officer account unlocked" });
        return null;
    },
});
exports.getBillingWorkspace = (0, server_2.query)({
    args: {},
    handler: async (ctx) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        const [tenant, tiers, records, departments, categories, items] = await Promise.all([
            ctx.db.get(auth.tenantId),
            ctx.db.query("subscriptionTiers").withIndex("by_display_order").filter((q) => q.eq(q.field("isActive"), true)).collect(),
            ctx.db.query("billingRecords").withIndex("by_tenantId", (q) => q.eq("tenantId", auth.tenantId)).order("desc").take(25),
            ctx.db.query("departments").withIndex("by_tenantId_isActive", (q) => q.eq("tenantId", auth.tenantId).eq("isActive", true)).collect(),
            ctx.db.query("procurementCategories").withIndex("by_tenantId_isActive", (q) => q.eq("tenantId", auth.tenantId).eq("isActive", true)).collect(),
            ctx.db.query("procurementItems").withIndex("by_tenantId_isActive", (q) => q.eq("tenantId", auth.tenantId).eq("isActive", true)).collect(),
        ]);
        if (!tenant)
            throw new values_1.ConvexError({ code: "NOT_FOUND", message: "Tenant not found." });
        const tier = tiers.find((item) => item.slug === tenant.tier);
        const numeric = (value) => typeof value === "number" ? value : null;
        const maxItems = categories.reduce((max, category) => Math.max(max, items.filter((item) => item.categoryId === category._id).length), 0);
        const metrics = [
            { key: "departments", label: "Departments", current: departments.length, limit: numeric(tier?.limits.departments) },
            { key: "categories", label: "Categories", current: categories.length, limit: numeric(tier?.limits.categories) },
            { key: "itemsPerCategory", label: "Maximum items per category", current: maxItems, limit: numeric(tier?.limits.itemsPerCategory) },
            { key: "editorBlocks", label: "DU editor blocks", current: null, limit: null, unavailableReason: "Block usage is not persisted by tenant." },
        ];
        return { tenant, tiers, records, metrics };
    },
});
exports.requestSubscriptionChange = (0, server_2.mutation)({
    args: { toTier: tierValidator },
    handler: async (ctx, args) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        const actor = await getCurrentTenantAdmin(ctx, auth);
        const tenant = await ctx.db.get(auth.tenantId);
        if (!tenant)
            throw new values_1.ConvexError({ code: "NOT_FOUND", message: "Tenant not found." });
        const order = ["free", "starter", "professional", "enterprise"];
        if (args.toTier === tenant.tier)
            validationError("toTier", "Select a different tier.");
        if (args.toTier === "enterprise") {
            const id = await ctx.db.insert("tenantSubscriptionChangeRequests", { changeType: "enterprise_contact", createdAt: Date.now(), fromTier: tenant.tier, requestedByTenantUserId: actor._id, status: "submitted", tenantId: auth.tenantId, toTier: args.toTier });
            await audit(ctx, auth, { action: "contact_sales", entityType: "subscription", event: "tenant_admin.subscription.enterprise_contact_submitted", recordId: String(id) });
            await notifyTenantAdminsExceptActor(ctx, auth, { category: "billing", eventKey: `subscription-change:${id}`, message: "An enterprise plan enquiry has been recorded for follow-up.", title: "Enterprise plan enquiry submitted" });
            return { status: "submitted", blockers: [] };
        }
        const isDowngrade = order.indexOf(args.toTier) < order.indexOf(tenant.tier);
        const tier = await ctx.db.query("subscriptionTiers").withIndex("by_slug", (q) => q.eq("slug", args.toTier)).first();
        const departments = await ctx.db.query("departments").withIndex("by_tenantId_isActive", (q) => q.eq("tenantId", auth.tenantId).eq("isActive", true)).collect();
        const blockers = isDowngrade ? (0, operations_1.buildDowngradeBlockers)([{ key: "departments", label: "Departments", current: departments.length, limit: typeof tier?.limits.departments === "number" ? tier.limits.departments : null }]) : [];
        const status = blockers.length > 0 ? "blocked" : isDowngrade ? "scheduled" : "pending_provider_confirmation";
        const currentTier = await ctx.db.query("subscriptionTiers").withIndex("by_slug", (q) => q.eq("slug", tenant.tier)).first();
        const prorationAmountCents = !isDowngrade && tier
            ? Math.max(0, Math.round((tier.priceUSD - (currentTier?.priceUSD ?? 0)) * 100))
            : undefined;
        const id = await ctx.db.insert("tenantSubscriptionChangeRequests", { blockers, changeType: isDowngrade ? "downgrade" : "upgrade", createdAt: Date.now(), effectiveAt: isDowngrade ? tenant.subscriptionNextBillingDate : undefined, fromTier: tenant.tier, requestedByTenantUserId: actor._id, prorationAmountCents, status, tenantId: auth.tenantId, toTier: args.toTier });
        if (status === "scheduled")
            await ctx.db.patch(auth.tenantId, { subscriptionPendingChangeEffectiveAt: tenant.subscriptionNextBillingDate, subscriptionPendingTier: args.toTier });
        await audit(ctx, auth, { action: isDowngrade ? "request_downgrade" : "request_upgrade", entityType: "subscription", event: "tenant_admin.subscription.change_requested", metadata: { blockers, status, toTier: args.toTier }, recordId: String(id) });
        await notifyTenantAdminsExceptActor(ctx, auth, { category: "billing", eventKey: `subscription-change:${id}`, message: blockers.length ? blockers.join(" ") : `Plan change request status: ${status}.`, priority: blockers.length ? "high" : "normal", title: blockers.length ? "Plan change blocked" : "Plan change requested" });
        return { blockers, checkoutAmountCents: prorationAmountCents, requestId: id, status };
    },
});
exports.getNotificationCenter = (0, server_2.query)({
    args: {},
    handler: async (ctx) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin", "procurement_officer"]);
        const actor = await getCurrentTenantMember(ctx, auth);
        const [notifications, preferences, broadcasts] = await Promise.all([
            ctx.db.query("tenantNotifications").withIndex("by_recipientTenantUserId", (q) => q.eq("recipientTenantUserId", actor._id)).order("desc").take(50),
            ctx.db.query("tenantNotificationPreferences").withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", actor._id)).first(),
            ctx.db.query("tenantNotificationBroadcasts").withIndex("by_tenantId", (q) => q.eq("tenantId", auth.tenantId)).order("desc").take(10),
        ]);
        return { broadcasts, notifications, preferences, unreadCount: notifications.filter((item) => item.readAt === undefined).length };
    },
});
exports.markNotificationRead = (0, server_2.mutation)({
    args: { notificationId: values_1.v.id("tenantNotifications") },
    handler: async (ctx, args) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin", "procurement_officer"]);
        await requireWritableTenant(ctx, auth);
        const actor = await getCurrentTenantMember(ctx, auth);
        const record = await ctx.db.get(args.notificationId);
        if (!record || record.tenantId !== auth.tenantId || record.recipientTenantUserId !== actor._id)
            throw new values_1.ConvexError({ code: "NOT_FOUND", message: "Notification not found." });
        await ctx.db.patch(record._id, { readAt: Date.now() });
        return null;
    },
});
exports.saveNotificationPreset = (0, server_2.mutation)({
    args: { preset: values_1.v.union(values_1.v.literal("all"), values_1.v.literal("critical_only")) },
    handler: async (ctx, args) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        await requireWritableTenant(ctx, auth);
        const actor = await getCurrentTenantAdmin(ctx, auth);
        const categories = ["po_lifecycle", "submission", "billing", "security", "broadcast"];
        const settings = categories.map((category) => ({ category, email: args.preset === "all" || category === "billing" || category === "security", inApp: true }));
        const existing = await ctx.db.query("tenantNotificationPreferences").withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", actor._id)).first();
        if (existing)
            await ctx.db.patch(existing._id, { categories: settings, preset: args.preset, updatedAt: Date.now() });
        else
            await ctx.db.insert("tenantNotificationPreferences", { categories: settings, preset: args.preset, tenantId: auth.tenantId, tenantUserId: actor._id, updatedAt: Date.now() });
        await audit(ctx, auth, { action: "update", entityType: "notification_preferences", event: "tenant_admin.notification.preferences_updated", metadata: { preset: args.preset } });
        return null;
    },
});
exports.sendPoBroadcast = (0, server_2.mutation)({
    args: { channels: values_1.v.array(values_1.v.union(values_1.v.literal("email"), values_1.v.literal("in_app"))), message: values_1.v.string(), subject: values_1.v.string() },
    handler: async (ctx, args) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        await requireWritableTenant(ctx, auth);
        const actor = await getCurrentTenantAdmin(ctx, auth);
        if (!args.subject.trim() || !args.message.trim())
            validationError("message", "Subject and message are required.");
        const recipients = await ctx.db.query("tenantUsers").withIndex("by_tenantId", (q) => q.eq("tenantId", auth.tenantId)).filter((q) => q.eq(q.field("role"), "procurement_officer")).filter((q) => q.eq(q.field("isActive"), true)).collect();
        const broadcastId = await ctx.db.insert("tenantNotificationBroadcasts", { channels: args.channels, createdAt: Date.now(), createdByTenantUserId: actor._id, message: args.message.trim(), subject: args.subject.trim(), tenantId: auth.tenantId });
        for (const recipient of recipients) {
            const notificationId = args.channels.includes("in_app") ? await ctx.db.insert("tenantNotifications", {
                category: "broadcast", createdAt: Date.now(), emailStatus: args.channels.includes("email") ? "queued" : "not_requested", eventKey: `broadcast:${broadcastId}:${recipient._id}`, message: args.message.trim(), priority: "normal", recipientTenantUserId: recipient._id, recipientUserId: recipient.userId, tenantId: auth.tenantId, title: args.subject.trim(),
            }) : undefined;
            await ctx.db.insert("tenantNotificationDeliveries", { broadcastId, createdAt: Date.now(), emailStatus: args.channels.includes("email") ? "queued" : "not_requested", inAppNotificationId: notificationId, recipientTenantUserId: recipient._id, tenantId: auth.tenantId });
            if (args.channels.includes("email")) {
                await scheduleGenericEmail(ctx, {
                    heading: args.subject.trim(),
                    idempotencyKey: `tenant-broadcast:${broadcastId}:${recipient._id}`,
                    message: args.message.trim(),
                    recipientUserId: recipient.userId,
                    subject: args.subject.trim(),
                    tenantId: auth.tenantId,
                });
            }
        }
        await audit(ctx, auth, { action: "broadcast", entityType: "notification_broadcast", event: "tenant_admin.notification.broadcast_submitted", metadata: { recipientCount: recipients.length }, recordId: String(broadcastId) });
        return { recipientCount: recipients.length };
    },
});
exports.getSecurityWorkspace = (0, server_2.query)({
    args: {},
    handler: async (ctx) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        const actor = await getCurrentTenantAdmin(ctx, auth);
        const currentSession = await (0, sessions_1.loadCurrentSessionDocuments)(ctx);
        const [state, events, sessions] = await Promise.all([
            ctx.db.query("tenantAdminSecurityStates").withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", actor._id)).first(),
            ctx.db.query("tenantSecurityEvents").withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", actor._id)).order("desc").take(25),
            ctx.db.query("sessionMetadata").withIndex("by_userId", (q) => q.eq("userId", auth.userId)).collect(),
        ]);
        return {
            events,
            isTwoFactorEnrolled: state?.isTwoFactorEnrolled ?? false,
            lockedUntil: state?.lockedUntil ?? null,
            passwordChangedAt: state?.passwordChangedAt ?? null,
            sessions: sessions.map((session) => ({
                device: session.tenantAdminDeviceLabel ?? "Device unavailable",
                id: session._id,
                isCurrent: currentSession?.sessionId === session.sessionId,
                lastActivityAt: session.lastActivityAt,
                revokedAt: session.revokedAt,
            })),
        };
    },
});
exports.beginTwoFactorEnrollment = (0, server_2.mutation)({
    args: {},
    handler: async (ctx) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        await requireWritableTenant(ctx, auth);
        const actor = await getCurrentTenantAdmin(ctx, auth);
        const secret = (0, random_1.generateRandomString)(randomReader(), "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 24);
        const existing = await ctx.db.query("tenantAdminSecurityStates").withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", actor._id)).first();
        const pending = await hashSecret(secret);
        if (existing)
            await ctx.db.patch(existing._id, { totpEnrollmentPendingHash: pending, updatedAt: Date.now() });
        else
            await ctx.db.insert("tenantAdminSecurityStates", { createdAt: Date.now(), failedLoginAttempts: 0, isTwoFactorEnrolled: false, recoveryCodes: [], tenantId: auth.tenantId, tenantUserId: actor._id, totpEnrollmentPendingHash: pending, updatedAt: Date.now(), userId: auth.userId });
        return { qrRepresentation: `otpauth://totp/Procureline:${auth.userId}?secret=${secret}&issuer=Procureline`, secret };
    },
});
exports.confirmTwoFactorEnrollment = (0, server_2.mutation)({
    args: { code: values_1.v.string(), secret: values_1.v.string() },
    handler: async (ctx, args) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        await requireWritableTenant(ctx, auth);
        const actor = await getCurrentTenantAdmin(ctx, auth);
        const state = await ctx.db.query("tenantAdminSecurityStates").withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", actor._id)).first();
        if (!state?.totpEnrollmentPendingHash || await hashSecret(args.secret) !== state.totpEnrollmentPendingHash)
            validationError("secret", "Authenticator enrollment is unavailable.");
        const expectedCodes = await Promise.all([-30_000, 0, 30_000].map((offset) => computeTotp(args.secret, Date.now() + offset)));
        if (!expectedCodes.includes(args.code.trim()))
            validationError("code", "Invalid authenticator confirmation code.");
        const codes = Array.from({ length: 10 }, () => (0, random_1.generateRandomString)(randomReader(), "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10));
        const encryptedSecret = await encryptTotpSecret(args.secret);
        await ctx.db.patch(state._id, { isTwoFactorEnrolled: false, recoveryCodes: await Promise.all(codes.map(async (code) => ({ codeHash: await hashSecret(code), suffix: code.slice(-4) }))), recoveryCodesAcknowledgedAt: undefined, totpEnrollmentPendingHash: undefined, totpSecretCiphertext: encryptedSecret.ciphertext, totpSecretIv: encryptedSecret.iv, updatedAt: Date.now() });
        return { recoveryCodes: codes };
    },
});
exports.acknowledgeTwoFactorRecoveryCodes = (0, server_2.mutation)({
    args: {},
    handler: async (ctx) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        await requireWritableTenant(ctx, auth);
        const actor = await getCurrentTenantAdmin(ctx, auth);
        const state = await ctx.db.query("tenantAdminSecurityStates").withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", actor._id)).first();
        if (!state?.totpSecretCiphertext || !state.totpSecretIv || state.recoveryCodes.length === 0) {
            validationError("recoveryCodes", "Complete authenticator verification before confirming recovery codes.");
        }
        const currentSession = await (0, sessions_1.loadCurrentSessionDocuments)(ctx);
        await ctx.db.patch(state._id, { isTwoFactorEnrolled: true, recoveryCodesAcknowledgedAt: Date.now(), updatedAt: Date.now() });
        if (currentSession?.metadata) {
            await ctx.db.patch(currentSession.metadata._id, { tenantAdminAuthStage: "verified", tenantAdminVerifiedAt: Date.now() });
        }
        else if (currentSession) {
            await ctx.db.insert("sessionMetadata", {
                createdAt: Date.now(),
                lastActivityAt: Date.now(),
                rememberMe: false,
                sessionId: currentSession.sessionId,
                tenantAdminAuthStage: "verified",
                tenantAdminVerifiedAt: Date.now(),
                userId: currentSession.userId,
            });
        }
        await audit(ctx, auth, { action: "enroll", entityType: "security", event: "tenant_admin.security.2fa_enrolled" });
        await notifyTenantAdminsExceptActor(ctx, auth, { category: "security", eventKey: `security:2fa-enrolled:${actor._id}`, message: "Two-factor authentication is now active for a Tenant Admin account.", priority: "high", title: "Two-factor authentication enabled" });
        return null;
    },
});
exports.verifyCurrentTwoFactorCode = (0, server_2.mutation)({
    args: { code: values_1.v.string() },
    handler: async (ctx, args) => {
        const auth = await requireTenantAdminVerificationSession(ctx);
        const actor = await getCurrentTenantAdmin(ctx, auth);
        const state = await ctx.db.query("tenantAdminSecurityStates").withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", actor._id)).first();
        if (!state?.isTwoFactorEnrolled || !state.totpSecretCiphertext || !state.totpSecretIv) {
            validationError("code", "Authenticator verification is unavailable.");
        }
        const secret = await decryptTotpSecret(state.totpSecretCiphertext, state.totpSecretIv);
        const expectedCodes = await Promise.all([-30_000, 0, 30_000].map((offset) => computeTotp(secret, Date.now() + offset)));
        if (!expectedCodes.includes(args.code.trim())) {
            const failedLoginAttempts = state.failedLoginAttempts + 1;
            await ctx.db.patch(state._id, { failedLoginAttempts, lockedUntil: (0, operations_1.computeLockoutUntil)({ failedAttempts: failedLoginAttempts, now: Date.now() }) ?? state.lockedUntil, updatedAt: Date.now() });
            validationError("code", "Invalid authenticator verification code.");
        }
        const currentSession = await (0, sessions_1.loadCurrentSessionDocuments)(ctx);
        if (!currentSession) {
            throw new values_1.ConvexError({ code: "UNAUTHORIZED", message: "The current session cannot be verified." });
        }
        if (currentSession.metadata) {
            await ctx.db.patch(currentSession.metadata._id, { tenantAdminAuthStage: "verified", tenantAdminVerifiedAt: Date.now() });
        }
        else {
            await ctx.db.insert("sessionMetadata", {
                createdAt: Date.now(),
                lastActivityAt: Date.now(),
                rememberMe: false,
                sessionId: currentSession.sessionId,
                tenantAdminAuthStage: "verified",
                tenantAdminVerifiedAt: Date.now(),
                userId: currentSession.userId,
            });
        }
        await ctx.db.patch(state._id, { failedLoginAttempts: 0, lockedUntil: undefined, updatedAt: Date.now() });
        await audit(ctx, auth, { action: "verify", entityType: "security", event: "tenant_admin.security.2fa_verified" });
        return { redirectPath: "/tenant-admin" };
    },
});
exports.verifyCurrentRecoveryCode = (0, server_2.mutation)({
    args: { code: values_1.v.string() },
    handler: async (ctx, args) => {
        const auth = await requireTenantAdminVerificationSession(ctx);
        const actor = await getCurrentTenantAdmin(ctx, auth);
        const state = await ctx.db.query("tenantAdminSecurityStates").withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", actor._id)).first();
        const codeHash = await hashSecret(args.code.trim());
        const recoveryIndex = state?.recoveryCodes.findIndex((code) => code.codeHash === codeHash && code.consumedAt === undefined) ?? -1;
        if (!state?.isTwoFactorEnrolled || recoveryIndex < 0)
            validationError("code", "Invalid or previously used recovery code.");
        const recoveryCodes = state.recoveryCodes.map((code, index) => index === recoveryIndex ? { ...code, consumedAt: Date.now() } : code);
        const currentSession = await (0, sessions_1.loadCurrentSessionDocuments)(ctx);
        if (!currentSession)
            throw new values_1.ConvexError({ code: "UNAUTHORIZED", message: "The current session cannot be verified." });
        await ctx.db.patch(state._id, { failedLoginAttempts: 0, lockedUntil: undefined, recoveryCodes, updatedAt: Date.now() });
        if (currentSession.metadata) {
            await ctx.db.patch(currentSession.metadata._id, { tenantAdminAuthStage: "verified", tenantAdminVerifiedAt: Date.now() });
        }
        else {
            await ctx.db.insert("sessionMetadata", { createdAt: Date.now(), lastActivityAt: Date.now(), rememberMe: false, sessionId: currentSession.sessionId, tenantAdminAuthStage: "verified", tenantAdminVerifiedAt: Date.now(), userId: currentSession.userId });
        }
        await audit(ctx, auth, { action: "recover", entityType: "security", event: "tenant_admin.security.recovery_code_used" });
        return { redirectPath: "/tenant-admin" };
    },
});
exports.revokeOtherSession = (0, server_2.mutation)({
    args: { sessionMetadataId: values_1.v.id("sessionMetadata") },
    handler: async (ctx, args) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        await requireWritableTenant(ctx, auth);
        const target = await ctx.db.get(args.sessionMetadataId);
        if (!target || target.userId !== auth.userId)
            throw new values_1.ConvexError({ code: "NOT_FOUND", message: "Session not found." });
        const currentSession = await (0, sessions_1.loadCurrentSessionDocuments)(ctx);
        if (currentSession?.sessionId === target.sessionId)
            validationError("sessionMetadataId", "The current session cannot be terminated here.");
        await ctx.db.patch(target._id, { revokedAt: Date.now() });
        await audit(ctx, auth, { action: "revoke", entityType: "session", event: "tenant_admin.security.session_revoked", recordId: String(target._id) });
        await notifyTenantAdminsExceptActor(ctx, auth, { category: "security", eventKey: `security:session-revoked:${target._id}`, message: "A Tenant Admin signed-in session was terminated.", priority: "high", title: "Session terminated" });
        return null;
    },
});
exports.getAccountLifecycle = (0, server_2.query)({
    args: {},
    handler: async (ctx) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        const actor = await getCurrentTenantAdmin(ctx, auth);
        const [transfers, deletion] = await Promise.all([
            ctx.db.query("tenantAdminTransferRequests").withIndex("by_tenantId", (q) => q.eq("tenantId", auth.tenantId)).order("desc").take(10),
            ctx.db.query("tenantAdminDeletionRequests").withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", actor._id)).order("desc").first(),
        ]);
        return { deletion, transfers };
    },
});
exports.initiateAdminTransfer = (0, server_2.mutation)({
    args: { recipientTenantUserId: values_1.v.id("tenantUsers") },
    handler: async (ctx, args) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        await requireWritableTenant(ctx, auth);
        const actor = await getCurrentTenantAdmin(ctx, auth);
        const recipient = await ctx.db.get(args.recipientTenantUserId);
        if (!recipient || recipient.tenantId !== auth.tenantId || !recipient.isActive || recipient._id === actor._id)
            validationError("recipientTenantUserId", "Select an eligible active tenant member.");
        const token = (0, random_1.generateRandomString)(randomReader(), "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789", 48);
        const id = await ctx.db.insert("tenantAdminTransferRequests", {
            acceptanceTokenHash: await hashSecret(token), createdAt: Date.now(), expiresAt: Date.now() + 7 * DAY_MS, initiatedByTenantUserId: actor._id, initiatorConfirmedAt: Date.now(), mode: "voluntary", recipientTenantUserId: recipient._id, status: "pending_acceptance", tenantId: auth.tenantId,
        });
        const queued = await scheduleGenericEmail(ctx, {
            heading: "Accept Tenant Admin responsibility",
            idempotencyKey: `tenant-admin-transfer:${id}`,
            message: `You were nominated to become Tenant Admin. Enter this one-time acceptance code in Procureline within seven days: ${token}`,
            recipientUserId: recipient.userId,
            subject: "Tenant Admin transfer request",
            tenantId: auth.tenantId,
        });
        if (!queued)
            throw new values_1.ConvexError({ code: "EMAIL_UNAVAILABLE", message: "The transfer acceptance email could not be queued." });
        await audit(ctx, auth, { action: "initiate", entityType: "admin_transfer", event: "tenant_admin.transfer.requested", recordId: String(id) });
        return { transferId: id };
    },
});
exports.acceptAdminTransfer = (0, server_2.mutation)({
    args: { acceptanceToken: values_1.v.string() },
    handler: async (ctx, args) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin", "procurement_officer"]);
        await requireWritableTenant(ctx, auth);
        const tokenHash = await hashSecret(args.acceptanceToken);
        const transfer = await ctx.db.query("tenantAdminTransferRequests").withIndex("by_acceptanceTokenHash", (q) => q.eq("acceptanceTokenHash", tokenHash)).first();
        if (!transfer || transfer.tenantId !== auth.tenantId || transfer.status !== "pending_acceptance" || transfer.expiresAt <= Date.now())
            validationError("acceptanceToken", "Transfer request is unavailable or expired.");
        const recipient = await ctx.db.get(transfer.recipientTenantUserId);
        if (!recipient || recipient.userId !== auth.userId || !recipient.isActive)
            validationError("acceptanceToken", "Only the nominated active recipient may accept.");
        const admins = await ctx.db.query("tenantUsers").withIndex("by_tenantId", (q) => q.eq("tenantId", auth.tenantId)).filter((q) => q.eq(q.field("role"), "tenant_admin")).filter((q) => q.eq(q.field("isActive"), true)).collect();
        if (recipient.role !== "tenant_admin")
            await ctx.db.insert("tenantUsers", { isActive: true, role: "tenant_admin", tenantId: auth.tenantId, userId: recipient.userId });
        if (admins.length > 0)
            await ctx.db.patch(transfer.initiatedByTenantUserId, { isActive: false, deactivatedAt: Date.now() });
        await ctx.db.patch(transfer._id, { acceptedAt: Date.now(), completedAt: Date.now(), status: "completed" });
        await audit(ctx, auth, { action: "accept", entityType: "admin_transfer", event: "tenant_admin.transfer.completed", recordId: String(transfer._id) });
        return null;
    },
});
exports.requestAccountDeletion = (0, server_2.mutation)({
    args: {},
    handler: async (ctx) => {
        const auth = await (0, _roleGuard_1.requireTenantRole)(ctx, ["tenant_admin"]);
        await requireWritableTenant(ctx, auth);
        const actor = await getCurrentTenantAdmin(ctx, auth);
        const admins = await ctx.db.query("tenantUsers").withIndex("by_tenantId", (q) => q.eq("tenantId", auth.tenantId)).filter((q) => q.eq(q.field("role"), "tenant_admin")).filter((q) => q.eq(q.field("isActive"), true)).collect();
        if (admins.length <= 1)
            validationError("account", "Transfer Tenant Admin responsibility before deleting this account.");
        const recoverUntil = Date.now() + 30 * DAY_MS;
        const id = await ctx.db.insert("tenantAdminDeletionRequests", { recoverUntil, requestedAt: Date.now(), requestedByTenantUserId: actor._id, status: "requested", tenantId: auth.tenantId, tenantUserId: actor._id });
        await ctx.db.patch(actor._id, { deactivatedAt: Date.now(), isActive: false });
        await audit(ctx, auth, { action: "soft_delete", entityType: "tenant_admin_account", event: "tenant_admin.account.deletion_requested", metadata: { recoverUntil }, recordId: String(id) });
        return { recoverUntil };
    },
});
exports.restoreDeletedTenantAdminAccount = (0, server_2.mutation)({
    args: {},
    handler: async (ctx) => {
        const userId = await (0, server_1.getAuthUserId)(ctx);
        if (!userId)
            throw new values_1.ConvexError({ code: "UNAUTHORIZED", message: "Sign in to restore this account." });
        const memberships = await ctx.db.query("tenantUsers").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
        const membership = memberships.find((item) => item.role === "tenant_admin" && !item.isActive);
        if (!membership)
            validationError("account", "No recoverable Tenant Admin account is available.");
        const deletion = await ctx.db.query("tenantAdminDeletionRequests").withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", membership._id)).order("desc").first();
        if (!deletion || deletion.status !== "requested" || !deletion.recoverUntil || deletion.recoverUntil <= Date.now()) {
            validationError("account", "The Tenant Admin recovery period has expired or is unavailable.");
        }
        await ctx.db.patch(membership._id, { isActive: true, reactivatedAt: Date.now() });
        await ctx.db.patch(deletion._id, { restoredAt: Date.now(), status: "restored" });
        await ctx.db.insert("auditLogs", {
            action: "restore",
            actorRole: "tenant_admin",
            actorState: "authenticated",
            actorUserId: userId,
            entityType: "tenant_admin_account",
            event: "tenant_admin.account.restored",
            metadata: {},
            outcome: "allowed",
            recordId: String(deletion._id),
            sourceTenantId: membership.tenantId,
            targetTenantId: membership.tenantId,
            timestamp: Date.now(),
        });
        return null;
    },
});
exports.runTenantSubscriptionMaintenance = (0, server_2.internalMutation)({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        const tenants = await ctx.db.query("tenants").collect();
        let queued = 0;
        for (const tenant of tenants) {
            const recipient = await ctx.db.query("tenantUsers").withIndex("by_tenantId", (q) => q.eq("tenantId", tenant._id)).filter((q) => q.eq(q.field("role"), "tenant_admin")).filter((q) => q.eq(q.field("isActive"), true)).first();
            if (!recipient)
                continue;
            const reminderCandidates = [];
            if (tenant.subscriptionStatus === "grace_period" && tenant.subscriptionGracePeriodEndsAt) {
                const dayKey = new Date(now).toISOString().slice(0, 10);
                reminderCandidates.push({ key: `billing:grace:${tenant._id}:${dayKey}`, type: "grace_daily", title: "Payment recovery required", message: "Your subscription is in its seven-day grace period. Update payment to prevent read-only suspension.", priority: "critical" });
            }
            if (tenant.subscriptionNextBillingDate) {
                const days = Math.ceil((tenant.subscriptionNextBillingDate - now) / DAY_MS);
                if (days === 30 || days === 7)
                    reminderCandidates.push({ key: `billing:renewal:${tenant._id}:${days}:${tenant.subscriptionNextBillingDate}`, type: days === 30 ? "renewal_30" : "renewal_7", title: `Renewal due in ${days} days`, message: `Subscription renewal is due ${new Date(tenant.subscriptionNextBillingDate).toLocaleDateString()}.`, priority: "high" });
            }
            if (tenant.subscriptionStatus === "suspended" && tenant.suspendedAt && tenant.suspendedAt + 90 * DAY_MS <= now && !tenant.subscriptionDeletionReviewAt) {
                reminderCandidates.push({ key: `billing:deletion-review:${tenant._id}`, type: "deletion_review", title: "Suspended account retained for review", message: "Your data remains retained; this account is marked for deletion review after extended suspension.", priority: "critical" });
                await ctx.db.patch(tenant._id, { subscriptionDeletionReviewAt: now });
            }
            if (tenant.subscriptionPendingTier && tenant.subscriptionPendingChangeEffectiveAt && tenant.subscriptionPendingChangeEffectiveAt <= now) {
                await ctx.db.patch(tenant._id, { tier: tenant.subscriptionPendingTier, subscriptionPendingChangeEffectiveAt: undefined, subscriptionPendingTier: undefined });
            }
            for (const candidate of reminderCandidates) {
                const existing = await ctx.db.query("tenantSubscriptionReminders").withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", candidate.key)).first();
                if (existing)
                    continue;
                await ctx.db.insert("tenantSubscriptionReminders", { createdAt: now, deliverAt: now, idempotencyKey: candidate.key, reminderType: candidate.type, tenantId: tenant._id });
                await ctx.db.insert("tenantNotifications", {
                    actionTarget: "/tenant-admin/billing", category: "billing", createdAt: now, emailStatus: "queued", eventKey: candidate.key, message: candidate.message, priority: candidate.priority, recipientTenantUserId: recipient._id, recipientUserId: recipient.userId, tenantId: tenant._id, title: candidate.title,
                });
                await scheduleGenericEmail(ctx, {
                    heading: candidate.title,
                    idempotencyKey: `tenant-reminder:${candidate.key}`,
                    message: candidate.message,
                    recipientUserId: recipient.userId,
                    subject: candidate.title,
                    tenantId: tenant._id,
                });
                queued += 1;
            }
        }
        return { queued };
    },
});
exports.runTenantNotificationDigests = (0, server_2.internalMutation)({
    args: {},
    handler: async (ctx) => {
        const digestQueued = await ctx.db
            .query("tenantNotifications")
            .filter((q) => q.eq(q.field("emailStatus"), "digest_queued"))
            .collect();
        const grouped = new Map();
        for (const notification of digestQueued) {
            const key = String(notification.recipientTenantUserId);
            const existing = grouped.get(key);
            if (existing) {
                existing.notifications.push(notification);
            }
            else {
                grouped.set(key, { notifications: [notification], recipient: notification });
            }
        }
        let scheduled = 0;
        for (const { notifications, recipient } of grouped.values()) {
            const delivered = await scheduleGenericEmail(ctx, {
                heading: "Procureline notification digest",
                idempotencyKey: `tenant-digest:${recipient.recipientTenantUserId}:${new Date().toISOString().slice(0, 10)}`,
                message: notifications.map((notification) => `- ${notification.title}: ${notification.message}`).join("\n"),
                recipientUserId: recipient.recipientUserId,
                subject: "Your Procureline notification digest",
                tenantId: recipient.tenantId,
            });
            if (!delivered)
                continue;
            for (const notification of notifications) {
                await ctx.db.patch(notification._id, { emailStatus: "queued" });
            }
            scheduled += 1;
        }
        return { scheduled };
    },
});
