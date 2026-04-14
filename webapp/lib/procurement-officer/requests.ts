import {
  buildCatalogRequestSummary,
  buildCatalogRequestStatusMeta,
  shouldExpireCatalogRequest,
  type CatalogRequestStatus,
  type CatalogRequestType,
  type CatalogRequestSummary,
} from "../procurement/catalog-requests";

export const PROCUREMENT_REQUEST_DENIAL_UNDO_WINDOW_MS =
  1000 * 60 * 60 * 24;

export type ProcurementCatalogRequestNotificationStatus =
  | "queued"
  | "cancelled"
  | "failed";

export type ProcurementCatalogRequestDecisionAction = "approve" | "deny";

export interface ProcurementCatalogRequestRowLike {
  id: string;
  status: CatalogRequestStatus;
  type: CatalogRequestType;
  denialUndoDeadlineAt?: number | null;
  decisionNotificationStatus?: ProcurementCatalogRequestNotificationStatus | null;
}

export interface ProcurementCatalogRequestFilterState {
  departmentId?: string | null;
  endDate?: number | null;
  requestType?: CatalogRequestType | "all";
  startDate?: number | null;
  status?: CatalogRequestStatus | "all";
}

export interface ProcurementCatalogRequestFilterNormalized {
  departmentId: string | null;
  endDate: number | null;
  requestType: CatalogRequestType | null;
  startDate: number | null;
  status: CatalogRequestStatus | null;
}

export interface BulkDecisionSkipReason {
  id: string;
  reason: string;
}

export interface BulkDecisionCompatibilityResult {
  eligibleIds: string[];
  skipped: BulkDecisionSkipReason[];
}

export interface ProcurementCatalogRequestSummaryDepartmentLike {
  id: string;
  submissionEndsAt?: number | null;
  submissionStartsAt?: number | null;
}

export interface ProcurementCatalogRequestSummaryRequestLike {
  departmentId: string;
  status: CatalogRequestStatus;
}

export function normalizeProcurementCatalogRequestFilters(
  input?: ProcurementCatalogRequestFilterState | null,
): ProcurementCatalogRequestFilterNormalized {
  const departmentId = input?.departmentId?.trim() ?? "";
  const requestType =
    input?.requestType && input.requestType !== "all"
      ? input.requestType
      : null;
  const status =
    input?.status && input.status !== "all" ? input.status : null;
  const startDate =
    typeof input?.startDate === "number" && Number.isFinite(input.startDate)
      ? input.startDate
      : null;
  const endDate =
    typeof input?.endDate === "number" && Number.isFinite(input.endDate)
      ? input.endDate
      : null;

  return {
    departmentId: departmentId.length > 0 ? departmentId : null,
    endDate,
    requestType,
    startDate,
    status,
  };
}

export function buildProcurementCatalogRequestStatusLabel(
  status: CatalogRequestStatus,
): string {
  return buildCatalogRequestStatusMeta(status).label;
}

export function resolveProcurementCatalogRequestSummary(args: {
  categoryRequests: readonly ProcurementCatalogRequestSummaryRequestLike[];
  departments: readonly ProcurementCatalogRequestSummaryDepartmentLike[];
  itemRequests: readonly ProcurementCatalogRequestSummaryRequestLike[];
}): CatalogRequestSummary {
  const departmentsById = new Map(
    args.departments.map((department) => [department.id, department] as const),
  );

  return buildCatalogRequestSummary({
    requests: [
      ...args.categoryRequests.map((request) => ({
        status: resolveRequestSummaryStatus({
          departmentsById,
          request,
        }),
        type: "category" as const,
      })),
      ...args.itemRequests.map((request) => ({
        status: resolveRequestSummaryStatus({
          departmentsById,
          request,
        }),
        type: "item" as const,
      })),
    ],
  });
}

export function resolveProcurementRequestDenialUndoDeadline(args?: {
  now?: number;
  windowMs?: number;
}): number {
  const now = args?.now ?? Date.now();
  const windowMs = args?.windowMs ?? PROCUREMENT_REQUEST_DENIAL_UNDO_WINDOW_MS;
  return now + windowMs;
}

export function isDenialUndoEligible(args: {
  denialUndoDeadlineAt?: number | null;
  decisionNotificationStatus?: ProcurementCatalogRequestNotificationStatus | null;
  now?: number;
  status: CatalogRequestStatus;
}): boolean {
  if (args.status !== "denied") {
    return false;
  }

  const deadlineAt = args.denialUndoDeadlineAt ?? null;
  if (typeof deadlineAt !== "number") {
    return false;
  }

  const now = args.now ?? Date.now();
  if (now > deadlineAt) {
    return false;
  }

  return args.decisionNotificationStatus !== "failed";
}

export function buildBulkDecisionCompatibility(args: {
  action: ProcurementCatalogRequestDecisionAction;
  allowedType?: CatalogRequestType | null;
  requests: readonly ProcurementCatalogRequestRowLike[];
}): BulkDecisionCompatibilityResult {
  const eligibleIds: string[] = [];
  const skipped: BulkDecisionSkipReason[] = [];
  const allowedType = args.allowedType ?? null;

  for (const request of args.requests) {
    if (allowedType && request.type !== allowedType) {
      skipped.push({
        id: request.id,
        reason: "Selection must stay within one request type.",
      });
      continue;
    }

    if (request.status !== "pending") {
      skipped.push({
        id: request.id,
        reason: "Only pending requests can be processed.",
      });
      continue;
    }

    eligibleIds.push(request.id);
  }

  return {
    eligibleIds,
    skipped,
  };
}

export function getProcurementRequestDecisionErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const message =
    error instanceof Error && error.message.trim().length > 0
      ? error.message.trim()
      : null;
  if (!message) {
    return fallback;
  }

  return message;
}

function resolveRequestSummaryStatus(args: {
  departmentsById: ReadonlyMap<
    string,
    ProcurementCatalogRequestSummaryDepartmentLike
  >;
  request: ProcurementCatalogRequestSummaryRequestLike;
}): CatalogRequestStatus {
  const department = args.departmentsById.get(args.request.departmentId);

  return shouldExpireCatalogRequest({
    status: args.request.status,
    submissionEndsAt: department?.submissionEndsAt,
    submissionStartsAt: department?.submissionStartsAt,
  })
    ? "expired"
    : args.request.status;
}
