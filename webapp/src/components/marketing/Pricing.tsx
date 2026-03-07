"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

type DisplayTier = {
    _id: string;
    tierName: string;
    slug: string;
    priceUSD: number;
    billingCycle: string;
    description: string;
    features: string[];
    isPopular: boolean;
    displayOrder: number;
};

const fallbackTiers: DisplayTier[] = [
    {
        _id: "fallback-free",
        tierName: "Free",
        slug: "free",
        priceUSD: 0,
        billingCycle: "annual",
        description: "Perfect for pilots and small departments",
        features: [
            "10 departments",
            "20 categories",
            "50 items per category",
            "Basic Blockly interface",
            "Limited Excel export",
            "Email support (48h response)",
        ],
        isPopular: false,
        displayOrder: 1,
    },
    {
        _id: "fallback-starter",
        tierName: "Starter",
        slug: "starter",
        priceUSD: 3850,
        billingCycle: "annual",
        description: "For small to medium universities",
        features: [
            "30 departments",
            "60 categories",
            "150 items per category",
            "Full Blockly interface",
            "Bulk import (100 rows)",
            "Excel export (GOK templates)",
            "Email support (24h response)",
        ],
        isPopular: false,
        displayOrder: 2,
    },
    {
        _id: "fallback-professional",
        tierName: "Professional",
        slug: "professional",
        priceUSD: 9230,
        billingCycle: "annual",
        description: "For large universities",
        features: [
            "100 departments",
            "200 categories",
            "500 items per category",
            "Advanced Blockly features",
            "Unlimited bulk import",
            "Custom Excel templates",
            "Audit trail reports",
            "Monthly compliance reports",
        ],
        isPopular: true,
        displayOrder: 3,
    },
    {
        _id: "fallback-enterprise",
        tierName: "Enterprise",
        slug: "enterprise",
        priceUSD: 18460,
        billingCycle: "annual",
        description: "For government agencies and consortiums",
        features: [
            "Unlimited departments",
            "Unlimited categories",
            "Unlimited items",
            "Custom Blockly blocks",
            "API access",
            "SSO/LDAP integration",
            "Dedicated account manager",
            "24/7 phone support",
        ],
        isPopular: false,
        displayOrder: 4,
    },
];

function buildDisplayTiers(liveTiers: DisplayTier[]): DisplayTier[] {
    if (liveTiers.length === 0) {
        return fallbackTiers;
    }

    const liveTiersBySlug = new Map(liveTiers.map((tier) => [tier.slug, tier]));

    return fallbackTiers.map((fallbackTier) => {
        const liveTier = liveTiersBySlug.get(fallbackTier.slug);
        return liveTier ? { ...fallbackTier, ...liveTier } : fallbackTier;
    });
}

