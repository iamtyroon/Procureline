"use client";

import { useEffect, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import {
    AUTH_ENTRY_SECTION_HASH,
    RECOGNIZED_PUBLIC_ENTRY_HANDOFF_PARAMS,
    getTrimmedSearchParam,
    resolveAuthenticatedAccessRedirect,
    type PublicEntrySearchParams,
} from "@/lib/auth/public-entry";
import { PublicAccessSection } from "@/src/components/marketing/PublicAccessSection";
import { Spinner } from "@/src/components/ui/Spinner";

interface HomepagePublicAccessExperienceProps {
    searchParams: PublicEntrySearchParams;
}

const ACCESS_TARGET_HASHES = new Set([
    AUTH_ENTRY_SECTION_HASH,
    "#role-guidance",
    "#department-access-next-steps",
]);

function hasAccessQueryIntent(searchParams: PublicEntrySearchParams): boolean {
    if (
        getTrimmedSearchParam(searchParams.role) ||
        getTrimmedSearchParam(searchParams.tier)
    ) {
        return true;
    }

    return RECOGNIZED_PUBLIC_ENTRY_HANDOFF_PARAMS.some((key) =>
        Boolean(getTrimmedSearchParam(searchParams[key])),
    );
}

export function HomepagePublicAccessExperience({
    searchParams,
}: HomepagePublicAccessExperienceProps): JSX.Element {
    const { isAuthenticated, isLoading } = useConvexAuth();
    const authContext = useQuery(
        api.functions.users.getAuthContext,
        isAuthenticated ? {} : "skip",
    );
    const router = useRouter();
    const [currentHash, setCurrentHash] = useState("");
    const [isRedirecting, setIsRedirecting] = useState(false);

    useEffect(() => {
        function syncHash(): void {
            setCurrentHash(window.location.hash);
        }

        syncHash();
        window.addEventListener("hashchange", syncHash);

        return () => {
            window.removeEventListener("hashchange", syncHash);
        };
    }, []);

    const shouldProtectAccessSurface =
        hasAccessQueryIntent(searchParams) || ACCESS_TARGET_HASHES.has(currentHash);

    useEffect(() => {
        if (
            !shouldProtectAccessSurface ||
            isLoading ||
            !isAuthenticated ||
            authContext === undefined
        ) {
            return;
        }

        const redirectTarget = resolveAuthenticatedAccessRedirect(authContext);
        if (!redirectTarget) {
            return;
        }

        setIsRedirecting(true);
        router.replace(redirectTarget);
    }, [
        authContext,
        isAuthenticated,
        isLoading,
        router,
        shouldProtectAccessSurface,
    ]);

    if (
        shouldProtectAccessSurface &&
        isAuthenticated &&
        (isLoading || authContext === undefined || isRedirecting)
    ) {
        return (
            <div className="flex min-h-[24rem] items-center justify-center bg-background px-6">
                <div className="flex flex-col items-center gap-3 text-center">
                    <Spinner />
                    <p className="text-sm text-muted-foreground">
                        Redirecting you to your workspace...
                    </p>
                </div>
            </div>
        );
    }

    return <PublicAccessSection searchParams={searchParams} selectionPathname="/" />;
}
