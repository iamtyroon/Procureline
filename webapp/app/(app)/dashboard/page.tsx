"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { getAuthNoticeMessage, getRoleLabel } from "@/lib/auth/roles";
import { Spinner } from "@/src/components/ui/Spinner";

export default function DashboardPage() {
    const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const authContext = useQuery(
        api.functions.users.getAuthContext,
        isAuthenticated ? {} : "skip",
    );

    useEffect(() => {
        if (authLoading) {
            return;
        }

        if (!isAuthenticated) {
            router.replace("/login");
            return;
        }

        if (
            authContext !== undefined &&
            authContext !== null &&
            authContext.isSessionValid &&
            authContext.isRoleResolved &&
            authContext.accessState === "allowed" &&
            authContext.homePath !== "/dashboard"
        ) {
            router.replace(authContext.homePath);
        }
    }, [authContext, authLoading, isAuthenticated, router]);

    if (authLoading || authContext === undefined) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Spinner />
                    <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    if (
        authContext !== null &&
        authContext.isSessionValid &&
        authContext.isRoleResolved &&
        authContext.accessState === "allowed" &&
        authContext.homePath !== "/dashboard"
    ) {
        return null;
    }

    const reasonMessage = getAuthNoticeMessage(searchParams.get("reason"));
    const statusTitle =
        authContext?.accessState === "misconfigured"
            ? "Role configuration needs attention"
            : "Access is pending";
    const statusDescription =
        authContext?.accessState === "misconfigured"
            ? "Procureline found conflicting or invalid role data for your account. Access is blocked until an administrator corrects it."
            : "Your account is authenticated, but no active application role is assigned yet. An administrator needs to grant access before a dashboard becomes available.";

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
            <h1 className="text-3xl font-bold text-primary">{statusTitle}</h1>
            {reasonMessage ? (
                <div className="max-w-xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
                    {reasonMessage}
                </div>
            ) : null}
            <div className="space-y-2 text-center">
                <p className="text-sm text-muted-foreground">{statusDescription}</p>
                {authContext ? (
                    <p className="text-sm text-muted-foreground">
                        Current access state: {authContext.accessState.replaceAll("_", " ")}
                        {" · "}
                        Display role: {getRoleLabel(authContext.role)}
                    </p>
                ) : null}
            </div>
        </div>
    );
}
