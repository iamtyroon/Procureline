import assert from "node:assert/strict";
import {
    createSignedDepartmentUserRequestContextToken,
    verifySignedDepartmentUserRequestContextToken,
} from "../lib/backend/auth/department-user-request-context-token";
import {
    catalogCategoryRequestFormSchema,
    catalogItemRequestFormSchema,
    buildCatalogRequestStatusMeta,
    createCategoryRequestIdentityKeys,
    createItemRequestIdentityKeys,
    formatCatalogRequestDecisionReason,
    sanitizeCatalogRequestTextField,
    shouldAutoCancelLinkedCategoryRequest,
    shouldExpireCatalogRequest,
} from "../lib/procurement/catalog-requests";

export async function runDepartmentUserRequestContextTests(): Promise<string[]> {
    const completedTests: string[] = [];

    const token = await createSignedDepartmentUserRequestContextToken({
        context: {
            ipAddress: "203.0.113.42",
            userAgent: "Unit Test Browser",
        },
        now: 1_000,
        secret: "test-secret",
    });
    const verified = await verifySignedDepartmentUserRequestContextToken({
        now: 1_001,
        secret: "test-secret",
        token,
    });
    if (!verified.ok) {
        assert.fail("expected signed request context verification to succeed");
    }
    assert.equal(verified.value.ipAddress, "203.0.113.42");
    completedTests.push(
        "department-user request-context tokens round-trip trusted origin metadata when the signature is valid",
    );

    const expiredToken = await createSignedDepartmentUserRequestContextToken({
        context: {
            ipAddress: "203.0.113.42",
        },
        now: 1_000,
        secret: "test-secret",
    });
    const expired = await verifySignedDepartmentUserRequestContextToken({
        now: 1_000 + (1000 * 60 * 16),
        secret: "test-secret",
        token: expiredToken,
    });
    assert.deepEqual(expired, {
        ok: false,
        reason: "expired",
    });
    completedTests.push(
        "department-user request-context tokens degrade to an expired result instead of pretending stale browser-supplied origin data is still trusted",
    );

    assert.deepEqual(
        createCategoryRequestIdentityKeys({
            departmentId: "dept-cs",
            normalizedName: "ict equipment",
            requestorTenantUserId: "tenant-user-du",
            tenantId: "tenant-1",
        }),
        {
            requesterDuplicateKey:
                "tenant-1::dept-cs::tenant-user-du::category::ict equipment",
            sharedGroupingKey: "tenant-1::category::ict equipment",
        },
    );
    assert.deepEqual(
        createItemRequestIdentityKeys({
            categoryReferenceKey: "category::cat-it",
            departmentId: "dept-cs",
            normalizedName: "laptops",
            requestorTenantUserId: "tenant-user-du",
            tenantId: "tenant-1",
        }),
        {
            requesterDuplicateKey:
                "tenant-1::dept-cs::tenant-user-du::item::category::cat-it::laptops",
            sharedGroupingKey: "tenant-1::item::category::cat-it::laptops",
        },
    );
    completedTests.push(
        "catalog request identity keys stay stable for same-du duplicate blocking and later cross-du grouping without depending on browser state",
    );

    assert.deepEqual(buildCatalogRequestStatusMeta("pending"), {
        badgeTone: "pending",
        label: "Pending",
    });
    assert.deepEqual(buildCatalogRequestStatusMeta("approved"), {
        badgeTone: "approved",
        label: "Approved",
    });
    assert.equal(
        formatCatalogRequestDecisionReason({
            reason: "Archived with the end of the submission window.",
            status: "expired",
        }),
        "Expired: Archived with the end of the submission window.",
    );
    assert.equal(
        formatCatalogRequestDecisionReason({
            reason: "Duplicate live catalog record created instead.",
            status: "denied",
        }),
        "Denied: Duplicate live catalog record created instead.",
    );
    completedTests.push(
        "catalog request status helpers keep DU-facing badge labels and decision messaging deterministic across pending, denied, and expired states",
    );

    const itemHandoffParse = catalogItemRequestFormSchema.safeParse({
        categoryMode: "request",
        description: "Mobile charging cart for shared classroom devices",
        estimatedUnitPrice: "25000",
        justification: "Supports shared lesson delivery",
        name: "Charging cart",
    });
    assert.equal(itemHandoffParse.success, true);

    const missingExistingCategoryParse = catalogItemRequestFormSchema.safeParse({
        categoryMode: "existing",
        description: "Mobile charging cart for shared classroom devices",
        estimatedUnitPrice: "25000",
        justification: "Supports shared lesson delivery",
        name: "Charging cart",
    });
    if (missingExistingCategoryParse.success) {
        assert.fail("expected missing existing-category validation to fail");
    }
    assert.match(
        JSON.stringify(missingExistingCategoryParse.error.flatten().fieldErrors),
        /Choose an active category or switch to category request handoff/i,
    );

    const invalidCategoryDraftParse = catalogCategoryRequestFormSchema.safeParse({
        description: "  ",
        justification: "  ",
        name: "  ",
    });
    assert.equal(invalidCategoryDraftParse.success, false);
    completedTests.push(
        "catalog request form schemas allow item handoff mode while still enforcing existing-category selection and standalone category draft validation",
    );

    assert.equal(
        shouldExpireCatalogRequest({
            now: Date.UTC(2026, 6, 1, 8, 0, 1),
            status: "pending",
            submissionEndsAt: Date.UTC(2026, 6, 1, 8, 0, 0),
            submissionStartsAt: Date.UTC(2026, 5, 1, 8, 0, 0),
        }),
        true,
    );
    assert.equal(
        shouldExpireCatalogRequest({
            now: Date.UTC(2026, 6, 2, 8, 0, 0),
            status: "pending",
            submissionEndsAt: Date.UTC(2026, 6, 1, 8, 0, 0),
            submissionStartsAt: Date.UTC(2026, 5, 1, 8, 0, 0),
        }),
        true,
    );
    assert.equal(
        shouldExpireCatalogRequest({
            now: Date.UTC(2026, 5, 15, 8, 0, 0),
            status: "pending",
            submissionEndsAt: Date.UTC(2026, 6, 1, 8, 0, 0),
            submissionStartsAt: Date.UTC(2026, 5, 1, 8, 0, 0),
        }),
        false,
    );
    assert.equal(
        shouldExpireCatalogRequest({
            now: Date.UTC(2026, 6, 2, 8, 0, 0),
            status: "cancelled",
            submissionEndsAt: Date.UTC(2026, 6, 1, 8, 0, 0),
            submissionStartsAt: Date.UTC(2026, 5, 1, 8, 0, 0),
        }),
        false,
    );
    completedTests.push(
        "catalog request expiry checks only target still-pending requests once the department submission deadline itself has passed",
    );

    assert.equal(
        shouldAutoCancelLinkedCategoryRequest({
            hasOtherPendingLinks: false,
            requestOrigin: "item_handoff",
        }),
        true,
    );
    assert.equal(
        shouldAutoCancelLinkedCategoryRequest({
            hasOtherPendingLinks: true,
            requestOrigin: "item_handoff",
        }),
        false,
    );
    assert.equal(
        shouldAutoCancelLinkedCategoryRequest({
            hasOtherPendingLinks: false,
            requestOrigin: "standalone",
        }),
        false,
    );
    completedTests.push(
        "linked category auto-cancellation only applies to item-handoff-created requests after the final pending linked item is withdrawn",
    );

    assert.equal(
        sanitizeCatalogRequestTextField("  Multi   purpose   laptop   cart  ", {
            field: "itemName",
            label: "Item name",
            maxLength: 80,
            minLength: 2,
        }),
        "Multi purpose laptop cart",
    );
    assert.throws(
        () =>
            sanitizeCatalogRequestTextField("<script>alert(1)</script>", {
                field: "itemName",
                label: "Item name",
                maxLength: 80,
                minLength: 2,
            }),
        /must not contain markup or control characters/i,
    );
    completedTests.push(
        "catalog request text sanitization normalizes safe whitespace and rejects markup-like payloads before duplicate checks or persistence",
    );

    return completedTests;
}
