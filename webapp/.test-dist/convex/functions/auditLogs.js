"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendAuditLogFromAction = void 0;
const values_1 = require("convex/values");
const server_1 = require("../_generated/server");
const _audit_1 = require("./_audit");
const auditActorRoleValidator = values_1.v.union(values_1.v.literal("anonymous"), values_1.v.literal("department_user"), values_1.v.literal("platform_admin"), values_1.v.literal("procurement_officer"), values_1.v.literal("tenant_admin"), values_1.v.literal("unassigned"));
const auditActorStateValidator = values_1.v.union(values_1.v.literal("anonymous"), values_1.v.literal("authenticated"));
const serializedAuditEventValidator = {
    action: values_1.v.string(),
    actorRole: auditActorRoleValidator,
    actorState: auditActorStateValidator,
    actorUserId: values_1.v.optional(values_1.v.id("users")),
    entityType: values_1.v.string(),
    event: values_1.v.string(),
    metadata: values_1.v.optional(values_1.v.any()),
    outcome: values_1.v.string(),
    recordId: values_1.v.optional(values_1.v.string()),
    sourceTenantId: values_1.v.optional(values_1.v.id("tenants")),
    tableName: values_1.v.optional(values_1.v.string()),
    targetTenantId: values_1.v.optional(values_1.v.id("tenants")),
    timestamp: values_1.v.number(),
};
exports.appendAuditLogFromAction = (0, server_1.internalMutation)({
    args: serializedAuditEventValidator,
    returns: values_1.v.null(),
    handler: async (ctx, args) => {
        await (0, _audit_1.appendAuditLogEntry)(ctx, (0, _audit_1.deserializeAuditEvent)(args));
        return null;
    },
});
