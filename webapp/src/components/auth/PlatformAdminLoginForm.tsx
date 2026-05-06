"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { api } from "@/convex/_generated/api";
import { shouldTerminateAuthenticatedSession } from "@/lib/shared/auth/roles";
import { normalizeAuthEmail } from "@/lib/shared/security/input";
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

const ADMIN_REASON_MESSAGES: Record<string, string> = {
    password_reset_required:
        "Your Platform Admin credentials were revoked. Reset your password before signing in again.",
    session_expired: "Your Platform Admin session expired. Sign in again to continue.",
    use_platform_admin_login:
        "Platform Admin accounts must use the dedicated internal admin sign-in path.",
};

interface PlatformAdminLoginFormProps {
    reason?: string | null;
    signedRequestContext: string;
}

export function PlatformAdminLoginForm({
    reason,
    signedRequestContext,
}: PlatformAdminLoginFormProps) {
    const { signIn, signOut } = useAuthActions();
    const { isAuthenticated } = useConvexAuth();
    const authContext = useQuery(
        api.functions.users.getAuthContext,
        isAuthenticated ? {} : "skip",
    );
    const beginPlatformAdminSignIn = useAction(
        api.functions.platformAdminAuth.beginPlatformAdminSignIn,
    );
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [hasAttemptedInitialization, setHasAttemptedInitialization] =
        useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const {
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

    const isAwaitingSecureContinuation =
        isAuthenticated && authContext?.role === "platform_admin";

    const reasonMessage = useMemo(() => {
        if (!reason) {
            return null;
        }

        return ADMIN_REASON_MESSAGES[reason] ?? ADMIN_REASON_MESSAGES.session_expired;
    }, [reason]);

    const continuePlatformAdminSignIn = useCallback(async (): Promise<void> => {
        setIsInitializing(true);
        setIsSubmitting(false);
        setServerError(null);

        try {
            const result = await beginPlatformAdminSignIn({
                signedRequestContext,
            });
            router.replace(result.redirectPath);
        } catch (error: unknown) {
            setServerError(
                error instanceof Error
                    ? error.message
                    : "Platform Admin access is unavailable for this account.",
            );
        } finally {
            setIsInitializing(false);
            setHasAttemptedInitialization(true);
        }
    }, [beginPlatformAdminSignIn, router, signedRequestContext]);

    useEffect(() => {
        if (!isAuthenticated || authContext === undefined || authContext === null) {
            return;
        }

        if (
            !authContext.isSessionValid ||
            shouldTerminateAuthenticatedSession(authContext)
        ) {
            void signOut().then(() => {
                setIsInitializing(false);
                setIsSubmitting(false);
                setServerError(
                    ADMIN_REASON_MESSAGES[
                        authContext.redirectReason ?? "session_expired"
                    ] ?? "Platform Admin access is unavailable for this account.",
                );
            });
            return;
        }

        if (authContext.role !== "platform_admin") {
            router.replace(authContext.homePath);
            return;
        }

        if (!hasAttemptedInitialization) {
            void continuePlatformAdminSignIn();
        }
    }, [
        authContext,
        continuePlatformAdminSignIn,
        hasAttemptedInitialization,
        isAuthenticated,
        router,
        signOut,
    ]);

    async function onSubmit(data: LoginFormData): Promise<void> {
        setIsSubmitting(true);
        setHasAttemptedInitialization(false);
        setServerError(null);

        try {
            const formData = new FormData();
            formData.set("email", normalizeAuthEmail(data.email));
            formData.set("password", data.password);
            formData.set("flow", "signIn");
            await signIn("password", formData);
        } catch (error: unknown) {
            setIsSubmitting(false);
            setServerError(
                error instanceof Error
                    ? error.message
                    : "Could not sign in. Please try again.",
            );
        }
    }

    async function handleRetry(): Promise<void> {
        setHasAttemptedInitialization(false);
        await continuePlatformAdminSignIn();
    }

    async function handleSignOut(): Promise<void> {
        await signOut();
        setHasAttemptedInitialization(false);
        setIsInitializing(false);
        setIsSubmitting(false);
        router.replace("/platform-admin/login");
    }

    return (
        <div className="space-y-6">
            <div className="rounded-[2rem] border border-slate-800 bg-slate-950 px-6 py-5 text-slate-100 shadow-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">
                    Internal Access
                </p>
                <h1 className="mt-3 text-3xl font-semibold">Platform Admin Console</h1>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
                    Procureline requires a separate admin sign-in flow with mandatory
                    email OTP verification, suspicious-login checks, and a 30-minute
                    privileged idle session window.
                </p>
            </div>

            <Card className="border-slate-200 shadow-xl">
                <CardHeader className="space-y-2 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                        <ShieldCheck className="h-7 w-7" />
                    </div>
                    <CardTitle className="text-2xl">Platform Admin Sign In</CardTitle>
                    <CardDescription>
                        Use your provisioned platform account. Tenant-scoped users cannot
                        continue into this route.
                    </CardDescription>
                </CardHeader>
                <form
                    onSubmit={(event) => {
                        void handleSubmit(onSubmit)(event);
                    }}
                >
                    <CardContent className="space-y-4">
                        {serverError ? (
                            <div
                                className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                                role="alert"
                            >
                                {serverError}
                            </div>
                        ) : null}

                        {reasonMessage && !serverError ? (
                            <div
                                className="rounded-lg border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                                role="status"
                            >
                                {reasonMessage}
                            </div>
                        ) : null}

                        {isAwaitingSecureContinuation ? (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                Primary credentials are valid. Continue into the secure
                                Platform Admin verification flow from this protected entry
                                point.
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="platform-admin-email">Email address</Label>
                                    <Input
                                        id="platform-admin-email"
                                        type="email"
                                        placeholder="platform.admin@procureline.com"
                                        autoComplete="email"
                                        {...register("email")}
                                        aria-invalid={errors.email ? "true" : undefined}
                                    />
                                    {errors.email ? (
                                        <p className="text-sm text-destructive">
                                            {errors.email.message}
                                        </p>
                                    ) : null}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="platform-admin-password">Password</Label>
                                    <Input
                                        id="platform-admin-password"
                                        type="password"
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                        {...register("password")}
                                        aria-invalid={errors.password ? "true" : undefined}
                                    />
                                    {errors.password ? (
                                        <p className="text-sm text-destructive">
                                            {errors.password.message}
                                        </p>
                                    ) : null}
                                </div>
                            </>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        {isAwaitingSecureContinuation ? (
                            <>
                                <Button
                                    type="button"
                                    className="w-full"
                                    disabled={isInitializing}
                                    onClick={() => {
                                        void handleRetry();
                                    }}
                                >
                                    {isInitializing ? (
                                        <span className="flex items-center gap-2">
                                            <LoaderCircle className="h-4 w-4 animate-spin" />
                                            Starting secure verification...
                                        </span>
                                    ) : (
                                        "Retry secure sign-in"
                                    )}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => {
                                        void handleSignOut();
                                    }}
                                >
                                    Sign out
                                </Button>
                            </>
                        ) : (
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <span className="flex items-center gap-2">
                                        <LoaderCircle className="h-4 w-4 animate-spin" />
                                        Securing sign in...
                                    </span>
                                ) : (
                                    "Continue to verification"
                                )}
                            </Button>
                        )}
                        <p className="text-center text-sm text-muted-foreground">
                            Need the standard workspace sign-in instead?{" "}
                            <Link href="/login" className="font-medium text-primary hover:underline">
                                Go to shared login
                            </Link>
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
