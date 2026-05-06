import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSingleSearchParam } from "@/lib/shared/auth/password-reset";
import {
    buildProcurementOfficerAccessHref,
    resolvePublicEntryState,
    type PublicEntrySearchParams,
} from "@/lib/shared/auth/public-entry";
import { LoginForm } from "@/src/components/auth/LoginForm";

export const metadata: Metadata = {
    title: "Login - Procureline",
    description: "Sign in to Procureline to access your procurement workspace.",
};

interface LoginPageProps {
    searchParams: Promise<{
        activationCode?: string | string[] | undefined;
        activationToken?: string | string[] | undefined;
        invite?: string | string[] | undefined;
        reason?: string | string[] | undefined;
        role?: string | string[] | undefined;
    }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const resolvedSearchParams = await searchParams;
    const publicEntryState = resolvePublicEntryState(
        resolvedSearchParams as PublicEntrySearchParams,
    );

    if (publicEntryState.activeRole === "procurement_officer") {
        redirect(buildProcurementOfficerAccessHref(resolvedSearchParams));
    }

    return (
        <LoginForm
            reason={getSingleSearchParam(resolvedSearchParams.reason) ?? null}
        />
    );
}
