"use client";

import { useCallback, useEffect, useState } from "react";
import { useConvexAuth } from "convex/react";
import {
    PENDING_TENANT_SETUP_RETRY_STORAGE_KEY,
    PENDING_VERIFICATION_EMAIL_STORAGE_KEY,
    restoreSignupFlowState,
    type SignupMode,
    type SignupStep,
} from "@/lib/auth/signup-flow";
import type { SelfServeTier } from "@/lib/marketing/pricing";
import { SignupForm } from "@/src/components/auth/SignupForm";
import { VerifyEmailForm } from "@/src/components/auth/VerifyEmailForm";

interface SignupFlowProps {
    selectedTier: SelfServeTier;
}

export function SignupFlow({ selectedTier }: SignupFlowProps): JSX.Element {
    const { isAuthenticated } = useConvexAuth();
    const [step, setStep] = useState<SignupStep>("signup");
    const [mode, setMode] = useState<SignupMode>("signup");
    const [email, setEmail] = useState("");

    useEffect(() => {
        if (step !== "signup") {
            return;
        }

        const restoredState = restoreSignupFlowState({
            isAuthenticated,
            pendingTenantSetupRetry:
                sessionStorage.getItem(PENDING_TENANT_SETUP_RETRY_STORAGE_KEY) ===
                "true",
            pendingVerificationEmail: sessionStorage.getItem(
                PENDING_VERIFICATION_EMAIL_STORAGE_KEY,
            ),
        });
        setEmail(restoredState.email);
        setMode(restoredState.mode);
        setStep(restoredState.step);
    }, [isAuthenticated, step]);

    const handleSignupComplete = useCallback((submittedEmail: string): void => {
        sessionStorage.setItem(
            PENDING_VERIFICATION_EMAIL_STORAGE_KEY,
            submittedEmail,
        );
        setEmail(submittedEmail);
        setMode("signup");
        setStep("verify");
    }, []);

    const handleVerificationBack = useCallback((options?: {
        retryTenantSetup?: boolean;
    }): void => {
        sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_STORAGE_KEY);
        if (options?.retryTenantSetup) {
            sessionStorage.setItem(PENDING_TENANT_SETUP_RETRY_STORAGE_KEY, "true");
            setMode("tenant-retry");
        } else {
            sessionStorage.removeItem(PENDING_TENANT_SETUP_RETRY_STORAGE_KEY);
            setMode("signup");
        }

        setEmail("");
        setStep("signup");
    }, []);

    if (step === "verify") {
        return (
            <VerifyEmailForm
                email={email}
                onBack={handleVerificationBack}
                selectedTier={selectedTier}
            />
        );
    }

    return (
        <SignupForm
            mode={mode}
            onComplete={handleSignupComplete}
            selectedTier={selectedTier}
        />
    );
}
