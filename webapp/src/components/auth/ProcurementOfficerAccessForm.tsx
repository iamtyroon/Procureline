"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { LockKeyhole } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { api } from "@/convex/_generated/api";
import { getPublicProcurementOfficerAccessErrorMessage } from "@/lib/errors/convex";
import {
    PROCUREMENT_OFFICER_AUTH_PROVIDER,
    PROCUREMENT_OFFICER_AUTH_VERIFY_FLOW,
    scrubProcurementOfficerHandoffFromUrl,
    type ResolvedProcurementOfficerHandoff,
} from "@/lib/procurement-officer/invitations";
import { clearRememberMeBootstrapValue } from "@/lib/auth/session";
import { shouldTerminateAuthenticatedSession } from "@/lib/auth/roles";
import { normalizeAuthEmail } from "@/lib/security/input";
import {
    procurementOfficerAccessRequestSchema,
    type ProcurementOfficerAccessRequestData,
} from "@/lib/validators/procurement-officer";
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

interface ProcurementOfficerAccessFormProps {
    backHref: string;
    initialHandoff: ResolvedProcurementOfficerHandoff;
}

export function ProcurementOfficerAccessForm({
    backHref,
    initialHandoff,
}: ProcurementOfficerAccessFormProps): JSX.Element {
    const { signIn, signOut } = useAuthActions();
    const { isAuthenticated } = useConvexAuth();
    const startAccessChallenge = useAction(
        api.functions.procurementOfficerOnboarding.startAccessChallenge,
    );
    const ensureCurrentSessionMetadata = useMutation(
        api.functions.sessions.ensureCurrentSessionMetadata,
    );
    const authContext = useQuery(
        api.functions.users.getAuthContext,
        isAuthenticated ? {} : "skip",
    );
    const handoffContext = useQuery(
        api.functions.procurementOfficerOnboarding.getInvitationAccessContext,
        initialHandoff.mode === null
            ? "skip"
            : {
                  activationCode: initialHandoff.activationCode,
                  inviteToken: initialHandoff.inviteToken,
              },
    );
    const router = useRouter();
    const [challengeId, setChallengeId] = useState<string | null>(null);
    const [challengeEmail, setChallengeEmail] = useState("");
    const [serverError, setServerError] = useState<string | null>(
        initialHandoff.error ?? null,
    );
    const [isStarting, setIsStarting] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [step, setStep] = useState<"access" | "otp">("access");

    const accessForm = useForm<ProcurementOfficerAccessRequestData>({
        resolver: zodResolver(procurementOfficerAccessRequestSchema),
        defaultValues: {
            activationCode: initialHandoff.activationCode,
            email: "",
            inviteToken: initialHandoff.inviteToken,
        },
    });
    const otpForm = useForm<OtpFormData>({
        resolver: zodResolver(otpSchema),
        defaultValues: {
            code: "",
        },
    });

    const inviteMode = initialHandoff.mode === "invite";
    const description = useMemo(() => {
        if (step === "otp") {
            return `We sent an 8-digit verification code to ${challengeEmail}.`;
        }

        if (inviteMode) {
            return "Confirm the invited email address and verify it to activate your Procurement Officer membership.";
        }

        return "Enter the activation code from your Tenant Admin and verify your email to continue.";
    }, [challengeEmail, inviteMode, step]);

    useEffect(() => {
        if (
            typeof window === "undefined" ||
            (!initialHandoff.activationCode &&
                !initialHandoff.inviteToken &&
                !initialHandoff.error)
        ) {
            return;
        }

        const sanitizedUrl = scrubProcurementOfficerHandoffFromUrl(
            window.location.pathname,
            window.location.search,
        );
        window.history.replaceState({}, document.title, sanitizedUrl);
    }, [
        initialHandoff.activationCode,
        initialHandoff.error,
        initialHandoff.inviteToken,
    ]);

    useEffect(() => {
        if (handoffContext && !handoffContext.isValid && handoffContext.message) {
            setServerError(handoffContext.message);
        }

        if (handoffContext?.email) {
            accessForm.setValue("email", handoffContext.email, {
                shouldDirty: false,
                shouldValidate: true,
            });
        }
    }, [accessForm, handoffContext]);

    useEffect(() => {
        if (!isAuthenticated || authContext === undefined || authContext === null) {
            return;
        }

        const currentAuthContext = authContext;

        async function completeAuthenticatedRedirect(): Promise<void> {
            if (
                !currentAuthContext.isSessionValid ||
                shouldTerminateAuthenticatedSession(currentAuthContext) ||
                currentAuthContext.accessState !== "allowed"
            ) {
                await signOut();
                clearRememberMeBootstrapValue();
                setServerError(
                    currentAuthContext.redirectReason === "subscription_inactive"
                        ? "Tenant deactivated. Contact Support."
                        : "Your Procurement Officer access is not available right now.",
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
        values: ProcurementOfficerAccessRequestData,
    ): Promise<void> {
        setIsStarting(true);
        setServerError(null);

        try {
            const result = await startAccessChallenge({
                activationCode: values.activationCode,
                email: normalizeAuthEmail(values.email),
                inviteToken: values.inviteToken,
            });

            setChallengeId(String(result.challengeId));
            setChallengeEmail(normalizeAuthEmail(values.email));
            otpForm.reset({ code: "" });
            setStep("otp");
        } catch (error) {
            setServerError(getPublicProcurementOfficerAccessErrorMessage(error));
        } finally {
            setIsStarting(false);
        }
    }

    async function handleOtpSubmit(values: OtpFormData): Promise<void> {
        if (!challengeId) {
            setServerError("Procurement Officer sign-in challenge expired. Start again.");
            setStep("access");
            return;
        }

        setIsVerifying(true);
        setServerError(null);

        try {
            const formData = new FormData();
            formData.set("challengeId", challengeId);
            formData.set("code", values.code.trim());
            formData.set("flow", PROCUREMENT_OFFICER_AUTH_VERIFY_FLOW);

            await signIn(PROCUREMENT_OFFICER_AUTH_PROVIDER, formData);
        } catch (error) {
            setServerError(getPublicProcurementOfficerAccessErrorMessage(error));
        } finally {
            setIsVerifying(false);
        }
    }

    const isBusy = isStarting || isVerifying;

    return (
        <Card className="border-border/50 shadow-lg">
            <CardHeader className="space-y-1 text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <LockKeyhole className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold">
                    Procurement Officer Access
                </CardTitle>
                <CardDescription>{description}</CardDescription>
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

                    {step === "access" ? (
                        <>
                            {!inviteMode ? (
                                <div className="space-y-2">
                                    <Label htmlFor="activationCode">Activation code</Label>
                                    <Input
                                        id="activationCode"
                                        type="text"
                                        placeholder="PO-ABCD-1234"
                                        autoComplete="off"
                                        {...accessForm.register("activationCode")}
                                    />
                                    {accessForm.formState.errors.activationCode ? (
                                        <p className="text-sm text-destructive">
                                            {accessForm.formState.errors.activationCode.message}
                                        </p>
                                    ) : null}
                                </div>
                            ) : null}

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    readOnly={inviteMode && Boolean(handoffContext?.email)}
                                    placeholder="po@institution.ac.ke"
                                    {...accessForm.register("email")}
                                />
                                {accessForm.formState.errors.email ? (
                                    <p className="text-sm text-destructive">
                                        {accessForm.formState.errors.email.message}
                                    </p>
                                ) : null}
                            </div>
                        </>
                    ) : (
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
                            />
                            {otpForm.formState.errors.code ? (
                                <p className="text-sm text-destructive">
                                    {otpForm.formState.errors.code.message}
                                </p>
                            ) : null}
                        </div>
                    )}
                </CardContent>

                <CardFooter className="flex flex-col gap-4">
                    <Button type="submit" className="w-full" disabled={isBusy}>
                        {step === "access"
                            ? isStarting
                                ? "Sending verification code..."
                                : "Continue"
                            : isVerifying
                                ? "Verifying..."
                                : "Verify and continue"}
                    </Button>

                    {step === "otp" ? (
                        <button
                            type="button"
                            onClick={() => {
                                setStep("access");
                                setServerError(null);
                            }}
                            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                            Back
                        </button>
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
