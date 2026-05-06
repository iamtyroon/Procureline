import assert from "node:assert/strict";
import {
    buildDisplayPricingTiers,
    buildPricingRedirectTarget,
    convertUsdToKes,
    FALLBACK_PUBLIC_PRICING_TIERS,
    getMonthlyEquivalent,
    getPricingAmountPresentation,
    isPricingCatalogLoading,
    PRICING_FAQS,
    PRICING_EXCHANGE_RATE_KES_PER_USD,
    resolveTenantRegistrationTier,
    resolveSelfServeTier,
    resolveVerificationSelectedTier,
    shouldUseFallbackPricingCatalog,
    sortPricingTiers,
} from "../lib/shared/marketing/pricing";
import {
    contactSalesSchema,
    ENTERPRISE_INQUIRY_COOLDOWN_MS,
    isEnterpriseInquiryRateLimited,
    normalizeEnterpriseInquiryEmail,
    normalizeEnterpriseInquiryOrganizationKey,
} from "../lib/validators/sales";

export function runPricingFlowTests(): string[] {
    const completedTests: string[] = [];

    assert.equal(
        buildPricingRedirectTarget({
            fbclid: "fb-123",
            ignored: "drop-me",
            utm_campaign: "fy-2026",
            utm_source: "linkedin",
        }),
        "/?utm_source=linkedin&utm_campaign=fy-2026&fbclid=fb-123#pricing",
    );
    assert.equal(buildPricingRedirectTarget({ ignored: "drop-me" }), "/#pricing");
    completedTests.push(
        "pricing redirect preserves only the supported tracking allowlist and always targets the landing pricing anchor",
    );

    assert.deepEqual(resolveSelfServeTier(undefined), {
        shouldWarn: false,
        tier: "free",
    });
    assert.deepEqual(resolveSelfServeTier("starter"), {
        shouldWarn: false,
        tier: "starter",
    });
    assert.deepEqual(resolveSelfServeTier("ENTERPRISE"), {
        shouldWarn: true,
        tier: "free",
    });
    assert.deepEqual(resolveSelfServeTier("invalid"), {
        shouldWarn: true,
        tier: "free",
    });
    assert.deepEqual(resolveVerificationSelectedTier(undefined, "starter"), {
        shouldWarn: false,
        tier: "starter",
    });
    assert.deepEqual(resolveVerificationSelectedTier("professional", "free"), {
        shouldWarn: false,
        tier: "professional",
    });
    assert.deepEqual(resolveVerificationSelectedTier("invalid", "starter"), {
        shouldWarn: true,
        tier: "free",
    });
    assert.equal(resolveTenantRegistrationTier(undefined), "free");
    assert.equal(resolveTenantRegistrationTier("starter"), "starter");
    assert.equal(resolveTenantRegistrationTier("professional"), "professional");
    assert.equal(resolveTenantRegistrationTier("enterprise"), "free");
    completedTests.push(
        "signup tier resolution keeps the self-serve allowlist, restores the chosen tier through verification, and defaults tenant registration safely to free when needed",
    );

    assert.deepEqual(
        sortPricingTiers([
            { displayOrder: 99, slug: "enterprise" },
            { displayOrder: 1, slug: "starter" },
            { displayOrder: 2, slug: "professional" },
            { displayOrder: 0, slug: "free" },
        ]).map((tier) => tier.slug),
        ["free", "starter", "professional", "enterprise"],
    );
    completedTests.push(
        "pricing tiers always render in the public comparison order regardless of source ordering",
    );

    const fallbackCatalog = buildDisplayPricingTiers(undefined);
    assert.equal(fallbackCatalog.usingFallback, true);
    assert.deepEqual(
        fallbackCatalog.tiers.map((tier) => tier.slug),
        ["free", "starter", "professional", "enterprise"],
    );
    assert.equal(FALLBACK_PUBLIC_PRICING_TIERS[3]?.limits.ssoLdap, true);
    completedTests.push(
        "pricing fallback catalog preserves the public tier order and enterprise-specific comparison limits",
    );

    assert.equal(
        isPricingCatalogLoading({
            catalogTimedOut: false,
            isOnline: true,
            tiers: undefined,
        }),
        true,
    );
    assert.equal(
        shouldUseFallbackPricingCatalog({
            catalogTimedOut: false,
            isOnline: true,
            tiers: undefined,
        }),
        false,
    );
    assert.equal(
        shouldUseFallbackPricingCatalog({
            catalogTimedOut: true,
            isOnline: true,
            tiers: undefined,
        }),
        true,
    );
    completedTests.push(
        "pricing keeps the loading skeleton separate from fallback catalog mode until the live query times out or definitively fails",
    );

    const freeFallbackTier = FALLBACK_PUBLIC_PRICING_TIERS[0];
    const starterFallbackTier = FALLBACK_PUBLIC_PRICING_TIERS[1];
    assert.ok(freeFallbackTier, "expected free fallback tier");
    assert.ok(starterFallbackTier, "expected starter fallback tier");
    const partialLiveCatalog = buildDisplayPricingTiers([
        {
            ...freeFallbackTier,
            _id: "live-free",
        },
        {
            ...starterFallbackTier,
            _id: "live-starter",
        },
    ]);
    assert.equal(partialLiveCatalog.usingFallback, true);
    assert.deepEqual(
        partialLiveCatalog.tiers.map((tier) => tier.slug),
        ["free", "starter", "professional", "enterprise"],
    );
    completedTests.push(
        "pricing falls back to the standard public catalog when the live tier source is incomplete",
    );

    const faqQuestions = PRICING_FAQS.map((item) => item.question);
    assert.deepEqual(faqQuestions, [
        "How is billing structured?",
        "How do the tiers differ?",
        "Can we upgrade later?",
        "What happens for Enterprise onboarding?",
    ]);
    assert.ok(
        PRICING_FAQS.every((item) => item.answer.length > 40),
        "pricing FAQ answers should remain substantive enough for the comparison section",
    );
    completedTests.push(
        "pricing FAQ content covers billing, tier differences, upgrade path, and enterprise onboarding",
    );

    assert.equal(PRICING_EXCHANGE_RATE_KES_PER_USD, 130);
    assert.equal(convertUsdToKes(3850), 500500);
    assert.equal(getMonthlyEquivalent(3850), 3850 / 12);
    assert.deepEqual(
        getPricingAmountPresentation({
            currency: "usd",
            priceUSD: 3850,
        }),
        {
            annualAmount: "$3,850",
            monthlyEquivalent: "$321 per month equivalent",
        },
    );
    assert.deepEqual(
        getPricingAmountPresentation({
            currency: "kes",
            priceUSD: 3850,
        }),
        {
            annualAmount: "KES 500,500",
            monthlyEquivalent: "KES 41,708 per month equivalent",
        },
    );
    completedTests.push(
        "pricing amount helpers expose the fixed PRD exchange rate and monthly-equivalent breakdown for both USD and KES views",
    );

    assert.equal(
        contactSalesSchema.safeParse({
            contactName: "Jane Procurement",
            email: "jane@university.ac.ke",
            message:
                "We need enterprise onboarding, SSO, and procurement workflow support for multiple campuses.",
            organizationName: "University of Nairobi",
        }).success,
        true,
    );
    assert.equal(
        contactSalesSchema.safeParse({
            contactName: "<script>alert(1)</script>",
            email: "invalid-email",
            message: "Too short",
            organizationName: "UoN",
        }).success,
        false,
    );
    completedTests.push(
        "contact sales validation accepts safe enterprise inquiry data and rejects unsafe or incomplete submissions",
    );

    assert.equal(
        normalizeEnterpriseInquiryEmail("  Jane@University.AC.KE "),
        "jane@university.ac.ke",
    );
    assert.equal(
        normalizeEnterpriseInquiryOrganizationKey("  University   of Nairobi "),
        "university of nairobi",
    );
    assert.equal(
        isEnterpriseInquiryRateLimited({
            lastSubmittedAt: 10_000,
            now: 10_000 + ENTERPRISE_INQUIRY_COOLDOWN_MS - 1,
        }),
        true,
    );
    assert.equal(
        isEnterpriseInquiryRateLimited({
            lastSubmittedAt: 10_000,
            now: 10_000 + ENTERPRISE_INQUIRY_COOLDOWN_MS,
        }),
        false,
    );
    completedTests.push(
        "enterprise inquiry helpers normalize throttle keys and enforce the cooldown boundary deterministically",
    );

    return completedTests;
}
