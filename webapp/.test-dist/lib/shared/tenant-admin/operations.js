"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatFiscalYearBySetting = exports.resolveNotificationEmailMode = exports.computeLockoutUntil = exports.buildDowngradeBlockers = exports.getUsageTone = exports.validateComplianceTargets = exports.normalizeAllowedEmailDomain = void 0;
function normalizeAllowedEmailDomain(value) {
    const normalized = value.trim().toLowerCase().replace(/^@/, "");
    if (normalized.length === 0 ||
        normalized.length > 253 ||
        !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(normalized) ||
        normalized.includes("..")) {
        return null;
    }
    return normalized;
}
exports.normalizeAllowedEmailDomain = normalizeAllowedEmailDomain;
function validateComplianceTargets(targets) {
    const errors = [];
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
exports.validateComplianceTargets = validateComplianceTargets;
function getUsageTone(metric) {
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
exports.getUsageTone = getUsageTone;
function buildDowngradeBlockers(metrics) {
    return metrics
        .filter((metric) => metric.current !== null &&
        metric.limit !== null &&
        metric.current > metric.limit)
        .map((metric) => `${metric.label}: ${metric.current} in use exceeds ${metric.limit} allowed.`);
}
exports.buildDowngradeBlockers = buildDowngradeBlockers;
function computeLockoutUntil(args) {
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
exports.computeLockoutUntil = computeLockoutUntil;
function resolveNotificationEmailMode(args) {
    if (args.isCritical) {
        return "immediate";
    }
    return args.recentImmediateCount >= 10 ? "digest" : "immediate";
}
exports.resolveNotificationEmailMode = resolveNotificationEmailMode;
function formatFiscalYearBySetting(args) {
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
exports.formatFiscalYearBySetting = formatFiscalYearBySetting;
