export const SUPPORTED_PRICING_REDIRECT_PARAMS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "ref",
] as const;

export const SELF_SERVE_TIERS = ["free", "starter", "professional"] as const;
export const PUBLIC_TIER_ORDER = [
    "free",
    "starter",
    "professional",
    "enterprise",
] as const;
export const PRICING_EXCHANGE_RATE_KES_PER_USD = 130 as const;

export type SelfServeTier = (typeof SELF_SERVE_TIERS)[number];
export type PublicTierSlug = (typeof PUBLIC_TIER_ORDER)[number];
export type TierLimitValue = number | string;
export type PricingCurrency = "usd" | "kes";

export interface PricingTierLike {
    displayOrder?: number;
    slug: string;
}

export interface PublicPricingDisplayTier extends PricingTierLike {
    _id: string;
    billingCycle: string;
    description: string;
    displayOrder: number;
    features: string[];
    isPopular: boolean;
    limits: {
        apiAccess: boolean;
        categories: TierLimitValue;
        departments: TierLimitValue;
        itemsPerCategory: TierLimitValue;
        ssoLdap: boolean;
        storage: string;
        users: TierLimitValue;
    };
    priceUSD: number;
    slug: PublicTierSlug;
    tierName: string;
}

export interface PricingFaqItem {
    answer: string;
    question: string;
}

export interface ResolvedSelfServeTier {
    shouldWarn: boolean;
    tier: SelfServeTier;
}

export interface PricingCatalogAvailabilityState {
    catalogTimedOut: boolean;
    isOnline: boolean;
    tiers: readonly PricingTierLike[] | undefined;
}

export interface PricingAmountPresentation {
    annualAmount: string;
    monthlyEquivalent: string;
}

export const FALLBACK_PUBLIC_PRICING_TIERS: PublicPricingDisplayTier[] = [
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

export const PRICING_FAQS: PricingFaqItem[] = [
    {
        answer:
            "All plans are quoted in USD for one annual subscription term aligned to the planning cycle from July to June. This pricing surface does not present or imply monthly billing.",
        question: "How is billing structured?",
    },
    {
        answer:
            "Free supports pilots, Starter expands department and catalog capacity, Professional adds larger operational limits and advanced support, and Enterprise is reserved for tailored onboarding or integration needs.",
        question: "How do the tiers differ?",
    },
    {
        answer:
            "You can start on Free, move to Starter or Professional as your institution grows, and keep the same tenant-admin signup path for those self-serve plans.",
        question: "Can we upgrade later?",
    },
    {
        answer:
            "Enterprise starts with the contact-sales form below. Procureline reviews your scope, discusses rollout expectations, and guides onboarding without sending you through self-serve tenant signup.",
        question: "What happens for Enterprise onboarding?",
    },
];

function getSingleSearchParam(
    value: string | string[] | undefined,
): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

export function buildPricingRedirectTarget(
    searchParams: Record<string, string | string[] | undefined>,
): string {
    const redirectParams = new URLSearchParams();

    for (const key of SUPPORTED_PRICING_REDIRECT_PARAMS) {
        const value = getSingleSearchParam(searchParams[key]);
        if (value) {
            redirectParams.set(key, value);
        }
    }

    const queryString = redirectParams.toString();
    return queryString.length > 0 ? `/?${queryString}#pricing` : "/#pricing";
}

export function isSelfServeTier(value: string): value is SelfServeTier {
    return (SELF_SERVE_TIERS as readonly string[]).includes(value);
}

export function resolveSelfServeTier(
    value: string | string[] | undefined,
): ResolvedSelfServeTier {
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

export function resolveVerificationSelectedTier(
    storedTier: string | null | undefined,
    selectedTier: SelfServeTier,
): ResolvedSelfServeTier {
    return resolveSelfServeTier(storedTier ?? selectedTier);
}

export function resolveTenantRegistrationTier(
    selectedTier: SelfServeTier | undefined,
): SelfServeTier {
    return selectedTier ?? "free";
}

export function convertUsdToKes(amountUSD: number): number {
    return amountUSD * PRICING_EXCHANGE_RATE_KES_PER_USD;
}

export function getMonthlyEquivalent(amount: number): number {
    return amount / 12;
}

function formatAnnualPrice(amount: number, currency: PricingCurrency): string {
    if (amount === 0) {
        return currency === "usd" ? "Free" : "KES 0";
    }

    if (currency === "usd") {
        return `$${amount.toLocaleString()}`;
    }

    return `KES ${amount.toLocaleString()}`;
}

function formatMonthlyEquivalent(
    amount: number,
    currency: PricingCurrency,
): string {
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

export function getPricingAmountPresentation(args: {
    currency: PricingCurrency;
    priceUSD: number;
}): PricingAmountPresentation {
    const annualAmount =
        args.currency === "usd"
            ? args.priceUSD
            : convertUsdToKes(args.priceUSD);

    return {
        annualAmount: formatAnnualPrice(annualAmount, args.currency),
        monthlyEquivalent: formatMonthlyEquivalent(
            annualAmount,
            args.currency,
        ),
    };
}

export function isPricingCatalogLoading(
    state: PricingCatalogAvailabilityState,
): boolean {
    return state.isOnline && !state.catalogTimedOut && state.tiers === undefined;
}

export function shouldUseFallbackPricingCatalog(
    state: PricingCatalogAvailabilityState,
): boolean {
    if (isPricingCatalogLoading(state)) {
        return false;
    }

    return !state.isOnline || state.catalogTimedOut || (state.tiers?.length ?? 0) === 0;
}

export function sortPricingTiers<TTier extends PricingTierLike>(
    tiers: readonly TTier[],
): TTier[] {
    const orderBySlug = new Map(
        PUBLIC_TIER_ORDER.map((slug, index) => [slug, index] as const),
    );

    return [...tiers].sort((left, right) => {
        const leftOrder = orderBySlug.get(left.slug as PublicTierSlug);
        const rightOrder = orderBySlug.get(right.slug as PublicTierSlug);

        if (leftOrder !== undefined || rightOrder !== undefined) {
            return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER);
        }

        return (left.displayOrder ?? Number.MAX_SAFE_INTEGER) - (right.displayOrder ?? Number.MAX_SAFE_INTEGER);
    });
}

export function buildDisplayPricingTiers(
    liveTiers: PublicPricingDisplayTier[] | undefined,
): { tiers: PublicPricingDisplayTier[]; usingFallback: boolean } {
    if (!liveTiers || liveTiers.length === 0) {
        return {
            tiers: sortPricingTiers(FALLBACK_PUBLIC_PRICING_TIERS),
            usingFallback: true,
        };
    }

    const liveTiersBySlug = new Map(liveTiers.map((tier) => [tier.slug, tier]));
    const hasCompletePublicCatalog = PUBLIC_TIER_ORDER.every((slug) =>
        liveTiersBySlug.has(slug),
    );

    if (!hasCompletePublicCatalog) {
        return {
            tiers: sortPricingTiers(FALLBACK_PUBLIC_PRICING_TIERS),
            usingFallback: true,
        };
    }

    const merged = FALLBACK_PUBLIC_PRICING_TIERS.map((fallbackTier) => {
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
