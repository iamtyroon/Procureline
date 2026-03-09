import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { type SerializedAuditEventEntry } from "../../lib/security/audit";
import { appendAuditLogEntry, deserializeAuditEvent } from "./_audit";

const auditActorRoleValidator = v.union(
    v.literal("anonymous"),
    v.literal("department_user"),
    v.literal("platform_admin"),
    v.literal("procurement_officer"),
    v.literal("tenant_admin"),
    v.literal("unassigned"),
);

const auditActorStateValidator = v.union(
    v.literal("anonymous"),
    v.literal("authenticated"),
);

const serializedAuditEventValidator = {
    action: v.string(),
    actorRole: auditActorRoleValidator,
    actorState: auditActorStateValidator,
    actorUserId: v.optional(v.id("users")),
    entityType: v.string(),
    event: v.string(),
    metadata: v.optional(v.any()),
    outcome: v.string(),
    recordId: v.optional(v.string()),
    sourceTenantId: v.optional(v.id("tenants")),
    tableName: v.optional(v.string()),
    targetTenantId: v.optional(v.id("tenants")),
    timestamp: v.number(),
};

export const appendAuditLogFromAction = internalMutation({
    args: serializedAuditEventValidator,
    returns: v.null(),
    handler: async (ctx, args) => {
        await appendAuditLogEntry(
            ctx,
            deserializeAuditEvent(args as SerializedAuditEventEntry),
        );
        return null;
    },
});
