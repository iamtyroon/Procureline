import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import {
    action,
    internalAction,
    internalMutation,
    query,
    type ActionCtx,
    type MutationCtx,
    type QueryCtx,
} from "../_generated/server";
import {
    AUDIT_EVENT_NAMES,
    AUDIT_OUTCOMES,
    createAuthenticatedAuditActor,
} from "../../lib/security/audit";
import {
    buildCatalogRequestCategoryReferenceKey,
    buildCatalogRequestSummary,
    CATALOG_REQUEST_MESSAGES,
    createCategoryRequestIdentityKeys,
    createItemRequestIdentityKeys,
    formatCatalogRequestDecisionReason,
    formatCatalogRequestDuplicateCatalogMessage,
    isCatalogRequestEditable,
    normalizeCatalogRequestName,
    sanitizeCatalogRequestTextField,
    shouldAutoCancelLinkedCategoryRequest,
    shouldExpireCatalogRequest,
} from "../../lib/procurement/catalog-requests";
import { normalizeCategoryName } from "../../lib/procurement-officer/categories";
import { appendAuditLogRequired } from "./_audit";
import { requireTenantRole } from "./_roleGuard";

type RequestQueryCtx = QueryCtx;
type RequestMutationCtx = MutationCtx;

type DepartmentUserCatalogRequestBase = {
    accessMode: "editable" | "read_only_grace" | null;
    department: Doc<"departments">;
    requestorTenantUserId: Doc<"tenantUsers">["_id"];
    requestorUserId: Doc<"users">["_id"];
    tenantId: Doc<"tenants">["_id"];
    tenantName: string;
};

type ActionContext = {
    accessMode: "editable" | "read_only_grace" | null;
    departmentId: Doc<"departments">["_id"];
    departmentName: string;
    fiscalYear: string;
    planId: Doc<"plans">["_id"];
    procurementOfficerEmails: string[];
    requestorTenantUserId: Doc<"tenantUsers">["_id"];
    requestorUserId: Doc<"users">["_id"];
    submissionEndsAt: number | null;
    submissionStartsAt: number | null;
    tenantId: Doc<"tenants">["_id"];
    tenantName: string;
};

type NotificationPayload = {
    idempotencyKey: string;
    subject: string;
    templateProps: Record<string, unknown>;
    template: "catalog-request-status" | "catalog-request-submitted";
    to: string;
};

function ensureEditableAccess(accessMode: "editable" | "read_only_grace" | null): void {
    if (accessMode !== "editable") {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message:
                "Catalog requests can only be changed while the submission window is still editable.",
        });
    }
}

async function loadDepartmentUserCatalogRequestBase(
    ctx: RequestQueryCtx | RequestMutationCtx,
): Promise<DepartmentUserCatalogRequestBase> {
    const authContext = await requireTenantRole(ctx, ["department_user"]);
    const tenantUser = await ctx.db
        .query("tenantUsers")
        .withIndex("by_userId_tenantId", (q) =>
            q.eq("userId", authContext.userId).eq("tenantId", authContext.tenantId),
        )
        .first();

    if (!tenantUser || !tenantUser.isActive || tenantUser.role !== "department_user") {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Department User access is required for this resource.",
        });
    }

    const [profile, tenant] = await Promise.all([
        ctx.db
            .query("departmentUserProfiles")
            .withIndex("by_tenantUserId", (q) => q.eq("tenantUserId", tenantUser._id))
            .first(),
        ctx.db.get(authContext.tenantId),
    ]);

    if (!profile || !profile.isActive) {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Department User access is required for this resource.",
        });
    }

    const department = await ctx.db.get(profile.departmentId);
    if (!department || department.tenantId !== authContext.tenantId || !department.isActive) {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Department User access is required for this resource.",
        });
    }

    if (!tenant) {
        throw new ConvexError({
            code: "NOT_FOUND",
            message: "Tenant record not found.",
        });
    }

    return {
        accessMode: authContext.departmentAccessMode ?? null,
        department,
        requestorTenantUserId: tenantUser._id,
        requestorUserId: authContext.userId,
        tenantId: authContext.tenantId,
        tenantName: tenant.name,
    };
}

async function loadPlanForDepartment(
    ctx: RequestQueryCtx | RequestMutationCtx,
    args: {
        departmentId: Doc<"departments">["_id"];
        planId: string;
        tenantId: Doc<"tenants">["_id"];
    },
) {
    const plans = await ctx.db
        .query("plans")
        .withIndex("by_departmentId", (q) => q.eq("departmentId", args.departmentId))
        .collect();

    const plan =
        plans.find((candidate) => String(candidate._id) === args.planId) ?? null;
    if (!plan || plan.tenantId !== args.tenantId) {
        throw new ConvexError({
            code: "PLAN_NOT_FOUND",
            message: "Plan not found for this department.",
        });
    }

    return plan;
}

async function loadProcurementOfficerEmails(
    ctx: RequestQueryCtx,
    department: Doc<"departments">,
): Promise<string[]> {
    const tenantUser = await ctx.db.get(department.procurementOfficerTenantUserId);
    if (!tenantUser) {
        return [];
    }

    const user = await ctx.db.get(tenantUser.userId);
    if (!user?.email) {
        return [];
    }

    return [user.email.trim().toLowerCase()];
}

function createRequestAuditEntry(args: {
    action: "cancel" | "create" | "expire" | "update";
    event: string;
    metadata: Record<string, unknown>;
    outcome: string;
    recordId: string;
    tableName: "categoryRequests" | "itemRequests";
    tenantId: string;
    userId: string;
}) {
    return {
        action: args.action,
        actor: createAuthenticatedAuditActor({
            role: "department_user",
            userId: args.userId,
        }),
        entityType: "catalog_request",
        event: args.event as any,
        metadata: args.metadata,
        outcome: args.outcome as any,
        recordId: args.recordId,
        sourceTenantId: args.tenantId,
        tableName: args.tableName,
        targetTenantId: args.tenantId,
        timestamp: Date.now(),
    };
}

function buildRequestStatusReason(args: {
    decisionReason?: string;
    status: "approved" | "cancelled" | "denied" | "expired" | "pending";
}) {
    if (args.status === "expired" && !args.decisionReason) {
        return "Submission window ended before review.";
    }

    if (args.status === "cancelled" && !args.decisionReason) {
        return "Cancelled by the requestor.";
    }

    return args.decisionReason ?? null;
}

function buildSubmittedNotificationPayload(args: {
    requestId: string;
    requestSummary: string;
    requestType: "category" | "item";
    tenantId: string;
    tenantName: string;
    to: string[];
}) {
    return args.to.map((recipientEmail) => ({
        idempotencyKey: `catalog-request-submitted:${args.tenantId}:${args.requestType}:${args.requestId}:${recipientEmail}`,
        subject: `${args.tenantName} catalog request submitted`,
        template: "catalog-request-submitted" as const,
        templateProps: {
            requestId: args.requestId,
            requestSummary: args.requestSummary,
            requestType: args.requestType,
            tenantName: args.tenantName,
        },
        to: recipientEmail,
    }));
}

