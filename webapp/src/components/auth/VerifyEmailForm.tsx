"use client";

import { useEffect, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    PENDING_ORG_NAME_STORAGE_KEY,
    PENDING_SELECTED_TIER_STORAGE_KEY,
    PENDING_TENANT_SETUP_RETRY_STORAGE_KEY,
    PENDING_VERIFICATION_EMAIL_STORAGE_KEY,
} from "@/lib/auth/signup-flow";
import {
    resolveVerificationSelectedTier,
    type SelfServeTier,
} from "@/lib/marketing/pricing";
import {
    getPublicVerificationErrorMessage,
    isExistingRoleAssignmentError,
    isOrganizationNameConflictError,
} from "@/lib/errors/convex";
import { normalizeAuthEmail, normalizePlainText } from "@/lib/security/input";
import { otpSchema, type OtpFormData } from "@/lib/validators/auth";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

interface VerifyEmailFormProps {
    email: string;
    onBack: (options?: { retryTenantSetup?: boolean }) => void;
    selectedTier: SelfServeTier;
}

const TIER_LABELS: Record<SelfServeTier, string> = {
    free: "Free",
    professional: "Professional",
    starter: "Starter",
};

export function VerifyEmailForm({
    email,
    onBack,
    selectedTier,
}: VerifyEmailFormProps): JSX.Element {
    const { signIn } = useAuthActions();
    const { isAuthenticated } = useConvexAuth();
    const registerWithTenant = useMutation(api.functions.users.registerWithTenant);
    const router = useRouter();
    const [serverError, setServerError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [requiresOrganizationRetry, setRequiresOrganizationRetry] =
        useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<OtpFormData>({
        resolver: zodResolver(otpSchema),
        defaultValues: { code: "" },
    });

    useEffect(() => {
        if (resendCooldown <= 0) {
            return;
        }

        const timer = setTimeout(() => setResendCooldown((current) => current - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        const orgName = sessionStorage.getItem(PENDING_ORG_NAME_STORAGE_KEY);
        const storedTier = resolveVerificationSelectedTier(
            sessionStorage.getItem(PENDING_SELECTED_TIER_STORAGE_KEY),
            selectedTier,
        );

        if (!orgName) {
            sessionStorage.setItem(PENDING_TENANT_SETUP_RETRY_STORAGE_KEY, "true");
            sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_STORAGE_KEY);
            onBack({ retryTenantSetup: true });
            return;
        }

        if (storedTier.shouldWarn) {
            console.warn(
                "[signup] Pending selected tier was invalid during verification; defaulting to free.",
            );
        }

        const normalizedOrganizationName = normalizePlainText(orgName);

        async function createTenant(): Promise<void> {
            sessionStorage.removeItem(PENDING_TENANT_SETUP_RETRY_STORAGE_KEY);

            try {
                await registerWithTenant({
                    organizationName: normalizedOrganizationName,
                    selectedTier: storedTier.tier,
                });
                sessionStorage.removeItem(PENDING_ORG_NAME_STORAGE_KEY);
                sessionStorage.removeItem(PENDING_SELECTED_TIER_STORAGE_KEY);
                sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_STORAGE_KEY);
                router.push("/dashboard");
            } catch (error: unknown) {
                if (isExistingRoleAssignmentError(error)) {
                    sessionStorage.removeItem(PENDING_ORG_NAME_STORAGE_KEY);
                    sessionStorage.removeItem(PENDING_SELECTED_TIER_STORAGE_KEY);
                    sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_STORAGE_KEY);
                    router.push("/dashboard");
                    return;
                }

                if (isOrganizationNameConflictError(error)) {
                    sessionStorage.setItem(
                        PENDING_TENANT_SETUP_RETRY_STORAGE_KEY,
                        "true",
                    );
                    sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_STORAGE_KEY);
                    setRequiresOrganizationRetry(true);
                    setServerError(getPublicVerificationErrorMessage(error));
                    return;
                }

                setRequiresOrganizationRetry(false);
                setServerError("Account created but organization setup failed. Please contact support.");
            }
        }

        void createTenant();
    }, [isAuthenticated, onBack, registerWithTenant, router, selectedTier]);

    async function onSubmit(data: OtpFormData): Promise<void> {
        setServerError(null);
        setRequiresOrganizationRetry(false);
        setIsSubmitting(true);

        try {
            const formData = new FormData();
            formData.set("email", normalizeAuthEmail(email));
            formData.set("code", data.code.trim());
            formData.set("flow", "email-verification");

            await signIn("password", formData);
        } catch (error: unknown) {
            setServerError(getPublicVerificationErrorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleResend(): Promise<void> {
        if (resendCooldown > 0) {
            return;
        }

        setIsResending(true);
        setServerError(null);
        setRequiresOrganizationRetry(false);

        try {
            const formData = new FormData();
            formData.set("email", normalizeAuthEmail(email));
            formData.set("flow", "email-verification");
            await signIn("password", formData);
            setResendCooldown(60);
        } catch (error: unknown) {
            setServerError(
                getPublicVerificationErrorMessage(error) ===
                    "Invalid or expired verification code. Please try again."
                    ? "Unable to resend code right now."
                    : getPublicVerificationErrorMessage(error),
            );
        } finally {
            setIsResending(false);
        }
    }

    return (
        <Card className="border-border/50 shadow-lg">
            <CardHeader className="space-y-1 text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <svg
                        className="h-6 w-6 text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                    </svg>
                </div>
                <CardTitle className="text-2xl font-bold">
                    Check your email
                </CardTitle>
                <CardDescription>
                    We sent an 8-digit code to{" "}
                    <span className="font-medium text-foreground">{email}</span>
                </CardDescription>
                <div className="mx-auto inline-flex rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                    Selected plan: {TIER_LABELS[selectedTier]}
                </div>
            </CardHeader>

            <form
                onSubmit={(event) => {
                    void handleSubmit(onSubmit)(event);
                }}
            >
                <CardContent className="space-y-4">
                    {serverError ? (
                        <div
                            className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                            role="alert"
                            id="verify-error"
                        >
                            {serverError}
                        </div>
                    ) : null}

                    <div className="space-y-2">
                        <Label htmlFor="code">Verification code</Label>
                        <Input
                            id="code"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={8}
                            placeholder="12345678"
                            autoComplete="one-time-code"
                            className="text-center text-lg font-mono tracking-[0.3em]"
                            {...register("code")}
                            aria-invalid={errors.code ? "true" : undefined}
                            aria-describedby={errors.code ? "code-error" : undefined}
                        />
                        {errors.code ? (
                            <p id="code-error" className="text-sm text-destructive">
                                {errors.code.message}
                            </p>
                        ) : null}
                    </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-3">
                    <Button
                        id="verify-submit"
                        type="submit"
                        className="w-full"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <span className="flex items-center gap-2">
                                <svg
                                    className="h-4 w-4 animate-spin"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                    />
                                </svg>
                                Verifying...
                            </span>
                        ) : (
                            "Verify email"
                        )}
                    </Button>

                    <div className="flex w-full items-center justify-between text-sm">
                        <button
                            type="button"
                            onClick={() => {
                                onBack(
                                    requiresOrganizationRetry
                                        ? { retryTenantSetup: true }
                                        : undefined,
                                );
                            }}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {requiresOrganizationRetry
                                ? "Choose another name"
                                : "Back"}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                void handleResend();
                            }}
                            disabled={isResending || resendCooldown > 0}
                            className="text-primary transition-colors hover:underline disabled:text-muted-foreground disabled:no-underline"
                        >
                            {resendCooldown > 0
                                ? `Resend in ${resendCooldown}s`
                                : isResending
                                    ? "Sending..."
                                    : "Resend code"}
                        </button>
                    </div>
                </CardFooter>
            </form>
        </Card>
    );
}
