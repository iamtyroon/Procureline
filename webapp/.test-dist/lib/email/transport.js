"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDevInboxCaptureUrl = exports.resolveConvexSiteUrl = exports.resolveEmailTransportMode = void 0;
function resolveEmailTransportMode(configuredMode) {
    const normalizedMode = configuredMode?.trim().toLowerCase();
    return normalizedMode === "dev_inbox" ? "dev_inbox" : "resend";
}
exports.resolveEmailTransportMode = resolveEmailTransportMode;
function resolveConvexSiteUrl(primarySiteUrl, fallbackSiteUrl) {
    const rawSiteUrl = primarySiteUrl ?? fallbackSiteUrl;
    if (typeof rawSiteUrl !== "string" || rawSiteUrl.trim().length === 0) {
        throw new Error("CONVEX_SITE_URL or NEXT_PUBLIC_CONVEX_SITE_URL must be configured.");
    }
    return rawSiteUrl.trim().replace(/\/+$/, "");
}
exports.resolveConvexSiteUrl = resolveConvexSiteUrl;
function resolveDevInboxCaptureUrl(primarySiteUrl, fallbackSiteUrl) {
    return `${resolveConvexSiteUrl(primarySiteUrl, fallbackSiteUrl)}/api/dev-email/capture`;
}
exports.resolveDevInboxCaptureUrl = resolveDevInboxCaptureUrl;
