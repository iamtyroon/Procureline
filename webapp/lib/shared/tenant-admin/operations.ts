export type TenantTier = "free" | "starter" | "professional" | "enterprise";

export interface ComplianceTargets {
    agpo: number;
    localContent: number;
    pwd: number;
}

export interface UsageMetric {
    current: number | null;
    key: string;
    label: string;
    limit: number | null;
    unavailableReason?: string;
}

export type UsageTone = "available" | "green" | "red" | "yellow";

export function normalizeAllowedEmailDomain(value: string): string | null {
    const normalized = value.trim().toLowerCase().replace(/^@/, "");
    if (
        normalized.length === 0 ||
        normalized.length > 253 ||
        !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(normalized) ||
        normalized.includes("..")
    ) {
        return null;
    }

    return normalized;
}

export function validateComplianceTargets(targets: ComplianceTargets): string[] {
    const errors: string[] = [];
    for (const [key, value] of Object.entries(targets)) {
        if (!Number.isFinite(value) || value < 0 || value > 100) {
            errors.push(`${key} must be between 0 and 100.`);
        }
    }

    if (targets.agpo + targets.pwd + targets.localContent > 100) {
        errors.push("Combined compliance targets cannot exceed 100%.");
    }

    return errors;
}

export function getUsageTone(metric: UsageMetric): UsageTone {
    if (metric.current === null || metric.limit === null || metric.limit <= 0) {
        return "available";
    }

    const percent = (metric.current / metric.limit) * 100;
    if (percent > 90) {
        return "red";
    }
    if (percent >= 70) {
        return "yellow";
    }
    return "green";
}

export function buildDowngradeBlockers(metrics: UsageMetric[]): string[] {
    return metrics
        .filter(
            (metric) =>
                metric.current !== null &&
                metric.limit !== null &&
                metric.current > metric.limit,
        )
        .map(
            (metric) =>
                `${metric.label}: ${metric.current as number} in use exceeds ${metric.limit as number} allowed.`,
        );
}

export function computeLockoutUntil(args: {
    failedAttempts: number;
    now: number;
}): number | null {
    if (args.failedAttempts >= 15) {
        return args.now + 24 * 60 * 60 * 1000;
    }
    if (args.failedAttempts >= 10) {
        return args.now + 60 * 60 * 1000;
    }
    if (args.failedAttempts >= 5) {
        return args.now + 15 * 60 * 1000;
    }
    return null;
}

export function resolveNotificationEmailMode(args: {
    isCritical: boolean;
    recentImmediateCount: number;
}): "immediate" | "digest" {
    if (args.isCritical) {
        return "immediate";
    }
    return args.recentImmediateCount >= 10 ? "digest" : "immediate";
}

export function formatFiscalYearBySetting(args: {
    customFormat?: string;
    format: "2025/2026" | "FY2025-26" | "custom";
    startYear: number;
}): string {
    const endYear = args.startYear + 1;
    if (args.format === "2025/2026") {
        return `${args.startYear}/${endYear}`;
    }
    if (args.format === "custom") {
        return (args.customFormat ?? "{start}-{end}")
            .replace("{start}", String(args.startYear))
            .replace("{end}", String(endYear))
            .replace("{endShort}", String(endYear).slice(-2));
    }
    return `FY${args.startYear}-${String(endYear).slice(-2)}`;
}