function buildStatusNotificationPayload(args: {
    reason: string;
    requestId: string;
    requestSummary: string;
    status: "expired";
    tenantId: string;
    tenantName: string;
    to: string;
}) {
    return {
        idempotencyKey: `catalog-request-status:${args.tenantId}:${args.requestId}:${args.status}:${args.to}`,
        subject: `${args.tenantName} catalog request ${args.status}`,
        template: "catalog-request-status" as const,
        templateProps: {
            reason: args.reason,
            requestId: args.requestId,
            requestSummary: args.requestSummary,
            status: args.status,
            tenantName: args.tenantName,
        },
        to: args.to,
    };
}

async function queueNotifications(
    ctx: ActionCtx,
    notifications: NotificationPayload[],
): Promise<void> {
    for (const notification of notifications) {
        await ctx.runAction("actions/email:queueTransactionalEmail" as any, {
            idempotencyKey: notification.idempotencyKey,
            subject: notification.subject,
            template: notification.template,
            templateProps: notification.templateProps,
            to: notification.to,
        });
    }
}

async function loadInternalRequestContext(
    ctx: RequestMutationCtx,
    args: ActionContext,
) {
    const [tenantUsers, profile] = await Promise.all([
        ctx.db
            .query("tenantUsers")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId))
            .collect(),
        ctx.db
            .query("departmentUserProfiles")
            .withIndex("by_tenantUserId", (q) =>
                q.eq("tenantUserId", args.requestorTenantUserId),
            )
            .first(),
    ]);
    const currentTenantUser = tenantUsers.find(
        (candidate) => String(candidate._id) === args.requestorTenantUserId,
    );
    if (
        !currentTenantUser ||
        !currentTenantUser.isActive ||
        currentTenantUser.role !== "department_user"
    ) {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Department User access is required for this resource.",
        });
    }

    if (
        !profile ||
        !profile.isActive ||
        String(profile.departmentId) !== args.departmentId
    ) {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Department User access is required for this resource.",
        });
    }

    const [department, tenant, plans] = await Promise.all([
        ctx.db.get(profile.departmentId),
        ctx.db.get(args.tenantId),
        ctx.db
            .query("plans")
            .withIndex("by_departmentId", (q) => q.eq("departmentId", profile.departmentId))
            .collect(),
    ]);

    const currentPlan =
        plans.find((candidate) => String(candidate._id) === args.planId) ?? null;

    if (
        !department ||
        String(department._id) !== args.departmentId ||
        department.tenantId !== args.tenantId
    ) {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Department User access is required for this resource.",
        });
    }

    if (!tenant) {
        throw new ConvexError({
            code: "NOT_FOUND",
            message: "Tenant record not found.",
        });
    }

    if (!currentPlan || currentPlan.departmentId !== department._id) {
        throw new ConvexError({
            code: "PLAN_NOT_FOUND",
            message: "Plan not found for this department.",
        });
    }

    return {
        department,
        plan: currentPlan,
        requestorTenantUserId: currentTenantUser._id,
        requestorUserId: currentTenantUser.userId,
        tenant,
    };
}

async function findExistingCategoryByNormalizedName(
    ctx: RequestMutationCtx,
    args: {
        normalizedName: string;
        tenantId: Doc<"tenants">["_id"];
    },
) {
    const existing = await ctx.db
        .query("procurementCategories")
        .withIndex("by_tenantId_normalizedName", (q) =>
            q.eq("tenantId", args.tenantId).eq("normalizedName", args.normalizedName),
        )
        .first();

    return existing ?? null;
}

async function ensureLinkedCategoryRequest(
    ctx: RequestMutationCtx,
    args: {
        context: ActionContext;
        description: string;
        justification: string;
        name: string;
    },
) {
    const internalContext = await loadInternalRequestContext(ctx, args.context);
    const name = sanitizeCatalogRequestTextField(args.name, {
        field: "categoryName",
        label: "Category name",
        maxLength: 80,
        minLength: 2,
    });
    const description = sanitizeCatalogRequestTextField(args.description, {
        field: "categoryDescription",
        label: "Category description",
        maxLength: 280,
        minLength: 2,
    });
    const justification = sanitizeCatalogRequestTextField(args.justification, {
        field: "categoryJustification",
        label: "Justification",
        maxLength: 280,
        minLength: 2,
    });
    const normalizedName = normalizeCatalogRequestName("category", name);
    const existingCategory = await findExistingCategoryByNormalizedName(ctx, {
        normalizedName,
        tenantId: internalContext.tenant._id,
    });
    if (existingCategory) {
        throw new ConvexError({
            code: "ALREADY_EXISTS",
            message: CATALOG_REQUEST_MESSAGES.categoryAlreadyExists,
        });
    }

    const identityKeys = createCategoryRequestIdentityKeys({
        departmentId: String(internalContext.department._id),
        normalizedName,
        requestorTenantUserId: String(internalContext.requestorTenantUserId),
        tenantId: String(internalContext.tenant._id),
    });
    const duplicateRequests = await ctx.db
        .query("categoryRequests")
        .withIndex("by_tenantId_requesterDuplicateKey", (q) =>
            q.eq("tenantId", internalContext.tenant._id).eq(
                "requesterDuplicateKey",
                identityKeys.requesterDuplicateKey,
            ),
        )
        .collect();
    const pendingDuplicate =
        duplicateRequests.find((request) => request.status === "pending") ?? null;

    if (pendingDuplicate) {
        return {
            categoryName: pendingDuplicate.name,
            categoryRequestId: pendingDuplicate._id,
            normalizedCategoryName: pendingDuplicate.normalizedName,
            notifications: [] as NotificationPayload[],
        };
    }

    const now = Date.now();
    const categoryRequestId = await ctx.db.insert("categoryRequests", {
        createdAt: now,
        departmentId: internalContext.department._id,
        description,
        fiscalYear: internalContext.plan.fiscalYear,
        justification,
        name,
        normalizedName,
        planId: internalContext.plan._id,
        requesterDuplicateKey: identityKeys.requesterDuplicateKey,
        requestorTenantUserId: internalContext.requestorTenantUserId,
        requestorUserId: internalContext.requestorUserId,
        requestOrigin: "item_handoff",
        revision: 1,
        sharedGroupingKey: identityKeys.sharedGroupingKey,
        status: "pending",
        submittedAt: now,
        tenantId: internalContext.tenant._id,
        updatedAt: now,
    });

    await appendAuditLogRequired(
        ctx,
        createRequestAuditEntry({
            action: "create",
            event: AUDIT_EVENT_NAMES.categoryRequestCreated,
            metadata: {
                departmentId: String(internalContext.department._id),
                planId: String(internalContext.plan._id),
                requestType: "category",
            },
            outcome: AUDIT_OUTCOMES.queued,
            recordId: String(categoryRequestId),
            tableName: "categoryRequests",
            tenantId: String(internalContext.tenant._id),
            userId: String(internalContext.requestorUserId),
        }),
    );

    return {
        categoryName: name,
        categoryRequestId,
        normalizedCategoryName: normalizedName,
        notifications: buildSubmittedNotificationPayload({
            requestId: String(categoryRequestId),
            requestSummary: name,
            requestType: "category",
            tenantId: String(internalContext.tenant._id),
            tenantName: internalContext.tenant.name,
            to: args.context.procurementOfficerEmails,
        }),
    };
}

