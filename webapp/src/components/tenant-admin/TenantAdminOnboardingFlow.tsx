"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { Building2, LoaderCircle, MailCheck, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
    tenantAdminInstitutionProfileSchema,
    type TenantAdminInstitutionProfileFormData,
} from "@/lib/validators/tenant-admin";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/src/components/ui/Spinner";

const ONBOARDING_STEPS = [
    {
        description: "Your tenant-admin identity is active.",
        icon: MailCheck,
        title: "Account created",
    },
    {
        description: "Your secure email verification step is complete.",
        icon: ShieldCheck,
        title: "Email verified",
    },
    {
        description: "Finish the institution profile to unlock the dashboard.",
        icon: Building2,
        title: "Institution profile",
    },
] as const;

export function TenantAdminOnboardingFlow(): JSX.Element {
    const router = useRouter();
    const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
    const authContext = useQuery(api.functions.users.getAuthContext, {});
    const onboardingContext = useQuery(
        api.functions.tenantAdminOnboarding.getCurrentOnboardingContext,
        authContext?.accessState === "allowed" ? {} : "skip",
    );
    const completeInstitutionProfile = useMutation(
        api.functions.tenantAdminOnboarding.completeInstitutionProfile,
    );
    const form = useForm<TenantAdminInstitutionProfileFormData>({
        resolver: zodResolver(tenantAdminInstitutionProfileSchema),
        defaultValues: {
            fiscalYearStartMonth: 7,
            institutionName: "",
            logoUrl: "",
            primaryContactEmail: "",
            primaryContactName: "",
            primaryContactPhone: "",
        },
    });

    useEffect(() => {
        if (authContext?.redirectReason === "subscription_inactive") {
            setBlockedMessage("Tenant deactivated. Contact Support.");
            return;
        }

        if (blockedMessage) {
            setBlockedMessage(null);
        }
    }, [authContext?.redirectReason, blockedMessage]);

    useEffect(() => {
        if (!onboardingContext) {
            return;
        }

        form.reset({
            fiscalYearStartMonth: onboardingContext.fiscalYearStartMonth ?? 7,
            institutionName: onboardingContext.institutionName,
            logoUrl: onboardingContext.logoUrl ?? "",
            primaryContactEmail: onboardingContext.primaryContactEmail,
            primaryContactName: onboardingContext.primaryContactName ?? "",
            primaryContactPhone: onboardingContext.primaryContactPhone ?? "",
        });
    }, [form, onboardingContext]);

    async function onSubmit(
        values: TenantAdminInstitutionProfileFormData,
    ): Promise<void> {
        try {
            await completeInstitutionProfile({
                fiscalYearStartMonth: values.fiscalYearStartMonth,
                institutionName: values.institutionName,
                logoUrl: values.logoUrl || undefined,
                primaryContactEmail: values.primaryContactEmail,
                primaryContactName: values.primaryContactName,
                primaryContactPhone: values.primaryContactPhone,
            });
            toast.success("Institution profile completed.");
            router.push("/tenant-admin");
        } catch (error: unknown) {
            const message =
                error instanceof Error && error.message.includes("Tenant deactivated")
                    ? "Tenant deactivated. Contact Support."
                    : "We could not save your institution profile right now.";
            setBlockedMessage(message);
            toast.error(message);
        }
    }

    if (blockedMessage) {
        return (
            <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
                <Card className="border-destructive/20 shadow-sm">
                    <CardHeader className="space-y-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                            <Building2 className="h-6 w-6" />
                        </div>
                        <div className="space-y-2">
                            <CardTitle className="text-3xl font-bold">
                                Onboarding unavailable
                            </CardTitle>
                            <CardDescription className="text-base leading-7 text-foreground">
                                {blockedMessage}
                            </CardDescription>
                        </div>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    if (authContext === undefined || onboardingContext === undefined) {
        return (
            <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Spinner />
                    <p className="text-sm text-muted-foreground">
                        Loading onboarding...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <Card className="border-border/60 shadow-sm">
                    <CardHeader className="space-y-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Building2 className="h-6 w-6" />
                        </div>
                        <div className="space-y-2">
                            <CardTitle className="text-3xl font-bold">
                                Finish institution setup
                            </CardTitle>
                            <CardDescription className="max-w-2xl text-base leading-7">
                                Procureline keeps the tenant-admin dashboard locked until
                                your institution profile is complete. Review the account
                                milestones and finish the required details here.
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {ONBOARDING_STEPS.map((step) => (
                            <div
                                key={step.title}
                                className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-4"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <step.icon className="h-4 w-4" />
                                </div>
                                <div className="space-y-1">
                                    <div className="text-sm font-semibold text-foreground">
                                        {step.title}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {step.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-sm">
                    <CardHeader>
                        <CardTitle>Institution Profile</CardTitle>
                        <CardDescription>
                            Required fields unlock the tenant-admin dashboard.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form
                            className="space-y-4"
                            onSubmit={(event) => {
                                void form.handleSubmit(onSubmit)(event);
                            }}
                        >
                            <div className="space-y-2">
                                <Label htmlFor="institutionName">Institution name</Label>
                                <Input
                                    id="institutionName"
                                    {...form.register("institutionName")}
                                />
                                {form.formState.errors.institutionName?.message ? (
                                    <p className="text-sm text-destructive">
                                        {form.formState.errors.institutionName.message}
                                    </p>
                                ) : null}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="primaryContactName">Primary contact name</Label>
                                <Input
                                    id="primaryContactName"
                                    {...form.register("primaryContactName")}
                                />
                                {form.formState.errors.primaryContactName?.message ? (
                                    <p className="text-sm text-destructive">
                                        {form.formState.errors.primaryContactName.message}
                                    </p>
                                ) : null}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="primaryContactEmail">
                                    Primary contact email
                                </Label>
                                <Input
                                    id="primaryContactEmail"
                                    type="email"
                                    {...form.register("primaryContactEmail")}
                                />
                                {form.formState.errors.primaryContactEmail?.message ? (
                                    <p className="text-sm text-destructive">
                                        {form.formState.errors.primaryContactEmail.message}
                                    </p>
                                ) : null}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="primaryContactPhone">
                                    Primary contact phone
                                </Label>
                                <Input
                                    id="primaryContactPhone"
                                    {...form.register("primaryContactPhone")}
                                />
                                {form.formState.errors.primaryContactPhone?.message ? (
                                    <p className="text-sm text-destructive">
                                        {form.formState.errors.primaryContactPhone.message}
                                    </p>
                                ) : null}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="fiscalYearStartMonth">
                                    Fiscal year start month
                                </Label>
                                <Input
                                    id="fiscalYearStartMonth"
                                    type="number"
                                    min={1}
                                    max={12}
                                    {...form.register("fiscalYearStartMonth", {
                                        valueAsNumber: true,
                                    })}
                                />
                                {form.formState.errors.fiscalYearStartMonth?.message ? (
                                    <p className="text-sm text-destructive">
                                        {
                                            form.formState.errors.fiscalYearStartMonth
                                                .message
                                        }
                                    </p>
                                ) : null}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="logoUrl">Logo URL (optional)</Label>
                                <Input id="logoUrl" {...form.register("logoUrl")} />
                                {form.formState.errors.logoUrl?.message ? (
                                    <p className="text-sm text-destructive">
                                        {form.formState.errors.logoUrl.message}
                                    </p>
                                ) : null}
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={form.formState.isSubmitting}
                            >
                                {form.formState.isSubmitting ? (
                                    <span className="flex items-center gap-2">
                                        <LoaderCircle className="h-4 w-4 animate-spin" />
                                        Saving profile...
                                    </span>
                                ) : (
                                    "Unlock tenant-admin dashboard"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
