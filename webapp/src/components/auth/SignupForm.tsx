"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useConvexAuth, useMutation } from "convex/react";
import { Check, Circle, LoaderCircle, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
    createPendingSignupState,
    PENDING_INVITE_TOKEN_STORAGE_KEY,
    PENDING_ORG_NAME_STORAGE_KEY,
    PENDING_SELECTED_TIER_STORAGE_KEY,
    PENDING_TENANT_SETUP_RETRY_STORAGE_KEY,
    PENDING_VERIFICATION_EMAIL_STORAGE_KEY,
} from "@/lib/auth/signup-flow";
import {
    getPublicVerificationErrorMessage,
    isExistingRoleAssignmentError,
    isOrganizationNameConflictError,
} from "@/lib/errors/convex";
import {
    resolveVerificationSelectedTier,
    type SelfServeTier,
} from "@/lib/marketing/pricing";
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

type InviteSignupFormData = Pick<SignupFormData, "email" | "password">;

interface SignupFormProps {
    initialOrganizationName?: string;
    inviteToken?: string;
    invitedEmail?: string;
    invitedTenantName?: string;
    mode?: "signup" | "invite" | "tenant-retry";
    onComplete: (
        email: string,
        mode: "signup" | "invite",
        inviteToken?: string,
    ) => void;
    selectedTier: SelfServeTier;
}

const TIER_LABELS: Record<SelfServeTier, string> = {
    free: "Free",
    professional: "Professional",
    starter: "Starter",
};