/** Loading skeleton with shimmer effect */
function PricingSkeleton(): JSX.Element {
    return (
        <section id="pricing" aria-label="Pricing plans" className="bg-background px-6 py-24">
            <div className="mx-auto max-w-7xl">
                <div className="mx-auto mb-16 max-w-2xl text-center">
                    <div className="mb-4 h-6 w-24 mx-auto rounded bg-muted animate-pulse" />
                    <div className="mb-4 h-10 w-96 mx-auto rounded bg-muted animate-pulse" />
                    <div className="h-6 w-80 mx-auto rounded bg-muted animate-pulse" />
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="animate-pulse rounded-2xl border border-border p-6">
                            <div className="mb-4 h-6 w-3/4 rounded bg-muted" />
                            <div className="mb-2 h-4 w-full rounded bg-muted" />
                            <div className="mb-6 h-10 w-1/2 rounded bg-muted" />
                            <div className="space-y-2">
                                {[1, 2, 3, 4, 5].map((j) => (
                                    <div key={j} className="h-3 rounded bg-muted" />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div role="status" aria-live="polite" className="sr-only">
                    Loading pricing information, please wait...
                </div>
            </div>
        </section>
    );
}

/** Error/timeout state UI */
function PricingError(): JSX.Element {
    return (
        <section id="pricing" aria-label="Pricing plans" className="bg-white px-6 py-24">
            <div className="mx-auto max-w-2xl text-center">
                <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-8">
                    <div className="mb-4 text-5xl">⚠️</div>
                    <h3 className="mb-2 text-xl font-bold text-gray-900">
                        Unable to Load Pricing
                    </h3>
                    <p className="mb-6 text-gray-600">
                        We&apos;re having trouble loading our pricing information. This might
                        be due to a slow connection or temporary issue.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <Button
                            onClick={() => window.location.reload()}
                            variant="default"
                            className="bg-primary"
                        >
                            Retry
                        </Button>
                        <Button
                            onClick={() => {
                                window.location.href = "mailto:support@procureline.co.ke";
                            }}
                            variant="outline"
                        >
                            Contact Support
                        </Button>
                    </div>
                </div>
                <div role="alert" aria-live="assertive" className="sr-only">
                    Error loading pricing. Please retry or contact support.
                </div>
            </div>
        </section>
    );
}

/** Offline state UI */
function PricingOffline(): JSX.Element {
    return (
        <section id="pricing" aria-label="Pricing plans" className="bg-white px-6 py-24">
            <div className="mx-auto max-w-2xl text-center">
                <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-8">
                    <div className="mb-4 text-5xl">📡</div>
                    <h3 className="mb-2 text-xl font-bold text-gray-900">
                        You&apos;re Offline
                    </h3>
                    <p className="text-gray-600">
                        Please check your internet connection to view live pricing
                        information.
                    </p>
                </div>
            </div>
        </section>
    );
}

export function Pricing(): JSX.Element {
    const tiers = useQuery(api.subscriptionTiers.listPublicTiers);
    const [loadingTimeout, setLoadingTimeout] = useState(false);
    const [isOnline, setIsOnline] = useState(true);

    // Detect loading timeout (10 seconds)
    useEffect(() => {
        if (tiers === undefined) {
            const timer = setTimeout(() => {
                setLoadingTimeout(true);
            }, 10000);
            return () => clearTimeout(timer);
        } else {
            setLoadingTimeout(false);
        }
    }, [tiers]);

    // Online/offline detection
    useEffect(() => {
        const handleOnline = (): void => setIsOnline(true);
        const handleOffline = (): void => setIsOnline(false);

        setIsOnline(navigator.onLine);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    // Offline state
    if (!isOnline) {
        return <PricingOffline />;
    }

    // Timeout/error state
    if (loadingTimeout) {
        return <PricingError />;
    }

    // Loading state
    if (tiers === undefined) {
        return <PricingSkeleton />;
    }

    const displayTiers = buildDisplayTiers(tiers as DisplayTier[]);

    return (
        <section id="pricing" aria-label="Pricing plans" className="bg-background px-6 py-24">
            <div className="mx-auto max-w-7xl">
                {/* Section Header */}
                <div className="mx-auto mb-16 max-w-2xl text-center">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary">
                        🏷️ Pricing
                    </div>
                    <h2 className="mb-4 text-4xl font-bold tracking-tight text-foreground">
                        Simple, Transparent Pricing
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        Annual billing aligned with Kenya&apos;s fiscal year (July - June).
                        No hidden fees.
                    </p>
                </div>

                {/* Free Forever Banner */}
                <div className="mb-12 overflow-hidden rounded-2xl border border-border bg-card p-8 md:flex md:items-center md:justify-between md:gap-8 shadow-sm">
                    <div className="mb-6 md:mb-0">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                            🎁 Free Forever
                        </div>
                        <h3 className="mb-2 text-xl font-bold text-foreground">
                            Start Planning for Free Today
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Permanent free access for departmental pilots. No credit card
                            required. Upgrade only when you grow.
                        </p>
                    </div>
                    <div className="flex-shrink-0">
                        <Link href="/signup">
                            <Button
                                size="lg"
                                className="w-full rounded-lg bg-primary px-8 py-6 text-base font-semibold text-primary-foreground shadow-md hover:bg-primary/90 md:w-auto"
                            >
                                🚀 Create Free Account
                            </Button>
                        </Link>
                        <p className="mt-2 text-center text-xs text-muted-foreground">
                            ⏱️ Takes less than 2 minutes to set up
                        </p>
                    </div>
                </div>

                {/* Pricing Grid */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {displayTiers.map((tier) => (
                        <Card
                            key={tier._id}
                            role="article"
                            aria-label={`${tier.tierName} pricing tier`}
                            className={`relative flex flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${tier.isPopular
                                ? "border-2 border-primary shadow-md"
                                : "border border-border"
                                }`}
                        >
                            {/* Popular badge */}
                            {tier.isPopular && (
                                <div className="bg-primary py-2 text-center text-sm font-semibold text-primary-foreground">
                                    ⭐ Most Popular
                                </div>
                            )}

                            <div className="flex flex-1 flex-col p-6">
                                <h3
                                    className="text-xl font-bold text-foreground line-clamp-2"
                                    title={tier.tierName}
                                >
                                    {tier.tierName}
                                </h3>
                                <p
                                    className="mt-2 text-sm text-muted-foreground line-clamp-2"
                                    title={tier.description}
                                >
                                    {tier.description}
                                </p>

                                {/* Price */}
                                <div className="mt-6">
                                    {tier.priceUSD === 0 ? (
                                        <span className="text-4xl font-bold text-primary">Free</span>
                                    ) : (
                                        <>
                                            <span className="text-4xl font-bold text-foreground">
                                                {tier.slug === "enterprise"
                                                    ? `$${tier.priceUSD.toLocaleString()}+`
                                                    : `$${tier.priceUSD.toLocaleString()}`}
                                            </span>
                                            <span className="text-muted-foreground">
                                                {tier.billingCycle === "annual"
                                                    ? " /year"
                                                    : ` /${tier.billingCycle}`}
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Feature list */}
                                {tier.features.length > 0 ? (
                                    <ul className="mt-6 flex-1 space-y-3">
                                        {tier.features.map((feature, idx) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <span className="mt-0.5 flex-shrink-0 text-primary">
                                                    ✓
                                                </span>
                                                <span
                                                    className="text-sm text-muted-foreground line-clamp-1"
                                                    title={feature}
                                                >
                                                    {feature}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="mt-6 flex-1 rounded-lg bg-muted/50 p-4 text-center">
                                        <p className="text-sm text-muted-foreground">
                                            Contact us for detailed features
                                        </p>
                                    </div>
                                )}

                                {/* CTA */}
                                <Link
                                    href={
                                        tier.slug === "enterprise"
                                            ? "mailto:sales@procureline.co.ke"
                                            : `/signup?tier=${tier.slug}`
                                    }
                                    className="mt-6 block"
                                >
                                    <Button
                                        className="w-full rounded-lg"
                                        variant={tier.isPopular ? "default" : "outline"}
                                        size="lg"
                                    >
                                        {tier.slug === "enterprise"
                                            ? "Contact Sales"
                                            : tier.slug === "free"
                                                ? "Start Free"
                                                : `Get ${tier.tierName}`}
                                    </Button>
                                </Link>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}