async function createCategoryRequestRecord(
    ctx: RequestMutationCtx,
    args: {
        context: ActionContext;
        description: string;
        justification: string;
        name: string;
    },
) {
    const internalContext = await loadInternalRequestContext(ctx, args.context);
    ensureEditableAccess(args.context.accessMode);

    const name = sanitizeCatalogRequestTextField(args.name, {
        field: "categoryName",
        label: "Category name",
        maxLength: 80,
        minLength: 2,
    });
    const description = sanitizeCatalogRequestTextField(args.description, {
        field: "categoryDescription",
        label: "Category description",
        maxLength: 280,
        minLength: 2,
    });
    const justification = sanitizeCatalogRequestTextField(args.justification, {
        field: "categoryJustification",
        label: "Justification",
        maxLength: 280,
        minLength: 2,
    });
    const normalizedName = normalizeCatalogRequestName("category", name);

    const existingCategory = await findExistingCategoryByNormalizedName(ctx, {
        normalizedName,
        tenantId: internalContext.tenant._id,
    });
    if (existingCategory) {
        throw new ConvexError({
            code: "ALREADY_EXISTS",
            message: CATALOG_REQUEST_MESSAGES.categoryAlreadyExists,
        });
    }

    const identityKeys = createCategoryRequestIdentityKeys({
        departmentId: String(internalContext.department._id),
        normalizedName,
        requestorTenantUserId: String(internalContext.requestorTenantUserId),
        tenantId: String(internalContext.tenant._id),
    });
    const duplicateRequests = await ctx.db
        .query("categoryRequests")
        .withIndex("by_tenantId_requesterDuplicateKey", (q) =>
            q.eq("tenantId", internalContext.tenant._id).eq(
                "requesterDuplicateKey",
                identityKeys.requesterDuplicateKey,
            ),
        )
        .collect();
    if (duplicateRequests.some((request) => request.status === "pending")) {
        throw new ConvexError({
            code: "ALREADY_EXISTS",
            message: CATALOG_REQUEST_MESSAGES.duplicatePending,
        });
    }

    const now = Date.now();
    const requestId = await ctx.db.insert("categoryRequests", {
        createdAt: now,
        departmentId: internalContext.department._id,
        description,
        fiscalYear: internalContext.plan.fiscalYear,
        justification,
        name,
        normalizedName,
        planId: internalContext.plan._id,
        requesterDuplicateKey: identityKeys.requesterDuplicateKey,
        requestorTenantUserId: internalContext.requestorTenantUserId,
        requestorUserId: internalContext.requestorUserId,
        requestOrigin: "standalone",
        revision: 1,
        sharedGroupingKey: identityKeys.sharedGroupingKey,
        status: "pending",
        submittedAt: now,
        tenantId: internalContext.tenant._id,
        updatedAt: now,
    });

    await appendAuditLogRequired(
        ctx,
        createRequestAuditEntry({
            action: "create",
            event: AUDIT_EVENT_NAMES.categoryRequestCreated,
            metadata: {
                departmentId: String(internalContext.department._id),
                planId: String(internalContext.plan._id),
                requestType: "category",
            },
            outcome: AUDIT_OUTCOMES.queued,
            recordId: String(requestId),
            tableName: "categoryRequests",
            tenantId: String(internalContext.tenant._id),
            userId: String(internalContext.requestorUserId),
        }),
    );

    return {
        notifications: buildSubmittedNotificationPayload({
            requestId: String(requestId),
            requestSummary: name,
            requestType: "category",
            tenantId: String(internalContext.tenant._id),
            tenantName: internalContext.tenant.name,
            to: args.context.procurementOfficerEmails,
        }),
        requestId: String(requestId),
    };
}

async function createItemRequestRecord(
    ctx: RequestMutationCtx,
    args: {
        categoryId?: string;
        categoryRequest?: {
            description: string;
            justification: string;
            name: string;
        };
        context: ActionContext;
        description: string;
        estimatedUnitPrice: number;
        justification: string;
        name: string;
    },
) {
    const internalContext = await loadInternalRequestContext(ctx, args.context);
    ensureEditableAccess(args.context.accessMode);

    const name = sanitizeCatalogRequestTextField(args.name, {
        field: "itemName",
        label: "Item name",
        maxLength: 80,
        minLength: 2,
    });
    const description = sanitizeCatalogRequestTextField(args.description, {
        field: "itemDescription",
        label: "Item description",
        maxLength: 280,
        minLength: 2,
    });
    const justification = sanitizeCatalogRequestTextField(args.justification, {
        field: "itemJustification",
        label: "Justification",
        maxLength: 280,
        minLength: 2,
    });
    if (!Number.isFinite(args.estimatedUnitPrice) || args.estimatedUnitPrice <= 0) {
        throw new ConvexError({
            code: "VALIDATION_FAILED",
            message: CATALOG_REQUEST_MESSAGES.itemPricePositive,
        });
    }

    const normalizedName = normalizeCatalogRequestName("item", name);
    let categoryId: Doc<"procurementCategories">["_id"] | undefined;
    let categoryNameSnapshot = "";
    let normalizedCategoryName = "";
    let linkedCategoryRequestId: Doc<"categoryRequests">["_id"] | undefined;
    let notifications: NotificationPayload[] = [];

    if (args.categoryId?.trim()) {
        const categories = await ctx.db
            .query("procurementCategories")
            .withIndex("by_tenantId", (q) => q.eq("tenantId", internalContext.tenant._id))
            .collect();
        const matchedCategory =
            categories.find((candidate) => String(candidate._id) === args.categoryId) ??
            null;
        if (!matchedCategory || !matchedCategory.isActive) {
            throw new ConvexError({
                code: "VALIDATION_FAILED",
                message: CATALOG_REQUEST_MESSAGES.itemCategoryRequired,
            });
        }
        categoryId = matchedCategory._id;
        categoryNameSnapshot = matchedCategory.name;
        normalizedCategoryName =
            matchedCategory.normalizedName ?? normalizeCategoryName(matchedCategory.name);

        const existingItem = await ctx.db
            .query("procurementItems")
            .withIndex("by_tenantId_categoryId_normalizedName", (q) =>
                q.eq("tenantId", internalContext.tenant._id)
                    .eq("categoryId", matchedCategory._id)
                    .eq("normalizedName", normalizedName),
            )
            .first();
        if (existingItem) {
            throw new ConvexError({
                code: "ALREADY_EXISTS",
                message: formatCatalogRequestDuplicateCatalogMessage(
                    matchedCategory.name,
                ),
            });
        }
    } else if (args.categoryRequest) {
        const linkedCategory = await ensureLinkedCategoryRequest(ctx, {
            context: args.context,
            description: args.categoryRequest.description,
            justification: args.categoryRequest.justification,
            name: args.categoryRequest.name,
        });
        categoryNameSnapshot = linkedCategory.categoryName;
        normalizedCategoryName = linkedCategory.normalizedCategoryName;
        linkedCategoryRequestId = linkedCategory.categoryRequestId;
        notifications = linkedCategory.notifications;
    } else {
        throw new ConvexError({
            code: "VALIDATION_FAILED",
            message: CATALOG_REQUEST_MESSAGES.itemCategoryRequired,
        });
    }

    const categoryReferenceKey = buildCatalogRequestCategoryReferenceKey({
        categoryId: categoryId ? String(categoryId) : null,
        normalizedCategoryName,
    });
    const identityKeys = createItemRequestIdentityKeys({
        categoryReferenceKey,
        departmentId: String(internalContext.department._id),
        normalizedName,
        requestorTenantUserId: String(internalContext.requestorTenantUserId),
        tenantId: String(internalContext.tenant._id),
    });
    const duplicateRequests = await ctx.db
        .query("itemRequests")
        .withIndex("by_tenantId_requesterDuplicateKey", (q) =>
            q.eq("tenantId", internalContext.tenant._id).eq(
                "requesterDuplicateKey",
                identityKeys.requesterDuplicateKey,
            ),
        )
        .collect();
    if (duplicateRequests.some((request) => request.status === "pending")) {
        throw new ConvexError({
            code: "ALREADY_EXISTS",
            message: CATALOG_REQUEST_MESSAGES.duplicatePending,
        });
    }

    const now = Date.now();
    const requestId = await ctx.db.insert("itemRequests", {
        categoryId,
        categoryNameSnapshot,
        categoryReferenceKey,
        createdAt: now,
        departmentId: internalContext.department._id,
        description,
        estimatedUnitPrice: args.estimatedUnitPrice,
        fiscalYear: internalContext.plan.fiscalYear,
        justification,
        linkedCategoryRequestId,
        name,
        normalizedCategoryName,
        normalizedName,
        planId: internalContext.plan._id,
        requesterDuplicateKey: identityKeys.requesterDuplicateKey,
        requestorTenantUserId: internalContext.requestorTenantUserId,
        requestorUserId: internalContext.requestorUserId,
        revision: 1,
        sharedGroupingKey: identityKeys.sharedGroupingKey,
        status: "pending",
        submittedAt: now,
        tenantId: internalContext.tenant._id,
        updatedAt: now,
    });

    await appendAuditLogRequired(
        ctx,
        createRequestAuditEntry({
            action: "create",
            event: AUDIT_EVENT_NAMES.itemRequestCreated,
            metadata: {
                categoryReferenceKey,
                departmentId: String(internalContext.department._id),
                linkedCategoryRequestId: linkedCategoryRequestId
                    ? String(linkedCategoryRequestId)
                    : null,
                planId: String(internalContext.plan._id),
                requestType: "item",
            },
            outcome: AUDIT_OUTCOMES.queued,
            recordId: String(requestId),
            tableName: "itemRequests",
            tenantId: String(internalContext.tenant._id),
            userId: String(internalContext.requestorUserId),
        }),
    );

    return {
        notifications: [
            ...notifications,
            ...buildSubmittedNotificationPayload({
                requestId: String(requestId),
                requestSummary: `${name} (${categoryNameSnapshot})`,
                requestType: "item",
                tenantId: String(internalContext.tenant._id),
                tenantName: internalContext.tenant.name,
                to: args.context.procurementOfficerEmails,
            }),
        ],
        requestId: String(requestId),
    };
}

