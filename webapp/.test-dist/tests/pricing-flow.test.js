"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPricingFlowTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const pricing_1 = require("../lib/shared/marketing/pricing");
const sales_1 = require("../lib/validators/sales");
function runPricingFlowTests() {
    const completedTests = [];
    strict_1.default.equal((0, pricing_1.buildPricingRedirectTarget)({
        fbclid: "fb-123",
        ignored: "drop-me",
        utm_campaign: "fy-2026",
        utm_source: "linkedin",
    }), "/?utm_source=linkedin&utm_campaign=fy-2026&fbclid=fb-123#pricing");
    strict_1.default.equal((0, pricing_1.buildPricingRedirectTarget)({ ignored: "drop-me" }), "/#pricing");
    completedTests.push("pricing redirect preserves only the supported tracking allowlist and always targets the landing pricing anchor");
    strict_1.default.deepEqual((0, pricing_1.resolveSelfServeTier)(undefined), {
        shouldWarn: false,
        tier: "free",
    });
    strict_1.default.deepEqual((0, pricing_1.resolveSelfServeTier)("starter"), {
        shouldWarn: false,
        tier: "starter",
    });
    strict_1.default.deepEqual((0, pricing_1.resolveSelfServeTier)("ENTERPRISE"), {
        shouldWarn: true,
        tier: "free",
    });
    strict_1.default.deepEqual((0, pricing_1.resolveSelfServeTier)("invalid"), {
        shouldWarn: true,
        tier: "free",
    });
    strict_1.default.deepEqual((0, pricing_1.resolveVerificationSelectedTier)(undefined, "starter"), {
        shouldWarn: false,
        tier: "starter",
    });
    strict_1.default.deepEqual((0, pricing_1.resolveVerificationSelectedTier)("professional", "free"), {
        shouldWarn: false,
        tier: "professional",
    });
    strict_1.default.deepEqual((0, pricing_1.resolveVerificationSelectedTier)("invalid", "starter"), {
        shouldWarn: true,
        tier: "free",
    });
    strict_1.default.equal((0, pricing_1.resolveTenantRegistrationTier)(undefined), "free");
    strict_1.default.equal((0, pricing_1.resolveTenantRegistrationTier)("starter"), "starter");
    strict_1.default.equal((0, pricing_1.resolveTenantRegistrationTier)("professional"), "professional");
    strict_1.default.equal((0, pricing_1.resolveTenantRegistrationTier)("enterprise"), "free");
    completedTests.push("signup tier resolution keeps the self-serve allowlist, restores the chosen tier through verification, and defaults tenant registration safely to free when needed");
    strict_1.default.deepEqual((0, pricing_1.sortPricingTiers)([
        { displayOrder: 99, slug: "enterprise" },
        { displayOrder: 1, slug: "starter" },
        { displayOrder: 2, slug: "professional" },
        { displayOrder: 0, slug: "free" },
    ]).map((tier) => tier.slug), ["free", "starter", "professional", "enterprise"]);
    completedTests.push("pricing tiers always render in the public comparison order regardless of source ordering");
    const fallbackCatalog = (0, pricing_1.buildDisplayPricingTiers)(undefined);
    strict_1.default.equal(fallbackCatalog.usingFallback, true);
    strict_1.default.deepEqual(fallbackCatalog.tiers.map((tier) => tier.slug), ["free", "starter", "professional", "enterprise"]);
    strict_1.default.equal(pricing_1.FALLBACK_PUBLIC_PRICING_TIERS[3]?.limits.ssoLdap, true);
    completedTests.push("pricing fallback catalog preserves the public tier order and enterprise-specific comparison limits");
    strict_1.default.equal((0, pricing_1.isPricingCatalogLoading)({
        catalogTimedOut: false,
        isOnline: true,
        tiers: undefined,
    }), true);
    strict_1.default.equal((0, pricing_1.shouldUseFallbackPricingCatalog)({
        catalogTimedOut: false,
        isOnline: true,
        tiers: undefined,
    }), false);
    strict_1.default.equal((0, pricing_1.shouldUseFallbackPricingCatalog)({
        catalogTimedOut: true,
        isOnline: true,
        tiers: undefined,
    }), true);
    completedTests.push("pricing keeps the loading skeleton separate from fallback catalog mode until the live query times out or definitively fails");
    const freeFallbackTier = pricing_1.FALLBACK_PUBLIC_PRICING_TIERS[0];
    const starterFallbackTier = pricing_1.FALLBACK_PUBLIC_PRICING_TIERS[1];
    strict_1.default.ok(freeFallbackTier, "expected free fallback tier");
    strict_1.default.ok(starterFallbackTier, "expected starter fallback tier");
    const partialLiveCatalog = (0, pricing_1.buildDisplayPricingTiers)([
        {
            ...freeFallbackTier,
            _id: "live-free",
        },
        {
            ...starterFallbackTier,
            _id: "live-starter",
        },
    ]);
    strict_1.default.equal(partialLiveCatalog.usingFallback, true);
    strict_1.default.deepEqual(partialLiveCatalog.tiers.map((tier) => tier.slug), ["free", "starter", "professional", "enterprise"]);
    completedTests.push("pricing falls back to the standard public catalog when the live tier source is incomplete");
    const faqQuestions = pricing_1.PRICING_FAQS.map((item) => item.question);
    strict_1.default.deepEqual(faqQuestions, [
        "How is billing structured?",
        "How do the tiers differ?",
        "Can we upgrade later?",
        "What happens for Enterprise onboarding?",
    ]);
    strict_1.default.ok(pricing_1.PRICING_FAQS.every((item) => item.answer.length > 40), "pricing FAQ answers should remain substantive enough for the comparison section");
    completedTests.push("pricing FAQ content covers billing, tier differences, upgrade path, and enterprise onboarding");
    strict_1.default.equal(pricing_1.PRICING_EXCHANGE_RATE_KES_PER_USD, 130);
    strict_1.default.equal((0, pricing_1.convertUsdToKes)(3850), 500500);
    strict_1.default.equal((0, pricing_1.getMonthlyEquivalent)(3850), 3850 / 12);
    strict_1.default.deepEqual((0, pricing_1.getPricingAmountPresentation)({
        currency: "usd",
        priceUSD: 3850,
    }), {
        annualAmount: "$3,850",
        monthlyEquivalent: "$321 per month equivalent",
    });
    strict_1.default.deepEqual((0, pricing_1.getPricingAmountPresentation)({
        currency: "kes",
        priceUSD: 3850,
    }), {
        annualAmount: "KES 500,500",
        monthlyEquivalent: "KES 41,708 per month equivalent",
    });
    completedTests.push("pricing amount helpers expose the fixed PRD exchange rate and monthly-equivalent breakdown for both USD and KES views");
    strict_1.default.equal(sales_1.contactSalesSchema.safeParse({
        contactName: "Jane Procurement",
        email: "jane@university.ac.ke",
        message: "We need enterprise onboarding, SSO, and procurement workflow support for multiple campuses.",
        organizationName: "University of Nairobi",
    }).success, true);
    strict_1.default.equal(sales_1.contactSalesSchema.safeParse({
        contactName: "<script>alert(1)</script>",
        email: "invalid-email",
        message: "Too short",
        organizationName: "UoN",
    }).success, false);
    completedTests.push("contact sales validation accepts safe enterprise inquiry data and rejects unsafe or incomplete submissions");
    strict_1.default.equal((0, sales_1.normalizeEnterpriseInquiryEmail)("  Jane@University.AC.KE "), "jane@university.ac.ke");
    strict_1.default.equal((0, sales_1.normalizeEnterpriseInquiryOrganizationKey)("  University   of Nairobi "), "university of nairobi");
    strict_1.default.equal((0, sales_1.isEnterpriseInquiryRateLimited)({
        lastSubmittedAt: 10_000,
        now: 10_000 + sales_1.ENTERPRISE_INQUIRY_COOLDOWN_MS - 1,
    }), true);
    strict_1.default.equal((0, sales_1.isEnterpriseInquiryRateLimited)({
        lastSubmittedAt: 10_000,
        now: 10_000 + sales_1.ENTERPRISE_INQUIRY_COOLDOWN_MS,
    }), false);
    completedTests.push("enterprise inquiry helpers normalize throttle keys and enforce the cooldown boundary deterministically");
    return completedTests;
}
exports.runPricingFlowTests = runPricingFlowTests;
