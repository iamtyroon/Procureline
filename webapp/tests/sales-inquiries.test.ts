import assert from "node:assert/strict";
import {
    createEnterpriseInquiryRecord,
    ENTERPRISE_INQUIRY_COOLDOWN_MS,
    getMostRecentEnterpriseInquiryCreatedAt,
    isEnterpriseInquiryRateLimited,
} from "../lib/validators/sales";

export function runSalesInquiryTests(): string[] {
    const completedTests: string[] = [];

    const inquiryRecord = createEnterpriseInquiryRecord({
        contactName: "  Jane Procurement ",
        createdAt: 123456789,
        email: "  Jane@University.AC.KE ",
        message:
            "  We need enterprise onboarding, SSO, and integration help for several campuses.  ",
        organizationName: "  University of Nairobi ",
    });
    assert.deepEqual(inquiryRecord, {
        contactName: "Jane Procurement",
        createdAt: 123456789,
        email: "jane@university.ac.ke",
        message:
            "We need enterprise onboarding, SSO, and integration help for several campuses.",
        organizationName: "University of Nairobi",
        organizationNameKey: "university of nairobi",
        requestedTier: "enterprise",
        source: "pricing_page",
        status: "new",
    });
    completedTests.push(
        "enterprise inquiry persistence helpers normalize and shape the public pricing request with the expected pricing-page metadata",
    );

    assert.equal(
        getMostRecentEnterpriseInquiryCreatedAt([
            null,
            10_000,
            12_000,
            undefined,
            11_000,
        ]),
        12_000,
    );
    assert.equal(
        getMostRecentEnterpriseInquiryCreatedAt([null, undefined]),
        null,
    );
    const now = 50_000;
    assert.equal(
        isEnterpriseInquiryRateLimited({
            lastSubmittedAt: now - ENTERPRISE_INQUIRY_COOLDOWN_MS + 1_000,
            now,
        }),
        true,
    );
    assert.equal(
        isEnterpriseInquiryRateLimited({
            lastSubmittedAt: now - ENTERPRISE_INQUIRY_COOLDOWN_MS,
            now,
        }),
        false,
    );
    completedTests.push(
        "enterprise inquiry cooldown helpers pick the latest prior submission and enforce the configured public form retry window",
    );

    return completedTests;
}