async function findCategoryRequestForEdit(
    ctx: RequestMutationCtx,
    args: {
        context: ActionContext;
        requestId: string;
    },
) {
    const internalContext = await loadInternalRequestContext(ctx, args.context);
    const requests = await ctx.db
        .query("categoryRequests")
        .withIndex("by_planId", (q) => q.eq("planId", internalContext.plan._id))
        .collect();
    const request =
        requests.find((candidate) => String(candidate._id) === args.requestId) ?? null;
    if (
        !request ||
        request.requestorTenantUserId !== internalContext.requestorTenantUserId
    ) {
        throw new ConvexError({
            code: "NOT_FOUND",
            message: "Catalog request not found.",
        });
    }

    return { internalContext, request };
}

async function findItemRequestForEdit(
    ctx: RequestMutationCtx,
    args: {
        context: ActionContext;
        requestId: string;
    },
) {
    const internalContext = await loadInternalRequestContext(ctx, args.context);
    const requests = await ctx.db
        .query("itemRequests")
        .withIndex("by_planId", (q) => q.eq("planId", internalContext.plan._id))
        .collect();
    const request =
        requests.find((candidate) => String(candidate._id) === args.requestId) ?? null;
    if (
        !request ||
        request.requestorTenantUserId !== internalContext.requestorTenantUserId
    ) {
        throw new ConvexError({
            code: "NOT_FOUND",
            message: "Catalog request not found.",
        });
    }

    return { internalContext, request };
}

async function updateCategoryRequestRecord(
    ctx: RequestMutationCtx,
    args: {
        context: ActionContext;
        description: string;
        justification: string;
        name: string;
        requestId: string;
        revision: number;
    },
) {
    const { internalContext, request } = await findCategoryRequestForEdit(ctx, {
        context: args.context,
        requestId: args.requestId,
    });
    ensureEditableAccess(args.context.accessMode);
    if (request.status !== "pending") {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Only pending requests can still be edited.",
        });
    }
    if (request.revision !== args.revision) {
        throw new ConvexError({
            code: "STALE_REQUEST_REVISION",
            message: CATALOG_REQUEST_MESSAGES.staleRevision,
        });
    }

    const name = sanitizeCatalogRequestTextField(args.name, {
        field: "categoryName",
        label: "Category name",
        maxLength: 80,
        minLength: 2,
    });
    const description = sanitizeCatalogRequestTextField(args.description, {
        field: "categoryDescription",
        label: "Category description",
        maxLength: 280,
        minLength: 2,
    });
    const justification = sanitizeCatalogRequestTextField(args.justification, {
        field: "categoryJustification",
        label: "Justification",
        maxLength: 280,
        minLength: 2,
    });
    const normalizedName = normalizeCatalogRequestName("category", name);
    const existingCategory = await findExistingCategoryByNormalizedName(ctx, {
        normalizedName,
        tenantId: internalContext.tenant._id,
    });
    if (existingCategory) {
        throw new ConvexError({
            code: "ALREADY_EXISTS",
            message: CATALOG_REQUEST_MESSAGES.categoryAlreadyExists,
        });
    }

    const identityKeys = createCategoryRequestIdentityKeys({
        departmentId: String(internalContext.department._id),
        normalizedName,
        requestorTenantUserId: String(internalContext.requestorTenantUserId),
        tenantId: String(internalContext.tenant._id),
    });
    const duplicateRequests = await ctx.db
        .query("categoryRequests")
        .withIndex("by_tenantId_requesterDuplicateKey", (q) =>
            q.eq("tenantId", internalContext.tenant._id).eq(
                "requesterDuplicateKey",
                identityKeys.requesterDuplicateKey,
            ),
        )
        .collect();
    if (
        duplicateRequests.some(
            (candidate) =>
                candidate.status === "pending" && candidate._id !== request._id,
        )
    ) {
        throw new ConvexError({
            code: "ALREADY_EXISTS",
            message: CATALOG_REQUEST_MESSAGES.duplicatePending,
        });
    }

    const updatedAt = Date.now();
    await ctx.db.patch(request._id, {
        description,
        justification,
        name,
        normalizedName,
        requesterDuplicateKey: identityKeys.requesterDuplicateKey,
        revision: request.revision + 1,
        sharedGroupingKey: identityKeys.sharedGroupingKey,
        updatedAt,
    });

    const linkedItems = await ctx.db
        .query("itemRequests")
        .withIndex("by_linkedCategoryRequestId", (q) =>
            q.eq("linkedCategoryRequestId", request._id),
        )
        .collect();
    const categoryReferenceKey = buildCatalogRequestCategoryReferenceKey({
        normalizedCategoryName: normalizedName,
    });
    for (const linkedItem of linkedItems) {
        if (linkedItem.status !== "pending") {
            continue;
        }

        const linkedItemIdentityKeys = createItemRequestIdentityKeys({
            categoryReferenceKey,
            departmentId: String(linkedItem.departmentId),
            normalizedName: linkedItem.normalizedName,
            requestorTenantUserId: String(linkedItem.requestorTenantUserId),
            tenantId: String(linkedItem.tenantId),
        });
        const duplicateLinkedItems = await ctx.db
            .query("itemRequests")
            .withIndex("by_tenantId_requesterDuplicateKey", (q) =>
                q.eq("tenantId", linkedItem.tenantId).eq(
                    "requesterDuplicateKey",
                    linkedItemIdentityKeys.requesterDuplicateKey,
                ),
            )
            .collect();
        if (
            duplicateLinkedItems.some(
                (candidate) =>
                    candidate.status === "pending" &&
                    candidate._id !== linkedItem._id,
            )
        ) {
            throw new ConvexError({
                code: "ALREADY_EXISTS",
                message: CATALOG_REQUEST_MESSAGES.duplicatePending,
            });
        }

        await ctx.db.patch(linkedItem._id, {
            categoryNameSnapshot: name,
            categoryReferenceKey,
            normalizedCategoryName: normalizedName,
            requesterDuplicateKey: linkedItemIdentityKeys.requesterDuplicateKey,
            revision: linkedItem.revision + 1,
            sharedGroupingKey: linkedItemIdentityKeys.sharedGroupingKey,
            updatedAt,
        });
        await appendAuditLogRequired(
            ctx,
            createRequestAuditEntry({
                action: "update",
                event: AUDIT_EVENT_NAMES.itemRequestUpdated,
                metadata: {
                    linkedCategoryRequestId: String(request._id),
                    requestType: "item",
                },
                outcome: AUDIT_OUTCOMES.allowed,
                recordId: String(linkedItem._id),
                tableName: "itemRequests",
                tenantId: String(linkedItem.tenantId),
                userId: String(linkedItem.requestorUserId),
            }),
        );
    }

    await appendAuditLogRequired(
        ctx,
        createRequestAuditEntry({
            action: "update",
            event: AUDIT_EVENT_NAMES.categoryRequestUpdated,
            metadata: {
                requestType: "category",
            },
            outcome: AUDIT_OUTCOMES.allowed,
            recordId: String(request._id),
            tableName: "categoryRequests",
            tenantId: String(internalContext.tenant._id),
            userId: String(internalContext.requestorUserId),
        }),
    );

    return {
        updatedAt,
    };
}

