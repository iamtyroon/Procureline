"use client";

import { useState } from "react";
import { SignupForm } from "@/src/components/auth/SignupForm";
import { VerifyEmailForm } from "@/src/components/auth/VerifyEmailForm";

export default function SignupPage() {
    const [step, setStep] = useState<"signup" | "verify">("signup");
    const [email, setEmail] = useState("");

    function handleSignupComplete(submittedEmail: string): void {
        setEmail(submittedEmail);
        setStep("verify");
    }

    if (step === "verify") {
        return (
            <VerifyEmailForm
                email={email}
                onBack={() => setStep("signup")}
            />
        );
    }

    return <SignupForm onComplete={handleSignupComplete} />;
}
