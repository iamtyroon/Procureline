import assert from "node:assert/strict";
import {
    AUDIT_EVENT_NAMES,
    AUDIT_OUTCOMES,
    buildSecurityInputRejectedEvent,
    createAuthenticatedAuditActor,
    serializeAuditEvent,
} from "../lib/security/audit";
import {
    DEVELOPMENT_SECURITY_AUDIT_PROXY_TOKEN,
    SecurityAuditProxyConfigurationError,
    resolveSecurityAuditProxyToken,
} from "../lib/security/bridge";
import {
    AUTH_INPUT_LIMITS,
    normalizeAuthEmail,
    normalizePlainText,
    validateEmailInput,
    validateOneTimeCodeInput,
    validateOrganizationNameInput,
    validatePasswordLength,
} from "../lib/security/input";
import {
    AllowedOriginsConfigurationError,
    DEVELOPMENT_ALLOWED_ORIGINS,
    evaluateOriginPolicy,
    resolveAllowedOrigins,
} from "../lib/security/origins";
import {
    PLAIN_TEXT_ONLY_FIELDS,
    SECURITY_HTTP_SURFACES,
    SECURITY_PROXY_AUDIT_ROUTE,
} from "../lib/security/policy";
import {
    forgotPasswordSchema,
    otpSchema,
    resetPasswordSchema,
    signupSchema,
} from "../lib/validators/auth";

