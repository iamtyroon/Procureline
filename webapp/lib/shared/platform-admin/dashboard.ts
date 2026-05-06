import { getPricingAmountPresentation } from "../marketing/pricing";

export const PLATFORM_ADMIN_WIDGET_IDS = [
    "recent_tenants",
    "system_health",
    "recent_alerts",
] as const;

export type PlatformAdminDashboardWidgetId =
    (typeof PLATFORM_ADMIN_WIDGET_IDS)[number];

export type PlatformAdminAlertSeverity = "critical" | "info" | "warning";
export type PlatformAdminAlertSeverityFilter = "all" | "critical" | "warning";

export type PlatformAdminSummaryState =
    | "available"
    | "awaiting_source"
    | "critical"
    | "empty"
    | "unavailable"
    | "warning";

export type PlatformAdminHealthServiceState =
    | "awaiting_source"
    | "critical"
    | "healthy"
    | "partial"
    | "stale"
    | "unavailable"
    | "warning";

export interface PlatformAdminDashboardPreferences {
    alertSeverityFilter: PlatformAdminAlertSeverityFilter;
    hiddenWidgetIds: PlatformAdminDashboardWidgetId[];
    sidebarCollapsed: boolean;
    widgetOrder: PlatformAdminDashboardWidgetId[];
}

export interface PlatformAdminTimestampPresentation {
    iso: string;
    localLabel: string;
    utcLabel: string;
}

export const PLATFORM_ADMIN_HEALTH_STALE_AFTER_MS = 15 * 60 * 1000;

export const DEFAULT_PLATFORM_ADMIN_DASHBOARD_PREFERENCES: PlatformAdminDashboardPreferences =
    {
        alertSeverityFilter: "all",
        hiddenWidgetIds: [],
        sidebarCollapsed: false,
        widgetOrder: [...PLATFORM_ADMIN_WIDGET_IDS],
    };

interface AlertLike {
    severity: PlatformAdminAlertSeverity;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWidgetId(value: unknown): value is PlatformAdminDashboardWidgetId {
    return PLATFORM_ADMIN_WIDGET_IDS.some((widgetId) => widgetId === value);
}

function isSeverityFilter(
    value: unknown,
): value is PlatformAdminAlertSeverityFilter {
    return value === "all" || value === "warning" || value === "critical";
}

function hasUniqueWidgets(
    values: readonly PlatformAdminDashboardWidgetId[],
): boolean {
    return new Set(values).size === values.length;
}

function createValidatedTimestampDate(timestamp: number): Date {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        throw new TypeError(`Invalid timestamp: ${String(timestamp)}`);
    }

    return date;
}

