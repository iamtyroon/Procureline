"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { getAuthNoticeMessage, getRoleLabel } from "@/lib/shared/auth/roles";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/src/components/ui/Spinner";

export default function DashboardPage() {
    const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const authContext = useQuery(
        api.functions.users.getAuthContext,
        isAuthenticated ? {} : "skip",
    );
    const membershipOptions = useQuery(
        api.functions.users.listCurrentActiveTenantMembershipOptions,
        isAuthenticated ? {} : "skip",
    );
    const setCurrentSessionActiveTenantSelection = useMutation(
        api.functions.sessions.setCurrentSessionActiveTenantSelection,
    );
    const [selectionError, setSelectionError] = useState<string | null>(null);
    const [selectingMembershipKey, setSelectingMembershipKey] = useState<
        string | null
    >(null);

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

    if (
        authLoading ||
        authContext === undefined ||
        membershipOptions === undefined
    ) {
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
    const showMembershipSelection =
        authContext?.accessState === "pending_access" &&
        membershipOptions.length > 0;
    type MembershipOption = NonNullable<typeof membershipOptions>[number];

    async function handleMembershipSelection(args: {
        tenantId: MembershipOption["tenantId"];
        tenantRole: MembershipOption["tenantRole"];
        tenantUserId: MembershipOption["tenantUserId"];
    }): Promise<void> {
        const membershipKey = `${args.tenantId}:${args.tenantUserId}`;
        setSelectingMembershipKey(membershipKey);
        setSelectionError(null);

        try {
            await setCurrentSessionActiveTenantSelection(args);
        } catch (error) {
            setSelectionError(
                error instanceof Error
                    ? error.message
                    : "We could not switch your workspace right now.",
            );
            setSelectingMembershipKey(null);
        }
    }

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
            {showMembershipSelection ? (
                <div className="w-full max-w-2xl space-y-3 rounded-xl border border-border/70 bg-background p-5 shadow-sm">
                    <div className="space-y-1 text-center">
                        <h2 className="text-lg font-semibold text-foreground">
                            Choose a workspace to continue
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Pick the tenant membership you want to use for this session.
                        </p>
                    </div>
                    <div className="grid gap-3">
                        {membershipOptions.map((membership) => {
                            const membershipKey = `${membership.tenantId}:${membership.tenantUserId}`;

                            return (
                                <button
                                    key={membershipKey}
                                    type="button"
                                    onClick={() => {
                                        void handleMembershipSelection(membership);
                                    }}
                                    disabled={selectingMembershipKey !== null}
                                    className="rounded-lg border border-border/70 bg-muted/20 px-4 py-4 text-left transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <div className="font-medium text-foreground">
                                        {membership.tenantName}
                                    </div>
                                    <div className="mt-1 text-sm text-muted-foreground">
                                        Continue as {getRoleLabel(membership.tenantRole)}
                                    </div>
                                    {selectingMembershipKey === membershipKey ? (
                                        <div className="mt-3">
                                            <Spinner />
                                        </div>
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>
                    {selectionError ? (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            {selectionError}
                        </div>
                    ) : null}
                </div>
            ) : null}
            {showMembershipSelection ? (
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                        router.refresh();
                    }}
                    disabled={selectingMembershipKey !== null}
                >
                    Refresh access
                </Button>
            ) : null}
        </div>
    );
}
