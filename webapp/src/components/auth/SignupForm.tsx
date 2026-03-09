"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { normalizeAuthEmail, normalizePlainText } from "@/lib/security/input";
import { signupSchema, type SignupFormData, passwordRequirements } from "@/lib/validators/auth";
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
    onComplete: (email: string) => void;
}

export function SignupForm({ onComplete }: SignupFormProps) {
    const { signIn } = useAuthActions();
    const [serverError, setServerError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    const passwordValue = watch("password");

    async function onSubmit(data: SignupFormData): Promise<void> {
        setServerError(null);
        setIsSubmitting(true);

        try {
            const normalizedEmail = normalizeAuthEmail(data.email);
            const normalizedOrganizationName = normalizePlainText(
                data.organizationName,
            );

            // Create FormData for Convex Auth signIn
            const formData = new FormData();
            formData.set("email", normalizedEmail);
            formData.set("password", data.password);
            formData.set("flow", "signUp");

            // signIn returns void on success, throws on error
            // When verify (ResendOTP) is configured, signIn triggers email verification
            await signIn("password", formData);

            // Store org name in sessionStorage for after verification
            sessionStorage.setItem("pendingOrgName", normalizedOrganizationName);

            // Move to verify step
            onComplete(normalizedEmail);
        } catch (error: unknown) {
            if (error instanceof Error) {
                const message = error.message;
                if (
                    message.includes("already") ||
                    message.includes("exists") ||
                    message.includes("registered")
                ) {
                    setServerError("Email already registered. Try signing in instead.");
                } else if (message.includes("verify") || message.includes("code")) {
                    // Password provider with verify triggers email verification
                    // This is actually success — user needs to enter OTP
                    sessionStorage.setItem(
                        "pendingOrgName",
                        normalizePlainText(data.organizationName),
                    );
                    onComplete(normalizeAuthEmail(data.email));
                    return;
                } else {
                    setServerError(message || "An unexpected error occurred. Please try again.");
                }
            } else {
                setServerError("An unexpected error occurred. Please try again.");
            }
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
                    Create your account
                </CardTitle>
                <CardDescription>
                    Start your free Procureline account — no credit card required
                </CardDescription>
            </CardHeader>
            <form
                onSubmit={(event) => {
                    void handleSubmit(onSubmit)(event);
                }}
            >
                <CardContent className="space-y-4">
                    {serverError && (
                        <div
                            className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                            role="alert"
                            id="server-error"
                        >
                            {serverError}
                        </div>
                    )}

                    {/* Organization Name */}
                    <div className="space-y-2">
                        <Label htmlFor="organizationName">Organization name</Label>
                        <Input
                            id="organizationName"
                            type="text"
                            placeholder="University of Nairobi"
                            autoComplete="organization"
                            {...register("organizationName")}
                            aria-invalid={errors.organizationName ? "true" : undefined}
                            aria-describedby={
                                errors.organizationName
                                    ? "organizationName-error"
                                    : undefined
                            }
                        />
                        {errors.organizationName && (
                            <p
                                id="organizationName-error"
                                className="text-sm text-destructive"
                            >
                                {errors.organizationName.message}
                            </p>
                        )}
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                        <Label htmlFor="email">Email address</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="admin@university.ac.ke"
                            autoComplete="email"
                            {...register("email")}
                            aria-invalid={errors.email ? "true" : undefined}
                            aria-describedby={
                                errors.email ? "email-error" : undefined
                            }
                        />
                        {errors.email && (
                            <p id="email-error" className="text-sm text-destructive">
                                {errors.email.message}
                            </p>
                        )}
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••••••"
                            autoComplete="new-password"
                            {...register("password")}
                            aria-invalid={errors.password ? "true" : undefined}
                            aria-describedby="password-requirements"
                        />
                        {errors.password && (
                            <p className="text-sm text-destructive">
                                {errors.password.message}
                            </p>
                        )}

                        {/* Password strength checklist */}
                        <ul
                            id="password-requirements"
                            className="mt-2 space-y-1 text-xs"
                            aria-label="Password requirements"
                        >
                            {passwordRequirements.map((req) => {
                                const met = req.test(passwordValue || "");
                                return (
                                    <li
                                        key={req.label}
                                        className={`flex items-center gap-1.5 ${met
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
                                        {req.label}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
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
                                Creating account…
                            </span>
                        ) : (
                            "Create free account"
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
