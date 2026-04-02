export type EmailTransportMode = "resend" | "dev_inbox";

export function resolveEmailTransportMode(
    configuredMode?: string | null,
): EmailTransportMode {
    const normalizedMode = configuredMode?.trim().toLowerCase();
    return normalizedMode === "dev_inbox" ? "dev_inbox" : "resend";
}

export function resolveConvexSiteUrl(
    primarySiteUrl?: string | null,
    fallbackSiteUrl?: string | null,
): string {
    const rawSiteUrl = primarySiteUrl ?? fallbackSiteUrl;
    if (typeof rawSiteUrl !== "string" || rawSiteUrl.trim().length === 0) {
        throw new Error(
            "CONVEX_SITE_URL or NEXT_PUBLIC_CONVEX_SITE_URL must be configured.",
        );
    }

    return rawSiteUrl.trim().replace(/\/+$/, "");
}

export function resolveDevInboxCaptureUrl(
    primarySiteUrl?: string | null,
    fallbackSiteUrl?: string | null,
): string {
    return `${resolveConvexSiteUrl(primarySiteUrl, fallbackSiteUrl)}/api/dev-email/capture`;
}
