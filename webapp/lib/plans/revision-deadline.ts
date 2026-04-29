const DAY_MS = 24 * 60 * 60 * 1000;

export interface DepartmentUserEffectiveRevisionDeadlineArgs {
    decisionType: "approved" | "rejected" | "revision_requested";
    decidedAt: number;
    revisionDeadlineAt?: number | null;
    submissionDeadlineAt?: number | null;
}

export interface DepartmentUserEffectiveRevisionDeadlineResult {
    automaticExtensionDeadlineAt: number | null;
    effectiveDeadlineAt: number | null;
    extensionApplied: boolean;
    precedence:
        | "automatic_extension"
        | "explicit_deadline"
        | "later_deadline"
        | "none";
}

export function deriveDepartmentUserEffectiveRevisionDeadline(
    args: DepartmentUserEffectiveRevisionDeadlineArgs,
): DepartmentUserEffectiveRevisionDeadlineResult {
    if (
        args.decisionType !== "rejected" &&
        args.decisionType !== "revision_requested"
    ) {
        return {
            automaticExtensionDeadlineAt: null,
            effectiveDeadlineAt: null,
            extensionApplied: false,
            precedence: "none",
        };
    }

    const automaticExtensionDeadlineAt =
        typeof args.submissionDeadlineAt === "number" &&
        args.submissionDeadlineAt - args.decidedAt <= DAY_MS &&
        args.submissionDeadlineAt >= args.decidedAt
            ? args.decidedAt + 2 * DAY_MS
            : null;

    const explicitDeadlineAt =
        typeof args.revisionDeadlineAt === "number"
            ? args.revisionDeadlineAt
            : null;

    if (
        typeof explicitDeadlineAt === "number" &&
        typeof automaticExtensionDeadlineAt === "number"
    ) {
        return {
            automaticExtensionDeadlineAt,
            effectiveDeadlineAt: Math.max(
                explicitDeadlineAt,
                automaticExtensionDeadlineAt,
            ),
            extensionApplied: automaticExtensionDeadlineAt > explicitDeadlineAt,
            precedence:
                explicitDeadlineAt === automaticExtensionDeadlineAt
                    ? "later_deadline"
                    : explicitDeadlineAt > automaticExtensionDeadlineAt
                      ? "explicit_deadline"
                      : "automatic_extension",
        };
    }

    if (typeof explicitDeadlineAt === "number") {
        return {
            automaticExtensionDeadlineAt,
            effectiveDeadlineAt: explicitDeadlineAt,
            extensionApplied: false,
            precedence: "explicit_deadline",
        };
    }

    if (typeof automaticExtensionDeadlineAt === "number") {
        return {
            automaticExtensionDeadlineAt,
            effectiveDeadlineAt: automaticExtensionDeadlineAt,
            extensionApplied: true,
            precedence: "automatic_extension",
        };
    }

    return {
        automaticExtensionDeadlineAt: null,
        effectiveDeadlineAt: null,
        extensionApplied: false,
        precedence: "none",
    };
}

export function hasDepartmentUserRevisionDeadlineExpired(args: {
    deadlineAt?: number | null;
    now: number;
}): boolean {
    return typeof args.deadlineAt === "number" && args.now > args.deadlineAt;
}
