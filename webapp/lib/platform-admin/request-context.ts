import { headers } from "next/headers";
import type { PlatformAdminRequestContext } from "./risk";
import { createSignedPlatformAdminRequestContextToken } from "./request-context-token";

function readHeaderValue(
    headerValue: string | null | undefined,
): string | null {
    const normalizedValue = headerValue?.trim();
    return normalizedValue ? normalizedValue : null;
}

function readForwardedIp(
    headerValue: string | null | undefined,
): string | null {
    const firstHop = headerValue?.split(",")[0]?.trim();
    return firstHop ? firstHop : null;
}

export async function readPlatformAdminRequestContext(): Promise<PlatformAdminRequestContext> {
    const requestHeaders = await headers();

    return {
        city: readHeaderValue(requestHeaders.get("x-vercel-ip-city")),
        country: readHeaderValue(requestHeaders.get("x-vercel-ip-country")),
        ipAddress:
            readForwardedIp(requestHeaders.get("x-forwarded-for")) ??
            readHeaderValue(requestHeaders.get("x-real-ip")),
        region: readHeaderValue(
            requestHeaders.get("x-vercel-ip-country-region"),
        ),
        userAgent: readHeaderValue(requestHeaders.get("user-agent")),
    };
}

export async function readSignedPlatformAdminRequestContext(): Promise<string> {
    const requestContext = await readPlatformAdminRequestContext();
    return await createSignedPlatformAdminRequestContextToken({
        context: requestContext,
    });
}
