import { headers } from "next/headers";
import type { DepartmentUserRequestContext } from "./department-user-request-context-token";
import { createSignedDepartmentUserRequestContextToken } from "./department-user-request-context-token";

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

export async function readDepartmentUserRequestContext(): Promise<DepartmentUserRequestContext> {
    const requestHeaders = await headers();

    return {
        city: readHeaderValue(requestHeaders.get("x-vercel-ip-city")),
        country: readHeaderValue(requestHeaders.get("x-vercel-ip-country")),
        ipAddress:
            readForwardedIp(requestHeaders.get("x-forwarded-for")) ??
            readHeaderValue(requestHeaders.get("x-real-ip")),
        isPIIAllowed: true,
        region: readHeaderValue(
            requestHeaders.get("x-vercel-ip-country-region"),
        ),
        userAgent: readHeaderValue(requestHeaders.get("user-agent")),
    };
}

export async function readSignedDepartmentUserRequestContext(): Promise<string> {
    const requestContext = await readDepartmentUserRequestContext();
    return await createSignedDepartmentUserRequestContextToken({
        context: requestContext,
    });
}
