import assert from "node:assert/strict";
import {
    completeInstitutionProfileForBackendTests,
    issueInvitationForBackendTests,
    redeemInvitationForBackendTests,
    resendInvitationForBackendTests,
    startVerificationWindowForBackendTests,
    TenantAdminOnboardingBackendError,
} from "../lib/backend/tenant-admin/onboarding";
import {
    canAutoResendTenantAdminVerification,
    getTenantAdminInvitationAccessMessage,
    invalidateSupersededInvitationStatuses,
    TENANT_ADMIN_INVITATION_TTL_MS,
    TENANT_ADMIN_VERIFICATION_WINDOW_MS,
} from "../lib/shared/tenant-admin/invitations";
import {
    buildTenantAdminSignupContinuationHref,
    evaluateTenantAdminOnboardingRouteAccess,
    isTenantAdminOnboardingRoute,
    resolveTenantAdminOnboardingStage,
    TENANT_ADMIN_ONBOARDING_ROUTE,
} from "../lib/shared/tenant-admin/onboarding";

type TableName =
    | "auditLogs"
    | "platformUsers"
    | "tenantAdminInvitations"
    | "tenantAdminOnboardingStates"
    | "tenantUsers"
    | "tenants"
    | "users";

type Tables = Record<TableName, Array<Record<string, unknown>>>;

const INDEX_FIELD_MAP: Record<
    TableName,
    Record<string, readonly string[]>
