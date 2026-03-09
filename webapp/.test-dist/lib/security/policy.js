"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAIN_TEXT_ONLY_FIELDS = exports.SECURITY_OUT_OF_SCOPE_SURFACES = exports.SECURITY_HTTP_SURFACES = exports.SECURITY_PROXY_AUDIT_ROUTE = void 0;
exports.SECURITY_PROXY_AUDIT_ROUTE = "/api/internal/security-events/origin-blocked";
exports.SECURITY_HTTP_SURFACES = [
    {
        browserCallable: true,
        description: "Convex auth discovery metadata remains public and does not use origin allowlisting.",
        id: "convex.auth.openid-configuration",
        originEnforced: false,
        path: "/.well-known/openid-configuration",
        runtime: "convex-http",
    },
    {
        browserCallable: true,
        description: "Convex auth JWKS remains public and does not use origin allowlisting.",
        id: "convex.auth.jwks",
        originEnforced: false,
        path: "/.well-known/jwks.json",
        runtime: "convex-http",
    },
    {
        browserCallable: true,
        description: "Next.js proxy enforces the shared origin policy for app-owned requests that reach the edge layer.",
        id: "next.proxy.app-routes",
        originEnforced: true,
        pathPrefix: "/",
        runtime: "next-proxy",
    },
];
exports.SECURITY_OUT_OF_SCOPE_SURFACES = [
    "non-http Convex queries, mutations, and actions",
    "same-origin-only client component validation without a server request",
    "future webhook or rich-text routes that do not exist in the current codebase",
];
exports.PLAIN_TEXT_ONLY_FIELDS = [
    "signup.email",
    "login.email",
    "forgotPassword.email",
    "resetPassword.email",
    "resetPassword.code",
    "emailVerification.code",
    "tenant.organizationName",
];
