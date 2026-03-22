"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { api } from "@/convex/_generated/api";
import { shouldTerminateAuthenticatedSession } from "@/lib/auth/roles";
import type { PlatformAdminRequestContext } from "@/lib/platform-admin/risk";
import { normalizeAuthEmail } from "@/lib/security/input";
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
};

interface PlatformAdminLoginFormProps {
    reason?: string | null;
    requestContext: PlatformAdminRequestContext;
}

export function PlatformAdminLoginForm({
    reason,
    requestContext,
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

    useEffect(() => {
        if (!isAuthenticated || authContext === undefined || authContext === null) {
            return;
        }

        const currentAuthContext = authContext;

        async function continuePlatformAdminSignIn(): Promise<void> {
            if (
                !currentAuthContext.isSessionValid ||
                shouldTerminateAuthenticatedSession(currentAuthContext)
            ) {
                await signOut();
                setIsSubmitting(false);
                setServerError(
                    ADMIN_REASON_MESSAGES[
                        currentAuthContext.redirectReason ?? "session_expired"
                    ] ?? "Platform Admin access is unavailable for this account.",
                );
                return;
            }

            try {
                const result = await beginPlatformAdminSignIn({
                    requestContext: {
                        city: requestContext.city ?? null,
                        country: requestContext.country ?? null,
                        ipAddress: requestContext.ipAddress ?? null,
                        region: requestContext.region ?? null,
                        userAgent: requestContext.userAgent ?? null,
                    },
                });
                setIsSubmitting(false);
                router.replace(result.redirectPath);
            } catch (error: unknown) {
                await signOut();
                setIsSubmitting(false);
                setServerError(
                    error instanceof Error
                        ? error.message
                        : "Platform Admin access is unavailable for this account.",
                );
            }
        }

        void continuePlatformAdminSignIn();
    }, [
        authContext,
        beginPlatformAdminSignIn,
        isAuthenticated,
        requestContext.city,
        requestContext.country,
        requestContext.ipAddress,
        requestContext.region,
        requestContext.userAgent,
        router,
        signOut,
    ]);

    async function onSubmit(data: LoginFormData): Promise<void> {
        setIsSubmitting(true);
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

                        {reason && !serverError ? (
                            <div
                                className="rounded-lg border border-emerald-300/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                                role="status"
                            >
                                {ADMIN_REASON_MESSAGES[reason] ?? ADMIN_REASON_MESSAGES.session_expired}
                            </div>
                        ) : null}

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
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
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
