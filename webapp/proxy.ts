import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
} from "@convex-dev/auth/nextjs/server";
import { PUBLIC_ROUTES } from "@/lib/auth/public-routes";
import {
  PROTECTED_ROUTE_CACHE_HEADERS,
  PROTECTED_ROUTE_SECURITY_HEADERS,
  SESSION_EXPIRED_REDIRECT_PATH,
} from "@/lib/auth/proxy";
import {
  SecurityAuditProxyConfigurationError,
  resolveSecurityAuditProxyToken,
} from "@/lib/security/bridge";
import {
  AllowedOriginsConfigurationError,
  evaluateOriginPolicy,
  resolveAllowedOrigins,
} from "@/lib/security/origins";
import { SECURITY_PROXY_AUDIT_ROUTE } from "@/lib/security/policy";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([...PUBLIC_ROUTES]);

function applyProtectedHeaders(response: NextResponse): NextResponse {
  for (const [headerName, headerValue] of Object.entries(
    PROTECTED_ROUTE_CACHE_HEADERS,
  )) {
    response.headers.set(headerName, headerValue);
  }

  for (const [headerName, headerValue] of Object.entries(
    PROTECTED_ROUTE_SECURITY_HEADERS,
  )) {
    response.headers.set(headerName, headerValue);
  }

  return response;
}

async function reportBlockedOrigin(
  request: Request,
  allowedOrigins: string[],
  proxyAuditToken: string,
): Promise<void> {
  try {
    await fetch(new URL(SECURITY_PROXY_AUDIT_ROUTE, request.url), {
      body: JSON.stringify({
        allowedOrigins,
        method: request.method,
        origin: request.headers.get("origin") ?? undefined,
        path: new URL(request.url).pathname,
        requestOrigin: new URL(request.url).origin,
      }),
      headers: {
        "Content-Type": "application/json",
        "x-security-audit-token": proxyAuditToken,
      },
      method: "POST",
    });
  } catch {
    // Blocked requests still fail closed even if audit forwarding is unavailable.
  }
}

const proxy = convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    if (request.nextUrl.pathname === SECURITY_PROXY_AUDIT_ROUTE) {
      return;
    }

    let proxyAuditToken: string | null = null;
    try {
      proxyAuditToken = resolveSecurityAuditProxyToken();
    } catch (error) {
      if (error instanceof SecurityAuditProxyConfigurationError) {
        return applyProtectedHeaders(
          new NextResponse("Security audit bridge is not configured", {
            status: 500,
          }),
        );
      }

      throw error;
    }

    try {
      const allowedOrigins = resolveAllowedOrigins().origins;
      const originDecision = evaluateOriginPolicy({
        allowedOrigins,
        method: request.method,
        originHeader: request.headers.get("origin"),
        path: request.nextUrl.pathname,
        requestOrigin: request.nextUrl.origin,
      });

      if (!originDecision.allowed) {
        await reportBlockedOrigin(request, allowedOrigins, proxyAuditToken);
        return applyProtectedHeaders(
          new NextResponse("Origin not allowed", { status: 403 }),
        );
      }
    } catch (error) {
      if (error instanceof AllowedOriginsConfigurationError) {
        if (proxyAuditToken) {
          await reportBlockedOrigin(request, [], proxyAuditToken).catch(
            () => undefined,
          );
        }
        return applyProtectedHeaders(
          new NextResponse("Origin allowlist is not configured", {
            status: 500,
          }),
        );
      }

      throw error;
    }

    if (isPublicRoute(request)) {
      return;
    }

    if (!(await convexAuth.isAuthenticated())) {
      return applyProtectedHeaders(
        NextResponse.redirect(
          new URL(SESSION_EXPIRED_REDIRECT_PATH, request.url),
        ),
      );
    }

    return applyProtectedHeaders(NextResponse.next({
      request: {
        headers: request.headers,
      },
    }));
  },
);

export default proxy;
export { proxy };
export { isPublicRoute };

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