async function updateItemRequestRecord(
    ctx: RequestMutationCtx,
    args: {
        context: ActionContext;
        description: string;
        estimatedUnitPrice: number;
        justification: string;
        linkedCategoryRequest?: {
            description: string;
            justification: string;
            name: string;
            revision: number;
        };
        name: string;
        requestId: string;
        revision: number;
    },
) {
    const { internalContext, request } = await findItemRequestForEdit(ctx, {
        context: args.context,
        requestId: args.requestId,
    });
    ensureEditableAccess(args.context.accessMode);
    if (request.status !== "pending") {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Only pending requests can still be edited.",
        });
    }
    if (request.revision !== args.revision) {
        throw new ConvexError({
            code: "STALE_REQUEST_REVISION",
            message: CATALOG_REQUEST_MESSAGES.staleRevision,
        });
    }

    const name = sanitizeCatalogRequestTextField(args.name, {
        field: "itemName",
        label: "Item name",
        maxLength: 80,
        minLength: 2,
    });
    const description = sanitizeCatalogRequestTextField(args.description, {
        field: "itemDescription",
        label: "Item description",
        maxLength: 280,
        minLength: 2,
    });
    const justification = sanitizeCatalogRequestTextField(args.justification, {
        field: "itemJustification",
        label: "Justification",
        maxLength: 280,
        minLength: 2,
    });
    if (!Number.isFinite(args.estimatedUnitPrice) || args.estimatedUnitPrice <= 0) {
        throw new ConvexError({
            code: "VALIDATION_FAILED",
            message: CATALOG_REQUEST_MESSAGES.itemPricePositive,
        });
    }

    const normalizedName = normalizeCatalogRequestName("item", name);
    if (request.categoryId) {
        const existingItem = await ctx.db
            .query("procurementItems")
            .withIndex("by_tenantId_categoryId_normalizedName", (q) =>
                q.eq("tenantId", internalContext.tenant._id)
                    .eq("categoryId", request.categoryId!)
                    .eq("normalizedName", normalizedName),
            )
            .first();
        if (existingItem) {
            throw new ConvexError({
                code: "ALREADY_EXISTS",
                message: formatCatalogRequestDuplicateCatalogMessage(
                    request.categoryNameSnapshot,
                ),
            });
        }
    }

    const identityKeys = createItemRequestIdentityKeys({
        categoryReferenceKey: request.categoryReferenceKey,
        departmentId: String(internalContext.department._id),
        normalizedName,
        requestorTenantUserId: String(internalContext.requestorTenantUserId),
        tenantId: String(internalContext.tenant._id),
    });
    const duplicateRequests = await ctx.db
        .query("itemRequests")
        .withIndex("by_tenantId_requesterDuplicateKey", (q) =>
            q.eq("tenantId", internalContext.tenant._id).eq(
                "requesterDuplicateKey",
                identityKeys.requesterDuplicateKey,
            ),
        )
        .collect();
    if (
        duplicateRequests.some(
            (candidate) =>
                candidate.status === "pending" && candidate._id !== request._id,
        )
    ) {
        throw new ConvexError({
            code: "ALREADY_EXISTS",
            message: CATALOG_REQUEST_MESSAGES.duplicatePending,
        });
    }

    const updatedAt = Date.now();
    await ctx.db.patch(request._id, {
        description,
        estimatedUnitPrice: args.estimatedUnitPrice,
        justification,
        name,
        normalizedName,
        requesterDuplicateKey: identityKeys.requesterDuplicateKey,
        revision: request.revision + 1,
        sharedGroupingKey: identityKeys.sharedGroupingKey,
        updatedAt,
    });
    await appendAuditLogRequired(
        ctx,
        createRequestAuditEntry({
            action: "update",
            event: AUDIT_EVENT_NAMES.itemRequestUpdated,
            metadata: {
                requestType: "item",
            },
            outcome: AUDIT_OUTCOMES.allowed,
            recordId: String(request._id),
            tableName: "itemRequests",
            tenantId: String(internalContext.tenant._id),
            userId: String(internalContext.requestorUserId),
        }),
    );

    if (request.linkedCategoryRequestId && args.linkedCategoryRequest) {
        const linkedCategoryRequest = await ctx.db.get(request.linkedCategoryRequestId);
        const shouldSyncLinkedCategoryDraft =
            linkedCategoryRequest &&
            (linkedCategoryRequest.name !== args.linkedCategoryRequest.name ||
                linkedCategoryRequest.description !==
                    args.linkedCategoryRequest.description ||
                linkedCategoryRequest.justification !==
                    args.linkedCategoryRequest.justification);

        if (shouldSyncLinkedCategoryDraft) {
            await updateCategoryRequestRecord(ctx, {
                context: args.context,
                description: args.linkedCategoryRequest.description,
                justification: args.linkedCategoryRequest.justification,
                name: args.linkedCategoryRequest.name,
                requestId: String(request.linkedCategoryRequestId),
                revision: args.linkedCategoryRequest.revision,
            });
        }
    }

    return {
        updatedAt,
    };
}

