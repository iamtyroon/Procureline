"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDepartmentUserRequestContextTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const department_user_request_context_token_1 = require("../lib/auth/department-user-request-context-token");
async function runDepartmentUserRequestContextTests() {
    const completedTests = [];
    const token = await (0, department_user_request_context_token_1.createSignedDepartmentUserRequestContextToken)({
        context: {
            ipAddress: "203.0.113.42",
            userAgent: "Unit Test Browser",
        },
        now: 1_000,
        secret: "test-secret",
    });
    const verified = await (0, department_user_request_context_token_1.verifySignedDepartmentUserRequestContextToken)({
        now: 1_001,
        secret: "test-secret",
        token,
    });
    if (!verified.ok) {
        strict_1.default.fail("expected signed request context verification to succeed");
    }
    strict_1.default.equal(verified.value.ipAddress, "203.0.113.42");
    completedTests.push("department-user request-context tokens round-trip trusted origin metadata when the signature is valid");
    const expiredToken = await (0, department_user_request_context_token_1.createSignedDepartmentUserRequestContextToken)({
        context: {
            ipAddress: "203.0.113.42",
        },
        now: 1_000,
        secret: "test-secret",
    });
    const expired = await (0, department_user_request_context_token_1.verifySignedDepartmentUserRequestContextToken)({
        now: 1_000 + (1000 * 60 * 16),
        secret: "test-secret",
        token: expiredToken,
    });
    strict_1.default.deepEqual(expired, {
        ok: false,
        reason: "expired",
    });
    completedTests.push("department-user request-context tokens degrade to an expired result instead of pretending stale browser-supplied origin data is still trusted");
    return completedTests;
}
exports.runDepartmentUserRequestContextTests = runDepartmentUserRequestContextTests;
