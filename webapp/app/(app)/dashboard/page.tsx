"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

export default function DashboardPage() {
    const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
    const router = useRouter();
    const tenantUser = useQuery(
        api.functions.users.getCurrentUserTenant,
        isAuthenticated ? {} : "skip",
    );

    useEffect(() => {
        if (authLoading) return;

        if (!isAuthenticated) {
            router.replace("/login");
            return;
        }
    }, [isAuthenticated, authLoading, router]);

    if (authLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <svg
                        className="h-8 w-8 animate-spin text-primary"
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
                    <p className="text-muted-foreground text-sm">Loading…</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
            <h1 className="text-3xl font-bold text-primary">
                Welcome to Procureline
            </h1>
            {tenantUser ? (
                <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                        Role: {tenantUser.role.replace("_", " ")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Your dashboard is being set up. More features coming soon!
                    </p>
                </div>
            ) : (
                <p className="text-muted-foreground">
                    Setting up your workspace…
                </p>
            )}
        </div>
    );
}
