"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { Monitor, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

function formatVerificationMethod(
    verificationMethod: "email_otp" | "backup_code" | null,
): string {
    if (verificationMethod === "backup_code") {
        return "Backup code";
    }

    if (verificationMethod === "email_otp") {
        return "Email OTP";
    }

    return "Pending verification";
}

function formatSessionLocation(args: {
    ipAddress: string | null;
    location: string | null;
}): string {
    if (args.location) {
        return args.ipAddress
            ? `${args.location} (${args.ipAddress})`
            : args.location;
    }

    return args.ipAddress ?? "Location unavailable";
}

export function PlatformAdminSecurityCard() {
    const { signOut } = useAuthActions();
    const securityOverview = useQuery(
        api.functions.platformAdminAuth.getPlatformAdminSecurityOverview,
        {},
    );
    const revokeAllPlatformAdminSessions = useMutation(
        api.functions.platformAdminAuth.revokeAllPlatformAdminSessions,
    );
    const attemptDeleteCurrentPlatformAdminAccount = useMutation(
        api.functions.platformAdminAuth.attemptDeleteCurrentPlatformAdminAccount,
    );
    const router = useRouter();
    const [feedback, setFeedback] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isRevoking, setIsRevoking] = useState(false);

    async function handleRevokeAll(): Promise<void> {
        setIsRevoking(true);
        setError(null);
        setFeedback(null);

        try {
            await revokeAllPlatformAdminSessions({});
            await signOut();
            router.replace("/platform-admin/login?reason=password_reset_required");
        } catch (caughtError: unknown) {
            setError(
                caughtError instanceof Error
                    ? caughtError.message
                    : "Could not revoke Platform Admin sessions.",
            );
            setIsRevoking(false);
        }
    }

    async function handleDeleteAttempt(): Promise<void> {
        setError(null);
        setFeedback(null);

        try {
            await attemptDeleteCurrentPlatformAdminAccount({});
        } catch (caughtError: unknown) {
            setFeedback(
                caughtError instanceof Error
                    ? caughtError.message
                    : "Platform Admin accounts cannot be deleted",
            );
        }
    }

    if (securityOverview === undefined) {
        return (
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Platform Admin Security</CardTitle>
                    <CardDescription>Loading privileged session controls...</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card className="shadow-lg">
            <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-emerald-600" />
                    Platform Admin Security
                </CardTitle>
                <CardDescription>
                    Mandatory 2FA, active session visibility, immediate revoke-all,
                    and blocked account deletion guardrails live here until the full
                    Platform Admin shell lands in Story 2.2.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                {error ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {error}
                    </div>
                ) : null}
                {feedback ? (
                    <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        {feedback}
                    </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border bg-slate-50 px-4 py-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Backup Codes
                        </div>
                        <div className="mt-3 text-3xl font-semibold text-slate-900">
                            {securityOverview.backupCodesRemaining}
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                            Remaining one-time recovery codes.
                        </p>
                    </div>
                    <div className="rounded-2xl border bg-slate-50 px-4 py-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Last Trusted Login
                        </div>
                        <div className="mt-3 text-lg font-semibold text-slate-900">
                            {securityOverview.lastTrustedCountry ?? "Unavailable"}
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                            {securityOverview.lastTrustedAt
                                ? new Date(securityOverview.lastTrustedAt).toLocaleString()
                                : "No trusted Platform Admin login has been recorded yet."}
                        </p>
                    </div>
                    <div className="rounded-2xl border bg-slate-50 px-4 py-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Concurrent Sessions
                        </div>
                        <div className="mt-3 text-3xl font-semibold text-slate-900">
                            {securityOverview.sessions.length}
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                            Every active or recently revoked privileged session tracked server-side.
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    {securityOverview.sessions.map((session) => (
                        <div
                            key={String(session.sessionId)}
                            className="flex flex-col gap-3 rounded-2xl border px-4 py-4 md:flex-row md:items-center md:justify-between"
                        >
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                    <Monitor className="h-4 w-4 text-slate-500" />
                                    {session.isCurrent ? "Current browser" : "Tracked session"}
                                </div>
                                <p className="text-sm text-slate-600">
                                    {formatSessionLocation({
                                        ipAddress: session.ipAddress,
                                        location: session.location,
                                    })}
                                </p>
                                <p className="text-sm text-slate-600">
                                    {session.userAgent ?? "User agent unavailable"}
                                </p>
                                <p className="text-xs text-slate-500">
                                    Last activity: {new Date(session.lastActivityAt).toLocaleString()}
                                </p>
                                <p className="text-xs text-slate-500">
                                    Status: {session.status.replaceAll("_", " ")} | Method: {formatVerificationMethod(session.verificationMethod)}
                                </p>
                                {session.revocationReason ? (
                                    <p className="text-xs text-amber-700">
                                        Revocation reason: {session.revocationReason.replaceAll("_", " ")}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <Button
                    type="button"
                    variant="destructive"
                    disabled={isRevoking}
                    onClick={() => {
                        void handleRevokeAll();
                    }}
                >
                    {isRevoking ? "Revoking..." : "Revoke all admin sessions"}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                        void handleDeleteAttempt();
                    }}
                >
                    Attempt account deletion
                </Button>
            </CardFooter>
        </Card>
    );
}
