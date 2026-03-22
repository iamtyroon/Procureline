"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useConvexAuth, useMutation } from "convex/react";
import { LoaderCircle, MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
    PENDING_INVITE_TOKEN_STORAGE_KEY,
    PENDING_ORG_NAME_STORAGE_KEY,
    PENDING_SELECTED_TIER_STORAGE_KEY,
    PENDING_TENANT_SETUP_RETRY_STORAGE_KEY,
    PENDING_VERIFICATION_EMAIL_STORAGE_KEY,
} from "@/lib/auth/signup-flow";
import { buildTenantAdminSignupContinuationHref } from "@/lib/tenant-admin/onboarding";
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
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface VerifyEmailFormProps {
    email: string;
    initialOrganizationName?: string;
    inviteToken?: string;
    mode: "signup" | "invite";
    onBack: (options?: { retryTenantSetup?: boolean }) => void;
    selectedTier: SelfServeTier;
    tenantName?: string;
}

const TIER_LABELS: Record<SelfServeTier, string> = {
    free: "Free",
    professional: "Professional",
    starter: "Starter",
};

export function VerifyEmailForm({
    email,
    initialOrganizationName,
    inviteToken,
    mode,
    onBack,
    selectedTier,
    tenantName,
}: VerifyEmailFormProps): JSX.Element {
    const { signIn } = useAuthActions();
    const { isAuthenticated } = useConvexAuth();
    const registerWithTenant = useMutation(api.functions.users.registerWithTenant);
    const redeemInvitation = useMutation(
        api.functions.tenantAdminOnboarding.redeemInvitation,
    );
    const registerVerificationResend = useMutation(
        api.functions.tenantAdminOnboarding.registerVerificationResend,
    );
    const router = useRouter();
    const [serverError, setServerError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [organizationNameForContinuation, setOrganizationNameForContinuation] =
        useState(initialOrganizationName ?? "");
    const [requiresOrganizationRetry, setRequiresOrganizationRetry] =
        useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    const form = useForm<OtpFormData>({
        resolver: zodResolver(otpSchema),
        defaultValues: { code: "" },
    });

    useEffect(() => {
        if (resendCooldown <= 0) {
            return;
        }

        const timer = setTimeout(
            () => setResendCooldown((current) => current - 1),
            1000,
        );
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    useEffect(() => {
        const storedOrganizationName =
            sessionStorage.getItem(PENDING_ORG_NAME_STORAGE_KEY) ??
            initialOrganizationName ??
            "";
        setOrganizationNameForContinuation(storedOrganizationName);
    }, [initialOrganizationName]);

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        const orgName =
            sessionStorage.getItem(PENDING_ORG_NAME_STORAGE_KEY) ??
            initialOrganizationName ??
            null;
        const storedTier = resolveVerificationSelectedTier(
            sessionStorage.getItem(PENDING_SELECTED_TIER_STORAGE_KEY),
            selectedTier,
        );

        if (mode === "signup" && !orgName) {
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

        async function finalizeOnboarding(): Promise<void> {
            try {
                if (mode === "invite" && inviteToken) {
                    await redeemInvitation({ inviteToken });
                } else {
                    await registerWithTenant({
                        organizationName: normalizePlainText(orgName ?? ""),
                        selectedTier: storedTier.tier,
                    });
                }

                sessionStorage.removeItem(PENDING_INVITE_TOKEN_STORAGE_KEY);
                sessionStorage.removeItem(PENDING_ORG_NAME_STORAGE_KEY);
                sessionStorage.removeItem(PENDING_SELECTED_TIER_STORAGE_KEY);
                sessionStorage.removeItem(PENDING_TENANT_SETUP_RETRY_STORAGE_KEY);
                sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_STORAGE_KEY);
                router.push("/dashboard");
            } catch (error: unknown) {
                if (isExistingRoleAssignmentError(error)) {
                    sessionStorage.removeItem(PENDING_INVITE_TOKEN_STORAGE_KEY);
                    sessionStorage.removeItem(PENDING_ORG_NAME_STORAGE_KEY);
                    sessionStorage.removeItem(PENDING_SELECTED_TIER_STORAGE_KEY);
                    sessionStorage.removeItem(
                        PENDING_TENANT_SETUP_RETRY_STORAGE_KEY,
                    );
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
                setServerError(getPublicVerificationErrorMessage(error));
            }
        }

        void finalizeOnboarding();
    }, [
        inviteToken,
        isAuthenticated,
        initialOrganizationName,
        mode,
        onBack,
        redeemInvitation,
        registerWithTenant,
        router,
        selectedTier,
    ]);

    useEffect(() => {
        if (isAuthenticated) {
            return;
        }

        async function attemptAutoResend(): Promise<void> {
            const resendState = await registerVerificationResend({
                email: normalizeAuthEmail(email),
                inviteToken,
                mode: mode === "invite" ? "invite" : "self_serve",
                resendMode: "auto",
            });

            if (!resendState.allowed) {
                if (resendState.message) {
                    setServerError(resendState.message);
                }
                return;
            }

            const formData = new FormData();
            formData.set("email", normalizeAuthEmail(email));
            formData.set("flow", "email-verification");
            await signIn("password", formData);
            setResendCooldown(60);
        }

        void attemptAutoResend();
    }, [email, inviteToken, isAuthenticated, mode, registerVerificationResend, signIn]);

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
            const resendState = await registerVerificationResend({
                email: normalizeAuthEmail(email),
                inviteToken,
                mode: mode === "invite" ? "invite" : "self_serve",
                resendMode: "manual",
            });
            if (!resendState.allowed) {
                setServerError(
                    resendState.message ?? "Unable to resend code right now.",
                );
                return;
            }

            const formData = new FormData();
            formData.set("email", normalizeAuthEmail(email));
            formData.set("flow", "email-verification");
            await signIn("password", formData);
            setResendCooldown(60);
        } catch (error: unknown) {
            setServerError(getPublicVerificationErrorMessage(error));
        } finally {
            setIsResending(false);
        }
    }

    const forgotPasswordHref = buildTenantAdminSignupContinuationHref({
        email,
        inviteToken,
        organizationName:
            mode === "signup" ? organizationNameForContinuation : undefined,
        tier: mode === "signup" ? selectedTier : undefined,
    });

    return (
        <Card className="border-border/50 shadow-lg">
            <CardHeader className="space-y-1 text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <MailCheck className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold">
                    Check your email
                </CardTitle>
                <CardDescription>
                    We sent an 8-digit code to{" "}
                    <span className="font-medium text-foreground">{email}</span>
                </CardDescription>
                <div className="mx-auto inline-flex rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                    {mode === "invite"
                        ? `Invitation for ${tenantName ?? "your institution"}`
                        : `Selected plan: ${TIER_LABELS[selectedTier]}`}
                </div>
            </CardHeader>

            <form
                onSubmit={(event) => {
                    void form.handleSubmit(onSubmit)(event);
                }}
            >
                <CardContent className="space-y-4">
                    {serverError ? (
                        <div
                            className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                            id="verify-error"
                            role="alert"
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
                            {...form.register("code")}
                        />
                        {form.formState.errors.code?.message ? (
                            <p className="text-sm text-destructive">
                                {form.formState.errors.code.message}
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
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                                Verifying...
                            </span>
                        ) : (
                            "Verify email"
                        )}
                    </Button>

                    <div className="flex w-full items-center justify-between text-sm">
                        <Button
                            type="button"
                            variant="ghost"
                            className="h-auto px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                            onClick={() => {
                                onBack(
                                    requiresOrganizationRetry
                                        ? { retryTenantSetup: true }
                                        : undefined,
                                );
                            }}
                        >
                            {requiresOrganizationRetry
                                ? "Choose another name"
                                : "Back"}
                        </Button>

                        <Button
                            type="button"
                            variant="link"
                            className="h-auto px-0"
                            onClick={() => {
                                void handleResend();
                            }}
                            disabled={isResending || resendCooldown > 0}
                        >
                            {resendCooldown > 0
                                ? `Resend in ${resendCooldown}s`
                                : isResending
                                    ? "Sending..."
                                    : "Resend code"}
                        </Button>
                    </div>

                    <p className="text-center text-sm text-muted-foreground">
                        Need to recover access instead?{" "}
                        <Link
                            href={`/forgot-password?continueTo=${encodeURIComponent(
                                forgotPasswordHref,
                            )}`}
                            className="font-medium text-primary hover:underline"
                        >
                            Reset password
                        </Link>
                    </p>
                </CardFooter>
            </form>
        </Card>
    );
}
