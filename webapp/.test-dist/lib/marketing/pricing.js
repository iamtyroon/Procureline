"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDisplayPricingTiers = exports.sortPricingTiers = exports.shouldUseFallbackPricingCatalog = exports.isPricingCatalogLoading = exports.getPricingAmountPresentation = exports.getMonthlyEquivalent = exports.convertUsdToKes = exports.resolveTenantRegistrationTier = exports.resolveVerificationSelectedTier = exports.resolveSelfServeTier = exports.isSelfServeTier = exports.buildPricingRedirectTarget = exports.PRICING_FAQS = exports.FALLBACK_PUBLIC_PRICING_TIERS = exports.PRICING_EXCHANGE_RATE_KES_PER_USD = exports.PUBLIC_TIER_ORDER = exports.SELF_SERVE_TIERS = exports.SUPPORTED_PRICING_REDIRECT_PARAMS = void 0;
exports.SUPPORTED_PRICING_REDIRECT_PARAMS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "ref",
];
exports.SELF_SERVE_TIERS = ["free", "starter", "professional"];
exports.PUBLIC_TIER_ORDER = [
    "free",
    "starter",
    "professional",
    "enterprise",
];
exports.PRICING_EXCHANGE_RATE_KES_PER_USD = 130;
exports.FALLBACK_PUBLIC_PRICING_TIERS = [
    {
        _id: "fallback-free",
        tierName: "Free",
        slug: "free",
        priceUSD: 0,
        billingCycle: "annual",
        description: "Best for departmental pilots and first procurement cycles.",
        features: [
            "Guided annual planning workspace",
            "PPRA-aligned export starter templates",
            "Email support within two business days",
        ],
        limits: {
            departments: 10,
            categories: 20,
            itemsPerCategory: 50,
            users: 5,
            storage: "1 GB",
            apiAccess: false,
            ssoLdap: false,
        },
        isPopular: false,
        displayOrder: 1,
    },
    {
        _id: "fallback-starter",
        tierName: "Starter",
        slug: "starter",
        priceUSD: 3850,
        billingCycle: "annual",
        description: "For growing institutions that need stronger collaboration limits.",
        features: [
            "Full Blockly planning workspace",
            "Bulk import up to 100 rows per upload",
            "Quarterly compliance reporting",
        ],
        limits: {
            departments: 30,
            categories: 60,
            itemsPerCategory: 150,
            users: 15,
            storage: "10 GB",
            apiAccess: false,
            ssoLdap: false,
        },
        isPopular: false,
        displayOrder: 2,
    },
    {
        _id: "fallback-professional",
        tierName: "Professional",
        slug: "professional",
        priceUSD: 9230,
        billingCycle: "annual",
        description: "For larger universities coordinating more departments and reviews.",
        features: [
            "Advanced plan consolidation workflows",
            "Custom Excel template support",
            "Priority email support within 12 hours",
        ],
        limits: {
            departments: 100,
            categories: 200,
            itemsPerCategory: 500,
            users: 50,
            storage: "50 GB",
            apiAccess: true,
            ssoLdap: false,
        },
        isPopular: true,
        displayOrder: 3,
    },
    {
        _id: "fallback-enterprise",
        tierName: "Enterprise",
        slug: "enterprise",
        priceUSD: 18460,
        billingCycle: "annual",
        description: "For agencies, multi-campus institutions, and custom onboarding needs.",
        features: [
            "Dedicated enterprise onboarding",
            "Custom compliance and reporting support",
            "24/7 response path with named account coverage",
        ],
        limits: {
            departments: "Unlimited",
            categories: "Unlimited",
            itemsPerCategory: "Unlimited",
            users: "Unlimited",
            storage: "Unlimited",
            apiAccess: true,
            ssoLdap: true,
        },
        isPopular: false,
        displayOrder: 4,
    },
];
exports.PRICING_FAQS = [
    {
        answer: "All plans are quoted in USD for one annual subscription term aligned to the planning cycle from July to June. This pricing surface does not present or imply monthly billing.",
        question: "How is billing structured?",
    },
    {
        answer: "Free supports pilots, Starter expands department and catalog capacity, Professional adds larger operational limits and advanced support, and Enterprise is reserved for tailored onboarding or integration needs.",
        question: "How do the tiers differ?",
    },
    {
        answer: "You can start on Free, move to Starter or Professional as your institution grows, and keep the same tenant-admin signup path for those self-serve plans.",
        question: "Can we upgrade later?",
    },
    {
        answer: "Enterprise starts with the contact-sales form below. Procureline reviews your scope, discusses rollout expectations, and guides onboarding without sending you through self-serve tenant signup.",
        question: "What happens for Enterprise onboarding?",
    },
];
function getSingleSearchParam(value) {
    return Array.isArray(value) ? value[0] : value;
}
function buildPricingRedirectTarget(searchParams) {
    const redirectParams = new URLSearchParams();
    for (const key of exports.SUPPORTED_PRICING_REDIRECT_PARAMS) {
        const value = getSingleSearchParam(searchParams[key]);
        if (value) {
            redirectParams.set(key, value);
        }
    }
    const queryString = redirectParams.toString();
    return queryString.length > 0 ? `/?${queryString}#pricing` : "/#pricing";
}
exports.buildPricingRedirectTarget = buildPricingRedirectTarget;
function isSelfServeTier(value) {
    return exports.SELF_SERVE_TIERS.includes(value);
}
exports.isSelfServeTier = isSelfServeTier;
function resolveSelfServeTier(value) {
    const tier = getSingleSearchParam(value)?.trim().toLowerCase();
    if (!tier) {
        return {
            shouldWarn: false,
            tier: "free",
        };
    }
    if (isSelfServeTier(tier)) {
        return {
            shouldWarn: false,
            tier,
        };
    }
    return {
        shouldWarn: true,
        tier: "free",
    };
}
exports.resolveSelfServeTier = resolveSelfServeTier;
function resolveVerificationSelectedTier(storedTier, selectedTier) {
    return resolveSelfServeTier(storedTier ?? selectedTier);
}
exports.resolveVerificationSelectedTier = resolveVerificationSelectedTier;
function resolveTenantRegistrationTier(selectedTier) {
    return selectedTier ?? "free";
}
exports.resolveTenantRegistrationTier = resolveTenantRegistrationTier;
function convertUsdToKes(amountUSD) {
    return amountUSD * exports.PRICING_EXCHANGE_RATE_KES_PER_USD;
}
exports.convertUsdToKes = convertUsdToKes;
function getMonthlyEquivalent(amount) {
    return amount / 12;
}
exports.getMonthlyEquivalent = getMonthlyEquivalent;
function formatAnnualPrice(amount, currency) {
    if (amount === 0) {
        return currency === "usd" ? "Free" : "KES 0";
    }
    if (currency === "usd") {
        return `$${amount.toLocaleString()}`;
    }
    return `KES ${amount.toLocaleString()}`;
}
function formatMonthlyEquivalent(amount, currency) {
    if (amount === 0) {
        return currency === "usd"
            ? "$0 per month equivalent"
            : "KES 0 per month equivalent";
    }
    const monthlyEquivalent = getMonthlyEquivalent(amount);
    if (currency === "usd") {
        return `$${monthlyEquivalent.toLocaleString(undefined, {
            maximumFractionDigits: 0,
        })} per month equivalent`;
    }
    return `KES ${monthlyEquivalent.toLocaleString(undefined, {
        maximumFractionDigits: 0,
    })} per month equivalent`;
}
function getPricingAmountPresentation(args) {
    const annualAmount = args.currency === "usd"
        ? args.priceUSD
        : convertUsdToKes(args.priceUSD);
    return {
        annualAmount: formatAnnualPrice(annualAmount, args.currency),
        monthlyEquivalent: formatMonthlyEquivalent(annualAmount, args.currency),
    };
}
exports.getPricingAmountPresentation = getPricingAmountPresentation;
function isPricingCatalogLoading(state) {
    return state.isOnline && !state.catalogTimedOut && state.tiers === undefined;
}
exports.isPricingCatalogLoading = isPricingCatalogLoading;
function shouldUseFallbackPricingCatalog(state) {
    if (isPricingCatalogLoading(state)) {
        return false;
    }
    return !state.isOnline || state.catalogTimedOut || (state.tiers?.length ?? 0) === 0;
}
exports.shouldUseFallbackPricingCatalog = shouldUseFallbackPricingCatalog;
function sortPricingTiers(tiers) {
    const orderBySlug = new Map(exports.PUBLIC_TIER_ORDER.map((slug, index) => [slug, index]));
    return [...tiers].sort((left, right) => {
        const leftOrder = orderBySlug.get(left.slug);
        const rightOrder = orderBySlug.get(right.slug);
        if (leftOrder !== undefined || rightOrder !== undefined) {
            return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER);
        }
        return (left.displayOrder ?? Number.MAX_SAFE_INTEGER) - (right.displayOrder ?? Number.MAX_SAFE_INTEGER);
    });
}
exports.sortPricingTiers = sortPricingTiers;
function buildDisplayPricingTiers(liveTiers) {
    if (!liveTiers || liveTiers.length === 0) {
        return {
            tiers: sortPricingTiers(exports.FALLBACK_PUBLIC_PRICING_TIERS),
            usingFallback: true,
        };
    }
    const liveTiersBySlug = new Map(liveTiers.map((tier) => [tier.slug, tier]));
    const hasCompletePublicCatalog = exports.PUBLIC_TIER_ORDER.every((slug) => liveTiersBySlug.has(slug));
    if (!hasCompletePublicCatalog) {
        return {
            tiers: sortPricingTiers(exports.FALLBACK_PUBLIC_PRICING_TIERS),
            usingFallback: true,
        };
    }
    const merged = exports.FALLBACK_PUBLIC_PRICING_TIERS.map((fallbackTier) => {
        const liveTier = liveTiersBySlug.get(fallbackTier.slug);
        return liveTier
            ? {
                ...fallbackTier,
                ...liveTier,
                limits: {
                    ...fallbackTier.limits,
                    ...liveTier.limits,
                },
            }
            : fallbackTier;
    });
    return {
        tiers: sortPricingTiers(merged),
        usingFallback: false,
    };
}
exports.buildDisplayPricingTiers = buildDisplayPricingTiers;
