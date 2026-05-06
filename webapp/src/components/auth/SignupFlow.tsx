"use client";

import { useCallback, useEffect, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import {
    PENDING_INVITE_TOKEN_STORAGE_KEY,
    PENDING_TENANT_SETUP_RETRY_STORAGE_KEY,
    PENDING_VERIFICATION_EMAIL_STORAGE_KEY,
    restoreSignupFlowState,
    type SignupMode,
    type SignupStep,
} from "@/lib/shared/auth/signup-flow";
import type { SelfServeTier } from "@/lib/shared/marketing/pricing";
import { api } from "@/convex/_generated/api";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { SignupForm } from "@/src/components/auth/SignupForm";
import { VerifyEmailForm } from "@/src/components/auth/VerifyEmailForm";
import { Spinner } from "@/src/components/ui/Spinner";

interface SignupFlowProps {
    initialEmail?: string;
    initialOrganizationName?: string;
    initialStep?: SignupStep;
    inviteToken?: string;
    selectedTier: SelfServeTier;
}

export function SignupFlow({
    initialEmail,
    initialOrganizationName,
    initialStep,
    inviteToken,
    selectedTier,
}: SignupFlowProps): JSX.Element {
    const { isAuthenticated } = useConvexAuth();
    const [step, setStep] = useState<SignupStep>("signup");
    const [mode, setMode] = useState<SignupMode>("signup");
    const [email, setEmail] = useState("");
    const invitationContext = useQuery(
        api.functions.tenantAdminOnboarding.getInvitationContext,
        inviteToken ? { inviteToken } : "skip",
    );

    useEffect(() => {
        if (step !== "signup") {
            return;
        }

        const storedInviteToken =
            sessionStorage.getItem(PENDING_INVITE_TOKEN_STORAGE_KEY) ?? inviteToken;
        const restoredState = restoreSignupFlowState({
            inviteToken: storedInviteToken ?? undefined,
            isAuthenticated,
            organizationNameFromQuery: initialOrganizationName,
            pendingTenantSetupRetry:
                sessionStorage.getItem(PENDING_TENANT_SETUP_RETRY_STORAGE_KEY) ===
                "true",
            pendingVerificationEmailFromQuery: initialEmail,
            pendingVerificationEmail: sessionStorage.getItem(
                PENDING_VERIFICATION_EMAIL_STORAGE_KEY,
            ),
            stepFromQuery: initialStep,
        });
        setEmail(restoredState.email);
        setMode(restoredState.mode);
        setStep(restoredState.step);
    }, [initialEmail, initialOrganizationName, initialStep, inviteToken, isAuthenticated, step]);

    const handleSignupComplete = useCallback(
        (
            submittedEmail: string,
            completedMode: Exclude<SignupMode, "tenant-retry">,
            completedInviteToken?: string,
        ): void => {
            sessionStorage.setItem(
                PENDING_VERIFICATION_EMAIL_STORAGE_KEY,
                submittedEmail,
            );
            if (completedInviteToken) {
                sessionStorage.setItem(
                    PENDING_INVITE_TOKEN_STORAGE_KEY,
                    completedInviteToken,
                );
            } else {
                sessionStorage.removeItem(PENDING_INVITE_TOKEN_STORAGE_KEY);
            }
            setEmail(submittedEmail);
            setMode(completedMode);
            setStep("verify");
        },
        [],
    );

    const handleVerificationBack = useCallback((options?: {
        retryTenantSetup?: boolean;
    }): void => {
        sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_STORAGE_KEY);
        if (options?.retryTenantSetup) {
            sessionStorage.setItem(PENDING_TENANT_SETUP_RETRY_STORAGE_KEY, "true");
            setMode("tenant-retry");
        } else {
            sessionStorage.removeItem(PENDING_TENANT_SETUP_RETRY_STORAGE_KEY);
            setMode(inviteToken ? "invite" : "signup");
        }

        setEmail("");
        setStep("signup");
    }, [inviteToken]);

    if (inviteToken) {
        if (invitationContext === undefined) {
            return (
                <Card className="border-border/50 shadow-lg">
                    <CardContent className="flex items-center justify-center gap-3 py-12">
                        <Spinner />
                        <p className="text-sm text-muted-foreground">
                            Validating your invitation...
                        </p>
                    </CardContent>
                </Card>
            );
        }

        if (!invitationContext.isValid) {
            return (
                <Card className="border-border/50 shadow-lg">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold">
                            Invitation unavailable
                        </CardTitle>
                        <CardDescription>
                            {invitationContext.message ??
                                "This invitation could not be used."}
                        </CardDescription>
                    </CardHeader>
                </Card>
            );
        }
    }

    if (step === "verify") {
        return (
            <VerifyEmailForm
                email={email}
                inviteToken={mode === "invite" ? inviteToken : undefined}
                initialOrganizationName={initialOrganizationName}
                mode={mode === "invite" ? "invite" : "signup"}
                onBack={handleVerificationBack}
                selectedTier={selectedTier}
                tenantName={invitationContext?.tenantName}
            />
        );
    }

    return (
        <SignupForm
            inviteToken={inviteToken}
            invitedEmail={invitationContext?.email}
            invitedTenantName={invitationContext?.tenantName}
            initialOrganizationName={initialOrganizationName}
            mode={mode}
            onComplete={handleSignupComplete}
            selectedTier={selectedTier}
        />
    );
}
