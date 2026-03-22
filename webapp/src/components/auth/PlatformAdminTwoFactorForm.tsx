"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { AlertTriangle, KeyRound, LoaderCircle, MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { api } from "@/convex/_generated/api";
import { shouldTerminateAuthenticatedSession } from "@/lib/auth/roles";
import { otpSchema, type OtpFormData } from "@/lib/validators/auth";
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

interface PlatformAdminTwoFactorFormProps {
    mode: "setup" | "verify";
}

export function PlatformAdminTwoFactorForm({
    mode,
}: PlatformAdminTwoFactorFormProps) {
    const { signOut } = useAuthActions();
    const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
    const authContext = useQuery(
        api.functions.users.getAuthContext,
        isAuthenticated ? {} : "skip",
    );
    const twoFactorState = useQuery(
        api.functions.platformAdminAuth.getCurrentTwoFactorState,
        isAuthenticated ? {} : "skip",
    );
    const issueCurrentTwoFactorChallenge = useAction(
        api.functions.platformAdminAuth.issueCurrentTwoFactorChallenge,
    );
    const verifyCurrentTwoFactorCode = useMutation(
        api.functions.platformAdminAuth.verifyCurrentTwoFactorCode,
    );
    const verifyCurrentBackupCode = useMutation(
        api.functions.platformAdminAuth.verifyCurrentBackupCode,
    );
    const router = useRouter();
    const [serverError, setServerError] = useState<string | null>(null);
    const [generatedBackupCodes, setGeneratedBackupCodes] = useState<string[]>([]);
    const [isBusy, setIsBusy] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [autoRequestedChallenge, setAutoRequestedChallenge] = useState(false);
    const [showBackupFallback, setShowBackupFallback] = useState(false);
    const [backupCode, setBackupCode] = useState("");
    const {
        register,
        handleSubmit,
        formState: { errors },
        reset,
    } = useForm<OtpFormData>({
        resolver: zodResolver(otpSchema),
        defaultValues: { code: "" },
    });

    const desiredStage = mode === "setup" ? "setup_required" : "verification_required";
    const title = useMemo(
        () =>
            mode === "setup"
                ? "Set Up Platform Admin 2FA"
                : "Verify Platform Admin Access",
        [mode],
    );

    useEffect(() => {
        if (resendCooldown <= 0) {
            return;
        }

        const timer = window.setTimeout(() => {
            setResendCooldown((current) => current - 1);
        }, 1000);

        return () => window.clearTimeout(timer);
    }, [resendCooldown]);

    useEffect(() => {
        if (authLoading || authContext === undefined) {
            return;
        }

        if (!isAuthenticated || authContext === null || !authContext.isSessionValid) {
            router.replace("/platform-admin/login?reason=session_expired");
            return;
        }

        if (shouldTerminateAuthenticatedSession(authContext)) {
            void signOut().then(() => {
                router.replace(
                    `/platform-admin/login?reason=${authContext.redirectReason ?? "session_expired"}`,
                );
            });
            return;
        }

        if (authContext.role !== "platform_admin") {
            router.replace(authContext.homePath);
            return;
        }

        if (authContext.platformAdminAuthStage === "verified") {
            router.replace("/platform-admin");
            return;
        }

        if (authContext.platformAdminAuthStage === "reset_required") {
            router.replace("/platform-admin/login?reason=password_reset_required");
            return;
        }

        if (authContext.platformAdminAuthStage !== desiredStage) {
            router.replace(
                authContext.platformAdminAuthStage === "setup_required"
                    ? "/platform-admin/setup-2fa"
                    : "/platform-admin/verify",
            );
        }
    }, [authContext, authLoading, desiredStage, isAuthenticated, router, signOut]);

    useEffect(() => {
        if (
            !isAuthenticated ||
            authContext === undefined ||
            authContext === null ||
            twoFactorState === undefined ||
            autoRequestedChallenge ||
            generatedBackupCodes.length > 0
        ) {
            return;
        }

        if (
            authContext.role === "platform_admin" &&
            authContext.platformAdminAuthStage === desiredStage &&
            twoFactorState.challengeExpiresAt === null
        ) {
            setAutoRequestedChallenge(true);
            setIsResending(true);
            void issueCurrentTwoFactorChallenge({})
                .then(() => {
                    setResendCooldown(60);
                })
                .catch((error: unknown) => {
                    setServerError(
                        error instanceof Error
                            ? error.message
                            : "Could not send a verification code.",
                    );
                    setAutoRequestedChallenge(false);
                })
                .finally(() => {
                    setIsResending(false);
                });
        }
    }, [
        authContext,
        autoRequestedChallenge,
        desiredStage,
        generatedBackupCodes.length,
        isAuthenticated,
        issueCurrentTwoFactorChallenge,
        twoFactorState,
    ]);

    async function handleCodeSubmit(values: OtpFormData): Promise<void> {
        setIsBusy(true);
        setServerError(null);

        try {
            const result = await verifyCurrentTwoFactorCode({
                code: values.code,
            });
            if (result.backupCodes.length > 0) {
                setGeneratedBackupCodes(result.backupCodes);
                reset({ code: "" });
                setShowBackupFallback(false);
            } else {
                router.replace(result.redirectPath);
            }
        } catch (error: unknown) {
            setServerError(
                error instanceof Error
                    ? error.message
                    : "Could not verify the Platform Admin code.",
            );
        } finally {
            setIsBusy(false);
        }
    }

    async function handleBackupCodeSubmit(): Promise<void> {
        setIsBusy(true);
        setServerError(null);

        try {
            const result = await verifyCurrentBackupCode({
                backupCode,
            });
            router.replace(result.redirectPath);
        } catch (error: unknown) {
            setServerError(
                error instanceof Error
                    ? error.message
                    : "Could not verify the backup code.",
            );
        } finally {
            setIsBusy(false);
        }
    }

    async function handleResend(): Promise<void> {
        if (resendCooldown > 0) {
            return;
        }

        setIsResending(true);
        setServerError(null);
        try {
            await issueCurrentTwoFactorChallenge({});
            setResendCooldown(60);
        } catch (error: unknown) {
            setServerError(
                error instanceof Error
                    ? error.message
                    : "Could not send a new verification code.",
            );
        } finally {
            setIsResending(false);
        }
    }

    if (authLoading || authContext === undefined || twoFactorState === undefined) {
        return (
            <div className="flex min-h-[18rem] items-center justify-center rounded-3xl border bg-background px-6">
                <div className="flex flex-col items-center gap-3 text-center">
                    <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                        Preparing Platform Admin verification...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <Card className="border-slate-200 shadow-xl">
            <CardHeader className="space-y-2 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-emerald-300">
                    {mode === "setup" ? (
                        <MailCheck className="h-7 w-7" />
                    ) : (
                        <KeyRound className="h-7 w-7" />
                    )}
                </div>
                <CardTitle className="text-2xl">{title}</CardTitle>
                <CardDescription>
                    {mode === "setup"
                        ? "Platform Admin access stays blocked until email OTP setup is finished and backup codes are generated."
                        : "Enter the email OTP challenge to continue. Backup codes are available if email delivery is unavailable."}
                </CardDescription>
            </CardHeader>
            <form
                onSubmit={(event) => {
                    if (showBackupFallback && mode === "verify") {
                        event.preventDefault();
                        void handleBackupCodeSubmit();
                        return;
                    }

                    void handleSubmit(handleCodeSubmit)(event);
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

                    {twoFactorState.riskLevel === "suspicious" ? (
                        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                                Procureline detected an unusual Platform Admin sign-in
                                context. The session will not be treated as trusted until
                                this challenge is completed.
                            </span>
                        </div>
                    ) : null}

                    {generatedBackupCodes.length > 0 ? (
                        <div className="space-y-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-4">
                            <p className="text-sm font-semibold text-emerald-900">
                                Save these backup codes now. They are shown once and stored
                                only as hashes after this step.
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {generatedBackupCodes.map((code) => (
                                    <div
                                        key={code}
                                        className="rounded-xl border border-emerald-200 bg-white px-3 py-2 font-mono text-sm font-semibold tracking-[0.14em] text-slate-900"
                                    >
                                        {code}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="platform-admin-code">
                                    {showBackupFallback && mode === "verify"
                                        ? "Backup code"
                                        : "Verification code"}
                                </Label>
                                {showBackupFallback && mode === "verify" ? (
                                    <Input
                                        id="platform-admin-backup-code"
                                        type="text"
                                        placeholder="ABCDE-FGHIJ"
                                        value={backupCode}
                                        onChange={(event) =>
                                            setBackupCode(event.target.value)
                                        }
                                        autoComplete="one-time-code"
                                    />
                                ) : (
                                    <Input
                                        id="platform-admin-code"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={8}
                                        placeholder="12345678"
                                        autoComplete="one-time-code"
                                        className="text-center text-lg font-mono tracking-[0.3em]"
                                        {...register("code")}
                                        aria-invalid={errors.code ? "true" : undefined}
                                    />
                                )}
                                {errors.code && !showBackupFallback ? (
                                    <p className="text-sm text-destructive">
                                        {errors.code.message}
                                    </p>
                                ) : null}
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                Verification challenge is bound to{" "}
                                <span className="font-semibold text-slate-900">
                                    {twoFactorState.maskedEmail}
                                </span>
                                . {mode === "verify"
                                    ? `Backup codes remaining: ${twoFactorState.backupCodesRemaining}.`
                                    : "Backup codes will be generated after setup succeeds."}
                            </div>
                        </>
                    )}
                </CardContent>

                <CardFooter className="flex flex-col gap-4">
                    {generatedBackupCodes.length > 0 ? (
                        <Button
                            type="button"
                            className="w-full"
                            onClick={() => router.replace("/platform-admin")}
                        >
                            I saved my backup codes
                        </Button>
                    ) : (
                        <>
                            <Button
                                type="submit"
                                className="w-full"
                                disabled={isBusy || isResending}
                            >
                                {isBusy ? (
                                    <span className="flex items-center gap-2">
                                        <LoaderCircle className="h-4 w-4 animate-spin" />
                                        Verifying...
                                    </span>
                                ) : showBackupFallback && mode === "verify" ? (
                                    "Use backup code"
                                ) : (
                                    "Verify access"
                                )}
                            </Button>

                            <div className="flex w-full items-center justify-between gap-3 text-sm">
                                <button
                                    type="button"
                                    className="text-muted-foreground transition-colors hover:text-foreground"
                                    disabled={isResending || resendCooldown > 0}
                                    onClick={() => {
                                        void handleResend();
                                    }}
                                >
                                    {resendCooldown > 0
                                        ? `Resend in ${resendCooldown}s`
                                        : isResending
                                            ? "Sending..."
                                            : "Resend code"}
                                </button>
                                {mode === "verify" && twoFactorState.backupCodesRemaining > 0 ? (
                                    <button
                                        type="button"
                                        className="font-medium text-primary transition-colors hover:underline"
                                        onClick={() =>
                                            setShowBackupFallback((current) => !current)
                                        }
                                    >
                                        {showBackupFallback
                                            ? "Use email OTP instead"
                                            : "Use backup code"}
                                    </button>
                                ) : null}
                            </div>
                        </>
                    )}
                </CardFooter>
            </form>
        </Card>
    );
}