async function cancelCategoryRequestRecord(
    ctx: RequestMutationCtx,
    args: {
        context: ActionContext;
        requestId: string;
    },
) {
    const { internalContext, request } = await findCategoryRequestForEdit(ctx, {
        context: args.context,
        requestId: args.requestId,
    });
    ensureEditableAccess(args.context.accessMode);
    if (request.status !== "pending") {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Only pending requests can still be cancelled.",
        });
    }

    const updatedAt = Date.now();
    await ctx.db.patch(request._id, {
        cancelledAt: updatedAt,
        decisionReason: "Cancelled by the requestor.",
        decisionSource: "du",
        revision: request.revision + 1,
        status: "cancelled",
        updatedAt,
    });

    const linkedItems = await ctx.db
        .query("itemRequests")
        .withIndex("by_linkedCategoryRequestId", (q) =>
            q.eq("linkedCategoryRequestId", request._id),
        )
        .collect();
    for (const linkedItem of linkedItems) {
        if (linkedItem.status !== "pending") {
            continue;
        }

        await ctx.db.patch(linkedItem._id, {
            cancelledAt: updatedAt,
            decisionReason: "Cancelled because the linked category request was withdrawn.",
            decisionSource: "du",
            revision: linkedItem.revision + 1,
            status: "cancelled",
            updatedAt,
        });
        await appendAuditLogRequired(
            ctx,
            createRequestAuditEntry({
                action: "cancel",
                event: AUDIT_EVENT_NAMES.itemRequestCancelled,
                metadata: {
                    linkedCategoryRequestId: String(request._id),
                    requestType: "item",
                },
                outcome: AUDIT_OUTCOMES.allowed,
                recordId: String(linkedItem._id),
                tableName: "itemRequests",
                tenantId: String(linkedItem.tenantId),
                userId: String(linkedItem.requestorUserId),
            }),
        );
    }

    await appendAuditLogRequired(
        ctx,
        createRequestAuditEntry({
            action: "cancel",
            event: AUDIT_EVENT_NAMES.categoryRequestCancelled,
            metadata: {
                requestType: "category",
            },
            outcome: AUDIT_OUTCOMES.allowed,
            recordId: String(request._id),
            tableName: "categoryRequests",
            tenantId: String(internalContext.tenant._id),
            userId: String(internalContext.requestorUserId),
        }),
    );

    return { updatedAt };
}

async function cancelItemRequestRecord(
    ctx: RequestMutationCtx,
    args: {
        context: ActionContext;
        requestId: string;
    },
) {
    const { internalContext, request } = await findItemRequestForEdit(ctx, {
        context: args.context,
        requestId: args.requestId,
    });
    ensureEditableAccess(args.context.accessMode);
    if (request.status !== "pending") {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "Only pending requests can still be cancelled.",
        });
    }

    const updatedAt = Date.now();
    await ctx.db.patch(request._id, {
        cancelledAt: updatedAt,
        decisionReason: "Cancelled by the requestor.",
        decisionSource: "du",
        revision: request.revision + 1,
        status: "cancelled",
        updatedAt,
    });

    if (request.linkedCategoryRequestId) {
        const linkedRequest = await ctx.db.get(request.linkedCategoryRequestId);
        const linkedItems = await ctx.db
            .query("itemRequests")
            .withIndex("by_linkedCategoryRequestId", (q) =>
                q.eq("linkedCategoryRequestId", request.linkedCategoryRequestId),
            )
            .collect();
        const hasOtherPendingLinks = linkedItems.some(
            (candidate) =>
                candidate._id !== request._id && candidate.status === "pending",
        );
        if (
            linkedRequest &&
            linkedRequest.status === "pending" &&
            linkedRequest.requestorTenantUserId === internalContext.requestorTenantUserId &&
            shouldAutoCancelLinkedCategoryRequest({
                hasOtherPendingLinks,
                requestOrigin: linkedRequest.requestOrigin,
            })
        ) {
            await ctx.db.patch(linkedRequest._id, {
                cancelledAt: updatedAt,
                decisionReason: "Cancelled because the linked item request was withdrawn.",
                decisionSource: "du",
                revision: linkedRequest.revision + 1,
                status: "cancelled",
                updatedAt,
            });
            await appendAuditLogRequired(
                ctx,
                createRequestAuditEntry({
                    action: "cancel",
                    event: AUDIT_EVENT_NAMES.categoryRequestCancelled,
                    metadata: {
                        linkedItemRequestId: String(request._id),
                        requestType: "category",
                    },
                    outcome: AUDIT_OUTCOMES.allowed,
                    recordId: String(linkedRequest._id),
                    tableName: "categoryRequests",
                    tenantId: String(linkedRequest.tenantId),
                    userId: String(linkedRequest.requestorUserId),
                }),
            );
        }
    }

    await appendAuditLogRequired(
        ctx,
        createRequestAuditEntry({
            action: "cancel",
            event: AUDIT_EVENT_NAMES.itemRequestCancelled,
            metadata: {
                requestType: "item",
            },
            outcome: AUDIT_OUTCOMES.allowed,
            recordId: String(request._id),
            tableName: "itemRequests",
            tenantId: String(internalContext.tenant._id),
            userId: String(internalContext.requestorUserId),
        }),
    );

    return { updatedAt };
}

export const getDepartmentUserCatalogRequestActionContext = query({
    args: {
        planId: v.string(),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        const base = await loadDepartmentUserCatalogRequestBase(ctx);
        const plan = await loadPlanForDepartment(ctx, {
            departmentId: base.department._id,
            planId: args.planId,
            tenantId: base.tenantId,
        });
        const procurementOfficerEmails = await loadProcurementOfficerEmails(
            ctx,
            base.department,
        );

        return {
            accessMode: base.accessMode,
            departmentId: base.department._id,
            departmentName: base.department.name,
            fiscalYear: plan.fiscalYear,
            planId: plan._id,
            procurementOfficerEmails,
            requestorTenantUserId: base.requestorTenantUserId,
            requestorUserId: base.requestorUserId,
            submissionEndsAt: base.department.submissionEndsAt ?? null,
            submissionStartsAt: base.department.submissionStartsAt ?? null,
            tenantId: base.tenantId,
            tenantName: base.tenantName,
        };
    },
});

