"use client";

import { useEffect, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    createPendingSignupState,
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
import {
    organizationSetupSchema,
    passwordRequirements,
    signupSchema,
    type OrganizationSetupFormData,
    type SignupFormData,
} from "@/lib/validators/auth";
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
import Link from "next/link";

interface SignupFormProps {
    mode?: "signup" | "tenant-retry";
    onComplete: (email: string) => void;
    selectedTier: SelfServeTier;
}

const TIER_LABELS: Record<SelfServeTier, string> = {
    free: "Free",
    professional: "Professional",
    starter: "Starter",
};

export function SignupForm({
    mode = "signup",
    onComplete,
    selectedTier,
}: SignupFormProps): JSX.Element {
    const { signIn } = useAuthActions();
    const { isAuthenticated } = useConvexAuth();
    const registerWithTenant = useMutation(api.functions.users.registerWithTenant);
    const router = useRouter();
    const [serverError, setServerError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isRecoveryMode = mode === "tenant-retry";

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<SignupFormData>({
        resolver: zodResolver(signupSchema),
        defaultValues: {
            email: "",
            password: "",
            organizationName: "",
        },
    });
    const {
        register: registerOrganization,
        handleSubmit: handleRecoverySubmit,
        reset: resetOrganizationForm,
        formState: { errors: organizationErrors },
    } = useForm<OrganizationSetupFormData>({
        resolver: zodResolver(organizationSetupSchema),
        defaultValues: {
            organizationName: "",
        },
    });

    const passwordValue = watch("password");

    useEffect(() => {
        if (!isRecoveryMode) {
            return;
        }

        resetOrganizationForm({
            organizationName:
                sessionStorage.getItem(PENDING_ORG_NAME_STORAGE_KEY) ?? "",
        });
    }, [isRecoveryMode, resetOrganizationForm]);

    async function onSubmit(data: SignupFormData): Promise<void> {
        setServerError(null);
        setIsSubmitting(true);

        try {
            const normalizedEmail = normalizeAuthEmail(data.email);
            const normalizedOrganizationName = normalizePlainText(
                data.organizationName,
            );

            const formData = new FormData();
            formData.set("email", normalizedEmail);
            formData.set("password", data.password);
            formData.set("flow", "signUp");

            await signIn("password", formData);

            const pendingSignupState = createPendingSignupState({
                email: normalizedEmail,
                organizationName: normalizedOrganizationName,
                selectedTier,
            });

            sessionStorage.setItem(
                PENDING_ORG_NAME_STORAGE_KEY,
                pendingSignupState.organizationName,
            );
            sessionStorage.setItem(
                PENDING_SELECTED_TIER_STORAGE_KEY,
                pendingSignupState.selectedTier,
            );
            sessionStorage.setItem(
                PENDING_VERIFICATION_EMAIL_STORAGE_KEY,
                pendingSignupState.email,
            );
            sessionStorage.removeItem(PENDING_TENANT_SETUP_RETRY_STORAGE_KEY);
            onComplete(pendingSignupState.email);
        } catch (error: unknown) {
            if (error instanceof Error) {
                const message = error.message;
                if (
                    message.includes("already") ||
                    message.includes("exists") ||
                    message.includes("registered")
                ) {
                    setServerError("Email already registered. Try signing in instead.");
                } else {
                    setServerError("We could not complete your request right now. Please try again.");
                }
            } else {
                setServerError("We could not complete your request right now. Please try again.");
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    async function onSubmitRecovery(
        data: OrganizationSetupFormData,
    ): Promise<void> {
        setServerError(null);
        setIsSubmitting(true);

        try {
            if (!isAuthenticated) {
                setServerError("Please verify your email again to finish setting up your organization.");
                return;
            }

            const normalizedOrganizationName = normalizePlainText(
                data.organizationName,
            );
            const storedTier = resolveVerificationSelectedTier(
                sessionStorage.getItem(PENDING_SELECTED_TIER_STORAGE_KEY),
                selectedTier,
            );

            if (storedTier.shouldWarn) {
                console.warn(
                    "[signup] Pending selected tier was invalid during organization setup retry; defaulting to free.",
                );
            }

            sessionStorage.setItem(
                PENDING_ORG_NAME_STORAGE_KEY,
                normalizedOrganizationName,
            );
            sessionStorage.setItem(
                PENDING_SELECTED_TIER_STORAGE_KEY,
                storedTier.tier,
            );

            await registerWithTenant({
                organizationName: normalizedOrganizationName,
                selectedTier: storedTier.tier,
            });

            sessionStorage.removeItem(PENDING_ORG_NAME_STORAGE_KEY);
            sessionStorage.removeItem(PENDING_SELECTED_TIER_STORAGE_KEY);
            sessionStorage.removeItem(PENDING_TENANT_SETUP_RETRY_STORAGE_KEY);
            sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_STORAGE_KEY);
            router.push("/dashboard");
        } catch (error: unknown) {
            if (isExistingRoleAssignmentError(error)) {
                sessionStorage.removeItem(PENDING_ORG_NAME_STORAGE_KEY);
                sessionStorage.removeItem(PENDING_SELECTED_TIER_STORAGE_KEY);
                sessionStorage.removeItem(PENDING_TENANT_SETUP_RETRY_STORAGE_KEY);
                sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_STORAGE_KEY);
                router.push("/dashboard");
                return;
            }

            if (isOrganizationNameConflictError(error)) {
                setServerError(getPublicVerificationErrorMessage(error));
                return;
            }

            setServerError(
                "Account verified but organization setup failed. Please try a different name or contact support.",
            );
        } finally {
            setIsSubmitting(false);
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
                            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                    </svg>
                </div>
                <CardTitle className="text-2xl font-bold">
                    {isRecoveryMode
                        ? "Finish organization setup"
                        : "Create your account"}
                </CardTitle>
                <CardDescription>
                    {isRecoveryMode
                        ? `Your account is verified. Choose a different organization name to finish your ${TIER_LABELS[selectedTier]} setup.`
                        : `Start your ${TIER_LABELS[selectedTier]} Procureline account with annual July to June billing. No monthly billing is implied here.`}
                </CardDescription>
                <div className="mx-auto inline-flex rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                    Selected plan: {TIER_LABELS[selectedTier]}
                </div>
            </CardHeader>
            <form
                onSubmit={(event) => {
                    if (isRecoveryMode) {
                        void handleRecoverySubmit(onSubmitRecovery)(event);
                        return;
                    }

                    void handleSubmit(onSubmit)(event);
                }}
            >
                <CardContent className="space-y-4">
                    {serverError ? (
                        <div
                            className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                            role="alert"
                            id="server-error"
                        >
                            {serverError}
                        </div>
                    ) : null}

                    <div className="space-y-2">
                        <Label htmlFor="organizationName">Organization name</Label>
                        <Input
                            id="organizationName"
                            type="text"
                            placeholder="University of Nairobi"
                            autoComplete="organization"
                            {...(isRecoveryMode
                                ? registerOrganization("organizationName")
                                : register("organizationName"))}
                            aria-invalid={
                                isRecoveryMode
                                    ? organizationErrors.organizationName
                                        ? "true"
                                        : undefined
                                    : errors.organizationName
                                        ? "true"
                                        : undefined
                            }
                            aria-describedby={
                                isRecoveryMode
                                    ? organizationErrors.organizationName
                                        ? "organizationName-error"
                                        : undefined
                                    : errors.organizationName
                                        ? "organizationName-error"
                                        : undefined
                            }
                        />
                        {isRecoveryMode ? (
                            organizationErrors.organizationName ? (
                                <p
                                    id="organizationName-error"
                                    className="text-sm text-destructive"
                                >
                                    {organizationErrors.organizationName.message}
                                </p>
                            ) : null
                        ) : errors.organizationName ? (
                            <p
                                id="organizationName-error"
                                className="text-sm text-destructive"
                            >
                                {errors.organizationName.message}
                            </p>
                        ) : null}
                    </div>

                    {isRecoveryMode ? (
                        <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                            Your email is already verified. Updating the organization
                            name will retry tenant creation without creating another
                            account.
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@university.ac.ke"
                                    autoComplete="email"
                                    {...register("email")}
                                    aria-invalid={errors.email ? "true" : undefined}
                                    aria-describedby={errors.email ? "email-error" : undefined}
                                />
                                {errors.email ? (
                                    <p id="email-error" className="text-sm text-destructive">
                                        {errors.email.message}
                                    </p>
                                ) : null}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Create a strong password"
                                    autoComplete="new-password"
                                    {...register("password")}
                                    aria-invalid={errors.password ? "true" : undefined}
                                    aria-describedby="password-requirements"
                                />
                                {errors.password ? (
                                    <p className="text-sm text-destructive">
                                        {errors.password.message}
                                    </p>
                                ) : null}

                                <ul
                                    id="password-requirements"
                                    className="mt-2 space-y-1 text-xs"
                                    aria-label="Password requirements"
                                >
                                    {passwordRequirements.map((requirement) => {
                                        const met = requirement.test(passwordValue || "");
                                        return (
                                            <li
                                                key={requirement.label}
                                                className={`flex items-center gap-1.5 ${
                                                    met
                                                        ? "text-primary"
                                                        : "text-muted-foreground"
                                                }`}
                                            >
                                                <span className="flex-shrink-0">
                                                    {met ? (
                                                        <svg
                                                            className="h-3.5 w-3.5"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            strokeWidth={3}
                                                        >
                                                            <path
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                d="M5 13l4 4L19 7"
                                                            />
                                                        </svg>
                                                    ) : (
                                                        <svg
                                                            className="h-3.5 w-3.5"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            strokeWidth={2}
                                                        >
                                                            <circle cx="12" cy="12" r="9" />
                                                        </svg>
                                                    )}
                                                </span>
                                                {requirement.label}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        </>
                    )}
                </CardContent>

                <CardFooter className="flex flex-col gap-4">
                    <Button
                        id="signup-submit"
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
                                {isRecoveryMode
                                    ? "Completing setup..."
                                    : "Creating account..."}
                            </span>
                        ) : (
                            isRecoveryMode
                                ? "Complete organization setup"
                                : `Continue with ${TIER_LABELS[selectedTier]}`
                        )}
                    </Button>

                    <p className="text-center text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link
                            href="/login"
                            className="font-medium text-primary hover:underline"
                        >
                            Sign in
                        </Link>
                    </p>
                </CardFooter>
            </form>
        </Card>
    );
}