function formatInTimeZone(args: {
    locale?: string;
    timeZone?: string;
    timestamp: number;
}): string {
    const timestampDate = createValidatedTimestampDate(args.timestamp);
    const options: Intl.DateTimeFormatOptions = {
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

    return new Intl.DateTimeFormat(args.locale ?? "en-GB", options).format(
        timestampDate,
    );
}

export function getPlatformAdminLocalTimestampLabel(args: {
    localLocale?: string;
    localTimeZone?: string;
    timestamp: number;
}): string {
    return formatInTimeZone({
        locale: args.localLocale ?? "en-US",
        timeZone: args.localTimeZone,
        timestamp: args.timestamp,
    });
}

export function getPlatformAdminUtcTimestampLabel(timestamp: number): string {
    return formatInTimeZone({
        locale: "en-GB",
        timeZone: "UTC",
        timestamp,
    });
}

export function getPlatformAdminTimestampPresentation(args: {
    localLocale?: string;
    localTimeZone?: string;
    timestamp: number;
}): PlatformAdminTimestampPresentation {
    const timestampDate = createValidatedTimestampDate(args.timestamp);

    return {
        iso: timestampDate.toISOString(),
        localLabel: getPlatformAdminLocalTimestampLabel(args),
        utcLabel: getPlatformAdminUtcTimestampLabel(args.timestamp),
    };
}

export function normalizePlatformAdminDashboardPreferences(
    input: unknown,
): PlatformAdminDashboardPreferences {
    if (!isRecord(input)) {
        return { ...DEFAULT_PLATFORM_ADMIN_DASHBOARD_PREFERENCES };
    }

    const sidebarCollapsed =
        typeof input.sidebarCollapsed === "boolean"
            ? input.sidebarCollapsed
            : DEFAULT_PLATFORM_ADMIN_DASHBOARD_PREFERENCES.sidebarCollapsed;
    const alertSeverityFilter = isSeverityFilter(input.alertSeverityFilter)
        ? input.alertSeverityFilter
        : DEFAULT_PLATFORM_ADMIN_DASHBOARD_PREFERENCES.alertSeverityFilter;
    const candidateOrder = Array.isArray(input.widgetOrder)
        ? input.widgetOrder.filter(isWidgetId)
        : [];
    const candidateHidden = Array.isArray(input.hiddenWidgetIds)
        ? input.hiddenWidgetIds.filter(isWidgetId)
        : [];

    const orderIsValid =
        candidateOrder.length === PLATFORM_ADMIN_WIDGET_IDS.length &&
        hasUniqueWidgets(candidateOrder);
    const hiddenAreValid = hasUniqueWidgets(candidateHidden);

    if (!orderIsValid || !hiddenAreValid) {
        return { ...DEFAULT_PLATFORM_ADMIN_DASHBOARD_PREFERENCES };
    }

    if (candidateHidden.length >= PLATFORM_ADMIN_WIDGET_IDS.length) {
        return { ...DEFAULT_PLATFORM_ADMIN_DASHBOARD_PREFERENCES };
    }

    return {
        alertSeverityFilter,
        hiddenWidgetIds: [...candidateHidden],
        sidebarCollapsed,
        widgetOrder: [...candidateOrder],
    };
}

export function getVisiblePlatformAdminWidgetOrder(
    preferences: PlatformAdminDashboardPreferences,
): PlatformAdminDashboardWidgetId[] {
    const hidden = new Set(preferences.hiddenWidgetIds);

    return preferences.widgetOrder.filter((widgetId) => !hidden.has(widgetId));
}

export function movePlatformAdminWidget(args: {
    direction: "backward" | "forward";
    widgetId: PlatformAdminDashboardWidgetId;
    widgetOrder: readonly PlatformAdminDashboardWidgetId[];
}): PlatformAdminDashboardWidgetId[] {
    const order = [...args.widgetOrder];
    const currentIndex = order.indexOf(args.widgetId);

    if (currentIndex < 0) {
        return order;
    }

    const targetIndex =
        args.direction === "backward" ? currentIndex - 1 : currentIndex + 1;

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

export function filterPlatformAdminAlertsBySeverity<TAlert extends AlertLike>(
    alerts: readonly TAlert[],
    filter: PlatformAdminAlertSeverityFilter,
): TAlert[] {
    if (filter === "all") {
        return [...alerts];
    }

    if (filter === "critical") {
        return alerts.filter((alert) => alert.severity === "critical");
    }

    return alerts.filter(
        (alert) =>
            alert.severity === "critical" || alert.severity === "warning",
    );
}

export function isPlatformHealthSnapshotStale(args: {
    capturedAt: number;
    now: number;
    staleAfterMs?: number;
}): boolean {
    return (
        args.now - args.capturedAt >
        (args.staleAfterMs ?? PLATFORM_ADMIN_HEALTH_STALE_AFTER_MS)
    );
}

export function humanizePlatformAdminToken(value: string): string {
    return value
        .replaceAll(/[._-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getPlatformAdminRevenuePresentation(annualUsdAmount: number): {
    annualLabel: string;
    monthlyLabel: string;
} {
    const amountPresentation = getPricingAmountPresentation({
        currency: "usd",
        priceUSD: annualUsdAmount,
    });

    return {
        annualLabel: amountPresentation.annualAmount,
        monthlyLabel: amountPresentation.monthlyEquivalent,
    };
}
