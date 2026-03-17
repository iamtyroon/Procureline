"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { getPublicDepartmentUserAccessErrorMessage } from "@/lib/errors/convex";
import {
    DEPARTMENT_USER_AUTH_PROVIDER,
    DEPARTMENT_USER_AUTH_VERIFY_FLOW,
    DEPARTMENT_USER_REMINDER_PLACEHOLDER,
    scrubDepartmentUserAccessCodeFromUrl,
} from "@/lib/auth/department-user-access";
import { clearRememberMeBootstrapValue } from "@/lib/auth/session";
import { shouldTerminateAuthenticatedSession } from "@/lib/auth/roles";
import { normalizeAuthEmail } from "@/lib/security/input";
import {
    departmentUserAccessRequestSchema,
    otpSchema,
    type DepartmentUserAccessRequestData,
    type OtpFormData,
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

interface DepartmentUserAccessFormProps {
    backHref: string;
    initialAccessCode?: string;
}

export function DepartmentUserAccessForm({
    backHref,
    initialAccessCode,
}: DepartmentUserAccessFormProps): JSX.Element {
    const { signIn, signOut } = useAuthActions();
    const { isAuthenticated } = useConvexAuth();
    const startAccessChallenge = useAction(
        api.functions.departmentUserAuth.startAccessChallenge,
    );
    const ensureCurrentSessionMetadata = useMutation(
        api.functions.sessions.ensureCurrentSessionMetadata,
    );
    const authContext = useQuery(
        api.functions.users.getAuthContext,
        isAuthenticated ? {} : "skip",
    );
    const router = useRouter();
    const [challengeId, setChallengeId] = useState<string | null>(null);
    const [challengeEmail, setChallengeEmail] = useState("");
    const [notice, setNotice] = useState<string | null>(null);
    const [serverError, setServerError] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [step, setStep] = useState<"access" | "otp">("access");

    const accessForm = useForm<DepartmentUserAccessRequestData>({
        resolver: zodResolver(departmentUserAccessRequestSchema),
        defaultValues: {
            accessCode: initialAccessCode ?? "",
            email: "",
        },
    });
    const otpForm = useForm<OtpFormData>({
        resolver: zodResolver(otpSchema),
        defaultValues: {
            code: "",
        },
    });

    useEffect(() => {
        if (!initialAccessCode || typeof window === "undefined") {
            return;
        }

        const sanitizedUrl = scrubDepartmentUserAccessCodeFromUrl(
            window.location.pathname,
            window.location.search,
        );
        window.history.replaceState({}, document.title, sanitizedUrl);
    }, [initialAccessCode]);

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
        if (!isAuthenticated || authContext === undefined || authContext === null) {
            return;
        }

        const currentAuthContext = authContext;

        async function completeAuthenticatedRedirect(): Promise<void> {
            if (
                !currentAuthContext.isSessionValid ||
                shouldTerminateAuthenticatedSession(currentAuthContext)
            ) {
                await signOut();
                clearRememberMeBootstrapValue();
                setServerError(
                    currentAuthContext.redirectReason === "subscription_inactive"
                        ? "Subscription inactive. Contact your administrator."
                        : "Your Department User access is not available right now.",
                );
                return;
            }

            try {
                await ensureCurrentSessionMetadata({});
                clearRememberMeBootstrapValue();
                router.replace(currentAuthContext.redirectPath);
            } catch {
                clearRememberMeBootstrapValue();
                await signOut();
                setServerError(
                    "We could not initialize your session. Please try again.",
                );
            }
        }

        void completeAuthenticatedRedirect();
    }, [
        authContext,
        ensureCurrentSessionMetadata,
        isAuthenticated,
        router,
        signOut,
    ]);

    async function handleAccessSubmit(
        values: DepartmentUserAccessRequestData,
    ): Promise<void> {
        setIsStarting(true);
        setServerError(null);

        try {
            const result = await startAccessChallenge({
                accessCode: values.accessCode,
                email: normalizeAuthEmail(values.email),
            });

            setChallengeId(String(result.challengeId));
            setChallengeEmail(normalizeAuthEmail(values.email));
            setNotice(result.notice);
            setResendCooldown(60);
            otpForm.reset({ code: "" });
            setStep("otp");
        } catch (error: unknown) {
            setServerError(getPublicDepartmentUserAccessErrorMessage(error));
        } finally {
            setIsStarting(false);
        }
    }

    async function handleOtpSubmit(values: OtpFormData): Promise<void> {
        if (!challengeId) {
            setServerError("Department User sign-in challenge expired. Start again.");
            setStep("access");
            return;
        }

        setIsVerifying(true);
        setServerError(null);

        try {
            const formData = new FormData();
            formData.set("challengeId", challengeId);
            formData.set("code", values.code.trim());
            formData.set("flow", DEPARTMENT_USER_AUTH_VERIFY_FLOW);

            await signIn(DEPARTMENT_USER_AUTH_PROVIDER, formData);
        } catch (error: unknown) {
            setServerError(getPublicDepartmentUserAccessErrorMessage(error));
        } finally {
            setIsVerifying(false);
        }
    }

    async function handleResend(): Promise<void> {
        if (resendCooldown > 0) {
            return;
        }

        const currentValues = accessForm.getValues();
        await handleAccessSubmit({
            accessCode: currentValues.accessCode,
            email: challengeEmail || currentValues.email,
        });
    }

    const isBusy = isStarting || isVerifying;

    return (
        <Card className="border-border/50 shadow-lg">
            <CardHeader className="space-y-1 text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <LockKeyhole className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold">
                    Department User Sign In
                </CardTitle>
                <CardDescription>
                    {step === "access"
                        ? "Enter your department access code and work email to receive a verification code."
                        : `We sent an 8-digit verification code to ${challengeEmail}.`}
                </CardDescription>
            </CardHeader>

            <form
                onSubmit={(event) => {
                    if (step === "access") {
                        void accessForm.handleSubmit(handleAccessSubmit)(event);
                        return;
                    }

                    void otpForm.handleSubmit(handleOtpSubmit)(event);
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

                    {notice ? (
                        <div
                            className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary"
                            role="status"
                        >
                            {notice}
                        </div>
                    ) : null}

                    {step === "access" ? (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="accessCode">Access code</Label>
                                <Input
                                    id="accessCode"
                                    type="text"
                                    placeholder="2026-CS-X7K9"
                                    autoComplete="off"
                                    {...accessForm.register("accessCode")}
                                    aria-invalid={
                                        accessForm.formState.errors.accessCode
                                            ? "true"
                                            : undefined
                                    }
                                />
                                {accessForm.formState.errors.accessCode ? (
                                    <p className="text-sm text-destructive">
                                        {accessForm.formState.errors.accessCode.message}
                                    </p>
                                ) : null}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Work email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="department.user@university.ac.ke"
                                    autoComplete="email"
                                    {...accessForm.register("email")}
                                    aria-invalid={
                                        accessForm.formState.errors.email ? "true" : undefined
                                    }
                                />
                                {accessForm.formState.errors.email ? (
                                    <p className="text-sm text-destructive">
                                        {accessForm.formState.errors.email.message}
                                    </p>
                                ) : null}
                            </div>
                        </>
                    ) : (
                        <>
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
                                    {...otpForm.register("code")}
                                    aria-invalid={
                                        otpForm.formState.errors.code ? "true" : undefined
                                    }
                                />
                                {otpForm.formState.errors.code ? (
                                    <p className="text-sm text-destructive">
                                        {otpForm.formState.errors.code.message}
                                    </p>
                                ) : null}
                            </div>
                        </>
                    )}

                    <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                        {DEPARTMENT_USER_REMINDER_PLACEHOLDER}
                    </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-4">
                    <Button type="submit" className="w-full" disabled={isBusy}>
                        {step === "access"
                            ? isStarting
                                ? "Sending verification code..."
                                : "Continue"
                            : isVerifying
                                ? "Verifying..."
                                : "Verify and sign in"}
                    </Button>

                    {step === "otp" ? (
                        <div className="flex w-full items-center justify-between text-sm">
                            <button
                                type="button"
                                onClick={() => {
                                    setStep("access");
                                    setServerError(null);
                                }}
                                className="text-muted-foreground transition-colors hover:text-foreground"
                            >
                                Back
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    void handleResend();
                                }}
                                disabled={resendCooldown > 0 || isStarting}
                                className="text-primary transition-colors hover:underline disabled:text-muted-foreground disabled:no-underline"
                            >
                                {resendCooldown > 0
                                    ? `Resend in ${resendCooldown}s`
                                    : "Resend code"}
                            </button>
                        </div>
                    ) : (
                        <p className="text-center text-sm text-muted-foreground">
                            Need another access path?{" "}
                            <Link
                                href={backHref}
                                className="font-medium text-primary hover:underline"
                            >
                                Return to the access portal
                            </Link>
                        </p>
                    )}
                </CardFooter>
            </form>
        </Card>
    );
}
