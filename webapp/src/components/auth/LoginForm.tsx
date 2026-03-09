"use client";

import { useEffect, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PASSWORD_RESET_SUCCESS_MESSAGE } from "@/lib/auth/password-reset";
import {
    clearRememberMeBootstrapValue,
    readRememberMeBootstrapValue,
    writeRememberMeBootstrapValue,
} from "@/lib/auth/session";
import { shouldTerminateAuthenticatedSession } from "@/lib/auth/roles";
import { normalizeAuthEmail } from "@/lib/security/input";
import { loginSchema, type LoginFormData } from "@/lib/validators/auth";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const AUTH_REASON_MESSAGES: Record<string, string> = {
    session_expired: "Your session has expired. Please log in again.",
    account_deactivated: "Account deactivated. Contact your administrator.",
    subscription_inactive: "Subscription inactive. Contact your administrator.",
    password_reset_success: PASSWORD_RESET_SUCCESS_MESSAGE,
};

interface LoginFormProps {
    reason?: string | null;
}

export function LoginForm({ reason }: LoginFormProps) {
    const { signIn, signOut } = useAuthActions();
    const { isAuthenticated } = useConvexAuth();
    const authContext = useQuery(
        api.functions.users.getAuthContext,
        isAuthenticated ? {} : "skip",
    );
    const ensureCurrentSessionMetadata = useMutation(
        api.functions.sessions.ensureCurrentSessionMetadata,
    );
    const router = useRouter();
    const [serverError, setServerError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        control,
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
            rememberMe: false,
        },
    });

    useEffect(() => {
        if (!isAuthenticated || authContext === undefined || authContext === null) {
            return;
        }

        const currentAuthContext = authContext;

        async function handleAuthenticatedState(): Promise<void> {
            if (!currentAuthContext.isSessionValid) {
                await signOut();
                clearRememberMeBootstrapValue();
                setIsSubmitting(false);
                setServerError(
                    AUTH_REASON_MESSAGES[
                        currentAuthContext.redirectReason ?? "session_expired"
                    ] ??
                        "Your session has expired. Please log in again.",
                );
                return;
            }

            if (shouldTerminateAuthenticatedSession(currentAuthContext)) {
                await signOut();
                clearRememberMeBootstrapValue();
                setIsSubmitting(false);
                setServerError(
                    AUTH_REASON_MESSAGES[
                        currentAuthContext.redirectReason ?? "session_expired"
                    ] ?? "Your account cannot access Procureline right now.",
                );
                return;
            }

            try {
                const bootstrapRememberMe = readRememberMeBootstrapValue();

                await ensureCurrentSessionMetadata(
                    bootstrapRememberMe === undefined
                        ? {}
                        : { rememberMe: bootstrapRememberMe },
                );

                clearRememberMeBootstrapValue();
                setIsSubmitting(false);
                router.replace(currentAuthContext.redirectPath);
            } catch {
                clearRememberMeBootstrapValue();
                await signOut();
                setIsSubmitting(false);
                setServerError(
                    "We could not initialize your session. Please sign in again.",
                );
            }
        }

        void handleAuthenticatedState();
    }, [
        authContext,
        ensureCurrentSessionMetadata,
        isAuthenticated,
        router,
        signOut,
    ]);

    async function onSubmit(data: LoginFormData): Promise<void> {
        setServerError(null);
        setIsSubmitting(true);

        if (process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true") {
            setServerError(
                "System is currently in maintenance mode. Expected return time: 2 hours. Please try again later.",
            );
            setIsSubmitting(false);
            return;
        }

        try {
            writeRememberMeBootstrapValue(data.rememberMe);
            const normalizedEmail = normalizeAuthEmail(data.email);

            const formData = new FormData();
            formData.set("email", normalizedEmail);
            formData.set("password", data.password);
            formData.set("flow", "signIn");

            await signIn("password", formData);
        } catch (error: unknown) {
            setIsSubmitting(false);
            clearRememberMeBootstrapValue();

            if (error instanceof Error) {
                const message = error.message;
                if (
                    message.includes("Invalid credentials") ||
                    message.includes("not found") ||
                    message.includes("password")
                ) {
                    setServerError("Invalid email or incorrect password. Please try again.");
                } else if (message.includes("maintenance")) {
                    setServerError("System is currently in maintenance mode. Please try again later.");
                } else {
                    setServerError(message || "An unexpected error occurred. Please try again.");
                }
            } else {
                setServerError("An unexpected error occurred. Please try again.");
            }
        }
    }

    const reasonMessage = reason ? (AUTH_REASON_MESSAGES[reason] ?? null) : null;
    const isBusy =
        isSubmitting ||
        (isAuthenticated &&
            authContext !== undefined &&
            authContext !== null &&
            authContext.isSessionValid);

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
                            d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                        />
                    </svg>
                </div>
                <CardTitle className="text-2xl font-bold">
                    Welcome back
                </CardTitle>
                <CardDescription>
                    Enter your email to sign in to your account
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

                    {reasonMessage && !serverError && (
                        <div
                            className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary"
                            role="alert"
                        >
                            {reasonMessage}
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
                            aria-describedby={errors.email ? "email-error" : undefined}
                        />
                        {errors.email && (
                            <p id="email-error" className="text-sm text-destructive">
                                {errors.email.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password">Password</Label>
                            <Link
                                href="/forgot-password"
                                className="text-sm font-medium text-primary hover:underline"
                            >
                                Forgot password?
                            </Link>
                        </div>
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••••••"
                            autoComplete="current-password"
                            {...register("password")}
                            aria-invalid={errors.password ? "true" : undefined}
                        />
                        {errors.password && (
                            <p className="text-sm text-destructive">
                                {errors.password.message}
                            </p>
                        )}
                    </div>

                    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
                        <Controller
                            control={control}
                            name="rememberMe"
                            render={({ field }) => (
                                <Checkbox
                                    id="remember-me"
                                    checked={field.value}
                                    onCheckedChange={(checked) =>
                                        field.onChange(checked === true)
                                    }
                                    aria-describedby="remember-me-help"
                                />
                            )}
                        />
                        <div className="space-y-1">
                            <Label htmlFor="remember-me" className="cursor-pointer">
                                Remember me
                            </Label>
                            <p
                                id="remember-me-help"
                                className="text-sm text-muted-foreground"
                            >
                                Keep this browser signed in for up to 30 days.
                            </p>
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-4">
                    <Button
                        id="login-submit"
                        type="submit"
                        className="w-full"
                        disabled={isBusy}
                    >
                        {isBusy ? (
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
                                Signing in…
                            </span>
                        ) : (
                            "Sign in"
                        )}
                    </Button>

                    <p className="text-center text-sm text-muted-foreground">
                        Don&apos;t have an account?{" "}
                        <Link
                            href="/signup"
                            className="font-medium text-primary hover:underline"
                        >
                            Sign up
                        </Link>
                    </p>
                </CardFooter>
            </form>
        </Card>
    );
}
