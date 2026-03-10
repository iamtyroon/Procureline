"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSalesInquiryTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const sales_1 = require("../lib/validators/sales");
function runSalesInquiryTests() {
    const completedTests = [];
    const inquiryRecord = (0, sales_1.createEnterpriseInquiryRecord)({
        contactName: "  Jane Procurement ",
        createdAt: 123456789,
        email: "  Jane@University.AC.KE ",
        message: "  We need enterprise onboarding, SSO, and integration help for several campuses.  ",
        organizationName: "  University of Nairobi ",
    });
    strict_1.default.deepEqual(inquiryRecord, {
        contactName: "Jane Procurement",
        createdAt: 123456789,
        email: "jane@university.ac.ke",
        message: "We need enterprise onboarding, SSO, and integration help for several campuses.",
        organizationName: "University of Nairobi",
        organizationNameKey: "university of nairobi",
        requestedTier: "enterprise",
        source: "pricing_page",
        status: "new",
    });
    completedTests.push("enterprise inquiry persistence helpers normalize and shape the public pricing request with the expected pricing-page metadata");
    strict_1.default.equal((0, sales_1.getMostRecentEnterpriseInquiryCreatedAt)([
        null,
        10_000,
        12_000,
        undefined,
        11_000,
    ]), 12_000);
    strict_1.default.equal((0, sales_1.getMostRecentEnterpriseInquiryCreatedAt)([null, undefined]), null);
    const now = 50_000;
    strict_1.default.equal((0, sales_1.isEnterpriseInquiryRateLimited)({
        lastSubmittedAt: now - sales_1.ENTERPRISE_INQUIRY_COOLDOWN_MS + 1_000,
        now,
    }), true);
    strict_1.default.equal((0, sales_1.isEnterpriseInquiryRateLimited)({
        lastSubmittedAt: now - sales_1.ENTERPRISE_INQUIRY_COOLDOWN_MS,
        now,
    }), false);
    completedTests.push("enterprise inquiry cooldown helpers pick the latest prior submission and enforce the configured public form retry window");
    return completedTests;
}
exports.runSalesInquiryTests = runSalesInquiryTests;