export const getDepartmentUserCatalogRequests = query({
    args: {
        planId: v.string(),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        const base = await loadDepartmentUserCatalogRequestBase(ctx);
        const plan = await loadPlanForDepartment(ctx, {
            departmentId: base.department._id,
            planId: args.planId,
            tenantId: base.tenantId,
        });
        const [categoryRequests, itemRequests] = await Promise.all([
            ctx.db
                .query("categoryRequests")
                .withIndex("by_planId", (q) => q.eq("planId", plan._id))
                .collect(),
            ctx.db
                .query("itemRequests")
                .withIndex("by_planId", (q) => q.eq("planId", plan._id))
                .collect(),
        ]);
        const ownCategoryRequests = categoryRequests.filter(
            (request) => request.requestorTenantUserId === base.requestorTenantUserId,
        );
        const ownItemRequests = itemRequests.filter(
            (request) => request.requestorTenantUserId === base.requestorTenantUserId,
        );
        const categoryRequestMap = new Map(
            ownCategoryRequests.map((request) => [String(request._id), request] as const),
        );

        const requestRows = [
            ...ownCategoryRequests.map((request) => {
                const computedStatus = shouldExpireCatalogRequest({
                    status: request.status,
                    submissionEndsAt: base.department.submissionEndsAt,
                    submissionStartsAt: base.department.submissionStartsAt,
                })
                    ? "expired"
                    : request.status;
                return {
                    canCancel: isCatalogRequestEditable({
                        accessMode: base.accessMode,
                        status: computedStatus,
                    }),
                    canEdit: isCatalogRequestEditable({
                        accessMode: base.accessMode,
                        status: computedStatus,
                    }),
                    categoryReferenceMode: "request",
                    createdAt: request.createdAt,
                    description: request.description,
                    id: String(request._id),
                    justification: request.justification,
                    name: request.name,
                    reason: formatCatalogRequestDecisionReason({
                        reason: buildRequestStatusReason({
                            decisionReason: request.decisionReason,
                            status: computedStatus,
                        }),
                        status: computedStatus,
                    }),
                    revision: request.revision,
                    status: computedStatus,
                    submittedAt: request.submittedAt,
                    type: "category" as const,
                    updatedAt: request.updatedAt,
                };
            }),
            ...ownItemRequests.map((request) => {
                const computedStatus = shouldExpireCatalogRequest({
                    status: request.status,
                    submissionEndsAt: base.department.submissionEndsAt,
                    submissionStartsAt: base.department.submissionStartsAt,
                })
                    ? "expired"
                    : request.status;
                const linkedCategoryRequest = request.linkedCategoryRequestId
                    ? categoryRequestMap.get(String(request.linkedCategoryRequestId)) ?? null
                    : null;

                return {
                    canCancel: isCatalogRequestEditable({
                        accessMode: base.accessMode,
                        status: computedStatus,
                    }),
                    canEdit: isCatalogRequestEditable({
                        accessMode: base.accessMode,
                        status: computedStatus,
                    }),
                    categoryId: request.categoryId ? String(request.categoryId) : null,
                    categoryName: request.categoryNameSnapshot,
                    categoryReferenceMode:
                        request.linkedCategoryRequestId || !request.categoryId
                            ? "request"
                            : "existing",
                    categoryRequest: linkedCategoryRequest
                        ? {
                              description: linkedCategoryRequest.description,
                              id: String(linkedCategoryRequest._id),
                              justification: linkedCategoryRequest.justification,
                              name: linkedCategoryRequest.name,
                              revision: linkedCategoryRequest.revision,
                          }
                        : null,
                    createdAt: request.createdAt,
                    description: request.description,
                    estimatedUnitPrice: request.estimatedUnitPrice,
                    id: String(request._id),
                    justification: request.justification,
                    linkedCategoryRequestId: request.linkedCategoryRequestId
                        ? String(request.linkedCategoryRequestId)
                        : null,
                    name: request.name,
                    reason: formatCatalogRequestDecisionReason({
                        reason: buildRequestStatusReason({
                            decisionReason: request.decisionReason,
                            status: computedStatus,
                        }),
                        status: computedStatus,
                    }),
                    revision: request.revision,
                    status: computedStatus,
                    submittedAt: request.submittedAt,
                    type: "item" as const,
                    updatedAt: request.updatedAt,
                };
            }),
        ].sort((left, right) => right.updatedAt - left.updatedAt);

        return {
            meta: {
                accessMode: base.accessMode,
                canCreate: base.accessMode === "editable",
            },
            requests: requestRows,
            summary: buildCatalogRequestSummary({
                requests: requestRows.map((request) => ({
                    status: request.status,
                    type: request.type,
                })),
            }),
        };
    },
});

export const createCategoryRequestInternal = internalMutation({
    args: {
        context: v.any(),
        description: v.string(),
        justification: v.string(),
        name: v.string(),
    },
    returns: v.any(),
    handler: async (ctx, args) => await createCategoryRequestRecord(ctx, args),
});

export const createItemRequestInternal = internalMutation({
    args: {
        categoryId: v.optional(v.string()),
        categoryRequest: v.optional(
            v.object({
                description: v.string(),
                justification: v.string(),
                name: v.string(),
            }),
        ),
        context: v.any(),
        description: v.string(),
        estimatedUnitPrice: v.number(),
        justification: v.string(),
        name: v.string(),
    },
    returns: v.any(),
    handler: async (ctx, args) => await createItemRequestRecord(ctx, args),
});

export const updateCategoryRequestInternal = internalMutation({
    args: {
        context: v.any(),
        description: v.string(),
        justification: v.string(),
        name: v.string(),
        requestId: v.string(),
        revision: v.number(),
    },
    returns: v.any(),
    handler: async (ctx, args) => await updateCategoryRequestRecord(ctx, args),
});

export const updateItemRequestInternal = internalMutation({
    args: {
        context: v.any(),
        description: v.string(),
        estimatedUnitPrice: v.number(),
        justification: v.string(),
        linkedCategoryRequest: v.optional(
            v.object({
                description: v.string(),
                justification: v.string(),
                name: v.string(),
                revision: v.number(),
            }),
        ),
        name: v.string(),
        requestId: v.string(),
        revision: v.number(),
    },
    returns: v.any(),
    handler: async (ctx, args) => await updateItemRequestRecord(ctx, args),
});

export const cancelCategoryRequestInternal = internalMutation({
    args: {
        context: v.any(),
        requestId: v.string(),
    },
    returns: v.any(),
    handler: async (ctx, args) => await cancelCategoryRequestRecord(ctx, args),
});

export const cancelItemRequestInternal = internalMutation({
    args: {
        context: v.any(),
        requestId: v.string(),
    },
    returns: v.any(),
    handler: async (ctx, args) => await cancelItemRequestRecord(ctx, args),
});

