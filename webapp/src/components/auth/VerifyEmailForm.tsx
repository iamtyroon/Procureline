"use client";

import { useState, useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
    onBack: () => void;
}

export function VerifyEmailForm({ email, onBack }: VerifyEmailFormProps) {
    const { signIn } = useAuthActions();
    const { isAuthenticated } = useConvexAuth();
    const registerWithTenant = useMutation(api.functions.users.registerWithTenant);
    const router = useRouter();
    const [serverError, setServerError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<OtpFormData>({
        resolver: zodResolver(otpSchema),
        defaultValues: { code: "" },
    });

    // Cooldown timer for resend
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    // After successful verification, register tenant
    useEffect(() => {
        if (!isAuthenticated) return;

        const orgName = sessionStorage.getItem("pendingOrgName");
        if (!orgName) {
            router.push("/dashboard");
            return;
        }

        async function createTenant(): Promise<void> {
            try {
                await registerWithTenant({ organizationName: orgName! });
                sessionStorage.removeItem("pendingOrgName");
                router.push("/dashboard");
            } catch (error: unknown) {
                // If ALREADY_EXISTS, tenant already created — just redirect
                if (
                    error instanceof Error &&
                    error.message.includes("already")
                ) {
                    sessionStorage.removeItem("pendingOrgName");
                    router.push("/dashboard");
                    return;
                }
                setServerError("Account created but organization setup failed. Please contact support.");
            }
        }

        createTenant();
    }, [isAuthenticated, registerWithTenant, router]);

    async function onSubmit(data: OtpFormData): Promise<void> {
        setServerError(null);
        setIsSubmitting(true);

        try {
            const formData = new FormData();
            formData.set("email", email);
            formData.set("code", data.code);
            formData.set("flow", "email-verification");

            await signIn("password", formData);
            // If signIn succeeds, the isAuthenticated useEffect above handles tenant creation
        } catch (error: unknown) {
            if (error instanceof Error) {
                if (
                    error.message.includes("invalid") ||
                    error.message.includes("code") ||
                    error.message.includes("expired")
                ) {
                    setServerError(
                        "Invalid or expired verification code. Please try again.",
                    );
                } else {
                    setServerError(
                        error.message || "Verification failed. Please try again.",
                    );
                }
            } else {
                setServerError("Verification failed. Please try again.");
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleResend(): Promise<void> {
        if (resendCooldown > 0) return;
        setIsResending(true);
        setServerError(null);

        try {
            const formData = new FormData();
            formData.set("email", email);
            formData.set("flow", "signUp");

            // Re-trigger the sign-up flow to resend the OTP
            await signIn("password", formData);
            setResendCooldown(60);
        } catch {
            // Resend may throw but code still sent
            setResendCooldown(60);
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
            </CardHeader>

            <form onSubmit={handleSubmit(onSubmit)}>
                <CardContent className="space-y-4">
                    {serverError && (
                        <div
                            className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                            role="alert"
                            id="verify-error"
                        >
                            {serverError}
                        </div>
                    )}

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
                            aria-describedby={
                                errors.code ? "code-error" : undefined
                            }
                        />
                        {errors.code && (
                            <p id="code-error" className="text-sm text-destructive">
                                {errors.code.message}
                            </p>
                        )}
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
                                Verifying…
                            </span>
                        ) : (
                            "Verify email"
                        )}
                    </Button>

                    <div className="flex items-center justify-between w-full text-sm">
                        <button
                            type="button"
                            onClick={onBack}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                            ← Back
                        </button>

                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={isResending || resendCooldown > 0}
                            className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline transition-colors"
                        >
                            {resendCooldown > 0
                                ? `Resend in ${resendCooldown}s`
                                : isResending
                                    ? "Sending…"
                                    : "Resend code"}
                        </button>
                    </div>
                </CardFooter>
            </form>
        </Card>
    );
}