export function runSecurityInfrastructureTests(): string[] {
    const completedTests: string[] = [];

    assert.equal(
        PLAIN_TEXT_ONLY_FIELDS.includes("tenant.organizationName"),
        true,
    );
    const proxySurface = SECURITY_HTTP_SURFACES.find(
        (surface) => surface.id === "next.proxy.app-routes",
    );
    const jwksSurface = SECURITY_HTTP_SURFACES.find(
        (surface) => surface.id === "convex.auth.jwks",
    );
    assert.ok(proxySurface);
    assert.ok(jwksSurface);
    assert.equal(proxySurface.originEnforced, true);
    assert.equal(jwksSurface.originEnforced, false);
    assert.equal(
        SECURITY_PROXY_AUDIT_ROUTE,
        "/api/internal/security-events/origin-blocked",
    );
    completedTests.push(
        "security scope metadata captures the in-scope proxy surface, public Convex metadata routes, and the internal audit bridge",
    );

    assert.equal(
        normalizeAuthEmail("  ADMIN@University.ac.ke "),
        "admin@university.ac.ke",
    );
    assert.equal(
        normalizePlainText("  University   of   Nairobi  "),
        "University of Nairobi",
    );
    completedTests.push(
        "shared input helpers normalize email casing and collapse plain-text whitespace deterministically",
    );

    const validEmailResult = validateEmailInput("  Admin@University.ac.ke ");
    if (!validEmailResult.ok) {
        assert.fail("Expected normalized email validation to succeed");
    }
    assert.equal(validEmailResult.value, "admin@university.ac.ke");

    const invalidEmailResult = validateEmailInput(
        "admin%3Cscript%3E@university.ac.ke",
    );
    if (invalidEmailResult.ok) {
        assert.fail("Expected encoded markup email validation to fail");
    }
    assert.equal(
        invalidEmailResult.issue.outcome,
        AUDIT_OUTCOMES.rejectedUnsafePlainText,
    );
    completedTests.push(
        "email validation normalizes valid values and rejects encoded markup payloads instead of silently mutating them",
    );

    const validOrganizationResult = validateOrganizationNameInput(
        "  University   of Nairobi  ",
    );
    if (!validOrganizationResult.ok) {
        assert.fail("Expected organization validation to succeed");
    }
    assert.equal(validOrganizationResult.value.normalized, "University of Nairobi");
    assert.equal(validOrganizationResult.value.subdomain, "university-of-nairobi");

    const invalidOrganizationResult = validateOrganizationNameInput(
        "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
    if (invalidOrganizationResult.ok) {
        assert.fail("Expected organization markup validation to fail");
    }
    assert.equal(
        invalidOrganizationResult.issue.outcome,
        AUDIT_OUTCOMES.rejectedUnsafePlainText,
    );

    const oversizedOrganizationResult = validateOrganizationNameInput(
        "A".repeat(AUTH_INPUT_LIMITS.organizationName + 1),
    );
    assert.equal(oversizedOrganizationResult.ok, false);
    completedTests.push(
        "plain-text organization validation normalizes safe values and rejects unsafe or oversized input with deterministic failures",
    );

    const verificationCodeResult = validateOneTimeCodeInput("12345678", {
        field: "code",
        label: "Verification code",
    });
    assert.equal(verificationCodeResult.ok, true);
    assert.equal(
        validateOneTimeCodeInput("12<script>", {
            field: "code",
            label: "Reset code",
        }).ok,
        false,
    );
    assert.equal(
        validatePasswordLength("A".repeat(AUTH_INPUT_LIMITS.password + 1)).ok,
        false,
    );
    completedTests.push(
        "shared code and password guards reject malformed verification codes and oversized password inputs",
    );

    assert.equal(
        signupSchema.safeParse({
            email: "admin@university.ac.ke",
            organizationName: "University of Nairobi",
            password: "StrongPass#2026",
        }).success,
        true,
    );
    assert.equal(
        signupSchema.safeParse({
            email: "admin@university.ac.ke",
            organizationName: "<script>alert(1)</script>",
            password: "StrongPass#2026",
        }).success,
        false,
    );
    assert.equal(
        forgotPasswordSchema.safeParse({
            email: "admin%3Cscript%3E@university.ac.ke",
        }).success,
        false,
    );
    assert.equal(otpSchema.safeParse({ code: "12345678" }).success, true);
    assert.equal(otpSchema.safeParse({ code: "12ab5678" }).success, false);
    assert.equal(
        resetPasswordSchema.safeParse({
            email: "admin@university.ac.ke",
            code: "12345678",
            newPassword: "StrongPass#2026",
        }).success,
        true,
    );
    completedTests.push(
        "auth form schemas reuse the shared security validators for email, code, organization name, and password bounds",
    );

    const developmentOrigins = resolveAllowedOrigins({
        allowedOrigins: undefined,
        nodeEnv: "development",
    });
    assert.deepEqual(developmentOrigins.origins, [...DEVELOPMENT_ALLOWED_ORIGINS]);

    const configuredOrigins = resolveAllowedOrigins({
        allowedOrigins:
            " https://app.procureline.example , https://staging.procureline.example , https://app.procureline.example ",
        nodeEnv: "production",
    });
    assert.deepEqual(configuredOrigins.origins, [
        "https://app.procureline.example",
        "https://staging.procureline.example",
    ]);

    assert.throws(
        () =>
            resolveAllowedOrigins({
                allowedOrigins: undefined,
                nodeEnv: "production",
            }),
        AllowedOriginsConfigurationError,
    );
    completedTests.push(
        "origin configuration uses development defaults locally and fails closed when production lacks an allowlist",
    );

    assert.equal(
        resolveSecurityAuditProxyToken({
            nodeEnv: "development",
            token: undefined,
        }),
        DEVELOPMENT_SECURITY_AUDIT_PROXY_TOKEN,
    );
    assert.equal(
        resolveSecurityAuditProxyToken({
            nodeEnv: "production",
            token: "secure-proxy-token",
        }),
        "secure-proxy-token",
    );
    assert.throws(
        () =>
            resolveSecurityAuditProxyToken({
                nodeEnv: "production",
                token: undefined,
            }),
        SecurityAuditProxyConfigurationError,
    );
    completedTests.push(
        "blocked-origin audit forwarding uses a required server token outside development and a deterministic local default in development",
    );

    const sameOriginDecision = evaluateOriginPolicy({
        allowedOrigins: configuredOrigins.origins,
        method: "POST",
        originHeader: "https://app.procureline.example",
        path: "/dashboard",
        requestOrigin: "https://app.procureline.example",
    });
    assert.equal(sameOriginDecision.allowed, true);
    assert.equal(sameOriginDecision.reason, "allowed_same_origin");

    const allowlistedOriginDecision = evaluateOriginPolicy({
        allowedOrigins: configuredOrigins.origins,
        method: "POST",
        originHeader: "https://staging.procureline.example",
        path: "/api/auth/session",
        requestOrigin: "https://app.procureline.example",
    });
    assert.equal(allowlistedOriginDecision.allowed, true);
    assert.equal(
        allowlistedOriginDecision.reason,
        "allowed_allowlisted_origin",
    );

    const allowlistedNoOriginDecision = evaluateOriginPolicy({
        allowedOrigins: configuredOrigins.origins,
        method: "POST",
        originHeader: null,
        path: "/api/auth/session",
        requestOrigin: "https://staging.procureline.example",
    });
    assert.equal(allowlistedNoOriginDecision.allowed, true);
    assert.equal(
        allowlistedNoOriginDecision.reason,
        "allowed_missing_origin_allowlisted_request",
    );

    const safeNoOriginDecision = evaluateOriginPolicy({
        allowedOrigins: configuredOrigins.origins,
        method: "GET",
        originHeader: null,
        path: "/login",
        requestOrigin: "https://app.procureline.example",
    });
    assert.equal(safeNoOriginDecision.allowed, true);
    assert.equal(
        safeNoOriginDecision.reason,
        "allowed_missing_origin_allowlisted_request",
    );

    const trustedMissingOriginDecision = evaluateOriginPolicy({
        allowedOrigins: configuredOrigins.origins,
        method: "POST",
        originHeader: null,
        path: "/tenant-admin",
        requestOrigin: "https://app.procureline.example",
    });
    assert.equal(trustedMissingOriginDecision.allowed, true);
    assert.equal(
        trustedMissingOriginDecision.reason,
        "allowed_missing_origin_allowlisted_request",
    );

    const blockedMissingOriginDecision = evaluateOriginPolicy({
        allowedOrigins: configuredOrigins.origins,
        method: "POST",
        originHeader: null,
        path: "/tenant-admin",
        requestOrigin: "https://evil.example",
    });
    assert.equal(blockedMissingOriginDecision.allowed, false);
    const blockedMissingOriginAuditEvent =
        blockedMissingOriginDecision.auditEvent;
    if (!blockedMissingOriginAuditEvent) {
        assert.fail("Expected a blocked missing-origin audit event");
    }
    assert.equal(
        blockedMissingOriginAuditEvent.outcome,
        AUDIT_OUTCOMES.blockedMissingOrigin,
    );
    assert.equal(
        blockedMissingOriginAuditEvent.actor.state,
        "anonymous",
    );

    const blockedOriginDecision = evaluateOriginPolicy({
        allowedOrigins: configuredOrigins.origins,
        method: "POST",
        originHeader: "https://evil.example",
        path: "/api/internal/security-events/origin-blocked",
        requestOrigin: "https://app.procureline.example",
    });
    assert.equal(blockedOriginDecision.allowed, false);
    const blockedOriginAuditEvent = blockedOriginDecision.auditEvent;
    if (!blockedOriginAuditEvent) {
        assert.fail("Expected a blocked-origin audit event");
    }
    assert.equal(
        blockedOriginAuditEvent.event,
        AUDIT_EVENT_NAMES.securityOriginBlocked,
    );
    completedTests.push(
        "origin policy allows same-origin or allowlisted requests, permits safe no-Origin reads, and produces anonymous audit entries for blocked requests",
    );

    const serializedAuditEvent = serializeAuditEvent(
        buildSecurityInputRejectedEvent({
            actor: createAuthenticatedAuditActor({
                role: "unassigned",
                userId: "user-123",
            }),
            field: "organizationName",
            flow: "registerWithTenant",
            outcome: AUDIT_OUTCOMES.rejectedUnsafePlainText,
            path: "functions.users.registerWithTenant",
            reason: "encoded_or_markup_like_content",
        }),
    );
    assert.equal(
        serializedAuditEvent.event,
        AUDIT_EVENT_NAMES.securityInputRejected,
    );
    assert.equal(serializedAuditEvent.actorState, "authenticated");
    assert.equal(serializedAuditEvent.actorRole, "unassigned");
    assert.equal(serializedAuditEvent.actorUserId, "user-123");
    completedTests.push(
        "security audit serialization preserves stable event names plus authenticated and anonymous actor shapes",
    );

    return completedTests;
}
