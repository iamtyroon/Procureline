import type { Metadata } from "next";
import { getSingleSearchParam } from "@/lib/auth/password-reset";
import { readSignedPlatformAdminRequestContext } from "@/lib/backend/platform-admin/request-context";
import { PlatformAdminLoginForm } from "@/src/components/auth/PlatformAdminLoginForm";

export const metadata: Metadata = {
    title: "Platform Admin Login - Procureline",
    description: "Secure sign-in for Procureline Platform Administrators.",
};

interface PlatformAdminLoginPageProps {
    searchParams: Promise<{
        reason?: string | string[] | undefined;
    }>;
}

export default async function PlatformAdminLoginPage({
    searchParams,
}: PlatformAdminLoginPageProps) {
    const resolvedSearchParams = await searchParams;
    const signedRequestContext = await readSignedPlatformAdminRequestContext();

    return (
        <PlatformAdminLoginForm
            reason={getSingleSearchParam(resolvedSearchParams.reason) ?? null}
            signedRequestContext={signedRequestContext}
        />
    );
}
