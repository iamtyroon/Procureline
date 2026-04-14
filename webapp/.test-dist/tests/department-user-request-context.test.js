"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDepartmentUserRequestContextTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const department_user_request_context_token_1 = require("../lib/auth/department-user-request-context-token");
const catalog_requests_1 = require("../lib/procurement/catalog-requests");
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
    strict_1.default.deepEqual((0, catalog_requests_1.createCategoryRequestIdentityKeys)({
        departmentId: "dept-cs",
        normalizedName: "ict equipment",
        requestorTenantUserId: "tenant-user-du",
        tenantId: "tenant-1",
    }), {
        requesterDuplicateKey: "tenant-1::dept-cs::tenant-user-du::category::ict equipment",
        sharedGroupingKey: "tenant-1::category::ict equipment",
    });
    strict_1.default.deepEqual((0, catalog_requests_1.createItemRequestIdentityKeys)({
        categoryReferenceKey: "category::cat-it",
        departmentId: "dept-cs",
        normalizedName: "laptops",
        requestorTenantUserId: "tenant-user-du",
        tenantId: "tenant-1",
    }), {
        requesterDuplicateKey: "tenant-1::dept-cs::tenant-user-du::item::category::cat-it::laptops",
        sharedGroupingKey: "tenant-1::item::category::cat-it::laptops",
    });
    completedTests.push("catalog request identity keys stay stable for same-du duplicate blocking and later cross-du grouping without depending on browser state");
    strict_1.default.deepEqual((0, catalog_requests_1.buildCatalogRequestStatusMeta)("pending"), {
        badgeTone: "pending",
        label: "Pending",
    });
    strict_1.default.deepEqual((0, catalog_requests_1.buildCatalogRequestStatusMeta)("approved"), {
        badgeTone: "approved",
        label: "Approved",
    });
    strict_1.default.equal((0, catalog_requests_1.formatCatalogRequestDecisionReason)({
        reason: "Archived with the end of the submission window.",
        status: "expired",
    }), "Expired: Archived with the end of the submission window.");
    strict_1.default.equal((0, catalog_requests_1.formatCatalogRequestDecisionReason)({
        reason: "Duplicate live catalog record created instead.",
        status: "denied",
    }), "Denied: Duplicate live catalog record created instead.");
    completedTests.push("catalog request status helpers keep DU-facing badge labels and decision messaging deterministic across pending, denied, and expired states");
    const itemHandoffParse = catalog_requests_1.catalogItemRequestFormSchema.safeParse({
        categoryMode: "request",
        description: "Mobile charging cart for shared classroom devices",
        estimatedUnitPrice: "25000",
        justification: "Supports shared lesson delivery",
        name: "Charging cart",
    });
    strict_1.default.equal(itemHandoffParse.success, true);
    const missingExistingCategoryParse = catalog_requests_1.catalogItemRequestFormSchema.safeParse({
        categoryMode: "existing",
        description: "Mobile charging cart for shared classroom devices",
        estimatedUnitPrice: "25000",
        justification: "Supports shared lesson delivery",
        name: "Charging cart",
    });
    if (missingExistingCategoryParse.success) {
        strict_1.default.fail("expected missing existing-category validation to fail");
    }
    strict_1.default.match(JSON.stringify(missingExistingCategoryParse.error.flatten().fieldErrors), /Choose an active category or switch to category request handoff/i);
    const invalidCategoryDraftParse = catalog_requests_1.catalogCategoryRequestFormSchema.safeParse({
        description: "  ",
        justification: "  ",
        name: "  ",
    });
    strict_1.default.equal(invalidCategoryDraftParse.success, false);
    completedTests.push("catalog request form schemas allow item handoff mode while still enforcing existing-category selection and standalone category draft validation");
    strict_1.default.equal((0, catalog_requests_1.shouldExpireCatalogRequest)({
        now: Date.UTC(2026, 6, 1, 8, 0, 1),
        status: "pending",
        submissionEndsAt: Date.UTC(2026, 6, 1, 8, 0, 0),
        submissionStartsAt: Date.UTC(2026, 5, 1, 8, 0, 0),
    }), true);
    strict_1.default.equal((0, catalog_requests_1.shouldExpireCatalogRequest)({
        now: Date.UTC(2026, 6, 2, 8, 0, 0),
        status: "pending",
        submissionEndsAt: Date.UTC(2026, 6, 1, 8, 0, 0),
        submissionStartsAt: Date.UTC(2026, 5, 1, 8, 0, 0),
    }), true);
    strict_1.default.equal((0, catalog_requests_1.shouldExpireCatalogRequest)({
        now: Date.UTC(2026, 5, 15, 8, 0, 0),
        status: "pending",
        submissionEndsAt: Date.UTC(2026, 6, 1, 8, 0, 0),
        submissionStartsAt: Date.UTC(2026, 5, 1, 8, 0, 0),
    }), false);
    strict_1.default.equal((0, catalog_requests_1.shouldExpireCatalogRequest)({
        now: Date.UTC(2026, 6, 2, 8, 0, 0),
        status: "cancelled",
        submissionEndsAt: Date.UTC(2026, 6, 1, 8, 0, 0),
        submissionStartsAt: Date.UTC(2026, 5, 1, 8, 0, 0),
    }), false);
    completedTests.push("catalog request expiry checks only target still-pending requests once the department submission deadline itself has passed");
    strict_1.default.equal((0, catalog_requests_1.shouldAutoCancelLinkedCategoryRequest)({
        hasOtherPendingLinks: false,
        requestOrigin: "item_handoff",
    }), true);
    strict_1.default.equal((0, catalog_requests_1.shouldAutoCancelLinkedCategoryRequest)({
        hasOtherPendingLinks: true,
        requestOrigin: "item_handoff",
    }), false);
    strict_1.default.equal((0, catalog_requests_1.shouldAutoCancelLinkedCategoryRequest)({
        hasOtherPendingLinks: false,
        requestOrigin: "standalone",
    }), false);
    completedTests.push("linked category auto-cancellation only applies to item-handoff-created requests after the final pending linked item is withdrawn");
    strict_1.default.equal((0, catalog_requests_1.sanitizeCatalogRequestTextField)("  Multi   purpose   laptop   cart  ", {
        field: "itemName",
        label: "Item name",
        maxLength: 80,
        minLength: 2,
    }), "Multi purpose laptop cart");
    strict_1.default.throws(() => (0, catalog_requests_1.sanitizeCatalogRequestTextField)("<script>alert(1)</script>", {
        field: "itemName",
        label: "Item name",
        maxLength: 80,
        minLength: 2,
    }), /must not contain markup or control characters/i);
    completedTests.push("catalog request text sanitization normalizes safe whitespace and rejects markup-like payloads before duplicate checks or persistence");
    return completedTests;
}
exports.runDepartmentUserRequestContextTests = runDepartmentUserRequestContextTests;
