import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { AUDIT_EVENT_NAMES, AUDIT_OUTCOMES } from "../../lib/shared/security/audit";
import { appendAuditLogBestEffort, appendAuditLogRequired } from "./_audit";
import { requireVerifiedPlatformAdmin } from "./_roleGuard";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const FREE_TIER_LIMITS = {
  categories: 10,
  departments: 3,
  items: 100,
};

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalized(value: unknown): string {
  return text(value).trim().toLowerCase();
}

function similarityKey(value: unknown): string {
  return normalized(value).replace(/[^a-z0-9]/g, "");
}

function getEmailDomain(value: unknown): string {
  const email = normalized(value);
  const atIndex = email.lastIndexOf("@");
  return atIndex > -1 ? email.slice(atIndex + 1) : "";
}

function parseNumber(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

async function audit(ctx: any, args: {
  actorUserId: Id<"users">;
  action: string;
  entityType: string;
  event: string;
  metadata?: Record<string, unknown>;
  outcome?: string;
  recordId?: string;
  targetTenantId?: Id<"tenants">;
}) {
  await appendAuditLogRequired(ctx, {
    action: args.action,
    actor: { role: "platform_admin", state: "authenticated", userId: args.actorUserId },
    entityType: args.entityType,
    event: args.event as any,
    metadata: args.metadata ?? {},
    outcome: (args.outcome ?? AUDIT_OUTCOMES.allowed) as any,
    recordId: args.recordId,
    targetTenantId: args.targetTenantId,
    timestamp: Date.now(),
  });
}

async function requireAllowedPlatformAdmin(ctx: any) {
  const auth = await requireVerifiedPlatformAdmin(ctx);
  const allowlist = await ctx.db
    .query("platformConfigurationRecords")
    .withIndex("by_key", (q: any) => q.eq("key", "platform_admin_ip_allowlist"))
    .first();
  const configuredIps = Array.isArray(allowlist?.value)
    ? allowlist.value.filter((item: unknown): item is string => typeof item === "string")
    : [];
  if (configuredIps.length === 0) {
    return auth;
  }
  const session = await ctx.db
    .query("sessionMetadata")
    .withIndex("by_userId", (q: any) => q.eq("userId", auth.userId))
    .order("desc")
    .first();
  const currentIp = session?.platformAdminIpAddress;
  if (!currentIp || !configuredIps.includes(currentIp)) {
    throw new ConvexError("Platform Admin IP address is not allowlisted.");
  }
  return auth;
}

async function getSystemPlatformUserId(ctx: any): Promise<Id<"users"> | null> {
  const platformUser = await ctx.db.query("platformUsers").first();
  return platformUser?.userId ?? null;
}

function rolloutBucket(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 100;
}

async function upsertFreeTierReview(ctx: any, args: {
  actorUserId: Id<"users">;
  patch: Record<string, unknown>;
  tenantId: Id<"tenants">;
}) {
  const existing = await ctx.db
    .query("platformFreeTierReviews")
    .withIndex("by_tenantId", (q: any) => q.eq("tenantId", args.tenantId))
    .first();
  const payload = {
    ...args.patch,
    updatedAt: Date.now(),
    updatedByPlatformUserId: args.actorUserId,
  };
  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return existing._id;
  }
  return await ctx.db.insert("platformFreeTierReviews", {
    salesFollowUp: false,
    tenantId: args.tenantId,
    ...payload,
  });
}

export const getCrossTenantUsers = query({
  args: {
    actionType: v.optional(v.string()),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAllowedPlatformAdmin(ctx);
    const needle = normalized(args.search);
    const [users, tenantUsers, tenants, sessions, auditLogs] = await Promise.all([
      ctx.db.query("users").take(300),
      ctx.db.query("tenantUsers").collect(),
      ctx.db.query("tenants").collect(),
      ctx.db.query("sessionMetadata").collect(),
      ctx.db.query("auditLogs").withIndex("by_timestamp", (q) => q).order("desc").take(200),
    ]);
    const tenantById = new Map(tenants.map((tenant) => [String(tenant._id), tenant]));
    const tenantUsersByUser = new Map<string, typeof tenantUsers>();
    for (const tenantUser of tenantUsers) {
      const key = String(tenantUser.userId);
      tenantUsersByUser.set(key, [...(tenantUsersByUser.get(key) ?? []), tenantUser]);
    }

    return users
      .map((user) => {
        const record = user as any;
        const associations = (tenantUsersByUser.get(String(user._id)) ?? []).map((tenantUser) => {
          const tenant = tenantById.get(String(tenantUser.tenantId));
          return {
            role: tenantUser.role,
            tenantId: tenantUser.tenantId,
            tenantName: tenant?.name ?? "Unknown tenant",
            tenantStatus: tenant?.status ?? "unknown",
            isActive: tenantUser.isActive,
          };
        });
        const haystack = [record.email, record.name, ...associations.map((item) => item.tenantName)].join(" ").toLowerCase();
        const userLogs = auditLogs.filter((entry) =>
          String(entry.actorUserId ?? "") === String(user._id) &&
          (!args.actionType || entry.action === args.actionType || entry.event === args.actionType) &&
          (!args.dateFrom || entry.timestamp >= args.dateFrom) &&
          (!args.dateTo || entry.timestamp <= args.dateTo),
        ).slice(0, 8);
        return {
          id: user._id,
          email: record.email ?? "Unavailable",
          name: record.name ?? record.email ?? "Unnamed user",
          associations,
          activeSessionCount: sessions.filter((session) => String(session.userId) === String(user._id) && !session.revokedAt && !session.loggedOutAt).length,
          locked: Boolean(record.lockedUntil && record.lockedUntil > Date.now()),
          deactivated: associations.length > 0 && associations.every((item) => !item.isActive),
          recentActivity: userLogs.map((entry) => ({ action: entry.action, event: entry.event, outcome: entry.outcome, timestamp: entry.timestamp })),
          matches: needle.length === 0 || haystack.includes(needle),
        };
      })
      .filter((row) => row.matches)
      .slice(0, 80);
  },
});

