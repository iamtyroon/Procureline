import { defineEnt, defineEntSchema, getEntDefinitions } from "convex-ents";
import { v } from "convex/values";

const schema = defineEntSchema({
  tenants: defineEnt({
    name: v.string(),
    tier: v.union(
      v.literal("free"),
      v.literal("starter"),
      v.literal("professional"),
      v.literal("enterprise")
    ),
    status: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("cancelled")
    ),
    createdAt: v.number(),
  })
    .edges("users", { ref: true }),  // Inverse edge for users relationship

  users: defineEnt({
    email: v.string(),
    name: v.optional(v.string()),
    role: v.union(
      v.literal("platform_admin"),
      v.literal("tenant_admin"),
      v.literal("po"),
      v.literal("du")
    ),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .edge("tenant")  // Ents relationship to tenants
    .index("by_email", ["email"])
    .index("by_tenant", ["tenantId"]),
});

export default schema;

export const entDefinitions = getEntDefinitions(schema);
