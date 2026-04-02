import assert from "node:assert/strict";
import {
    resolveConvexSiteUrl,
    resolveDevInboxCaptureUrl,
    resolveEmailTransportMode,
} from "../lib/email/transport";

export function runEmailTransportTests(): string[] {
    const completedTests: string[] = [];

    assert.equal(resolveEmailTransportMode(undefined), "resend");
    assert.equal(resolveEmailTransportMode("resend"), "resend");
    assert.equal(resolveEmailTransportMode(" dev_inbox "), "dev_inbox");
    assert.equal(resolveEmailTransportMode("DEV_INBOX"), "dev_inbox");
    completedTests.push(
        "email transport mode resolution defaults safely to resend and only enables the dev inbox when explicitly requested",
    );

    assert.equal(
        resolveConvexSiteUrl("https://example.convex.site/", undefined),
        "https://example.convex.site",
    );
    assert.equal(
        resolveDevInboxCaptureUrl(undefined, "https://fallback.convex.site/"),
        "https://fallback.convex.site/api/dev-email/capture",
    );
    assert.throws(
        () => resolveConvexSiteUrl(undefined, undefined),
        /CONVEX_SITE_URL or NEXT_PUBLIC_CONVEX_SITE_URL must be configured/,
    );
    completedTests.push(
        "dev inbox capture URLs normalize Convex site URLs and fail clearly when no site URL is configured",
    );

    return completedTests;
}
