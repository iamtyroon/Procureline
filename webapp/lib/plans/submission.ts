export type PlanWorkflowStatus =
    | "approved"
    | "draft"
    | "rejected"
    | "submitted";

export type PlanSubmissionEmailStatus = "failed" | "queued";
export type PlanSubmissionLifecycleStatus = "active" | "withdrawn";

export interface PlanSubmissionPersistenceCategorySummary {
    amount: number;
    categoryId: string;
    categoryName: string;
    itemCount: number;
}

export interface PlanSubmissionPersistenceRecord {
    categorySummaries: PlanSubmissionPersistenceCategorySummary[];
    estimatedBudgetUsed: number;
    itemCount: number;
    selectedCategoryIds: string[];
}

export interface PlanSubmissionSnapshotLike {
    capturedAt: number;
    lifecycleStatus?: PlanSubmissionLifecycleStatus | null;
    submissionSequence?: number | null;
    submittedAt: number | null;
}

export function normalizePlanSubmissionLifecycleStatus(
    value: PlanSubmissionLifecycleStatus | null | undefined,
): PlanSubmissionLifecycleStatus {
    return value === "withdrawn" ? "withdrawn" : "active";
}

export function compactFiscalYearForSubmissionReference(
    fiscalYear: string,
): string {
    const match = /^(\d{4})-(\d{4})$/.exec(fiscalYear.trim());
    if (!match) {
        return fiscalYear.replace(/\s+/gu, "").toUpperCase();
    }

    const startYear = match[1] ?? "";
    const endYear = match[2] ?? "";
    return `${startYear.slice(-2)}${endYear.slice(-2)}`;
}

export function formatPlanSubmissionReference(args: {
    departmentCode: string;
    fiscalYear: string;
    submissionSequence: number;
}): string {
    const normalizedDepartmentCode = args.departmentCode
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/gu, "-")
        .replace(/^-+|-+$/gu, "") || "DEPT";
    const normalizedSequence = Math.max(
        1,
        Math.trunc(Number.isFinite(args.submissionSequence) ? args.submissionSequence : 1),
    );

    return `${normalizedDepartmentCode}-${compactFiscalYearForSubmissionReference(args.fiscalYear)}-${String(normalizedSequence).padStart(3, "0")}`;
}

export function getNextPlanSubmissionSequence(
    snapshots: readonly Pick<PlanSubmissionSnapshotLike, "submissionSequence">[],
): number {
    const highestKnownSequence = snapshots.reduce((highest, snapshot) => {
        const nextSequence = snapshot.submissionSequence ?? 0;
        return nextSequence > highest ? nextSequence : highest;
    }, 0);

    return highestKnownSequence + 1;
}

export function buildPlanSubmissionSequenceKey(args: {
    planId: string;
    submissionSequence?: number | null;
    submittedAt: number | null;
    tenantId: string;
}): string {
    if (typeof args.submissionSequence === "number" && args.submissionSequence > 0) {
        return `${args.tenantId}:${args.planId}:sequence:${args.submissionSequence}`;
    }

    return `${args.tenantId}:${args.planId}:submitted-at:${args.submittedAt ?? "no-submission"}`;
}

export function resolveLatestActivePlanSubmissionSnapshot<TSnapshot extends PlanSubmissionSnapshotLike>(
    snapshots: readonly TSnapshot[],
): TSnapshot | null {
    const activeSnapshots = snapshots.filter(
        (snapshot) => normalizePlanSubmissionLifecycleStatus(snapshot.lifecycleStatus) === "active",
    );
    if (activeSnapshots.length === 0) {
        return null;
    }

    return [...activeSnapshots].sort((left, right) => {
        const leftSequence = left.submissionSequence ?? 0;
        const rightSequence = right.submissionSequence ?? 0;
        if (leftSequence !== rightSequence) {
            return rightSequence - leftSequence;
        }

        const leftSubmittedAt = left.submittedAt ?? 0;
        const rightSubmittedAt = right.submittedAt ?? 0;
        if (leftSubmittedAt !== rightSubmittedAt) {
            return rightSubmittedAt - leftSubmittedAt;
        }

        return right.capturedAt - left.capturedAt;
    })[0] ?? null;
}

export function selectPreviousActivePlanSubmissionSnapshot<TSnapshot extends PlanSubmissionSnapshotLike>(args: {
    currentSubmissionSequence?: number | null;
    currentSubmittedAt: number | null;
    snapshots: readonly TSnapshot[];
}): TSnapshot | null {
    const eligibleSnapshots = args.snapshots.filter((snapshot) => {
        if (normalizePlanSubmissionLifecycleStatus(snapshot.lifecycleStatus) !== "active") {
            return false;
        }

        if (
            typeof args.currentSubmissionSequence === "number" &&
            args.currentSubmissionSequence > 0 &&
            typeof snapshot.submissionSequence === "number" &&
            snapshot.submissionSequence > 0
        ) {
            return snapshot.submissionSequence < args.currentSubmissionSequence;
        }

        if (args.currentSubmittedAt === null || snapshot.submittedAt === null) {
            return false;
        }

        return snapshot.submittedAt < args.currentSubmittedAt;
    });

    if (eligibleSnapshots.length === 0) {
        return null;
    }

    return resolveLatestActivePlanSubmissionSnapshot(eligibleSnapshots);
}

export function buildPlanSubmissionEmailIdempotencyKey(args: {
    planId: string;
    submissionSequence: number;
}): string {
    return `plan-submission:${args.planId}:${args.submissionSequence}`;
}

export function buildPlanSubmissionPersistenceRecord(args: {
    categorySummaries: readonly PlanSubmissionPersistenceCategorySummary[];
    estimatedBudgetUsed: number;
    existingSelectedCategoryIds: readonly string[];
    itemCount: number;
}): PlanSubmissionPersistenceRecord {
    const categorySummaries = args.categorySummaries
        .map((summary) => ({
            amount: summary.amount,
            categoryId: summary.categoryId.trim(),
            categoryName: summary.categoryName,
            itemCount: summary.itemCount,
        }))
        .filter((summary) => summary.categoryId.length > 0);

    return {
        categorySummaries,
        estimatedBudgetUsed: Math.max(0, args.estimatedBudgetUsed),
        itemCount: Math.max(0, args.itemCount),
        selectedCategoryIds: Array.from(
            new Set([
                ...args.existingSelectedCategoryIds
                    .map((categoryId) => categoryId.trim())
                    .filter((categoryId) => categoryId.length > 0),
                ...categorySummaries.map((summary) => summary.categoryId),
            ]),
        ),
    };
}

export function shouldCaptureLegacyWithdrawnPlanSubmissionSnapshot(args: {
    activeSnapshotExists: boolean;
    planStatus: PlanWorkflowStatus;
    submissionReference?: string | null;
    submittedAt?: number | null;
}): boolean {
    return (
        !args.activeSnapshotExists &&
        args.planStatus === "submitted" &&
        (typeof args.submittedAt === "number" ||
            (args.submissionReference?.trim().length ?? 0) > 0)
    );
}
