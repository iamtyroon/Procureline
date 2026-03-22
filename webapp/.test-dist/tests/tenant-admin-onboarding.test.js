"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTenantAdminOnboardingTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const onboarding_backend_1 = require("../lib/tenant-admin/onboarding-backend");
const invitations_1 = require("../lib/tenant-admin/invitations");
const onboarding_1 = require("../lib/tenant-admin/onboarding");
const INDEX_FIELD_MAP = {
    auditLogs: {},
    platformUsers: {
        by_userId: ["userId"],
    },
    tenantAdminInvitations: {
        by_normalizedEmail: ["normalizedEmail", "createdAt"],
        by_tenantId_email: ["tenantId", "normalizedEmail"],
        by_tokenHash: ["tokenHash"],
    },
    tenantAdminOnboardingStates: {
        by_invitationId: ["invitationId", "createdAt"],
        by_normalizedEmail: ["normalizedEmail", "createdAt"],
    },
    tenantUsers: {
        by_tenantId: ["tenantId"],
        by_userId: ["userId"],
        by_userId_tenantId: ["userId", "tenantId"],
    },
    tenants: {},
    users: {},
};
class MockQueryBuilder {
    tableName;
    tables;
    descending = false;
    indexName = null;
    indexValues = [];
    constructor(tableName, tables) {
        this.tableName = tableName;
        this.tables = tables;
    }
    withIndex(indexName, build) {
        this.indexName = indexName;
        const values = [];
        const chainBuilder = {
            eq: (_field, value) => {
                values.push(value);
                return chainBuilder;
            },
        };
        build({
            eq: chainBuilder.eq,
        });
        this.indexValues = values;
        return this;
    }
    order(direction) {
        this.descending = direction === "desc";
        return this;
    }
    async collect() {
        return this.resolve();
    }
    async first() {
        return this.resolve()[0] ?? null;
    }
    resolve() {
        const docs = [...this.tables[this.tableName]];
        const filtered = !this.indexName
            ? docs
            : docs.filter((doc) => {
                const fields = INDEX_FIELD_MAP[this.tableName][this.indexName ?? ""] ?? [];
                return fields
                    .slice(0, this.indexValues.length)
                    .every((field, index) => doc[field] === this.indexValues[index]);
            });
        filtered.sort((left, right) => {
            const leftCreatedAt = typeof left.createdAt === "number"
                ? left.createdAt
                : Number(left._creationTime ?? 0);
            const rightCreatedAt = typeof right.createdAt === "number"
                ? right.createdAt
                : Number(right._creationTime ?? 0);
            const diff = leftCreatedAt - rightCreatedAt;
            return this.descending ? -diff : diff;
        });
        return filtered;
    }
}
function createMockMutationCtx(seed) {
    const tables = {
        auditLogs: seed?.auditLogs ? [...seed.auditLogs] : [],
        platformUsers: seed?.platformUsers ? [...seed.platformUsers] : [],
        tenantAdminInvitations: seed?.tenantAdminInvitations
            ? [...seed.tenantAdminInvitations]
            : [],
        tenantAdminOnboardingStates: seed?.tenantAdminOnboardingStates
            ? [...seed.tenantAdminOnboardingStates]
            : [],
        tenantUsers: seed?.tenantUsers ? [...seed.tenantUsers] : [],
        tenants: seed?.tenants ? [...seed.tenants] : [],
        users: seed?.users ? [...seed.users] : [],
    };
    let idCounter = Object.values(tables).reduce((total, docs) => total + docs.length, 0);
    let creationTimeCounter = 1_000;
    const ctx = {
        db: {
            async get(id) {
                for (const tableName of Object.keys(tables)) {
                    const match = tables[tableName].find((doc) => doc._id === id) ?? null;
                    if (match) {
                        return match;
                    }
                }
                return null;
            },
            async insert(tableName, value) {
                idCounter += 1;
                creationTimeCounter += 1;
                const id = `${tableName}-${idCounter}`;
                tables[tableName].push({
                    _creationTime: creationTimeCounter,
                    _id: id,
                    ...value,
                });
                return id;
            },
            async patch(id, value) {
                for (const tableName of Object.keys(tables)) {
                    const doc = tables[tableName].find((entry) => entry._id === id);
                    if (!doc) {
                        continue;
                    }
                    Object.assign(doc, value);
                    return;
                }
                throw new Error(`Missing document for patch: ${id}`);
            },
            query(tableName) {
                return new MockQueryBuilder(tableName, tables);
            },
        },
        tables,
    };
    return ctx;
}
async function withMockedDateNow(now, callback) {
    const originalDateNow = Date.now;
    Date.now = () => now;
    try {
        return await callback();
    }
    finally {
        Date.now = originalDateNow;
    }
}
async function expectConvexError(callback) {
    try {
        await callback();
        strict_1.default.fail("Expected a backend onboarding error");
    }
    catch (error) {
        strict_1.default.ok(error instanceof onboarding_backend_1.TenantAdminOnboardingBackendError);
        return error;
    }
}
async function runTenantAdminOnboardingTests() {
    const completedTests = [];
    strict_1.default.equal(onboarding_1.TENANT_ADMIN_ONBOARDING_ROUTE, "/tenant-admin/onboarding");
    strict_1.default.equal((0, onboarding_1.isTenantAdminOnboardingRoute)("/tenant-admin/onboarding"), true);
    strict_1.default.equal((0, onboarding_1.isTenantAdminOnboardingRoute)("/tenant-admin/onboarding/details"), true);
    strict_1.default.equal((0, onboarding_1.isTenantAdminOnboardingRoute)("/tenant-admin"), false);
    completedTests.push("tenant-admin onboarding route helpers identify the canonical onboarding namespace without confusing it with the dashboard root");
    strict_1.default.equal((0, onboarding_1.resolveTenantAdminOnboardingStage)({
        profileComplete: false,
        role: "tenant_admin",
    }), "required");
    strict_1.default.equal((0, onboarding_1.resolveTenantAdminOnboardingStage)({
        profileComplete: true,
        role: "tenant_admin",
    }), "complete");
    strict_1.default.equal((0, onboarding_1.resolveTenantAdminOnboardingStage)({
        profileComplete: false,
        role: "procurement_officer",
    }), "not_applicable");
    completedTests.push("tenant-admin onboarding stage resolution distinguishes incomplete tenant admins from complete or non-tenant-admin roles");
    strict_1.default.deepEqual((0, onboarding_1.evaluateTenantAdminOnboardingRouteAccess)({
        homePath: onboarding_1.TENANT_ADMIN_ONBOARDING_ROUTE,
        onboardingStage: "required",
        pathname: "/tenant-admin/settings",
    }), {
        action: "redirect",
        target: onboarding_1.TENANT_ADMIN_ONBOARDING_ROUTE,
    });
    strict_1.default.deepEqual((0, onboarding_1.evaluateTenantAdminOnboardingRouteAccess)({
        homePath: "/tenant-admin",
        onboardingStage: "complete",
        pathname: onboarding_1.TENANT_ADMIN_ONBOARDING_ROUTE,
    }), {
        action: "redirect",
        target: "/tenant-admin",
    });
    strict_1.default.deepEqual((0, onboarding_1.evaluateTenantAdminOnboardingRouteAccess)({
        homePath: onboarding_1.TENANT_ADMIN_ONBOARDING_ROUTE,
        onboardingStage: "required",
        pathname: onboarding_1.TENANT_ADMIN_ONBOARDING_ROUTE,
    }), { action: "allow" });
    completedTests.push("tenant-admin onboarding route access allows only the onboarding route while setup is incomplete and redirects complete users back to the dashboard");
    strict_1.default.equal(invitations_1.TENANT_ADMIN_INVITATION_TTL_MS, 72 * 60 * 60 * 1000);
    strict_1.default.equal(invitations_1.TENANT_ADMIN_VERIFICATION_WINDOW_MS, 24 * 60 * 60 * 1000);
    completedTests.push("tenant-admin onboarding constants preserve the required 72-hour invite expiry and 24-hour verification window");
    strict_1.default.equal((0, invitations_1.getTenantAdminInvitationAccessMessage)({
        status: "pending",
        tenantIsActive: true,
        expiresAt: Date.now() + 1_000,
        now: Date.now(),
    }), null);
    strict_1.default.equal((0, invitations_1.getTenantAdminInvitationAccessMessage)({
        status: "pending",
        tenantIsActive: false,
        expiresAt: Date.now() + 1_000,
        now: Date.now(),
    }), "Tenant deactivated. Contact Support.");
    strict_1.default.equal((0, invitations_1.getTenantAdminInvitationAccessMessage)({
        status: "expired",
        tenantIsActive: true,
        expiresAt: Date.now() - 1_000,
        now: Date.now(),
    }), "This invitation has expired. Request a new link.");
    completedTests.push("tenant-admin invitation access messaging fails closed for inactive tenants and expired invite links");
    strict_1.default.deepEqual((0, invitations_1.invalidateSupersededInvitationStatuses)([
        { id: "invite-1", status: "accepted" },
        { id: "invite-2", status: "pending" },
        { id: "invite-3", status: "revoked" },
    ]), [
        { id: "invite-1", nextStatus: "accepted" },
        { id: "invite-2", nextStatus: "revoked" },
        { id: "invite-3", nextStatus: "revoked" },
    ]);
    completedTests.push("invitation resend handling revokes only prior pending links so the newest invite remains the sole valid pending credential");
    strict_1.default.equal((0, invitations_1.canAutoResendTenantAdminVerification)({
        autoResendCount: 0,
        lastSentAt: 0,
        now: 16 * 60 * 1000,
        verificationWindowExpiresAt: invitations_1.TENANT_ADMIN_VERIFICATION_WINDOW_MS,
    }), true);
    strict_1.default.equal((0, invitations_1.canAutoResendTenantAdminVerification)({
        autoResendCount: 3,
        lastSentAt: 0,
        now: 16 * 60 * 1000,
        verificationWindowExpiresAt: invitations_1.TENANT_ADMIN_VERIFICATION_WINDOW_MS,
    }), false);
    strict_1.default.equal((0, invitations_1.canAutoResendTenantAdminVerification)({
        autoResendCount: 1,
        lastSentAt: 16 * 60 * 1000,
        now: invitations_1.TENANT_ADMIN_VERIFICATION_WINDOW_MS + 1,
        verificationWindowExpiresAt: invitations_1.TENANT_ADMIN_VERIFICATION_WINDOW_MS,
    }), false);
    completedTests.push("verification auto-resend logic respects the OTP cadence, 24-hour onboarding window, and three-attempt safety cap");
    strict_1.default.equal((0, onboarding_1.buildTenantAdminSignupContinuationHref)({
        email: "admin@university.ac.ke",
        inviteToken: "tenant-admin-token",
        organizationName: "University of Nairobi",
        tier: "starter",
    }), "/signup?tier=starter&invite=tenant-admin-token&email=admin%40university.ac.ke&step=verify&organizationName=University+of+Nairobi");
    completedTests.push("tenant-admin password-reset continuation preserves tier, invite token, email, verify-step resume, and organization name in the signup return path");
    await withMockedDateNow(1_710_000_000_000, async () => {
        const ctx = createMockMutationCtx();
        const tenantId = await ctx.db.insert("tenants", {
            createdAt: 1_700_000_000_000,
            name: "Alpha University",
            profileComplete: false,
            status: "active",
            subdomain: "alpha-university",
            tier: "starter",
        });
        const firstInvite = await (0, onboarding_backend_1.issueInvitationForBackendTests)({
            ctx: ctx,
            email: "admin@alpha.ac.ke",
            now: 1_710_000_000_000,
            platformUserId: "platform-user-1",
            tenantId,
        });
        const resentInvite = await (0, onboarding_backend_1.resendInvitationForBackendTests)({
            ctx: ctx,
            email: "admin@alpha.ac.ke",
            now: 1_710_000_000_000,
            platformUserId: "platform-user-1",
            tenantId,
        });
        const invitations = ctx.tables.tenantAdminInvitations;
        const firstInvitation = invitations.find((invitation) => invitation._id === firstInvite.invitationId);
        const latestInvitation = invitations.find((invitation) => invitation._id === resentInvite.invitationId);
        strict_1.default.equal(firstInvite.inviteUrl.startsWith("/signup?invite="), true);
        strict_1.default.equal(firstInvitation?.status, "revoked");
        strict_1.default.equal(latestInvitation?.status, "pending");
        strict_1.default.equal(latestInvitation?.resentCount, 1);
        strict_1.default.equal(ctx.tables.auditLogs.filter((entry) => entry.event === "tenant_admin.invitation.issued").length, 1);
        strict_1.default.equal(ctx.tables.auditLogs.filter((entry) => entry.event === "tenant_admin.invitation.resent").length, 1);
    });
    completedTests.push("backend invitation issue and resend flows persist hashed invite records, revoke superseded pending invites, and append the expected audit trail");
    await withMockedDateNow(1_720_000_000_000, async () => {
        const ctx = createMockMutationCtx();
        const tenantId = await ctx.db.insert("tenants", {
            createdAt: 1_700_000_000_000,
            name: "Beta University",
            profileComplete: false,
            status: "active",
            subdomain: "beta-university",
            tier: "free",
        });
        const invitation = await (0, onboarding_backend_1.issueInvitationForBackendTests)({
            ctx: ctx,
            email: "invited.admin@beta.ac.ke",
            now: 1_720_000_000_000,
            platformUserId: "platform-user-2",
            tenantId,
        });
        const error = await expectConvexError(async () => {
            await (0, onboarding_backend_1.startVerificationWindowForBackendTests)({
                ctx: ctx,
                email: "someone-else@beta.ac.ke",
                inviteToken: invitation.inviteToken,
                mode: "invite",
                now: 1_720_000_000_000,
            });
        });
        strict_1.default.match(error.message, /Email already in use/i);
        strict_1.default.equal(ctx.tables.tenantAdminOnboardingStates.length, 0);
    });
    completedTests.push("backend invite verification refuses mismatched invited emails before any onboarding state is persisted, preventing orphaned accounts later in the flow");
    await withMockedDateNow(1_730_000_000_000, async () => {
        const ctx = createMockMutationCtx();
        const tenantId = await ctx.db.insert("tenants", {
            createdAt: 1_700_000_000_000,
            name: "Gamma University",
            profileComplete: false,
            status: "active",
            subdomain: "gamma-university",
            tier: "professional",
        });
        await ctx.db.insert("users", {
            email: "admin@gamma.ac.ke",
        });
        await ctx.db.insert("tenantAdminOnboardingStates", {
            autoResendCount: 0,
            completedAt: undefined,
            createdAt: 1_729_000_000_000,
            invitationId: undefined,
            lastVerificationSentAt: 1_729_000_000_000,
            manualResendCount: 0,
            mode: "self_serve",
            normalizedEmail: "admin@gamma.ac.ke",
            tenantId,
            updatedAt: 1_729_000_000_000,
            verificationWindowExpiresAt: 1_731_000_000_000,
        });
        const result = await (0, onboarding_backend_1.completeInstitutionProfileForBackendTests)({
            authTenantId: tenantId,
            authUserId: "tenant-user-1",
            ctx: ctx,
            fiscalYearStartMonth: 7,
            institutionName: "Gamma University Main Campus",
            logoUrl: "https://cdn.procureline.app/logos/gamma.png",
            now: 1_730_000_000_000,
            primaryContactEmail: "admin@gamma.ac.ke",
            primaryContactName: "Grace Wanjiku",
            primaryContactPhone: "+254700000001",
        });
        const tenant = ctx.tables.tenants.find((entry) => entry._id === tenantId);
        const onboardingState = ctx.tables.tenantAdminOnboardingStates[0];
        strict_1.default.deepEqual(result, {
            profileComplete: true,
            tenantId,
        });
        strict_1.default.equal(tenant?.profileComplete, true);
        strict_1.default.equal(tenant?.fiscalYearStartMonth, 7);
        strict_1.default.equal(tenant?.name, "Gamma University Main Campus");
        strict_1.default.equal(onboardingState?.completedAt, 1_730_000_000_000);
        strict_1.default.equal(ctx.tables.auditLogs.some((entry) => entry.event === "tenant_admin.onboarding.completed"), true);
    });
    completedTests.push("backend institution-profile completion persists tenant setup truthfully, marks the onboarding state complete, and records the completion audit event");
    await withMockedDateNow(1_740_000_000_000, async () => {
        const ctx = createMockMutationCtx();
        const tenantId = await ctx.db.insert("tenants", {
            createdAt: 1_700_000_000_000,
            name: "Dormant University",
            profileComplete: false,
            status: "suspended",
            subdomain: "dormant-university",
            tier: "starter",
        });
        const error = await expectConvexError(async () => {
            await (0, onboarding_backend_1.completeInstitutionProfileForBackendTests)({
                authTenantId: tenantId,
                authUserId: "tenant-user-2",
                ctx: ctx,
                fiscalYearStartMonth: 7,
                institutionName: "Dormant University",
                now: 1_740_000_000_000,
                primaryContactEmail: "admin@dormant.ac.ke",
                primaryContactName: "Daniel Otieno",
                primaryContactPhone: "+254700000002",
            });
        });
        strict_1.default.equal(error.code, "TENANT_INACTIVE");
        strict_1.default.equal(error.message, "Tenant deactivated. Contact Support.");
        strict_1.default.equal(ctx.tables.auditLogs.some((entry) => entry.event === "tenant_admin.onboarding.blocked"), true);
    });
    completedTests.push("backend institution-profile completion fails closed for inactive tenants with the exact support message and blocked-onboarding audit trail");
    await withMockedDateNow(1_750_000_000_000, async () => {
        const ctx = createMockMutationCtx();
        const tenantId = await ctx.db.insert("tenants", {
            createdAt: 1_700_000_000_000,
            name: "Delta University",
            profileComplete: false,
            status: "active",
            subdomain: "delta-university",
            tier: "starter",
        });
        const userId = await ctx.db.insert("users", {
            email: "admin@delta.ac.ke",
        });
        await ctx.db.insert("platformUsers", {
            createdAt: 1_700_000_000_000,
            isActive: true,
            userId,
        });
        const invitation = await (0, onboarding_backend_1.issueInvitationForBackendTests)({
            ctx: ctx,
            email: "admin@delta.ac.ke",
            now: 1_750_000_000_000,
            platformUserId: "platform-user-3",
            tenantId,
        });
        const error = await expectConvexError(async () => {
            await (0, onboarding_backend_1.redeemInvitationForBackendTests)({
                ctx: ctx,
                inviteToken: invitation.inviteToken,
                now: 1_750_000_000_000,
                userId,
            });
        });
        strict_1.default.equal(error.code, "ALREADY_EXISTS");
        strict_1.default.match(error.message, /application role assignment/i);
        strict_1.default.equal(ctx.tables.tenantUsers.length, 0);
    });
    completedTests.push("backend invitation redemption blocks duplicate application-role assignments so onboarding cannot create a second tenant-admin membership for an existing app account");
    return completedTests;
}
exports.runTenantAdminOnboardingTests = runTenantAdminOnboardingTests;
