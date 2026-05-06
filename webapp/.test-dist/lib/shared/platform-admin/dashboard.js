"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatformAdminRevenuePresentation = exports.humanizePlatformAdminToken = exports.isPlatformHealthSnapshotStale = exports.filterPlatformAdminAlertsBySeverity = exports.movePlatformAdminWidget = exports.getVisiblePlatformAdminWidgetOrder = exports.normalizePlatformAdminDashboardPreferences = exports.getPlatformAdminTimestampPresentation = exports.getPlatformAdminUtcTimestampLabel = exports.getPlatformAdminLocalTimestampLabel = exports.DEFAULT_PLATFORM_ADMIN_DASHBOARD_PREFERENCES = exports.PLATFORM_ADMIN_HEALTH_STALE_AFTER_MS = exports.PLATFORM_ADMIN_WIDGET_IDS = void 0;
const pricing_1 = require("../marketing/pricing");
exports.PLATFORM_ADMIN_WIDGET_IDS = [
    "recent_tenants",
    "system_health",
    "recent_alerts",
];
exports.PLATFORM_ADMIN_HEALTH_STALE_AFTER_MS = 15 * 60 * 1000;
exports.DEFAULT_PLATFORM_ADMIN_DASHBOARD_PREFERENCES = {
    alertSeverityFilter: "all",
    hiddenWidgetIds: [],
    sidebarCollapsed: false,
    widgetOrder: [...exports.PLATFORM_ADMIN_WIDGET_IDS],
};
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isWidgetId(value) {
    return exports.PLATFORM_ADMIN_WIDGET_IDS.some((widgetId) => widgetId === value);
}
function isSeverityFilter(value) {
    return value === "all" || value === "warning" || value === "critical";
}
function hasUniqueWidgets(values) {
    return new Set(values).size === values.length;
}
function createValidatedTimestampDate(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        throw new TypeError(`Invalid timestamp: ${String(timestamp)}`);
    }
    return date;
}
function formatInTimeZone(args) {
    const timestampDate = createValidatedTimestampDate(args.timestamp);
    const options = {
        day: "2-digit",
        hour: "2-digit",
        hour12: false,
        minute: "2-digit",
        month: "short",
        timeZoneName: "short",
        year: "numeric",
    };
    if (args.timeZone) {
        options.timeZone = args.timeZone;
    }
    return new Intl.DateTimeFormat(args.locale ?? "en-GB", options).format(timestampDate);
}
function getPlatformAdminLocalTimestampLabel(args) {
    return formatInTimeZone({
        locale: args.localLocale ?? "en-US",
        timeZone: args.localTimeZone,
        timestamp: args.timestamp,
    });
}
exports.getPlatformAdminLocalTimestampLabel = getPlatformAdminLocalTimestampLabel;
function getPlatformAdminUtcTimestampLabel(timestamp) {
    return formatInTimeZone({
        locale: "en-GB",
        timeZone: "UTC",
        timestamp,
    });
}
exports.getPlatformAdminUtcTimestampLabel = getPlatformAdminUtcTimestampLabel;
function getPlatformAdminTimestampPresentation(args) {
    const timestampDate = createValidatedTimestampDate(args.timestamp);
    return {
        iso: timestampDate.toISOString(),
        localLabel: getPlatformAdminLocalTimestampLabel(args),
        utcLabel: getPlatformAdminUtcTimestampLabel(args.timestamp),
    };
}
exports.getPlatformAdminTimestampPresentation = getPlatformAdminTimestampPresentation;
function normalizePlatformAdminDashboardPreferences(input) {
    if (!isRecord(input)) {
        return { ...exports.DEFAULT_PLATFORM_ADMIN_DASHBOARD_PREFERENCES };
    }
    const sidebarCollapsed = typeof input.sidebarCollapsed === "boolean"
        ? input.sidebarCollapsed
        : exports.DEFAULT_PLATFORM_ADMIN_DASHBOARD_PREFERENCES.sidebarCollapsed;
    const alertSeverityFilter = isSeverityFilter(input.alertSeverityFilter)
        ? input.alertSeverityFilter
        : exports.DEFAULT_PLATFORM_ADMIN_DASHBOARD_PREFERENCES.alertSeverityFilter;
    const candidateOrder = Array.isArray(input.widgetOrder)
        ? input.widgetOrder.filter(isWidgetId)
        : [];
    const candidateHidden = Array.isArray(input.hiddenWidgetIds)
        ? input.hiddenWidgetIds.filter(isWidgetId)
        : [];
    const orderIsValid = candidateOrder.length === exports.PLATFORM_ADMIN_WIDGET_IDS.length &&
        hasUniqueWidgets(candidateOrder);
    const hiddenAreValid = hasUniqueWidgets(candidateHidden);
    if (!orderIsValid || !hiddenAreValid) {
        return { ...exports.DEFAULT_PLATFORM_ADMIN_DASHBOARD_PREFERENCES };
    }
    if (candidateHidden.length >= exports.PLATFORM_ADMIN_WIDGET_IDS.length) {
        return { ...exports.DEFAULT_PLATFORM_ADMIN_DASHBOARD_PREFERENCES };
    }
    return {
        alertSeverityFilter,
        hiddenWidgetIds: [...candidateHidden],
        sidebarCollapsed,
        widgetOrder: [...candidateOrder],
    };
}
exports.normalizePlatformAdminDashboardPreferences = normalizePlatformAdminDashboardPreferences;
function getVisiblePlatformAdminWidgetOrder(preferences) {
    const hidden = new Set(preferences.hiddenWidgetIds);
    return preferences.widgetOrder.filter((widgetId) => !hidden.has(widgetId));
}
exports.getVisiblePlatformAdminWidgetOrder = getVisiblePlatformAdminWidgetOrder;
function movePlatformAdminWidget(args) {
    const order = [...args.widgetOrder];
    const currentIndex = order.indexOf(args.widgetId);
    if (currentIndex < 0) {
        return order;
    }
    const targetIndex = args.direction === "backward" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= order.length) {
        return order;
    }
    const [widget] = order.splice(currentIndex, 1);
    if (!widget) {
        return order;
    }
    order.splice(targetIndex, 0, widget);
    return order;
}
exports.movePlatformAdminWidget = movePlatformAdminWidget;
function filterPlatformAdminAlertsBySeverity(alerts, filter) {
    if (filter === "all") {
        return [...alerts];
    }
    if (filter === "critical") {
        return alerts.filter((alert) => alert.severity === "critical");
    }
    return alerts.filter((alert) => alert.severity === "critical" || alert.severity === "warning");
}
exports.filterPlatformAdminAlertsBySeverity = filterPlatformAdminAlertsBySeverity;
function isPlatformHealthSnapshotStale(args) {
    return (args.now - args.capturedAt >
        (args.staleAfterMs ?? exports.PLATFORM_ADMIN_HEALTH_STALE_AFTER_MS));
}
exports.isPlatformHealthSnapshotStale = isPlatformHealthSnapshotStale;
function humanizePlatformAdminToken(value) {
    return value
        .replaceAll(/[._-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (character) => character.toUpperCase());
}
exports.humanizePlatformAdminToken = humanizePlatformAdminToken;
function getPlatformAdminRevenuePresentation(annualUsdAmount) {
    const amountPresentation = (0, pricing_1.getPricingAmountPresentation)({
        currency: "usd",
        priceUSD: annualUsdAmount,
    });
    return {
        annualLabel: amountPresentation.annualAmount,
        monthlyLabel: amountPresentation.monthlyEquivalent,
    };
}
exports.getPlatformAdminRevenuePresentation = getPlatformAdminRevenuePresentation;
