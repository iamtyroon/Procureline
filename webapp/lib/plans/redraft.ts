export type PlanRedraftRequestStatus =
  | "approved"
  | "cancelled"
  | "denied"
  | "pending";

export interface PlanRedraftRequestLike {
  fiscalYear: string;
  planId: string;
  status: PlanRedraftRequestStatus;
}

export interface PlanRedraftPlanLike {
  approvedAt?: number | null;
  departmentId: string;
  fiscalYear: string;
  id: string;
  status: "approved" | "draft" | "rejected" | "submitted";
  tenantId: string;
}

export interface PlanRedraftEligibilityResult {
  canRequest: boolean;
  message: string | null;
}

export function normalizePlanRedraftReason(value: string): {
  message?: string;
  ok: boolean;
  value?: string;
} {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length < 8) {
    return {
      message: "Explain why this approved plan needs to be redrafted.",
      ok: false,
    };
  }

  if (normalized.length > 500) {
    return {
      message: "Redraft reason must be 500 characters or fewer.",
      ok: false,
    };
  }

  return {
    ok: true,
    value: normalized,
  };
}

export function hasPendingPlanRedraftRequest(args: {
  fiscalYear: string;
  planId: string;
  requests: readonly PlanRedraftRequestLike[];
}): boolean {
  return args.requests.some(
    (request) =>
      request.planId === args.planId &&
      request.fiscalYear === args.fiscalYear &&
      request.status === "pending",
  );
}

export function getPlanRedraftRequestEligibility(args: {
  currentFiscalYear: string;
  departmentId: string;
  pendingRequestExists: boolean;
  plan: PlanRedraftPlanLike | null;
  tenantId: string;
}): PlanRedraftEligibilityResult {
  if (!args.plan) {
    return {
      canRequest: false,
      message: "Approved plan not found.",
    };
  }

  if (args.plan.tenantId !== args.tenantId || args.plan.departmentId !== args.departmentId) {
    return {
      canRequest: false,
      message: "Approved plan not found for this department.",
    };
  }

  if (args.plan.fiscalYear !== args.currentFiscalYear) {
    return {
      canRequest: false,
      message: "Only the current fiscal-year approved plan can be redrafted.",
    };
  }

  if (args.plan.status !== "approved") {
    return {
      canRequest: false,
      message: "Only approved plans can be requested for redraft.",
    };
  }

  if (typeof args.plan.approvedAt !== "number") {
    return {
      canRequest: false,
      message: "This approved plan is missing its approval timestamp.",
    };
  }

  if (args.pendingRequestExists) {
    return {
      canRequest: false,
      message: "A redraft request is already pending for this approved plan.",
    };
  }

  return {
    canRequest: true,
    message: null,
  };
}

export function buildApprovedPlanRedraftSnapshotKey(args: {
  approvedAt: number;
  planId: string;
  tenantId: string;
}): string {
  return `${args.tenantId}:${args.planId}:approved-baseline:${args.approvedAt}`;
}

