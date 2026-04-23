"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { getPublicInquirySubmissionErrorMessage } from "@/lib/errors/convex";
import {
    buildDisplayPricingTiers,
    getPricingAmountPresentation,
    isPricingCatalogLoading,
    PRICING_FAQS,
    PRICING_EXCHANGE_RATE_KES_PER_USD,
    shouldUseFallbackPricingCatalog,
    type PricingCurrency,
    type PublicPricingDisplayTier,
    type TierLimitValue,
} from "@/lib/marketing/pricing";
import {
    contactSalesSchema,
    type ContactSalesFormData,
} from "@/lib/validators/sales";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, CircleAlert, Coins, Sparkles } from "lucide-react";
import Link from "next/link";

type DisplayTier = PublicPricingDisplayTier;

const tierCtas: Record<DisplayTier["slug"], string> = {
    enterprise: "Talk to sales",
    free: "Start with Free",
    professional: "Choose Professional",
    starter: "Choose Starter",
};

function formatLimitValue(value: TierLimitValue): string {
    return typeof value === "number" ? value.toLocaleString() : value;
}

function PricingSkeleton(): JSX.Element {
    return (
        <section
            id="pricing"
            aria-label="Pricing plans"
            className="scroll-mt-28 bg-background px-6 py-24 md:scroll-mt-32"
        >
            <div className="mx-auto max-w-7xl">
                <div className="mx-auto mb-16 max-w-3xl text-center">
                    <div className="mx-auto mb-4 h-5 w-28 animate-pulse rounded-full bg-muted" />
                    <div className="mx-auto mb-4 h-10 w-full max-w-xl animate-pulse rounded bg-muted" />
                    <div className="mx-auto h-5 w-full max-w-2xl animate-pulse rounded bg-muted" />
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                    {[1, 2, 3, 4].map((tier) => (
                        <div
                            key={tier}
                            className="rounded-3xl border border-border/60 bg-card p-6 shadow-sm"
                        >
                            <div className="mb-4 h-6 w-28 animate-pulse rounded bg-muted" />
                            <div className="mb-3 h-10 w-36 animate-pulse rounded bg-muted" />
                            <div className="mb-6 h-16 animate-pulse rounded bg-muted" />
                            <div className="space-y-3">
                                {[1, 2, 3, 4, 5].map((row) => (
                                    <div
                                        key={row}
                                        className="h-4 animate-pulse rounded bg-muted"
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function Pricing(): JSX.Element {
    const tiers = useQuery(api.subscriptionTiers.listPublicTiers);
    const submitEnterpriseInquiry = useMutation(
        api.functions.salesInquiries.submitEnterpriseInquiry,
    );
    const [pricingCurrency, setPricingCurrency] =
        useState<PricingCurrency>("usd");
    const [catalogTimedOut, setCatalogTimedOut] = useState(false);
    const [isEnterpriseDialogOpen, setIsEnterpriseDialogOpen] = useState(false);
    const [contactSalesServerError, setContactSalesServerError] = useState<
        string | null
    >(null);
    const [contactSalesSucceeded, setContactSalesSucceeded] = useState(false);
    const [isOnline, setIsOnline] = useState(true);

    const form = useForm<ContactSalesFormData>({
        resolver: zodResolver(contactSalesSchema),
        defaultValues: {
            contactName: "",
            email: "",
            message: "",
            organizationName: "",
        },
    });

    useEffect(() => {
        if (typeof navigator === "undefined") {
            return;
        }

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

    useEffect(() => {
        if (tiers !== undefined) {
            setCatalogTimedOut(false);
            return;
        }

        const timer = window.setTimeout(() => {
            setCatalogTimedOut(true);
        }, 4000);

        return () => window.clearTimeout(timer);
    }, [tiers]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const scheduledScrolls: number[] = [];

        const scrollToPricing = (): void => {
            if (window.location.hash !== "#pricing") {
                return;
            }

            const pricingSection = document.getElementById("pricing");
            if (!pricingSection) {
                return;
            }

            for (const delay of [0, 200, 600, 1200]) {
                const timeoutId = window.setTimeout(() => {
                    const sectionTop =
                        pricingSection.getBoundingClientRect().top + window.scrollY;
                    window.scrollTo({
                        top: Math.max(sectionTop - 112, 0),
                    });
                }, delay);
                scheduledScrolls.push(timeoutId);
            }
        };

        scrollToPricing();
        window.addEventListener("hashchange", scrollToPricing);

        return () => {
            for (const timeoutId of scheduledScrolls) {
                window.clearTimeout(timeoutId);
            }
            window.removeEventListener("hashchange", scrollToPricing);
        };
    }, [tiers, catalogTimedOut, isOnline]);

    const isCatalogLoading = isPricingCatalogLoading({
        catalogTimedOut,
        isOnline,
        tiers,
    });
    const shouldUseFallback = shouldUseFallbackPricingCatalog({
        catalogTimedOut,
        isOnline,
        tiers,
    });
    const pricingCatalog = useMemo(
        () =>
            buildDisplayPricingTiers(
                shouldUseFallback ? undefined : (tiers as DisplayTier[] | undefined),
            ),
        [shouldUseFallback, tiers],
    );

    async function onSubmitEnterpriseInquiry(
        values: ContactSalesFormData,
    ): Promise<void> {
        setContactSalesServerError(null);

        try {
            await submitEnterpriseInquiry(values);
            setContactSalesSucceeded(true);
            form.reset();
            toast.success("Your enterprise inquiry has been submitted.");
        } catch (error: unknown) {
            const message = getPublicInquirySubmissionErrorMessage(error);
            setContactSalesServerError(message);
            toast.error(message);
        }
    }

    function handleEnterpriseDialogChange(isOpen: boolean): void {
        setIsEnterpriseDialogOpen(isOpen);
        if (isOpen) {
            setContactSalesSucceeded(false);
            setContactSalesServerError(null);
        }
    }

    if (isCatalogLoading) {
        return <PricingSkeleton />;
    }

    return (
        <>
            <section
                id="pricing"
                aria-label="Pricing plans"
                className="scroll-mt-28 bg-background px-6 py-24 md:scroll-mt-32"
            >
                <div className="mx-auto max-w-7xl">
                    <div className="mx-auto mb-16 max-w-3xl text-center">
                        <Badge
                            variant="secondary"
                            className="mb-4 gap-2 rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary"
                        >
                            <Coins className="h-4 w-4" />
                            Pricing
                        </Badge>
                        <h2 className="mb-4 text-4xl font-semibold tracking-tight text-foreground">
                            Annual procurement plans with USD and KES comparison views
                        </h2>
                        <p className="text-lg text-muted-foreground">
                            Compare Free, Starter, Professional, and Enterprise with
                            annual July to June billing, plus a monthly-equivalent budget
                            reference. USD remains the commercial anchor and KES uses the
                            fixed planning rate of {PRICING_EXCHANGE_RATE_KES_PER_USD} KES
                            per USD from the PRD.
                        </p>
                        <Tabs
                            value={pricingCurrency}
                            onValueChange={(value) =>
                                setPricingCurrency(value as PricingCurrency)
                            }
                            className="mt-6"
                        >
                            <TabsList className="h-auto rounded-full border border-border/60 bg-card p-1 shadow-sm">
                                <TabsTrigger
                                    value="usd"
                                    className="rounded-full px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                                >
                                    USD pricing
                                </TabsTrigger>
                                <TabsTrigger
                                    value="kes"
                                    className="rounded-full px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                                >
                                    KES planning view
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    {pricingCatalog.usingFallback ? (
                        <Alert
                            className="mb-8 rounded-2xl border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
                            dismissible
                            dismissKey="pricing-fallback"
                        >
                            <CircleAlert className="h-4 w-4" />
                            <AlertTitle>Showing fallback pricing</AlertTitle>
                            <AlertDescription>
                                We are showing the standard pricing snapshot because the live tier
                                catalog is currently unavailable. Self-serve links and the
                                Enterprise contact flow remain available.
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    <div className="mb-10 rounded-3xl border border-border/60 bg-card px-6 py-6 shadow-sm md:flex md:items-center md:justify-between md:gap-8">
                        <div className="max-w-2xl">
                            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                                Annual planning starts here
                            </p>
                            <h3 className="mb-2 text-2xl font-semibold text-foreground">
                                Free remains available for pilots and first institutional
                                rollouts
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Self-serve signup supports Free, Starter, and Professional.
                                Enterprise stays sales-led so onboarding scope is aligned
                                before tenant provisioning begins.
                            </p>
                        </div>
                        <div className="mt-5 md:mt-0">
                            <Link href="/signup?tier=free">
                                <Button size="lg" className="w-full md:w-auto">
                                    Create free account
                                </Button>
                            </Link>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                        {pricingCatalog.tiers.map((tier) => {
                            const pricingPresentation = getPricingAmountPresentation({
                                currency: pricingCurrency,
                                priceUSD: tier.priceUSD,
                            });

                            return (
                                <Card
                                    key={tier._id}
                                    className={`flex h-full flex-col rounded-3xl border px-6 py-7 shadow-sm ${
                                        tier.isPopular
                                            ? "border-primary bg-primary/[0.03] shadow-md"
                                            : "border-border/60"
                                    }`}
                                >
                                    <div className="mb-6">
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <h3 className="text-2xl font-semibold text-foreground">
                                                {tier.tierName}
                                            </h3>
                                            {tier.isPopular ? (
                                                <Badge className="rounded-full px-3 py-1">
                                                    Recommended
                                                </Badge>
                                            ) : null}
                                        </div>
                                        <p className="min-h-[72px] text-sm leading-6 text-muted-foreground">
                                            {tier.description}
                                        </p>
                                    </div>

                                    <div className="mb-6 border-b border-border/60 pb-6">
                                        <div className="flex flex-wrap items-end gap-2">
                                            <span className="text-4xl font-bold tracking-tight text-foreground">
                                                {pricingPresentation.annualAmount}
                                            </span>
                                            <span className="pb-1 text-sm text-muted-foreground">
                                                per fiscal year
                                            </span>
                                        </div>
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            {tier.billingCycle === "annual"
                                                ? "Billed annually for July to June coverage"
                                                : `Billed ${tier.billingCycle}`}
                                        </p>
                                        <p className="mt-2 text-sm font-medium text-foreground/80">
                                            {pricingPresentation.monthlyEquivalent}
                                        </p>
                                    </div>

                                    <div className="mb-6 grid grid-cols-2 gap-3 text-sm">
                                        <div className="rounded-2xl bg-muted/40 p-3">
                                            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                                Departments
                                            </div>
                                            <div className="mt-1 font-semibold text-foreground">
                                                {formatLimitValue(tier.limits.departments)}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl bg-muted/40 p-3">
                                            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                                Users
                                            </div>
                                            <div className="mt-1 font-semibold text-foreground">
                                                {formatLimitValue(tier.limits.users)}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl bg-muted/40 p-3">
                                            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                                Categories
                                            </div>
                                            <div className="mt-1 font-semibold text-foreground">
                                                {formatLimitValue(tier.limits.categories)}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl bg-muted/40 p-3">
                                            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                                Items / category
                                            </div>
                                            <div className="mt-1 font-semibold text-foreground">
                                                {formatLimitValue(tier.limits.itemsPerCategory)}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl bg-muted/40 p-3">
                                            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                                Storage
                                            </div>
                                            <div className="mt-1 font-semibold text-foreground">
                                                {tier.limits.storage}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl bg-muted/40 p-3">
                                            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                                Integrations
                                            </div>
                                            <div className="mt-1 font-semibold text-foreground">
                                                {tier.limits.ssoLdap
                                                    ? "API + SSO"
                                                    : tier.limits.apiAccess
                                                        ? "API access"
                                                        : "Standard only"}
                                            </div>
                                        </div>
                                    </div>

                                    <ul className="mb-6 flex-1 space-y-3">
                                        {tier.features.map((feature) => (
                                            <li
                                                key={`${tier.slug}-${feature}`}
                                                className="flex items-start gap-3 text-sm leading-6 text-muted-foreground"
                                            >
                                                <CheckCircle2 className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    {tier.slug === "enterprise" ? (
                                        <Button
                                            size="lg"
                                            variant="outline"
                                            className="w-full"
                                            onClick={() => setIsEnterpriseDialogOpen(true)}
                                        >
                                            {tierCtas[tier.slug]}
                                        </Button>
                                    ) : (
                                        <Link href={`/signup?tier=${tier.slug}`} className="block">
                                            <Button
                                                size="lg"
                                                variant={tier.isPopular ? "default" : "outline"}
                                                className="w-full"
                                            >
                                                {tierCtas[tier.slug]}
                                            </Button>
                                        </Link>
                                    )}
                                </Card>
                            );
                        })}
                    </div>

                    <div className="mt-16 grid gap-10 rounded-3xl border border-border/60 bg-card px-6 py-8 shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
                        <div>
                            <Badge
                                variant="secondary"
                                className="mb-3 gap-2 rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary"
                            >
                                <Sparkles className="h-4 w-4" />
                                Pricing FAQ
                            </Badge>
                            <h3 className="mb-3 text-3xl font-semibold text-foreground">
                                Questions procurement teams ask before rollout
                            </h3>
                            <p className="text-sm leading-6 text-muted-foreground">
                                Billing cycle, tier differences, upgrade path, and
                                Enterprise onboarding stay directly attached to the pricing
                                comparison surface.
                            </p>
                        </div>
                        <Accordion type="single" collapsible className="w-full">
                            {PRICING_FAQS.map((item) => (
                                <AccordionItem key={item.question} value={item.question}>
                                    <AccordionTrigger className="text-left text-base text-foreground">
                                        {item.question}
                                    </AccordionTrigger>
                                    <AccordionContent className="leading-6 text-muted-foreground">
                                        {item.answer}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
                </div>
            </section>

            <Dialog
                open={isEnterpriseDialogOpen}
                onOpenChange={handleEnterpriseDialogChange}
            >
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Contact sales for Enterprise</DialogTitle>
                        <DialogDescription>
                            Enterprise onboarding is handled in-app here so it never
                            routes into the public self-serve tenant signup path.
                        </DialogDescription>
                    </DialogHeader>
                    {contactSalesSucceeded ? (
                        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm text-foreground">
                            <p className="font-semibold text-primary">Inquiry received</p>
                            <p className="mt-2 leading-6 text-muted-foreground">
                                A Procureline team member will review your Enterprise
                                request and follow up with the next onboarding steps.
                            </p>
                            <div className="mt-5 flex justify-end">
                                <Button onClick={() => setIsEnterpriseDialogOpen(false)}>
                                    Close
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Form {...form}>
                            <form
                                className="space-y-4"
                                onSubmit={(event) => {
                                    void form.handleSubmit(onSubmitEnterpriseInquiry)(event);
                                }}
                            >
                                <div className="grid gap-4 md:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="contactName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Contact name</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Jane Procurement"
                                                        autoComplete="name"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Work email</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="jane@university.ac.ke"
                                                        autoComplete="email"
                                                        type="email"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="organizationName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Organization name</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="University of Nairobi"
                                                    autoComplete="organization"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="message"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>What do you need from Enterprise?</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    className="min-h-[140px]"
                                                    placeholder="Tell us about rollout scope, campus count, onboarding expectations, or integration requirements."
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {contactSalesServerError ? (
                                    <div
                                        className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                                        role="alert"
                                    >
                                        {contactSalesServerError}
                                    </div>
                                ) : null}

                                <div className="flex justify-end gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsEnterpriseDialogOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={form.formState.isSubmitting}
                                    >
                                        {form.formState.isSubmitting
                                            ? "Submitting..."
                                            : "Submit enterprise inquiry"}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
