"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthActions } from "@convex-dev/auth/react";
import { Check, Circle, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
    isPasswordResetLinkExpired,
    matchesInitialPasswordResetAttempt,
    normalizeAuthEmail,
    PASSWORD_RESET_EXPIRED_MESSAGE,
    PASSWORD_RESET_INVALID_MESSAGE,
    PASSWORD_RESET_SUCCESS_REASON,
    PASSWORD_RESET_TOO_MANY_ATTEMPTS_MESSAGE,
} from "@/lib/auth/password-reset";
import {
    passwordRequirements,
    resetPasswordSchema,
    type ResetPasswordFormData,
} from "@/lib/validators/auth";
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

interface ResetPasswordFormProps {
    initialCode?: string;
    initialEmail?: string;
    initialExpiresAt?: number;
}

export function ResetPasswordForm({
    initialCode,
    initialEmail,
    initialExpiresAt,
}: ResetPasswordFormProps) {
    const { signIn, signOut } = useAuthActions();
    const router = useRouter();
    const [serverError, setServerError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<ResetPasswordFormData>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: {
            email: initialEmail ?? "",
            code: initialCode ?? "",
            newPassword: "",
        },
    });

    const codeValue = watch("code");
    const emailValue = watch("email");
    const passwordValue = watch("newPassword");
    const linkIsExpired = isPasswordResetLinkExpired(initialExpiresAt);

    useEffect(() => {
        if (!initialCode || !initialEmail || !linkIsExpired) {
            return;
        }

        setServerError(PASSWORD_RESET_EXPIRED_MESSAGE);
    }, [initialCode, initialEmail, linkIsExpired]);

    async function onSubmit(data: ResetPasswordFormData): Promise<void> {
        setServerError(null);
        setIsSubmitting(true);

        const normalizedEmail = normalizeAuthEmail(data.email);
        const normalizedCode = data.code.trim();
        const matchesInitialAttempt = matchesInitialPasswordResetAttempt({
            initialCode,
            initialEmail,
            submittedCode: normalizedCode,
            submittedEmail: normalizedEmail,
        });

        try {
            if (linkIsExpired && matchesInitialAttempt) {
                setServerError(PASSWORD_RESET_EXPIRED_MESSAGE);
                return;
            }

            const formData = new FormData();
            formData.set("email", normalizedEmail);
            formData.set("code", normalizedCode);
            formData.set("newPassword", data.newPassword);
            formData.set("flow", "reset-verification");

            await signIn("password", formData);
            await signOut();
            router.replace(`/login?reason=${PASSWORD_RESET_SUCCESS_REASON}`);
        } catch (error: unknown) {
            if (error instanceof Error && error.message.includes("failed attempts")) {
                setServerError(PASSWORD_RESET_TOO_MANY_ATTEMPTS_MESSAGE);
            } else if (linkIsExpired && matchesInitialAttempt) {
                setServerError(PASSWORD_RESET_EXPIRED_MESSAGE);
            } else {
                setServerError(PASSWORD_RESET_INVALID_MESSAGE);
            }
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Card className="border-border/50 shadow-lg">
            <CardHeader className="space-y-1 text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <LockKeyhole className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold">
                    Reset your password
                </CardTitle>
                <CardDescription>
                    Enter the email, reset code, and your new password.
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
                        >
                            {serverError}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="reset-email">Email address</Label>
                        <Input
                            id="reset-email"
                            type="email"
                            placeholder="admin@university.ac.ke"
                            autoComplete="email"
                            {...register("email")}
                            aria-invalid={errors.email ? "true" : undefined}
                            aria-describedby={errors.email ? "reset-email-error" : undefined}
                        />
                        {errors.email && (
                            <p id="reset-email-error" className="text-sm text-destructive">
                                {errors.email.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reset-code">Reset code</Label>
                        <Input
                            id="reset-code"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={8}
                            placeholder="12345678"
                            autoComplete="one-time-code"
                            className="text-center text-lg font-mono tracking-[0.3em]"
                            {...register("code")}
                            aria-invalid={errors.code ? "true" : undefined}
                            aria-describedby={errors.code ? "reset-code-error" : undefined}
                        />
                        {errors.code && (
                            <p id="reset-code-error" className="text-sm text-destructive">
                                {errors.code.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="new-password">New password</Label>
                        <Input
                            id="new-password"
                            type="password"
                            autoComplete="new-password"
                            placeholder="••••••••••••"
                            {...register("newPassword")}
                            aria-invalid={errors.newPassword ? "true" : undefined}
                            aria-describedby="reset-password-requirements"
                        />
                        {errors.newPassword && (
                            <p className="text-sm text-destructive">
                                {errors.newPassword.message}
                            </p>
                        )}

                        <ul
                            id="reset-password-requirements"
                            className="mt-2 space-y-1 text-xs"
                            aria-label="Password requirements"
                        >
                            {passwordRequirements.map((requirement) => {
                                const isMet = requirement.test(passwordValue);
                                return (
                                    <li
                                        key={requirement.label}
                                        className={`flex items-center gap-1.5 ${isMet
                                            ? "text-primary"
                                            : "text-muted-foreground"
                                            }`}
                                    >
                                        <span className="flex-shrink-0">
                                            {isMet ? (
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

                    {initialCode && initialEmail && codeValue && emailValue && !serverError && (
                        <p className="text-xs text-muted-foreground">
                            Reset link detected from your email. You can continue here or
                            replace the email/code manually.
                        </p>
                    )}
                </CardContent>

                <CardFooter className="flex flex-col gap-4">
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Updating password..." : "Update password"}
                    </Button>

                    <p className="text-center text-sm text-muted-foreground">
                        Need a fresh reset email?{" "}
                        <Link
                            href="/forgot-password"
                            className="font-medium text-primary hover:underline"
                        >
                            Request another link
                        </Link>
                    </p>
                </CardFooter>
            </form>
        </Card>
    );
}
