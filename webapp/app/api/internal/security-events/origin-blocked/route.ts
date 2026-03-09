import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
    DEVELOPMENT_SECURITY_AUDIT_PROXY_TOKEN,
    resolveSecurityAuditProxyToken,
} from "@/lib/security/bridge";

export const runtime = "nodejs";

interface OriginBlockedRequestBody {
    allowedOrigins?: string[];
    method?: string;
    origin?: string;
    path?: string;
    requestOrigin?: string;
}

function getConvexHttpClient(): ConvexHttpClient {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
        throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
    }

    return new ConvexHttpClient(convexUrl);
}

export async function POST(request: Request): Promise<NextResponse> {
    const proxyAuditToken = request.headers.get("x-security-audit-token");
    if (
        !proxyAuditToken ||
        proxyAuditToken !== resolveSecurityAuditProxyToken()
    ) {
        return NextResponse.json(
            { logged: false, reason: "unauthorized" },
            { status: 401 },
        );
    }

    const requestUrl = new URL(request.url);
    if (
        proxyAuditToken === DEVELOPMENT_SECURITY_AUDIT_PROXY_TOKEN &&
        !["localhost", "127.0.0.1"].includes(requestUrl.hostname)
    ) {
        return NextResponse.json(
            { logged: false, reason: "forbidden" },
            { status: 403 },
        );
    }

    const body = (await request.json()) as OriginBlockedRequestBody;
    if (
        !body.path ||
        !body.method ||
        !Array.isArray(body.allowedOrigins)
    ) {
        return NextResponse.json(
            { logged: false, reason: "invalid_payload" },
            { status: 400 },
        );
    }

    await getConvexHttpClient().action(
        api.functions.securityAudit.logBlockedOriginFromProxy,
        {
            allowedOrigins: body.allowedOrigins,
            method: body.method,
            origin: body.origin,
            path: body.path,
            proxyAuditToken,
            requestOrigin: body.requestOrigin,
        },
    );

    return NextResponse.json({ logged: true }, { status: 202 });
}