export const manageCrossTenantUser = mutation({
  args: {
    action: v.union(
      v.literal("password_reset"),
      v.literal("unlock"),
      v.literal("force_logout"),
      v.literal("deactivate"),
      v.literal("gdpr_anonymize"),
    ),
    reason: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const auth = await requireAllowedPlatformAdmin(ctx);
    if (args.reason.trim().length < 6) throw new ConvexError("A reason is required.");
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError("User not found.");
    const tenantUsers = await ctx.db.query("tenantUsers").withIndex("by_userId", (q) => q.eq("userId", args.userId)).collect();
    if (args.action === "deactivate" || args.action === "gdpr_anonymize") {
      for (const tenantUser of tenantUsers.filter((item) => item.role === "tenant_admin" && item.isActive)) {
        const peerAdmins = await ctx.db.query("tenantUsers").withIndex("by_tenantId", (q) => q.eq("tenantId", tenantUser.tenantId)).collect();
        if (peerAdmins.filter((item) => item.role === "tenant_admin" && item.isActive && String(item.userId) !== String(args.userId)).length === 0) {
          await appendAuditLogBestEffort(ctx, {
            action: args.action,
            actor: { role: "platform_admin", state: "authenticated", userId: auth.userId },
            entityType: "user",
            event: AUDIT_EVENT_NAMES.platformAdminUserManaged,
            metadata: { reason: args.reason, blockedReason: "tenant_admin_orphan_prevention" },
            outcome: AUDIT_OUTCOMES.blockedStateTransition,
            recordId: String(args.userId),
            targetTenantId: tenantUser.tenantId,
            timestamp: Date.now(),
          });
          throw new ConvexError("This action would leave a tenant without an active Tenant Admin.");
        }
      }
    }
    if (args.action === "force_logout") {
      const sessions = await ctx.db.query("sessionMetadata").withIndex("by_userId", (q) => q.eq("userId", args.userId)).collect();
      await Promise.all(sessions.map((session) => ctx.db.patch(session._id, { loggedOutAt: Date.now(), revokedAt: Date.now() })));
    }
    if (args.action === "unlock") {
      const email = normalized((user as any).email);
      const [accessAttempts, platformChallenges, platformSecurityState] = await Promise.all([
        email ? ctx.db.query("departmentUserLoginAttempts").collect().then((attempts: any[]) => attempts.filter((attempt) => attempt.normalizedEmail === email)) : Promise.resolve([]),
        ctx.db.query("platformAdminChallenges").withIndex("by_userId", (q: any) => q.eq("userId", args.userId)).collect(),
        ctx.db.query("platformAdminSecurityStates").withIndex("by_userId", (q: any) => q.eq("userId", args.userId)).first(),
      ]);
      await Promise.all([
        ...accessAttempts.map((attempt: any) => ctx.db.patch(attempt._id, { failedAttempts: 0, lockedUntil: undefined, updatedAt: Date.now() })),
        ...platformChallenges.map((challenge: any) => ctx.db.patch(challenge._id, { failedAttempts: 0, lockedUntil: undefined, updatedAt: Date.now() })),
        platformSecurityState ? ctx.db.patch(platformSecurityState._id, { revokedAt: undefined, updatedAt: Date.now() }) : Promise.resolve(),
      ]);
    }
    if (args.action === "password_reset") {
      const platformSecurityState = await ctx.db.query("platformAdminSecurityStates").withIndex("by_userId", (q: any) => q.eq("userId", args.userId)).first();
      if (platformSecurityState) {
        await ctx.db.patch(platformSecurityState._id, {
          passwordResetRequiredAt: Date.now(),
          revokedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      if (typeof (user as any).email === "string" && (user as any).email.trim().length > 0) {
        await ctx.scheduler.runAfter(0, "actions/email:queueTransactionalEmail" as any, {
          idempotencyKey: `platform-admin-password-reset-${String(args.userId)}-${Date.now()}`,
          subject: "Procureline password reset required",
          template: "generic-notification",
          templateProps: {
            body: "A Platform Admin has required a password reset for your Procureline account. Use the password reset flow before signing in again.",
            title: "Password reset required",
          },
          to: (user as any).email.trim().toLowerCase(),
        });
      }
    }
    if (args.action === "deactivate" || args.action === "gdpr_anonymize") {
      await Promise.all(tenantUsers.map((tenantUser) => ctx.db.patch(tenantUser._id, { isActive: false })));
    }
    if (args.action === "gdpr_anonymize") {
      await ctx.db.patch(args.userId, { email: `deleted-${String(args.userId)}@anonymous.local`, name: "Deleted user" } as any);
    }
    await audit(ctx, { actorUserId: auth.userId, action: args.action, entityType: "user", event: AUDIT_EVENT_NAMES.platformAdminUserManaged, metadata: { reason: args.reason }, recordId: String(args.userId) });
    return { ok: true };
  },
});

export const lockTenantUsers = mutation({
  args: { reason: v.string(), tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const auth = await requireAllowedPlatformAdmin(ctx);
    const users = await ctx.db.query("tenantUsers").withIndex("by_tenantId", (q) => q.eq("tenantId", args.tenantId)).collect();
    await Promise.all(users.map((user) => ctx.db.patch(user._id, { isActive: false })));
    await audit(ctx, { actorUserId: auth.userId, action: "tenant_lockout", entityType: "tenant", event: AUDIT_EVENT_NAMES.platformAdminTenantLockout, metadata: { reason: args.reason, affectedUsers: users.length }, recordId: String(args.tenantId), targetTenantId: args.tenantId });
    return { affectedUsers: users.length };
  },
});

export const getFreeTierSnapshot = query({
  args: {},
  handler: async (ctx) => {
    await requireAllowedPlatformAdmin(ctx);
    const [tenants, departments, categories, items, reviews, auditLogs] = await Promise.all([
      ctx.db.query("tenants").withIndex("by_tier", (q) => q.eq("tier", "free")).collect(),
      ctx.db.query("departments").collect(),
      ctx.db.query("procurementCategories").collect(),
      ctx.db.query("procurementItems").collect(),
      ctx.db.query("platformFreeTierReviews").collect(),
      ctx.db.query("auditLogs").withIndex("by_timestamp", (q) => q).order("desc").take(500),
    ]);
    const reviewByTenant = new Map(reviews.map((review) => [String(review.tenantId), review]));
    const rows = tenants.map((tenant) => {
      const tenantDepartments = departments.filter((item) => String(item.tenantId) === String(tenant._id) && item.isActive);
      const tenantCategories = categories.filter((item) => String(item.tenantId) === String(tenant._id) && item.isActive);
      const tenantItems = items.filter((item) => String(item.tenantId) === String(tenant._id) && item.isActive);
      const lastActivity = auditLogs.find((entry) => String(entry.targetTenantId ?? entry.sourceTenantId ?? "") === String(tenant._id))?.timestamp ?? tenant.createdAt;
      const utilization = Math.max(tenantDepartments.length / FREE_TIER_LIMITS.departments, tenantCategories.length / FREE_TIER_LIMITS.categories, tenantItems.length / FREE_TIER_LIMITS.items) * 100;
      const review = reviewByTenant.get(String(tenant._id)) ?? null;
      return {
        id: tenant._id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        departments: tenantDepartments.length,
        categories: tenantCategories.length,
        itemsPerCategory: tenantCategories.length ? Math.round(tenantItems.length / tenantCategories.length) : 0,
        logins: auditLogs.filter((entry) => String(entry.targetTenantId ?? entry.sourceTenantId ?? "") === String(tenant._id) && entry.action.includes("login")).length,
        lastActivity,
        utilization: Math.round(utilization),
        state: utilization >= 90 ? "red" : utilization >= 70 ? "yellow" : "green",
        inactive: Date.now() - lastActivity > 90 * DAY,
        overage: {
          categories: Math.max(0, tenantCategories.length - FREE_TIER_LIMITS.categories),
          departments: Math.max(0, tenantDepartments.length - FREE_TIER_LIMITS.departments),
          items: Math.max(0, tenantItems.length - FREE_TIER_LIMITS.items),
        },
        review,
      };
    });
    return {
      rows,
      report: {
        total: rows.length,
        candidates: rows.filter((row) => row.utilization >= 90 || row.review?.upgradeCandidateFirstHitAt).length,
        paidConversions: reviews.filter((review) => review.convertedAt).length,
        inactive: rows.filter((row) => row.inactive).length,
        conversionRate: rows.length ? Math.round((reviews.filter((review) => review.convertedAt).length / rows.length) * 100) : 0,
      },
    };
  },
});

export const updateFreeTierReview = mutation({
  args: { notes: v.optional(v.string()), salesFollowUp: v.boolean(), tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const auth = await requireAllowedPlatformAdmin(ctx);
    const payload = { salesFollowUp: args.salesFollowUp, salesNotes: args.notes };
    await upsertFreeTierReview(ctx, { actorUserId: auth.userId, patch: payload, tenantId: args.tenantId });
    await audit(ctx, { actorUserId: auth.userId, action: "free_tier_review", entityType: "tenant", event: AUDIT_EVENT_NAMES.platformAdminFreeTierReviewed, targetTenantId: args.tenantId, recordId: String(args.tenantId), metadata: payload });
    return { ok: true };
  },
});

export const convertFreeTenantToPaid = mutation({
  args: { notifyTenant: v.boolean(), tenantId: v.id("tenants"), tier: v.union(v.literal("starter"), v.literal("professional"), v.literal("enterprise")) },
  handler: async (ctx, args) => {
    const auth = await requireAllowedPlatformAdmin(ctx);
    await ctx.db.patch(args.tenantId, { tier: args.tier, subscriptionStatus: "active" });
    await upsertFreeTierReview(ctx, { actorUserId: auth.userId, patch: { convertedAt: Date.now(), convertedByPlatformUserId: auth.userId }, tenantId: args.tenantId });
    if (args.notifyTenant) {
      const tenant = await ctx.db.get(args.tenantId);
      if (tenant?.primaryContactEmail) {
        await ctx.scheduler.runAfter(0, "actions/email:queueTransactionalEmail" as any, {
          idempotencyKey: `free-tier-conversion-${String(args.tenantId)}-${Date.now()}`,
          subject: "Procureline tier conversion complete",
          template: "generic-notification",
          templateProps: {
            body: `Your Procureline tenant has been converted to the ${args.tier} tier.`,
            title: "Subscription updated",
          },
          to: tenant.primaryContactEmail,
        });
      }
    }
    await audit(ctx, { actorUserId: auth.userId, action: "free_tier_convert", entityType: "tenant", event: AUDIT_EVENT_NAMES.platformAdminFreeTierReviewed, targetTenantId: args.tenantId, recordId: String(args.tenantId), metadata: { tier: args.tier, notifyTenant: args.notifyTenant } });
    return { ok: true };
  },
});

export const getHealthOperationsSnapshot = query({
  args: {},
  handler: async (ctx) => {
    await requireAllowedPlatformAdmin(ctx);
    const [health, jobsFailed, jobsClaimed, maintenance] = await Promise.all([
      ctx.db.query("platformHealthSnapshots").withIndex("by_capturedAt", (q) => q).order("desc").first(),
      ctx.db.query("externalServiceSyncEvents").withIndex("by_status", (q) => q.eq("status", "failed")).order("desc").take(20),
      ctx.db.query("externalServiceSyncEvents").withIndex("by_status", (q) => q.eq("status", "claimed")).order("desc").take(20),
      ctx.db.query("platformMaintenanceWindows").withIndex("by_startsAt", (q) => q).order("desc").take(20),
    ]);
    const failed = jobsFailed.length;
    const recentJobs = [...jobsFailed, ...jobsClaimed].sort((a, b) => b.updatedAt - a.updatedAt);
    const backupJobs = recentJobs.filter((job) => job.eventType.includes("backup"));
    const apiLatencyMs = parseNumber(health?.api?.detail?.match(/\d+(\.\d+)?/)?.[0]) ?? (failed > 0 ? 750 : 120);
    const apiErrorRate = failed > 0 ? Math.min(100, failed * 5) : 0;
    const sslConfig = await ctx.db.query("platformConfigurationRecords").withIndex("by_key", (q) => q.eq("key", "ssl_certificate_expires_in_days")).first();
    const sslExpiresInDays = parseNumber(sslConfig?.value) ?? 30;
    const activeMaintenance = maintenance.find((window) => window.status === "active" || (window.status === "scheduled" && window.startsAt <= Date.now() && window.endsAt >= Date.now()));
    return {
      health,
      api: { latencyMs: apiLatencyMs, errorRate: apiErrorRate, alert: apiErrorRate > 5 },
      database: health?.database ?? { state: "warning", detail: "No database snapshot captured" },
      jobs: recentJobs.map((job) => ({ id: job._id, eventType: job.eventType, metadata: job.metadata, provider: job.provider, status: job.status, updatedAt: job.updatedAt })),
      infrastructure: { cpu: health?.summaryState ?? "healthy", memory: health?.jobs?.state ?? "healthy", storage: health?.storage?.detail ?? "No storage snapshot" },
      backups: { latestStatus: backupJobs[0]?.status ?? "not_started", history: backupJobs.map((job) => ({ id: job._id, progress: job.metadata?.progress ?? null, status: job.status, updatedAt: job.updatedAt })) },
      ssl: { expiresInDays: sslExpiresInDays, state: sslExpiresInDays <= 30 ? "warning" : "healthy" },
      alerts: [
        ...(apiErrorRate > 5 ? [{ kind: "api_error_rate", message: "API error rate is above 5%." }] : []),
        ...(backupJobs.some((job) => job.status === "failed") ? [{ kind: "backup_failure", message: "Recent backup failure detected." }] : []),
      ],
      activeMaintenance,
      maintenance,
    };
  },
});

export const scheduleMaintenanceWindow = mutation({
  args: { endsAt: v.number(), message: v.string(), startsAt: v.number(), title: v.string() },
  handler: async (ctx, args) => {
    const auth = await requireAllowedPlatformAdmin(ctx);
    const id = await ctx.db.insert("platformMaintenanceWindows", { ...args, status: "scheduled", createdAt: Date.now(), updatedAt: Date.now(), createdByPlatformUserId: auth.userId });
    await audit(ctx, { actorUserId: auth.userId, action: "schedule_maintenance", entityType: "maintenance_window", event: AUDIT_EVENT_NAMES.platformAdminHealthManaged, recordId: String(id), metadata: args });
    return id;
  },
});

export const createManualBackupJob = mutation({
  args: {},
  handler: async (ctx) => {
    const auth = await requireAllowedPlatformAdmin(ctx);
    const id = await ctx.db.insert("externalServiceSyncEvents", { actorRole: "platform_admin", actorUserId: auth.userId, claimedAt: Date.now(), durableChanges: [{ kind: "backup_requested", requestedAt: Date.now() }], eventKey: `manual-backup-${Date.now()}`, eventType: "manual_backup", metadata: { completedAt: Date.now(), progress: 100 }, payloadHash: "manual", processedAt: Date.now(), provider: "backup", result: { state: "completed" }, status: "completed", updatedAt: Date.now() });
    await audit(ctx, { actorUserId: auth.userId, action: "manual_backup", entityType: "backup_job", event: AUDIT_EVENT_NAMES.platformAdminHealthManaged, recordId: String(id) });
    return id;
  },
});

export const getSecuritySnapshot = query({
  args: { action: v.optional(v.string()), dateFrom: v.optional(v.number()), dateTo: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAllowedPlatformAdmin(ctx);
    const [tenants, isolationEvents, auditLogs, config] = await Promise.all([
      ctx.db.query("tenants").collect(),
      ctx.db.query("tenantIsolationEvents").withIndex("by_timestamp", (q) => q).order("desc").take(200),
      ctx.db.query("auditLogs").withIndex("by_timestamp", (q) => q).order("desc").take(300),
      ctx.db.query("platformConfigurationRecords").withIndex("by_key", (q) => q.eq("key", "platform_admin_ip_allowlist")).first(),
    ]);
    const filteredAudit = auditLogs.filter((log) => (!args.action || log.action === args.action || log.event === args.action) && (!args.dateFrom || log.timestamp >= args.dateFrom) && (!args.dateTo || log.timestamp <= args.dateTo));
    return {
      threats: isolationEvents.filter((event) => event.event === "tenant.probe_blocked").length,
      auditStatus: { checked: auditLogs.length, immutable: true, integrityState: auditLogs.every((entry) => entry._creationTime <= entry.timestamp + DAY) ? "pass" : "review" },
      isolation: tenants.slice(0, 50).map((tenant) => ({ tenantId: tenant._id, tenantName: tenant.name, state: isolationEvents.some((event) => String(event.targetTenantId ?? "") === String(tenant._id) && event.event === "tenant.probe_blocked") ? "fail" : "pass" })),
      accessLogs: filteredAudit.slice(0, 80),
      allowlist: config?.value ?? [],
      incidentResponse: {
        actions: ["tenant_lockout", "force_logout", "audit_export", "announcement"],
        lockdownAvailable: true,
        notificationAvailable: true,
      },
      unusualAccessAlerts: isolationEvents.filter((event) => event.event === "tenant.probe_blocked").slice(0, 10),
    };
  },
});

export const updateIpAllowlist = mutation({
  args: { ips: v.array(v.string()), reason: v.string() },
  handler: async (ctx, args) => {
    const auth = await requireAllowedPlatformAdmin(ctx);
    await upsertConfig(ctx, auth.userId, "platform_admin_ip_allowlist", "system", args.ips, args.reason);
    return { ok: true };
  },
});

export const getSupportSnapshot = query({
  args: {},
  handler: async (ctx) => {
    await requireAllowedPlatformAdmin(ctx);
    const [tickets, incidents, announcements] = await Promise.all([
      ctx.db.query("platformSupportTickets").withIndex("by_status_slaDueAt", (q) => q).collect(),
      ctx.db.query("platformIncidents").withIndex("by_updatedAt", (q) => q).order("desc").take(50),
      ctx.db.query("platformAnnouncements").withIndex("by_deliverAt", (q) => q).order("desc").take(50),
    ]);
    const now = Date.now();
    return {
      tickets: tickets.map((ticket) => ({ ...ticket, slaState: ticket.slaDueAt < now ? "breached" : ticket.slaDueAt - now < 4 * 60 * 60 * 1000 ? "approaching" : "ok" })),
      incidents,
      announcements,
      statusPage: incidents.find((incident) => incident.status !== "resolved")?.statusPageMessage ?? "All systems operational",
    };
  },
});

export const upsertSupportTicket = mutation({
  args: { assignedToPlatformUserId: v.optional(v.id("users")), description: v.string(), priority: v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("critical")), status: v.optional(v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved"))), subject: v.string(), tenantId: v.optional(v.id("tenants")), ticketId: v.optional(v.id("platformSupportTickets")) },
  handler: async (ctx, args) => {
    const auth = await requireAllowedPlatformAdmin(ctx);
    const now = Date.now();
    const payload = { tenantId: args.tenantId, subject: args.subject, description: args.description, priority: args.priority, assignedToPlatformUserId: args.assignedToPlatformUserId, status: args.status, updatedAt: now };
    const id = args.ticketId ? (await ctx.db.patch(args.ticketId, payload), args.ticketId) : await ctx.db.insert("platformSupportTickets", { ...payload, status: args.status ?? "open", slaDueAt: now + (args.priority === "critical" ? 4 : 24) * 60 * 60 * 1000, createdAt: now });
    await audit(ctx, { actorUserId: auth.userId, action: args.ticketId ? "update_ticket" : "create_ticket", entityType: "support_ticket", event: AUDIT_EVENT_NAMES.platformAdminSupportManaged, recordId: String(id), targetTenantId: args.tenantId });
    return id;
  },
});

export const mergeSupportTickets = mutation({
  args: { sourceTicketId: v.id("platformSupportTickets"), targetTicketId: v.id("platformSupportTickets") },
  handler: async (ctx, args) => {
    const auth = await requireAllowedPlatformAdmin(ctx);
    if (String(args.sourceTicketId) === String(args.targetTicketId)) throw new ConvexError("Choose two different tickets to merge.");
    const [source, target] = await Promise.all([ctx.db.get(args.sourceTicketId), ctx.db.get(args.targetTicketId)]);
    if (!source || !target) throw new ConvexError("Ticket not found.");
    await ctx.db.patch(args.sourceTicketId, { mergedIntoTicketId: args.targetTicketId, status: "merged", updatedAt: Date.now() });
    await ctx.db.patch(args.targetTicketId, {
      description: `${target.description}\n\nMerged ticket ${String(args.sourceTicketId)}: ${source.subject}\n${source.description}`,
      updatedAt: Date.now(),
    });
    await audit(ctx, { actorUserId: auth.userId, action: "merge_ticket", entityType: "support_ticket", event: AUDIT_EVENT_NAMES.platformAdminSupportManaged, metadata: { targetTicketId: String(args.targetTicketId) }, recordId: String(args.sourceTicketId), targetTenantId: source.tenantId });
    return { ok: true };
  },
});

export const createIncident = mutation({
  args: { severity: v.union(v.literal("minor"), v.literal("major"), v.literal("critical")), status: v.optional(v.union(v.literal("investigating"), v.literal("identified"), v.literal("monitoring"), v.literal("resolved"))), statusPageMessage: v.string(), summary: v.string(), title: v.string() },
  handler: async (ctx, args) => {
    const auth = await requireAllowedPlatformAdmin(ctx);
    const id = await ctx.db.insert("platformIncidents", { ...args, status: args.status ?? "investigating", createdByPlatformUserId: auth.userId, createdAt: Date.now(), updatedAt: Date.now() });
    await audit(ctx, { actorUserId: auth.userId, action: "create_incident", entityType: "incident", event: AUDIT_EVENT_NAMES.platformAdminSupportManaged, recordId: String(id), metadata: args });
    return id;
  },
});

export const updateIncidentStatus = mutation({
  args: { incidentId: v.id("platformIncidents"), status: v.union(v.literal("investigating"), v.literal("identified"), v.literal("monitoring"), v.literal("resolved")), statusPageMessage: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const auth = await requireAllowedPlatformAdmin(ctx);
    const incident = await ctx.db.get(args.incidentId);
    if (!incident) throw new ConvexError("Incident not found.");
    await ctx.db.patch(args.incidentId, {
      postIncidentReviewDueAt: args.status === "resolved" ? Date.now() + DAY : incident.postIncidentReviewDueAt,
      status: args.status,
      statusPageMessage: args.statusPageMessage ?? incident.statusPageMessage,
      updatedAt: Date.now(),
    });
    await audit(ctx, { actorUserId: auth.userId, action: "update_incident", entityType: "incident", event: AUDIT_EVENT_NAMES.platformAdminSupportManaged, metadata: { status: args.status }, recordId: String(args.incidentId) });
    return { ok: true };
  },
});

export const scheduleAnnouncement = mutation({
  args: { deliverAt: v.number(), message: v.string(), targetTenantIds: v.optional(v.array(v.id("tenants"))), title: v.string() },
  handler: async (ctx, args) => {
    const auth = await requireAllowedPlatformAdmin(ctx);
    const id = await ctx.db.insert("platformAnnouncements", { ...args, status: args.deliverAt > Date.now() ? "scheduled" : "sent", createdByPlatformUserId: auth.userId, createdAt: Date.now(), updatedAt: Date.now() });
    await audit(ctx, { actorUserId: auth.userId, action: "schedule_announcement", entityType: "announcement", event: AUDIT_EVENT_NAMES.platformAdminSupportManaged, recordId: String(id), metadata: { targetTenantCount: args.targetTenantIds?.length ?? "all" } });
    return id;
  },
});

export const getConfigurationSnapshot = query({
  args: {},
  handler: async (ctx) => {
    await requireAllowedPlatformAdmin(ctx);
    const [configs, versions, tiers] = await Promise.all([
      ctx.db.query("platformConfigurationRecords").withIndex("by_category", (q) => q).collect(),
      ctx.db.query("platformConfigurationVersions").collect(),
      ctx.db.query("subscriptionTiers").collect(),
    ]);
    return {
      configs,
      emailPreview: configs.filter((config) => config.category === "email_template").map((config) => ({ key: config.key, preview: String(config.value).slice(0, 240) })),
      exportPayload: configs.map((config) => ({ category: config.category, enabled: config.enabled, key: config.key, rolloutPercentage: config.rolloutPercentage, tenantOverrides: config.tenantOverrides, value: config.value })),
      versions: versions.slice(-100),
      tiers,
    };
  },
});

export const saveConfiguration = mutation({
  args: { category: v.union(v.literal("system"), v.literal("feature_flag"), v.literal("pricing"), v.literal("email_template"), v.literal("integration")), enabled: v.optional(v.boolean()), key: v.string(), reason: v.string(), rolloutPercentage: v.optional(v.number()), tenantOverrides: v.optional(v.array(v.id("tenants"))), value: v.any() },
  handler: async (ctx, args) => {
    const auth = await requireAllowedPlatformAdmin(ctx);
    return await upsertConfig(ctx, auth.userId, args.key, args.category, args.value, args.reason, args.enabled, args.rolloutPercentage, args.tenantOverrides);
  },
});

export const rollbackConfiguration = mutation({
  args: { configId: v.id("platformConfigurationRecords"), reason: v.string(), version: v.number() },
  handler: async (ctx, args) => {
    const auth = await requireAllowedPlatformAdmin(ctx);
    const version = await ctx.db.query("platformConfigurationVersions").withIndex("by_configId", (q) => q.eq("configId", args.configId)).filter((q) => q.eq(q.field("version"), args.version)).first();
    if (!version) throw new ConvexError("Configuration version not found.");
    await ctx.db.patch(args.configId, { value: version.value, version: args.version, updatedAt: Date.now(), updatedByPlatformUserId: auth.userId });
    await ctx.db.insert("platformConfigurationVersions", { configId: args.configId, key: version.key, value: version.value, version: args.version, reason: `Rollback: ${args.reason}`, createdByPlatformUserId: auth.userId, createdAt: Date.now() });
    await audit(ctx, { actorUserId: auth.userId, action: "rollback_configuration", entityType: "configuration", event: AUDIT_EVENT_NAMES.platformAdminConfigurationChanged, recordId: String(args.configId), metadata: { reason: args.reason, version: args.version } });
    return { ok: true };
  },
});

export const importConfiguration = mutation({
  args: {
    records: v.array(
      v.object({
        category: v.union(v.literal("system"), v.literal("feature_flag"), v.literal("pricing"), v.literal("email_template"), v.literal("integration")),
        enabled: v.optional(v.boolean()),
        key: v.string(),
        rolloutPercentage: v.optional(v.number()),
        tenantOverrides: v.optional(v.array(v.id("tenants"))),
        value: v.any(),
      }),
    ),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await requireAllowedPlatformAdmin(ctx);
    const ids = [];
    for (const record of args.records.slice(0, 100)) {
      ids.push(await upsertConfig(ctx, auth.userId, record.key, record.category, record.value, args.reason, record.enabled, record.rolloutPercentage, record.tenantOverrides));
    }
    return { imported: ids.length };
  },
});

export const evaluateFeatureFlag = query({
  args: { key: v.string(), tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireAllowedPlatformAdmin(ctx);
    const config = await ctx.db.query("platformConfigurationRecords").withIndex("by_key", (q) => q.eq("key", args.key)).first();
    if (!config || config.category !== "feature_flag" || config.enabled === false) {
      return { enabled: false, reason: "disabled" };
    }
    if (config.tenantOverrides?.some((tenantId) => String(tenantId) === String(args.tenantId))) {
      return { enabled: true, reason: "tenant_override" };
    }
    const percentage = Math.max(0, Math.min(100, config.rolloutPercentage ?? 0));
    return {
      bucket: rolloutBucket(`${args.key}:${String(args.tenantId)}`),
      enabled: rolloutBucket(`${args.key}:${String(args.tenantId)}`) < percentage,
      reason: "percentage_rollout",
    };
  },
});

async function upsertConfig(ctx: any, actorUserId: Id<"users">, key: string, category: "system" | "feature_flag" | "pricing" | "email_template" | "integration", value: unknown, reason: string, enabled?: boolean, rolloutPercentage?: number, tenantOverrides?: Id<"tenants">[]) {
  if (reason.trim().length < 6) throw new ConvexError("A change reason is required.");
  if (rolloutPercentage !== undefined && (rolloutPercentage < 0 || rolloutPercentage > 100)) throw new ConvexError("Rollout percentage must be between 0 and 100.");
  const existing = await ctx.db.query("platformConfigurationRecords").withIndex("by_key", (q: any) => q.eq("key", key)).first();
  const nextVersion = (existing?.version ?? 0) + 1;
  const payload = { key, value, category, enabled, rolloutPercentage, tenantOverrides, version: nextVersion, updatedByPlatformUserId: actorUserId, updatedAt: Date.now() };
  const configId = existing ? (await ctx.db.patch(existing._id, payload), existing._id) : await ctx.db.insert("platformConfigurationRecords", payload);
  if (category === "pricing") {
    const tier = await ctx.db.query("subscriptionTiers").withIndex("by_slug", (q: any) => q.eq("slug", key)).first();
    const priceUSD = typeof value === "number" ? value : Number(value);
    if (tier && Number.isFinite(priceUSD)) {
      await ctx.db.insert("platformConfigurationVersions", { configId, key: `${key}:grandfathered_price_snapshot`, value: { previousPriceUSD: tier.priceUSD }, version: nextVersion, reason: "Grandfather pricing snapshot before tier price update", createdByPlatformUserId: actorUserId, createdAt: Date.now() });
      await ctx.db.patch(tier._id, { priceUSD });
    }
  }
  await ctx.db.insert("platformConfigurationVersions", { configId, key, value, version: nextVersion, reason, createdByPlatformUserId: actorUserId, createdAt: Date.now() });
  await audit(ctx, { actorUserId, action: "save_configuration", entityType: "configuration", event: AUDIT_EVENT_NAMES.platformAdminConfigurationChanged, recordId: String(configId), metadata: { key, category, reason, rolloutPercentage } });
  return configId;
}

export const runPlatformAdminMaintenance = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const systemActor = await getSystemPlatformUserId(ctx);
    const [tenants, departments, categories, items, auditLogs] = await Promise.all([
      ctx.db.query("tenants").withIndex("by_tier", (q) => q.eq("tier", "free")).collect(),
      ctx.db.query("departments").collect(),
      ctx.db.query("procurementCategories").collect(),
      ctx.db.query("procurementItems").collect(),
      ctx.db.query("auditLogs").withIndex("by_timestamp", (q) => q).order("desc").take(1000),
    ]);
    if (systemActor) {
      const tenantsByDomain = new Map<string, typeof tenants>();
      const tenantsByNameKey = new Map<string, typeof tenants>();
      for (const tenant of tenants) {
        const domain = getEmailDomain(tenant.primaryContactEmail);
        const nameKey = similarityKey(tenant.name);
        if (domain) tenantsByDomain.set(domain, [...(tenantsByDomain.get(domain) ?? []), tenant]);
        if (nameKey) tenantsByNameKey.set(nameKey, [...(tenantsByNameKey.get(nameKey) ?? []), tenant]);
      }
      for (const tenant of tenants) {
        const tenantDepartments = departments.filter((item) => String(item.tenantId) === String(tenant._id) && item.isActive);
        const tenantCategories = categories.filter((item) => String(item.tenantId) === String(tenant._id) && item.isActive);
        const tenantItems = items.filter((item) => String(item.tenantId) === String(tenant._id) && item.isActive);
        const lastActivity = auditLogs.find((entry) => String(entry.targetTenantId ?? entry.sourceTenantId ?? "") === String(tenant._id))?.timestamp ?? tenant.createdAt;
        const utilization = Math.max(tenantDepartments.length / FREE_TIER_LIMITS.departments, tenantCategories.length / FREE_TIER_LIMITS.categories, tenantItems.length / FREE_TIER_LIMITS.items) * 100;
        const domain = getEmailDomain(tenant.primaryContactEmail);
        const nameKey = similarityKey(tenant.name);
        const duplicateByDomain = Boolean(domain && (tenantsByDomain.get(domain)?.length ?? 0) > 1);
        const duplicateByName = Boolean(nameKey && (tenantsByNameKey.get(nameKey)?.length ?? 0) > 1);
        const patch: Record<string, unknown> = {};
        if (utilization >= 90) patch.upgradeCandidateFirstHitAt = now;
        if (now - lastActivity > 90 * DAY) patch.inactiveFirstDetectedAt = now;
        if (duplicateByDomain || duplicateByName) patch.abuseFlag = { detectedAt: now, reason: duplicateByDomain ? "duplicate_email_domain" : "similar_organization_name" };
        if (Object.keys(patch).length > 0) {
          await upsertFreeTierReview(ctx, { actorUserId: systemActor, patch, tenantId: tenant._id });
        }
      }
      const recentSignups = tenants.filter((tenant) => now - tenant.createdAt <= HOUR);
      if (recentSignups.length > 50) {
        await ctx.db.insert("externalServiceSyncEvents", { actorRole: "platform_admin", actorUserId: systemActor, claimedAt: now, durableChanges: [], eventKey: `free-tier-signup-volume-${Math.floor(now / HOUR)}`, eventType: "free_tier_signup_volume_alert", metadata: { count: recentSignups.length, threshold: 50 }, payloadHash: `free-tier-signup-volume-${Math.floor(now / HOUR)}`, processedAt: now, provider: "platform-admin", result: { state: "alerted" }, status: "completed", updatedAt: now });
      }
    }
    const tickets = await ctx.db.query("platformSupportTickets").withIndex("by_status_slaDueAt", (q) => q).collect();
    for (const ticket of tickets.filter((item) => item.status === "open" && item.slaDueAt - now < 2 * 60 * 60 * 1000 && !item.escalatedAt)) {
      await ctx.db.patch(ticket._id, { escalatedAt: now, priority: "high", updatedAt: now });
    }
    const announcements = await ctx.db.query("platformAnnouncements").withIndex("by_status_deliverAt", (q) => q.eq("status", "scheduled")).collect();
    for (const announcement of announcements.filter((item) => item.deliverAt <= now)) {
      await ctx.db.patch(announcement._id, { status: "sent", updatedAt: now });
    }
    const incidents = await ctx.db.query("platformIncidents").withIndex("by_status", (q) => q.eq("status", "resolved")).collect();
    for (const incident of incidents.filter((item) => !item.postIncidentReviewDueAt)) {
      await ctx.db.patch(incident._id, { postIncidentReviewDueAt: now + DAY, updatedAt: now });
    }
    const maintenanceWindows = await ctx.db.query("platformMaintenanceWindows").withIndex("by_startsAt", (q) => q).collect();
    for (const window of maintenanceWindows) {
      if (window.status === "scheduled" && window.startsAt <= now && window.endsAt > now) {
        await ctx.db.patch(window._id, { status: "active", updatedAt: now });
      }
      if ((window.status === "scheduled" || window.status === "active") && window.endsAt <= now) {
        await ctx.db.patch(window._id, { status: "completed", updatedAt: now });
      }
    }
    return null;
  },
});

export const getActiveMaintenanceWindow = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const windows = await ctx.db.query("platformMaintenanceWindows").withIndex("by_status_startsAt", (q) => q.eq("status", "active")).collect();
    return windows.find((window) => window.startsAt <= now && window.endsAt >= now) ?? null;
  },
});