export function SignupForm({
    initialOrganizationName,
    inviteToken,
    invitedEmail,
    invitedTenantName,
    mode = "signup",
    onComplete,
    selectedTier,
}: SignupFormProps): JSX.Element {
    const { signIn } = useAuthActions();
    const { isAuthenticated } = useConvexAuth();
    const registerWithTenant = useMutation(api.functions.users.registerWithTenant);
    const startVerificationWindow = useMutation(
        api.functions.tenantAdminOnboarding.startVerificationWindow,
    );
    const router = useRouter();
    const [serverError, setServerError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isInviteMode = mode === "invite";
    const isRecoveryMode = mode === "tenant-retry";

    const signupForm = useForm<SignupFormData>({
        resolver: zodResolver(signupSchema),
        defaultValues: {
            email: "",
            organizationName: "",
            password: "",
        },
    });
    const inviteForm = useForm<InviteSignupFormData>({
        resolver: zodResolver(signupSchema.omit({ organizationName: true })),
        defaultValues: {
            email: invitedEmail ?? "",
            password: "",
        },
    });
    const recoveryForm = useForm<OrganizationSetupFormData>({
        resolver: zodResolver(organizationSetupSchema),
        defaultValues: {
            organizationName: "",
        },
    });

    const passwordValue = isInviteMode
        ? inviteForm.watch("password")
        : signupForm.watch("password");

    useEffect(() => {
        if (!isRecoveryMode) {
            return;
        }

        recoveryForm.reset({
            organizationName:
                sessionStorage.getItem(PENDING_ORG_NAME_STORAGE_KEY) ??
                initialOrganizationName ??
                "",
        });
    }, [initialOrganizationName, isRecoveryMode, recoveryForm]);

    useEffect(() => {
        if (!isInviteMode) {
            return;
        }

        inviteForm.reset({
            email: invitedEmail ?? "",
            password: "",
        });
    }, [inviteForm, invitedEmail, isInviteMode]);

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
            await startVerificationWindow({
                email: normalizedEmail,
                mode: "self_serve",
            });

            const pendingSignupState = createPendingSignupState({
                email: normalizedEmail,
                inviteToken: undefined,
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
            sessionStorage.removeItem(PENDING_INVITE_TOKEN_STORAGE_KEY);
            sessionStorage.removeItem(PENDING_TENANT_SETUP_RETRY_STORAGE_KEY);
            onComplete(pendingSignupState.email, "signup");
        } catch (error: unknown) {
            if (
                error instanceof Error &&
                (error.message.includes("already") ||
                    error.message.includes("exists") ||
                    error.message.includes("registered"))
            ) {
                setServerError("Email already registered. Try signing in instead.");
            } else {
                setServerError(
                    "We could not complete your request right now. Please try again.",
                );
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    async function onSubmitInvite(data: InviteSignupFormData): Promise<void> {
        setServerError(null);
        setIsSubmitting(true);

        try {
            const normalizedEmail = normalizeAuthEmail(data.email);

            await startVerificationWindow({
                email: normalizedEmail,
                inviteToken,
                mode: "invite",
            });

            const formData = new FormData();
            formData.set("email", normalizedEmail);
            formData.set("password", data.password);
            formData.set("flow", "signUp");

            await signIn("password", formData);

            sessionStorage.setItem(
                PENDING_VERIFICATION_EMAIL_STORAGE_KEY,
                normalizedEmail,
            );
            if (inviteToken) {
                sessionStorage.setItem(PENDING_INVITE_TOKEN_STORAGE_KEY, inviteToken);
            }
            sessionStorage.removeItem(PENDING_TENANT_SETUP_RETRY_STORAGE_KEY);
            onComplete(normalizedEmail, "invite", inviteToken);
        } catch (error: unknown) {
            if (isExistingRoleAssignmentError(error)) {
                setServerError(
                    "Email already in use. Sign in with that account or use the invited email.",
                );
            } else if (error instanceof Error && error.message.includes("registered")) {
                setServerError(
                    "Email already in use. Sign in with that account or use the invited email.",
                );
            } else {
                setServerError(getPublicVerificationErrorMessage(error));
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
                setServerError(
                    "Please verify your email again to finish setting up your organization.",
                );
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
            sessionStorage.removeItem(PENDING_INVITE_TOKEN_STORAGE_KEY);
            router.push("/dashboard");
        } catch (error: unknown) {
            if (isExistingRoleAssignmentError(error)) {
                sessionStorage.removeItem(PENDING_ORG_NAME_STORAGE_KEY);
                sessionStorage.removeItem(PENDING_SELECTED_TIER_STORAGE_KEY);
                sessionStorage.removeItem(PENDING_TENANT_SETUP_RETRY_STORAGE_KEY);
                sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_STORAGE_KEY);
                sessionStorage.removeItem(PENDING_INVITE_TOKEN_STORAGE_KEY);
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
                    <UserPlus className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold">
                    {isRecoveryMode
                        ? "Finish organization setup"
                        : isInviteMode
                            ? "Accept your invitation"
                            : "Create your account"}
                </CardTitle>
                <CardDescription>
                    {isRecoveryMode
                        ? `Your account is verified. Choose a different organization name to finish your ${TIER_LABELS[selectedTier]} setup.`
                        : isInviteMode
                            ? `Create a password for the ${invitedTenantName ?? "institution"} tenant-admin invitation sent to your email.`
                            : `Start your ${TIER_LABELS[selectedTier]} Procureline account with annual July to June billing. No monthly billing is implied here.`}
                </CardDescription>
                <div className="mx-auto inline-flex rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                    {isInviteMode
                        ? "Tenant-admin invitation"
                        : `Selected plan: ${TIER_LABELS[selectedTier]}`}
                </div>
            </CardHeader>
            <form
                onSubmit={(event) => {
                    if (isRecoveryMode) {
                        void recoveryForm.handleSubmit(onSubmitRecovery)(event);
                        return;
                    }

                    if (isInviteMode) {
                        void inviteForm.handleSubmit(onSubmitInvite)(event);
                        return;
                    }

                    void signupForm.handleSubmit(onSubmit)(event);
                }}
            >
                <CardContent className="space-y-4">
                    {serverError ? (
                        <div
                            className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                            id="server-error"
                            role="alert"
                        >
                            {serverError}
                        </div>
                    ) : null}

                    {isInviteMode ? (
                        <div className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                            Invitation for{" "}
                            <span className="font-medium text-foreground">
                                {invitedTenantName ?? "your institution"}
                            </span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="organizationName">Organization name</Label>
                            <Input
                                id="organizationName"
                                type="text"
                                placeholder="University of Nairobi"
                                autoComplete="organization"
                                {...(isRecoveryMode
                                    ? recoveryForm.register("organizationName")
                                    : signupForm.register("organizationName"))}
                            />
                            {isRecoveryMode
                                ? recoveryForm.formState.errors.organizationName?.message
                                    ? (
                                        <p className="text-sm text-destructive">
                                            {
                                                recoveryForm.formState.errors.organizationName
                                                    .message
                                            }
                                        </p>
                                    )
                                    : null
                                : signupForm.formState.errors.organizationName?.message
                                    ? (
                                        <p className="text-sm text-destructive">
                                            {
                                                signupForm.formState.errors.organizationName
                                                    .message
                                            }
                                        </p>
                                    )
                                    : null}
                        </div>
                    )}

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
                                    readOnly={isInviteMode}
                                    {...(isInviteMode
                                        ? inviteForm.register("email")
                                        : signupForm.register("email"))}
                                />
                                {(isInviteMode
                                    ? inviteForm.formState.errors.email?.message
                                    : signupForm.formState.errors.email?.message) ? (
                                    <p className="text-sm text-destructive">
                                        {isInviteMode
                                            ? inviteForm.formState.errors.email?.message
                                            : signupForm.formState.errors.email?.message}
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
                                    {...(isInviteMode
                                        ? inviteForm.register("password")
                                        : signupForm.register("password"))}
                                />
                                {(isInviteMode
                                    ? inviteForm.formState.errors.password?.message
                                    : signupForm.formState.errors.password?.message) ? (
                                    <p className="text-sm text-destructive">
                                        {isInviteMode
                                            ? inviteForm.formState.errors.password?.message
                                            : signupForm.formState.errors.password?.message}
                                    </p>
                                ) : null}

                                <ul
                                    className="mt-2 space-y-1 text-xs"
                                    aria-label="Password requirements"
                                    id="password-requirements"
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
                                                        <Check className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <Circle className="h-3.5 w-3.5" />
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
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                                {isRecoveryMode
                                    ? "Completing setup..."
                                    : isInviteMode
                                        ? "Accepting invitation..."
                                        : "Creating account..."}
                            </span>
                        ) : isRecoveryMode ? (
                            "Complete organization setup"
                        ) : isInviteMode ? (
                            "Continue with invitation"
                        ) : (
                            `Continue with ${TIER_LABELS[selectedTier]}`
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