export const expirePendingCatalogRequestsBatch = internalMutation({
    args: {},
    returns: v.any(),
    handler: async (ctx) => {
        const tenants = await ctx.db.query("tenants").collect();
        const departmentCache = new Map<string, Doc<"departments"> | null>();
        const tenantUserCache = new Map<string, Doc<"tenantUsers"> | null>();
        const tenantCache = new Map(
            tenants.map((tenant) => [String(tenant._id), tenant] as const),
        );
        const userCache = new Map<string, Doc<"users"> | null>();
        const notifications: NotificationPayload[] = [];

        async function getDepartmentRecord(departmentId: string) {
            if (departmentCache.has(departmentId)) {
                return departmentCache.get(departmentId) ?? null;
            }

            const record = (await ctx.db.get(departmentId as any)) as
                | Doc<"departments">
                | null;
            departmentCache.set(departmentId, record);
            return record;
        }

        async function getTenantUserRecord(tenantUserId: string) {
            if (tenantUserCache.has(tenantUserId)) {
                return tenantUserCache.get(tenantUserId) ?? null;
            }

            const record = (await ctx.db.get(tenantUserId as any)) as
                | Doc<"tenantUsers">
                | null;
            tenantUserCache.set(tenantUserId, record);
            return record;
        }

        async function getUserRecord(userId: string) {
            if (userCache.has(userId)) {
                return userCache.get(userId) ?? null;
            }

            const record = (await ctx.db.get(userId as any)) as Doc<"users"> | null;
            userCache.set(userId, record);
            return record;
        }

        async function expireRecord(args: {
            request: Doc<"categoryRequests"> | Doc<"itemRequests">;
            requestType: "category" | "item";
            summary: string;
        }) {
            const department = await getDepartmentRecord(String(args.request.departmentId));
            if (
                !department ||
                args.request.status !== "pending" ||
                !shouldExpireCatalogRequest({
                    status: args.request.status,
                    submissionEndsAt: department.submissionEndsAt,
                    submissionStartsAt: department.submissionStartsAt,
                })
            ) {
                return;
            }

            const updatedAt = Date.now();
            await ctx.db.patch(args.request._id, {
                decisionReason: "Submission window ended before review.",
                decisionSource: "deadline",
                revision: args.request.revision + 1,
                status: "expired",
                updatedAt,
            });
            await appendAuditLogRequired(
                ctx,
                createRequestAuditEntry({
                    action: "expire",
                    event:
                        args.requestType === "item"
                            ? AUDIT_EVENT_NAMES.itemRequestExpired
                            : AUDIT_EVENT_NAMES.categoryRequestExpired,
                    metadata: {
                        requestType: args.requestType,
                    },
                    outcome: AUDIT_OUTCOMES.allowed,
                    recordId: String(args.request._id),
                    tableName:
                        args.requestType === "item" ? "itemRequests" : "categoryRequests",
                    tenantId: String(args.request.tenantId),
                    userId: String(args.request.requestorUserId),
                }),
            );

            const tenantUser = await getTenantUserRecord(
                String(args.request.requestorTenantUserId),
            );
            const user = tenantUser
                ? await getUserRecord(String(tenantUser.userId))
                : null;
            const tenant = tenantCache.get(String(args.request.tenantId)) ?? null;
            if (user?.email && tenant) {
                notifications.push(
                    buildStatusNotificationPayload({
                        reason: "Submission window ended before review.",
                        requestId: String(args.request._id),
                        requestSummary: args.summary,
                        status: "expired",
                        tenantId: String(args.request.tenantId),
                        tenantName: tenant.name,
                        to: user.email.trim().toLowerCase(),
                    }),
                );
            }
        }

        for (const tenant of tenants) {
            const [categoryRequests, itemRequests] = await Promise.all([
                ctx.db
                    .query("categoryRequests")
                    .withIndex("by_tenantId_status", (q) =>
                        q.eq("tenantId", tenant._id).eq("status", "pending"),
                    )
                    .collect(),
                ctx.db
                    .query("itemRequests")
                    .withIndex("by_tenantId_status", (q) =>
                        q.eq("tenantId", tenant._id).eq("status", "pending"),
                    )
                    .collect(),
            ]);

            for (const request of categoryRequests) {
                await expireRecord({
                    request,
                    requestType: "category",
                    summary: request.name,
                });
            }

            for (const request of itemRequests) {
                await expireRecord({
                    request,
                    requestType: "item",
                    summary: `${request.name} (${request.categoryNameSnapshot})`,
                });
            }
        }

        return {
            notifications,
        };
    },
});

export const expirePendingCatalogRequests = internalAction({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        const result = await ctx.runMutation(
            "functions/catalogRequests:expirePendingCatalogRequestsBatch" as any,
            {},
        );
        await queueNotifications(ctx, result.notifications as NotificationPayload[]);
        return null;
    },
});

export const createCategoryRequest = action({
    args: {
        description: v.string(),
        justification: v.string(),
        name: v.string(),
        planId: v.string(),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        const context = (await ctx.runQuery(
            "functions/catalogRequests:getDepartmentUserCatalogRequestActionContext" as any,
            { planId: args.planId },
        )) as ActionContext;
        const result = await ctx.runMutation(
            "functions/catalogRequests:createCategoryRequestInternal" as any,
            {
                context,
                description: args.description,
                justification: args.justification,
                name: args.name,
            },
        );
        await queueNotifications(ctx, result.notifications as NotificationPayload[]);
        return result;
    },
});

export const createItemRequest = action({
    args: {
        categoryId: v.optional(v.string()),
        categoryRequest: v.optional(
            v.object({
                description: v.string(),
                justification: v.string(),
                name: v.string(),
            }),
        ),
        description: v.string(),
        estimatedUnitPrice: v.number(),
        justification: v.string(),
        name: v.string(),
        planId: v.string(),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        const context = (await ctx.runQuery(
            "functions/catalogRequests:getDepartmentUserCatalogRequestActionContext" as any,
            { planId: args.planId },
        )) as ActionContext;
        const result = await ctx.runMutation(
            "functions/catalogRequests:createItemRequestInternal" as any,
            {
                categoryId: args.categoryId,
                categoryRequest: args.categoryRequest,
                context,
                description: args.description,
                estimatedUnitPrice: args.estimatedUnitPrice,
                justification: args.justification,
                name: args.name,
            },
        );
        await queueNotifications(ctx, result.notifications as NotificationPayload[]);
        return result;
    },
});

export const updateCategoryRequest = action({
    args: {
        description: v.string(),
        justification: v.string(),
        name: v.string(),
        planId: v.string(),
        requestId: v.string(),
        revision: v.number(),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        const context = (await ctx.runQuery(
            "functions/catalogRequests:getDepartmentUserCatalogRequestActionContext" as any,
            { planId: args.planId },
        )) as ActionContext;
        return await ctx.runMutation(
            "functions/catalogRequests:updateCategoryRequestInternal" as any,
            {
                context,
                description: args.description,
                justification: args.justification,
                name: args.name,
                requestId: args.requestId,
                revision: args.revision,
            },
        );
    },
});

export const updateItemRequest = action({
    args: {
        description: v.string(),
        estimatedUnitPrice: v.number(),
        justification: v.string(),
        linkedCategoryRequest: v.optional(
            v.object({
                description: v.string(),
                justification: v.string(),
                name: v.string(),
                revision: v.number(),
            }),
        ),
        name: v.string(),
        planId: v.string(),
        requestId: v.string(),
        revision: v.number(),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        const context = (await ctx.runQuery(
            "functions/catalogRequests:getDepartmentUserCatalogRequestActionContext" as any,
            { planId: args.planId },
        )) as ActionContext;
        return await ctx.runMutation(
            "functions/catalogRequests:updateItemRequestInternal" as any,
            {
                context,
                description: args.description,
                estimatedUnitPrice: args.estimatedUnitPrice,
                justification: args.justification,
                linkedCategoryRequest: args.linkedCategoryRequest,
                name: args.name,
                requestId: args.requestId,
                revision: args.revision,
            },
        );
    },
});

export const cancelCatalogRequest = action({
    args: {
        planId: v.string(),
        requestId: v.string(),
        requestType: v.union(v.literal("category"), v.literal("item")),
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        const context = (await ctx.runQuery(
            "functions/catalogRequests:getDepartmentUserCatalogRequestActionContext" as any,
            { planId: args.planId },
        )) as ActionContext;

        return await ctx.runMutation(
            args.requestType === "item"
                ? ("functions/catalogRequests:cancelItemRequestInternal" as any)
                : ("functions/catalogRequests:cancelCategoryRequestInternal" as any),
            {
                context,
                requestId: args.requestId,
            },
        );
    },
});
