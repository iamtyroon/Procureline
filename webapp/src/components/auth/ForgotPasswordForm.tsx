"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAction } from "convex/react";
import { LockKeyhole } from "lucide-react";
import { useForm } from "react-hook-form";
import { api } from "@/convex/_generated/api";
import {
    normalizeAuthEmail,
    PASSWORD_RESET_REQUEST_ERROR_MESSAGE,
    PASSWORD_RESET_REQUEST_MESSAGE,
} from "@/lib/shared/auth/password-reset";
import {
    forgotPasswordSchema,
    type ForgotPasswordFormData,
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

export function ForgotPasswordForm({
    continueTo,
}: {
    continueTo?: string;
}) {
    const requestPasswordReset = useAction(api.functions.auth.requestPasswordReset);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
    const [serverError, setServerError] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ForgotPasswordFormData>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: { email: "" },
    });

    useEffect(() => {
        if (cooldown <= 0) {
            return;
        }

        const timer = window.setTimeout(() => {
            setCooldown((currentCooldown) => currentCooldown - 1);
        }, 1000);

        return () => window.clearTimeout(timer);
    }, [cooldown]);

    async function onSubmit(data: ForgotPasswordFormData): Promise<void> {
        setIsSubmitting(true);
        setFeedbackMessage(null);
        setServerError(null);

        try {
            const normalizedEmail = normalizeAuthEmail(data.email);
            await requestPasswordReset({
                continueTo,
                email: normalizedEmail,
            });

            setIsSubmitting(false);
            setCooldown(60);
            setFeedbackMessage(PASSWORD_RESET_REQUEST_MESSAGE);
        } catch (_error: unknown) {
            setIsSubmitting(false);
            setServerError(PASSWORD_RESET_REQUEST_ERROR_MESSAGE);
        }
    }

    return (
        <Card className="border-border/50 shadow-lg">
            <CardHeader className="space-y-1 text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <LockKeyhole className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold">
                    Forgot your password?
                </CardTitle>
                <CardDescription>
                    Enter your registered email and we&apos;ll send a reset link.
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

                    {feedbackMessage && (
                        <div
                            className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary"
                            role="status"
                        >
                            {feedbackMessage}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="email">Email address</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="admin@university.ac.ke"
                            autoComplete="email"
                            {...register("email")}
                            aria-invalid={errors.email ? "true" : undefined}
                            aria-describedby={errors.email ? "forgot-email-error" : undefined}
                        />
                        {errors.email && (
                            <p
                                id="forgot-email-error"
                                className="text-sm text-destructive"
                            >
                                {errors.email.message}
                            </p>
                        )}
                    </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-4">
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={isSubmitting || cooldown > 0}
                    >
                        {isSubmitting
                            ? "Sending reset link..."
                            : cooldown > 0
                                ? `Try again in ${cooldown}s`
                                : "Email reset link"}
                    </Button>

                    <p className="text-center text-sm text-muted-foreground">
                        Remembered your password?{" "}
                        <Link
                            href="/login"
                            className="font-medium text-primary hover:underline"
                        >
                            Back to sign in
                        </Link>
                    </p>
                </CardFooter>
            </form>
        </Card>
    );
}
