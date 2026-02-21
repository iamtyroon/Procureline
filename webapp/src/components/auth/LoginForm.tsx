"use client";

import { useState, useEffect } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormData } from "@/lib/validators/auth";
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
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, useSearchParams } from "next/navigation";
export function LoginForm() {
    const { signIn } = useAuthActions();
    const router = useRouter();
    const [serverError, setServerError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // We fetch the user context to know where to redirect and if they are active
    const authContext = useQuery(api.functions.users.getAuthContext);
    const searchParams = useSearchParams();
    const reason = searchParams.get("reason");

    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    // Check if we already logged in and context loaded
    useEffect(() => {
        if (authContext !== undefined && authContext !== null) {
            if (authContext.isActive === false) {
                if (!serverError || serverError !== "Account deactivated. Contact your administrator.") {
                    setServerError("Account deactivated. Contact your administrator.");
                }
            } else if (authContext.tenantStatus !== "active") {
                if (!serverError || serverError !== "Subscription inactive. Contact your administrator.") {
                    setServerError("Subscription inactive. Contact your administrator.");
                }
            } else {
                // Role based redirect
                const role = authContext.role;
                if (role === "tenant_admin") {
                    router.push("/tenant-admin");
                } else if (role === "procurement_officer") {
                    router.push("/po");
                } else if (role === "department_user") {
                    router.push("/du");
                } else {
                    router.push("/dashboard");
                }
            }
        }
    }, [authContext, router, serverError]);

    async function onSubmit(data: LoginFormData): Promise<void> {
        setServerError(null);
        setIsSubmitting(true);

        // Check maintenance mode
        if (process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true") {
            setServerError("System is currently in maintenance mode. Expected return time: 2 hours. Please try again later.");
            setIsSubmitting(false);
            return;
        }

        try {
            const formData = new FormData();
            formData.set("email", data.email.toLowerCase().trim());
            formData.set("password", data.password);
            formData.set("flow", "signIn");

            await signIn("password", formData);
            // After successful sign in, the authContext query will update automatically
        } catch (error: unknown) {
            setIsSubmitting(false);
            if (error instanceof Error) {
                const message = error.message;
                if (message.includes("Invalid credentials") || message.includes("not found") || message.includes("password")) {
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
            <form onSubmit={handleSubmit(onSubmit)}>
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

                    {reason === "session_expired" && !serverError && (
                        <div
                            className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary"
                            role="alert"
                        >
                            Your session has expired. Please log in again.
                        </div>
                    )}

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
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password">Password</Label>
                            <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
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
                </CardContent>

                <CardFooter className="flex flex-col gap-4">
                    <Button
                        id="login-submit"
                        type="submit"
                        className="w-full"
                        disabled={isSubmitting || (authContext !== undefined && authContext !== null && authContext.isActive === true && authContext.tenantStatus === "active")}
                    >
                        {isSubmitting || (authContext !== undefined && authContext !== null && authContext.isActive === true && authContext.tenantStatus === "active") ? (
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
                        Don't have an account?{" "}
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