> = {
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

interface MockMutationCtx {
    db: {
        get(id: string): Promise<Record<string, unknown> | null>;
        insert(tableName: TableName, value: Record<string, unknown>): Promise<string>;
        patch(id: string, value: Record<string, unknown>): Promise<void>;
        query(tableName: TableName): MockQueryBuilder;
    };
}

class MockQueryBuilder {
    private descending = false;
    private indexName: string | null = null;
    private indexValues: unknown[] = [];

    constructor(
        private readonly tableName: TableName,
        private readonly tables: Tables,
    ) {}

    withIndex(
        indexName: string,
        build: (builder: {
            eq(field: string, value: unknown): {
                eq(field: string, value: unknown): unknown;
            };
        }) => unknown,
    ): MockQueryBuilder {
        this.indexName = indexName;
        const values: unknown[] = [];
        const chainBuilder = {
            eq: (_field: string, value: unknown) => {
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

    order(direction: "asc" | "desc"): MockQueryBuilder {
        this.descending = direction === "desc";
        return this;
    }

    async collect(): Promise<Array<Record<string, unknown>>> {
        return this.resolve();
    }

    async first(): Promise<Record<string, unknown> | null> {
        return this.resolve()[0] ?? null;
    }

    private resolve(): Array<Record<string, unknown>> {
        const docs = [...this.tables[this.tableName]];

        const filtered = !this.indexName
            ? docs
            : docs.filter((doc) => {
                  const fields =
                      INDEX_FIELD_MAP[this.tableName][this.indexName ?? ""] ?? [];
                  return fields
                      .slice(0, this.indexValues.length)
                      .every(
                          (field, index) =>
                              doc[field] === this.indexValues[index],
                  );
              });

        filtered.sort((left, right) => {
            const leftCreatedAt =
                typeof left.createdAt === "number"
                    ? left.createdAt
                    : Number(left._creationTime ?? 0);
            const rightCreatedAt =
                typeof right.createdAt === "number"
                    ? right.createdAt
                    : Number(right._creationTime ?? 0);
            const diff = leftCreatedAt - rightCreatedAt;
            return this.descending ? -diff : diff;
        });

        return filtered;
    }
}

function createMockMutationCtx(seed?: Partial<Tables>): MockMutationCtx & {
    tables: Tables;
} {
    const tables: Tables = {
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

    let idCounter = Object.values(tables).reduce(
        (total, docs) => total + docs.length,
        0,
    );
    let creationTimeCounter = 1_000;

    const ctx = {
        db: {
            async get(id: string): Promise<Record<string, unknown> | null> {
                for (const tableName of Object.keys(tables) as TableName[]) {
                    const match =
                        tables[tableName].find((doc) => doc._id === id) ?? null;
                    if (match) {
                        return match;
                    }
                }

                return null;
            },
            async insert(
                tableName: TableName,
                value: Record<string, unknown>,
            ): Promise<string> {
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
            async patch(id: string, value: Record<string, unknown>): Promise<void> {
                for (const tableName of Object.keys(tables) as TableName[]) {
                    const doc = tables[tableName].find((entry) => entry._id === id);
                    if (!doc) {
                        continue;
                    }

                    Object.assign(doc, value);
                    return;
                }

                throw new Error(`Missing document for patch: ${id}`);
            },
            query(tableName: TableName): MockQueryBuilder {
                return new MockQueryBuilder(tableName, tables);
            },
        },
        tables,
    };

    return ctx;
}

async function withMockedDateNow<T>(
    now: number,
    callback: () => Promise<T>,
): Promise<T> {
    const originalDateNow = Date.now;
    Date.now = () => now;

    try {
        return await callback();
    } finally {
        Date.now = originalDateNow;
    }
}

async function expectConvexError(
    callback: () => Promise<unknown>,
): Promise<TenantAdminOnboardingBackendError> {
    try {
        await callback();
        assert.fail("Expected a backend onboarding error");
    } catch (error: unknown) {
        assert.ok(error instanceof TenantAdminOnboardingBackendError);
        return error;
    }
}

export async function runTenantAdminOnboardingTests(): Promise<string[]> {
    const completedTests: string[] = [];

    assert.equal(TENANT_ADMIN_ONBOARDING_ROUTE, "/tenant-admin/onboarding");
    assert.equal(isTenantAdminOnboardingRoute("/tenant-admin/onboarding"), true);
    assert.equal(
        isTenantAdminOnboardingRoute("/tenant-admin/onboarding/details"),
        true,
    );
    assert.equal(isTenantAdminOnboardingRoute("/tenant-admin"), false);
    completedTests.push(
        "tenant-admin onboarding route helpers identify the canonical onboarding namespace without confusing it with the dashboard root",
    );

    assert.equal(
        resolveTenantAdminOnboardingStage({
            profileComplete: false,
            role: "tenant_admin",
        }),
        "required",
    );
    assert.equal(
        resolveTenantAdminOnboardingStage({
            profileComplete: true,
            role: "tenant_admin",
        }),
        "complete",
    );
    assert.equal(
        resolveTenantAdminOnboardingStage({
            profileComplete: false,
            role: "procurement_officer",
        }),
        "not_applicable",
    );
    completedTests.push(
        "tenant-admin onboarding stage resolution distinguishes incomplete tenant admins from complete or non-tenant-admin roles",
    );

    assert.deepEqual(
        evaluateTenantAdminOnboardingRouteAccess({
            homePath: TENANT_ADMIN_ONBOARDING_ROUTE,
            onboardingStage: "required",
            pathname: "/tenant-admin/settings",
        }),
        {
            action: "redirect",
            target: TENANT_ADMIN_ONBOARDING_ROUTE,
        },
    );
    assert.deepEqual(
        evaluateTenantAdminOnboardingRouteAccess({
            homePath: "/tenant-admin",
            onboardingStage: "complete",
            pathname: TENANT_ADMIN_ONBOARDING_ROUTE,
        }),
        {
            action: "redirect",
            target: "/tenant-admin",
        },
    );
    assert.deepEqual(
        evaluateTenantAdminOnboardingRouteAccess({
            homePath: TENANT_ADMIN_ONBOARDING_ROUTE,
            onboardingStage: "required",
            pathname: TENANT_ADMIN_ONBOARDING_ROUTE,
        }),
        { action: "allow" },
    );
    completedTests.push(
        "tenant-admin onboarding route access allows only the onboarding route while setup is incomplete and redirects complete users back to the dashboard",
    );

    assert.equal(TENANT_ADMIN_INVITATION_TTL_MS, 72 * 60 * 60 * 1000);
    assert.equal(TENANT_ADMIN_VERIFICATION_WINDOW_MS, 24 * 60 * 60 * 1000);
    completedTests.push(
        "tenant-admin onboarding constants preserve the required 72-hour invite expiry and 24-hour verification window",
    );

    assert.equal(
        getTenantAdminInvitationAccessMessage({
            status: "pending",
            tenantIsActive: true,
            expiresAt: Date.now() + 1_000,
            now: Date.now(),
        }),
        null,
    );
    assert.equal(
        getTenantAdminInvitationAccessMessage({
            status: "pending",
            tenantIsActive: false,
            expiresAt: Date.now() + 1_000,
            now: Date.now(),
        }),
        "Tenant deactivated. Contact Support.",
    );
    assert.equal(
        getTenantAdminInvitationAccessMessage({
            status: "expired",
            tenantIsActive: true,
            expiresAt: Date.now() - 1_000,
            now: Date.now(),
        }),
        "This invitation has expired. Request a new link.",
    );
    completedTests.push(
        "tenant-admin invitation access messaging fails closed for inactive tenants and expired invite links",
    );

    assert.deepEqual(
        invalidateSupersededInvitationStatuses([
            { id: "invite-1", status: "accepted" },
            { id: "invite-2", status: "pending" },
            { id: "invite-3", status: "revoked" },
        ]),
        [
            { id: "invite-1", nextStatus: "accepted" },
            { id: "invite-2", nextStatus: "revoked" },
            { id: "invite-3", nextStatus: "revoked" },
        ],
    );
    completedTests.push(
        "invitation resend handling revokes only prior pending links so the newest invite remains the sole valid pending credential",
    );

    assert.equal(
        canAutoResendTenantAdminVerification({
            autoResendCount: 0,
            lastSentAt: 0,
            now: 16 * 60 * 1000,
            verificationWindowExpiresAt: TENANT_ADMIN_VERIFICATION_WINDOW_MS,
        }),
        true,
    );
    assert.equal(
        canAutoResendTenantAdminVerification({
            autoResendCount: 3,
            lastSentAt: 0,
            now: 16 * 60 * 1000,
            verificationWindowExpiresAt: TENANT_ADMIN_VERIFICATION_WINDOW_MS,
        }),
        false,
    );
    assert.equal(
        canAutoResendTenantAdminVerification({
            autoResendCount: 1,
            lastSentAt: 16 * 60 * 1000,
            now: TENANT_ADMIN_VERIFICATION_WINDOW_MS + 1,
            verificationWindowExpiresAt: TENANT_ADMIN_VERIFICATION_WINDOW_MS,
        }),
        false,
    );
    completedTests.push(
        "verification auto-resend logic respects the OTP cadence, 24-hour onboarding window, and three-attempt safety cap",
    );

    assert.equal(
        buildTenantAdminSignupContinuationHref({
            email: "admin@university.ac.ke",
            inviteToken: "tenant-admin-token",
            organizationName: "University of Nairobi",
            tier: "starter",
        }),
        "/signup?tier=starter&invite=tenant-admin-token&email=admin%40university.ac.ke&step=verify&organizationName=University+of+Nairobi",
    );
    completedTests.push(
        "tenant-admin password-reset continuation preserves tier, invite token, email, verify-step resume, and organization name in the signup return path",
    );

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

        const firstInvite = await issueInvitationForBackendTests({
            ctx: ctx as any,
            email: "admin@alpha.ac.ke",
            now: 1_710_000_000_000,
            platformUserId: "platform-user-1",
            tenantId,
        });
        const resentInvite = await resendInvitationForBackendTests({
            ctx: ctx as any,
            email: "admin@alpha.ac.ke",
            now: 1_710_000_000_000,
            platformUserId: "platform-user-1",
            tenantId,
        });

        const invitations = ctx.tables.tenantAdminInvitations;
        const firstInvitation = invitations.find(
            (invitation) => invitation._id === firstInvite.invitationId,
        );
        const latestInvitation = invitations.find(
            (invitation) => invitation._id === resentInvite.invitationId,
        );

        assert.ok(firstInvitation);
        assert.ok(latestInvitation);
        assert.equal(firstInvite.inviteUrl.startsWith("/signup?invite="), true);
        assert.equal(firstInvitation.status, "revoked");
        assert.equal(latestInvitation.status, "pending");
        assert.equal(latestInvitation.resentCount, 1);
        assert.equal(
            ctx.tables.auditLogs.filter(
                (entry) => entry.event === "tenant_admin.invitation.issued",
            ).length,
            1,
        );
        assert.equal(
            ctx.tables.auditLogs.filter(
                (entry) => entry.event === "tenant_admin.invitation.resent",
            ).length,
            1,
        );
    });
    completedTests.push(
        "backend invitation issue and resend flows persist hashed invite records, revoke superseded pending invites, and append the expected audit trail",
    );

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

        const invitation = await issueInvitationForBackendTests({
            ctx: ctx as any,
            email: "invited.admin@beta.ac.ke",
            now: 1_720_000_000_000,
            platformUserId: "platform-user-2",
            tenantId,
        });
        const error = await expectConvexError(async () => {
            await startVerificationWindowForBackendTests({
                ctx: ctx as any,
                email: "someone-else@beta.ac.ke",
                inviteToken: invitation.inviteToken,
                mode: "invite",
                now: 1_720_000_000_000,
            });
        });

        assert.match(error.message, /Email already in use/i);
        assert.equal(ctx.tables.tenantAdminOnboardingStates.length, 0);
    });
    completedTests.push(
        "backend invite verification refuses mismatched invited emails before any onboarding state is persisted, preventing orphaned accounts later in the flow",
    );

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

        const result = await completeInstitutionProfileForBackendTests({
            authTenantId: tenantId,
            authUserId: "tenant-user-1",
            ctx: ctx as any,
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

        assert.ok(tenant);
        assert.deepEqual(result, {
            profileComplete: true,
            tenantId,
        });
        assert.equal(tenant.profileComplete, true);
        assert.equal(tenant.fiscalYearStartMonth, 7);
        assert.equal(
            tenant.name,
            "Gamma University Main Campus",
        );
        assert.equal(onboardingState?.completedAt, 1_730_000_000_000);
        assert.equal(
            ctx.tables.auditLogs.some(
                (entry) => entry.event === "tenant_admin.onboarding.completed",
            ),
            true,
        );
    });
    completedTests.push(
        "backend institution-profile completion persists tenant setup truthfully, marks the onboarding state complete, and records the completion audit event",
    );

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
            await completeInstitutionProfileForBackendTests({
                authTenantId: tenantId,
                authUserId: "tenant-user-2",
                ctx: ctx as any,
                fiscalYearStartMonth: 7,
                institutionName: "Dormant University",
                now: 1_740_000_000_000,
                primaryContactEmail: "admin@dormant.ac.ke",
                primaryContactName: "Daniel Otieno",
                primaryContactPhone: "+254700000002",
            });
        });

        assert.equal(error.code, "TENANT_INACTIVE");
        assert.equal(error.message, "Tenant deactivated. Contact Support.");
        assert.equal(
            ctx.tables.auditLogs.some(
                (entry) => entry.event === "tenant_admin.onboarding.blocked",
            ),
            true,
        );
    });
    completedTests.push(
        "backend institution-profile completion fails closed for inactive tenants with the exact support message and blocked-onboarding audit trail",
    );

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

        const invitation = await issueInvitationForBackendTests({
            ctx: ctx as any,
            email: "admin@delta.ac.ke",
            now: 1_750_000_000_000,
            platformUserId: "platform-user-3",
            tenantId,
        });

        const error = await expectConvexError(async () => {
            await redeemInvitationForBackendTests({
                ctx: ctx as any,
                inviteToken: invitation.inviteToken,
                now: 1_750_000_000_000,
                userId,
            });
        });

        assert.equal(error.code, "ALREADY_EXISTS");
        assert.match(error.message, /application role assignment/i);
        assert.equal(ctx.tables.tenantUsers.length, 0);
    });
    completedTests.push(
        "backend invitation redemption blocks duplicate application-role assignments so onboarding cannot create a second tenant-admin membership for an existing app account",
    );

    return completedTests;
}
