import assert from "node:assert/strict";
import {
    buildProcurelineServiceHeaders,
    createProcurelineServiceToken,
    DEVELOPMENT_PROCURELINE_CONVEX_SYNC_SECRET,
    resolveProcurelineConvexSyncSecret,
} from "../lib/services/procureline-service-auth";
import { createNestServiceRequest } from "../lib/services/external-service-client";

function decodePayload(token: string): Record<string, unknown> {
    const [, payload] = token.split(".");
    return JSON.parse(Buffer.from(payload ?? "", "base64url").toString("utf8"));
}

export async function runServiceBridgeTests(): Promise<string[]> {
    const completed: string[] = [];

    const token = await createProcurelineServiceToken({
        issuedAtSeconds: 100,
        jti: "token-123",
        role: "tenant_admin",
        secret: "shared-secret",
        tenantId: "tenant_1",
        userId: "user_1",
    });
    const payload = decodePayload(token);
    assert.equal(payload.iss, "procureline.webapp");
    assert.equal(payload.aud, "procureline.nestjs");
    assert.equal(payload.sub, "user_1");
    assert.equal(payload.tenantId, "tenant_1");
    assert.equal(payload.role, "tenant_admin");
    assert.equal(payload.exp, 400);
    completed.push("service token claims follow the canonical Procureline contract");

    const headers = buildProcurelineServiceHeaders("signed-token");
    assert.equal(headers.Authorization, "Bearer signed-token");
    assert.equal(headers["Content-Type"], "application/json");
    completed.push("service request headers include bearer auth and json content type");

    process.env.NESTJS_URL = "http://localhost:4001/";
    const request = createNestServiceRequest({
        body: { hello: "world" },
        path: "/api/services/payments/subscriptions",
        token: "signed-token",
    });
    assert.equal(
        request.url,
        "http://localhost:4001/api/services/payments/subscriptions",
    );
    assert.equal(request.init.method, "POST");
    assert.equal(request.init.body, JSON.stringify({ hello: "world" }));
    completed.push("service request builder normalizes the NestJS base url");

    const developmentSecret = resolveProcurelineConvexSyncSecret({
        nodeEnv: "development",
        secret: undefined,
    });
    assert.equal(
        developmentSecret,
        DEVELOPMENT_PROCURELINE_CONVEX_SYNC_SECRET,
    );
    completed.push("development sync secret falls back to the documented local default");

    return completed;
}
